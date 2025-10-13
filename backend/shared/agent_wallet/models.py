"""
Agent Wallet & Booking Fees Models
Manages agent wallet balance, booking fees, and transaction history
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from enum import Enum
import uuid

Base = declarative_base()

class TransactionType(Enum):
    """Types of wallet transactions"""
    BOOKING_FEE = "booking_fee"      # 20 Rs deducted when agent accepts booking
    REFUND = "refund"                # Refund when booking is cancelled
    RECHARGE = "recharge"            # Agent wallet top-up (for future implementation)
    BONUS = "bonus"                  # Bonus credits from admin
    PENALTY = "penalty"              # Deductions for violations
    ADJUSTMENT = "adjustment"        # Manual balance adjustments

class TransactionStatus(Enum):
    """Transaction processing status"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"

class AgentWallet(Base):
    """
    Agent wallet balance and configuration
    """
    __tablename__ = "agent_wallets"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), unique=True, nullable=False, index=True)
    
    # Balance Information
    current_balance = Column(Float, default=0.0, nullable=False)  # Current available balance
    reserved_balance = Column(Float, default=0.0, nullable=False)  # Reserved for pending transactions
    total_earned = Column(Float, default=0.0, nullable=False)  # Lifetime earnings (from recharges/bonuses)
    total_spent = Column(Float, default=0.0, nullable=False)  # Lifetime spent on booking fees
    
    # Wallet Settings
    minimum_balance = Column(Float, default=20.0, nullable=False)  # Minimum balance to stay online
    auto_offline_enabled = Column(Boolean, default=True, nullable=False)  # Auto-offline when balance low
    low_balance_threshold = Column(Float, default=50.0, nullable=False)  # Warning threshold
    
    # Status Tracking
    is_active = Column(Boolean, default=True, nullable=False)
    is_suspended = Column(Boolean, default=False, nullable=False)  # Admin suspension
    last_transaction_at = Column(DateTime, nullable=True)
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<AgentWallet(agent_id={self.agent_id}, balance={self.current_balance})>"
    
    @property
    def available_balance(self):
        """Available balance excluding reserved amounts"""
        return max(0, self.current_balance - self.reserved_balance)
    
    @property
    def can_accept_bookings(self):
        """Check if agent has sufficient balance to accept new bookings"""
        return (
            self.is_active and 
            not self.is_suspended and 
            self.available_balance >= self.minimum_balance
        )
    
    @property
    def needs_recharge(self):
        """Check if wallet needs recharging"""
        return self.current_balance < self.low_balance_threshold

class WalletTransaction(Base):
    """
    Individual wallet transactions with complete audit trail
    """
    __tablename__ = "wallet_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(36), default=lambda: str(uuid.uuid4()), unique=True, nullable=False, index=True)
    
    # Wallet Reference
    wallet_id = Column(Integer, ForeignKey('agent_wallets.id'), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False, index=True)  # Denormalized for queries
    
    # Transaction Details
    transaction_type = Column(SQLEnum(TransactionType), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # Positive for credits, negative for debits
    balance_before = Column(Float, nullable=False)  # Balance before this transaction
    balance_after = Column(Float, nullable=False)  # Balance after this transaction
    
    # Transaction Status
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False, index=True)
    processed_at = Column(DateTime, nullable=True)
    
    # Reference Information
    booking_id = Column(String(36), nullable=True, index=True)  # Related booking if applicable
    reference_id = Column(String(255), nullable=True)  # External reference (payment gateway, etc.)
    
    # Description and Metadata
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)  # Internal notes
    metadata = Column(Text, nullable=True)  # JSON metadata for additional info
    
    # Processing Information
    processed_by_user_id = Column(Integer, nullable=True)  # Who processed this transaction
    processed_by_type = Column(String(50), nullable=True)  # system, admin, agent, etc.
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    wallet = relationship("AgentWallet", back_populates="transactions")
    
    def __repr__(self):
        return f"<WalletTransaction(id={self.transaction_id}, type={self.transaction_type.value}, amount={self.amount})>"

class BookingFeeRecord(Base):
    """
    Specific tracking for booking fees and refunds
    Links wallet transactions to booking lifecycle
    """
    __tablename__ = "booking_fee_records"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Booking Information
    booking_id = Column(String(36), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False, index=True)
    
    # Fee Information
    fee_amount = Column(Float, default=20.0, nullable=False)  # Standard booking fee
    fee_transaction_id = Column(Integer, ForeignKey('wallet_transactions.id'), nullable=True)
    fee_charged_at = Column(DateTime, nullable=True)
    
    # Refund Information
    refund_amount = Column(Float, default=0.0, nullable=False)
    refund_transaction_id = Column(Integer, ForeignKey('wallet_transactions.id'), nullable=True)
    refund_processed_at = Column(DateTime, nullable=True)
    refund_reason = Column(String(255), nullable=True)
    
    # Status Tracking
    is_fee_charged = Column(Boolean, default=False, nullable=False)
    is_refunded = Column(Boolean, default=False, nullable=False)
    is_disputed = Column(Boolean, default=False, nullable=False)
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<BookingFeeRecord(booking_id={self.booking_id}, fee={self.fee_amount}, refunded={self.is_refunded})>"

class WalletAlert(Base):
    """
    Wallet-related alerts and notifications for agents
    """
    __tablename__ = "wallet_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False, index=True)
    
    # Alert Information
    alert_type = Column(String(50), nullable=False, index=True)  # low_balance, insufficient_funds, etc.
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    message = Column(Text, nullable=False)
    
    # Alert Status
    is_read = Column(Boolean, default=False, nullable=False)
    is_dismissed = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime, nullable=True)
    dismissed_at = Column(DateTime, nullable=True)
    
    # Trigger Information
    trigger_balance = Column(Float, nullable=True)  # Balance that triggered this alert
    trigger_transaction_id = Column(Integer, ForeignKey('wallet_transactions.id'), nullable=True)
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<WalletAlert(agent_id={self.agent_id}, type={self.alert_type}, read={self.is_read})>"

# Database indexes for performance optimization
"""
CREATE INDEX idx_wallet_transactions_agent_created ON wallet_transactions(agent_id, created_at DESC);
CREATE INDEX idx_wallet_transactions_booking ON wallet_transactions(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_type_status ON wallet_transactions(transaction_type, status);
CREATE INDEX idx_booking_fee_records_booking ON booking_fee_records(booking_id);
CREATE INDEX idx_booking_fee_records_agent_created ON booking_fee_records(agent_id, created_at DESC);
CREATE INDEX idx_wallet_alerts_agent_unread ON wallet_alerts(agent_id, is_read, created_at DESC);
"""