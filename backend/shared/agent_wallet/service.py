"""
Agent Wallet Service
Business logic for wallet operations, booking fees, and balance management
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
import json

from .models import (
    AgentWallet, WalletTransaction, BookingFeeRecord, WalletAlert,
    TransactionType, TransactionStatus
)

logger = logging.getLogger(__name__)

class WalletService:
    """
    Service for managing agent wallets and transactions
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.booking_fee_amount = 20.0  # Standard booking fee
        self.minimum_balance = 20.0     # Minimum balance to stay online
    
    def get_or_create_wallet(self, agent_id: int) -> AgentWallet:
        """
        Get existing wallet or create new one for agent
        """
        try:
            wallet = self.db.query(AgentWallet).filter(
                AgentWallet.agent_id == agent_id
            ).first()
            
            if not wallet:
                wallet = AgentWallet(
                    agent_id=agent_id,
                    current_balance=0.0,
                    minimum_balance=self.minimum_balance
                )
                self.db.add(wallet)
                self.db.commit()
                self.db.refresh(wallet)
                
                logger.info(f"💳 Created new wallet for agent {agent_id}")
            
            return wallet
            
        except Exception as e:
            logger.error(f"Error getting/creating wallet for agent {agent_id}: {e}")
            self.db.rollback()
            raise
    
    def check_balance_for_booking(self, agent_id: int) -> Dict[str, Any]:
        """
        Check if agent has sufficient balance to accept a booking
        Returns balance info and eligibility status
        """
        try:
            wallet = self.get_or_create_wallet(agent_id)
            
            can_accept = wallet.can_accept_bookings
            available_balance = wallet.available_balance
            
            return {
                "can_accept_booking": can_accept,
                "current_balance": wallet.current_balance,
                "available_balance": available_balance,
                "minimum_required": self.booking_fee_amount,
                "wallet_active": wallet.is_active,
                "wallet_suspended": wallet.is_suspended,
                "needs_recharge": wallet.needs_recharge
            }
            
        except Exception as e:
            logger.error(f"Error checking balance for agent {agent_id}: {e}")
            return {
                "can_accept_booking": False,
                "error": str(e)
            }
    
    def charge_booking_fee(self, agent_id: int, booking_id: str, description: Optional[str] = None) -> Dict[str, Any]:
        """
        Charge booking fee when agent accepts a booking
        """
        try:
            wallet = self.get_or_create_wallet(agent_id)
            
            # Check if already charged for this booking
            existing_fee = self.db.query(BookingFeeRecord).filter(
                and_(
                    BookingFeeRecord.booking_id == booking_id,
                    BookingFeeRecord.agent_id == agent_id,
                    BookingFeeRecord.is_fee_charged == True
                )
            ).first()
            
            if existing_fee:
                return {
                    "success": False,
                    "error": "Booking fee already charged for this booking",
                    "fee_record_id": existing_fee.id
                }
            
            # Check sufficient balance
            if wallet.available_balance < self.booking_fee_amount:
                # Create alert for insufficient funds
                self.create_wallet_alert(
                    agent_id=agent_id,
                    alert_type="insufficient_funds",
                    severity="critical",
                    message=f"Insufficient balance to accept booking. Required: ₹{self.booking_fee_amount}, Available: ₹{wallet.available_balance}",
                    trigger_balance=wallet.current_balance
                )
                
                return {
                    "success": False,
                    "error": "Insufficient wallet balance",
                    "required": self.booking_fee_amount,
                    "available": wallet.available_balance
                }
            
            # Create transaction
            transaction = WalletTransaction(
                wallet_id=wallet.id,
                agent_id=agent_id,
                transaction_type=TransactionType.BOOKING_FEE,
                amount=-self.booking_fee_amount,  # Negative for debit
                balance_before=wallet.current_balance,
                balance_after=wallet.current_balance - self.booking_fee_amount,
                booking_id=booking_id,
                description=description or f"Booking fee for booking {booking_id}",
                status=TransactionStatus.COMPLETED,
                processed_at=datetime.utcnow(),
                processed_by_type="system"
            )
            
            # Update wallet balance
            wallet.current_balance -= self.booking_fee_amount
            wallet.total_spent += self.booking_fee_amount
            wallet.last_transaction_at = datetime.utcnow()
            
            # Create booking fee record
            fee_record = BookingFeeRecord(
                booking_id=booking_id,
                agent_id=agent_id,
                fee_amount=self.booking_fee_amount,
                is_fee_charged=True,
                fee_charged_at=datetime.utcnow()
            )
            
            # Save all changes
            self.db.add(transaction)
            self.db.add(fee_record)
            self.db.commit()
            
            # Link transaction to fee record
            fee_record.fee_transaction_id = transaction.id
            self.db.commit()
            
            # Check if wallet balance is low after transaction
            if wallet.current_balance < wallet.low_balance_threshold:
                self.create_wallet_alert(
                    agent_id=agent_id,
                    alert_type="low_balance",
                    severity="high" if wallet.current_balance < wallet.minimum_balance else "medium",
                    message=f"Wallet balance is low: ₹{wallet.current_balance}. Please recharge soon.",
                    trigger_balance=wallet.current_balance,
                    trigger_transaction_id=transaction.id
                )
            
            logger.info(f"💸 Charged booking fee: Agent {agent_id}, Booking {booking_id}, Amount ₹{self.booking_fee_amount}")
            
            return {
                "success": True,
                "transaction_id": transaction.transaction_id,
                "fee_record_id": fee_record.id,
                "amount_charged": self.booking_fee_amount,
                "new_balance": wallet.current_balance,
                "wallet_status": "active" if wallet.can_accept_bookings else "insufficient_balance"
            }
            
        except Exception as e:
            logger.error(f"Error charging booking fee for agent {agent_id}, booking {booking_id}: {e}")
            self.db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
    
    def process_booking_refund(self, agent_id: int, booking_id: str, reason: str) -> Dict[str, Any]:
        """
        Process refund when booking is cancelled
        """
        try:
            # Find the booking fee record
            fee_record = self.db.query(BookingFeeRecord).filter(
                and_(
                    BookingFeeRecord.booking_id == booking_id,
                    BookingFeeRecord.agent_id == agent_id,
                    BookingFeeRecord.is_fee_charged == True,
                    BookingFeeRecord.is_refunded == False
                )
            ).first()
            
            if not fee_record:
                return {
                    "success": False,
                    "error": "No chargeable booking fee found for this booking"
                }
            
            wallet = self.get_or_create_wallet(agent_id)
            refund_amount = fee_record.fee_amount
            
            # Create refund transaction
            refund_transaction = WalletTransaction(
                wallet_id=wallet.id,
                agent_id=agent_id,
                transaction_type=TransactionType.REFUND,
                amount=refund_amount,  # Positive for credit
                balance_before=wallet.current_balance,
                balance_after=wallet.current_balance + refund_amount,
                booking_id=booking_id,
                description=f"Refund for cancelled booking {booking_id}",
                notes=f"Cancellation reason: {reason}",
                status=TransactionStatus.COMPLETED,
                processed_at=datetime.utcnow(),
                processed_by_type="system"
            )
            
            # Update wallet balance
            wallet.current_balance += refund_amount
            wallet.last_transaction_at = datetime.utcnow()
            
            # Update fee record
            fee_record.is_refunded = True
            fee_record.refund_amount = refund_amount
            fee_record.refund_processed_at = datetime.utcnow()
            fee_record.refund_reason = reason
            
            # Save changes
            self.db.add(refund_transaction)
            self.db.commit()
            
            # Link refund transaction to fee record
            fee_record.refund_transaction_id = refund_transaction.id
            self.db.commit()
            
            logger.info(f"💰 Processed refund: Agent {agent_id}, Booking {booking_id}, Amount ₹{refund_amount}")
            
            return {
                "success": True,
                "refund_transaction_id": refund_transaction.transaction_id,
                "refund_amount": refund_amount,
                "new_balance": wallet.current_balance,
                "fee_record_id": fee_record.id
            }
            
        except Exception as e:
            logger.error(f"Error processing refund for agent {agent_id}, booking {booking_id}: {e}")
            self.db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_wallet_summary(self, agent_id: int) -> Dict[str, Any]:
        """
        Get comprehensive wallet summary for agent
        """
        try:
            wallet = self.get_or_create_wallet(agent_id)
            
            # Get recent transactions
            recent_transactions = self.db.query(WalletTransaction).filter(
                WalletTransaction.agent_id == agent_id
            ).order_by(desc(WalletTransaction.created_at)).limit(10).all()
            
            # Get unread alerts
            unread_alerts = self.db.query(WalletAlert).filter(
                and_(
                    WalletAlert.agent_id == agent_id,
                    WalletAlert.is_read == False
                )
            ).count()
            
            # Calculate statistics for last 30 days
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            
            recent_stats = self.db.query(
                func.count(WalletTransaction.id).label('transaction_count'),
                func.sum(WalletTransaction.amount).label('net_amount'),
                func.sum(func.case([(WalletTransaction.amount < 0, -WalletTransaction.amount)], else_=0)).label('total_spent'),
                func.sum(func.case([(WalletTransaction.amount > 0, WalletTransaction.amount)], else_=0)).label('total_received')
            ).filter(
                and_(
                    WalletTransaction.agent_id == agent_id,
                    WalletTransaction.created_at >= thirty_days_ago,
                    WalletTransaction.status == TransactionStatus.COMPLETED
                )
            ).first()
            
            return {
                "wallet_id": wallet.id,
                "current_balance": wallet.current_balance,
                "available_balance": wallet.available_balance,
                "reserved_balance": wallet.reserved_balance,
                "minimum_balance": wallet.minimum_balance,
                "can_accept_bookings": wallet.can_accept_bookings,
                "needs_recharge": wallet.needs_recharge,
                "is_active": wallet.is_active,
                "is_suspended": wallet.is_suspended,
                "last_transaction_at": wallet.last_transaction_at,
                "recent_transactions": [
                    {
                        "id": t.transaction_id,
                        "type": t.transaction_type.value,
                        "amount": t.amount,
                        "balance_after": t.balance_after,
                        "description": t.description,
                        "created_at": t.created_at,
                        "booking_id": t.booking_id
                    } for t in recent_transactions
                ],
                "unread_alerts": unread_alerts,
                "monthly_stats": {
                    "transaction_count": recent_stats.transaction_count or 0,
                    "net_amount": float(recent_stats.net_amount or 0),
                    "total_spent": float(recent_stats.total_spent or 0),
                    "total_received": float(recent_stats.total_received or 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting wallet summary for agent {agent_id}: {e}")
            return {
                "error": str(e)
            }
    
    def create_wallet_alert(self, agent_id: int, alert_type: str, severity: str, 
                           message: str, trigger_balance: Optional[float] = None,
                           trigger_transaction_id: Optional[int] = None) -> WalletAlert:
        """
        Create wallet alert for agent
        """
        try:
            alert = WalletAlert(
                agent_id=agent_id,
                alert_type=alert_type,
                severity=severity,
                message=message,
                trigger_balance=trigger_balance,
                trigger_transaction_id=trigger_transaction_id
            )
            
            self.db.add(alert)
            self.db.commit()
            self.db.refresh(alert)
            
            logger.info(f"🚨 Created wallet alert: Agent {agent_id}, Type {alert_type}")
            return alert
            
        except Exception as e:
            logger.error(f"Error creating wallet alert: {e}")
            self.db.rollback()
            raise
    
    def get_agents_with_low_balance(self, threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Get list of agents with low wallet balance
        Used for monitoring and notifications
        """
        try:
            threshold = threshold or self.minimum_balance
            
            low_balance_wallets = self.db.query(AgentWallet).filter(
                and_(
                    AgentWallet.current_balance < threshold,
                    AgentWallet.is_active == True,
                    AgentWallet.is_suspended == False
                )
            ).all()
            
            result = []
            for wallet in low_balance_wallets:
                result.append({
                    "agent_id": wallet.agent_id,
                    "current_balance": wallet.current_balance,
                    "minimum_balance": wallet.minimum_balance,
                    "can_accept_bookings": wallet.can_accept_bookings,
                    "last_transaction_at": wallet.last_transaction_at
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting agents with low balance: {e}")
            return []
    
    def should_agent_be_offline(self, agent_id: int) -> Tuple[bool, str]:
        """
        Check if agent should be forced offline due to insufficient balance
        """
        try:
            wallet = self.get_or_create_wallet(agent_id)
            
            if not wallet.can_accept_bookings:
                if wallet.is_suspended:
                    return True, "Wallet is suspended"
                elif not wallet.is_active:
                    return True, "Wallet is inactive"
                elif wallet.available_balance < wallet.minimum_balance:
                    return True, f"Insufficient balance (₹{wallet.current_balance} < ₹{wallet.minimum_balance})"
            
            return False, "Wallet balance sufficient"
            
        except Exception as e:
            logger.error(f"Error checking if agent should be offline: {e}")
            return True, f"Error checking wallet status: {str(e)}"