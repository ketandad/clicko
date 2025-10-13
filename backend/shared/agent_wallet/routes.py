"""
Agent Wallet API Routes
REST endpoints for wallet operations and balance management
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime
import logging

from .service import WalletService
from .models import TransactionType

router = APIRouter()
logger = logging.getLogger(__name__)

# Pydantic models for API requests and responses
class WalletBalanceResponse(BaseModel):
    current_balance: float
    available_balance: float
    can_accept_bookings: bool
    minimum_required: float
    needs_recharge: bool

class ChargeBookingFeeRequest(BaseModel):
    agent_id: int
    booking_id: str
    description: Optional[str] = None

class ProcessRefundRequest(BaseModel):
    agent_id: int
    booking_id: str
    reason: str

class WalletSummaryResponse(BaseModel):
    wallet_id: int
    current_balance: float
    available_balance: float
    can_accept_bookings: bool
    needs_recharge: bool
    unread_alerts: int
    monthly_stats: Dict[str, Any]

# Dependency to get database session (placeholder)
def get_db():
    # This would return actual database session
    return None

# Dependency for authentication (placeholder)
def get_current_user():
    return {"user_id": 1, "is_agent": True}

@router.get("/balance/{agent_id}", response_model=WalletBalanceResponse)
async def get_agent_wallet_balance(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get agent wallet balance and eligibility status
    """
    try:
        # Verify access (agent can only see their own wallet or admin access)
        if current_user.get("user_id") != agent_id and not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        wallet_service = WalletService(db)
        balance_info = wallet_service.check_balance_for_booking(agent_id)
        
        if "error" in balance_info:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=balance_info["error"]
            )
        
        return WalletBalanceResponse(
            current_balance=balance_info["current_balance"],
            available_balance=balance_info["available_balance"],
            can_accept_bookings=balance_info["can_accept_booking"],
            minimum_required=balance_info["minimum_required"],
            needs_recharge=balance_info["needs_recharge"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting wallet balance for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get balance: {str(e)}"
        )

@router.post("/charge-booking-fee")
async def charge_booking_fee(
    request: ChargeBookingFeeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Charge booking fee when agent accepts booking
    """
    try:
        wallet_service = WalletService(db)
        
        result = wallet_service.charge_booking_fee(
            agent_id=request.agent_id,
            booking_id=request.booking_id,
            description=request.description
        )
        
        if not result["success"]:
            # If insufficient funds, agent should be marked offline
            if "Insufficient wallet balance" in result.get("error", ""):
                background_tasks.add_task(
                    notify_agent_insufficient_balance,
                    request.agent_id,
                    result.get("available", 0)
                )
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        # Log successful charge
        logger.info(f"💸 Booking fee charged: Agent {request.agent_id}, Booking {request.booking_id}")
        
        return {
            "success": True,
            "message": f"Booking fee of ₹{result['amount_charged']} charged successfully",
            "transaction_id": result["transaction_id"],
            "new_balance": result["new_balance"],
            "wallet_status": result["wallet_status"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error charging booking fee: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to charge fee: {str(e)}"
        )

@router.post("/process-refund")
async def process_booking_refund(
    request: ProcessRefundRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Process refund when booking is cancelled
    """
    try:
        wallet_service = WalletService(db)
        
        result = wallet_service.process_booking_refund(
            agent_id=request.agent_id,
            booking_id=request.booking_id,
            reason=request.reason
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["error"]
            )
        
        logger.info(f"💰 Refund processed: Agent {request.agent_id}, Booking {request.booking_id}")
        
        return {
            "success": True,
            "message": f"Refund of ₹{result['refund_amount']} processed successfully",
            "refund_transaction_id": result["refund_transaction_id"],
            "new_balance": result["new_balance"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing refund: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process refund: {str(e)}"
        )

@router.get("/summary/{agent_id}", response_model=WalletSummaryResponse)
async def get_wallet_summary(
    agent_id: int,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get comprehensive wallet summary for agent
    """
    try:
        # Verify access
        if current_user.get("user_id") != agent_id and not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        wallet_service = WalletService(db)
        summary = wallet_service.get_wallet_summary(agent_id)
        
        if "error" in summary:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=summary["error"]
            )
        
        return WalletSummaryResponse(
            wallet_id=summary["wallet_id"],
            current_balance=summary["current_balance"],
            available_balance=summary["available_balance"],
            can_accept_bookings=summary["can_accept_bookings"],
            needs_recharge=summary["needs_recharge"],
            unread_alerts=summary["unread_alerts"],
            monthly_stats=summary["monthly_stats"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting wallet summary for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get summary: {str(e)}"
        )

@router.get("/transactions/{agent_id}")
async def get_wallet_transactions(
    agent_id: int,
    limit: int = 50,
    offset: int = 0,
    transaction_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get wallet transaction history
    """
    try:
        # Verify access
        if current_user.get("user_id") != agent_id and not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        wallet_service = WalletService(db)
        
        # Get transactions with filters
        from .models import WalletTransaction, TransactionStatus
        from sqlalchemy import and_, desc
        
        query = db.query(WalletTransaction).filter(
            WalletTransaction.agent_id == agent_id
        )
        
        if transaction_type:
            query = query.filter(WalletTransaction.transaction_type == transaction_type)
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination and ordering
        transactions = query.order_by(
            desc(WalletTransaction.created_at)
        ).offset(offset).limit(limit).all()
        
        transaction_data = []
        for t in transactions:
            transaction_data.append({
                "id": t.transaction_id,
                "type": t.transaction_type.value,
                "amount": t.amount,
                "balance_before": t.balance_before,
                "balance_after": t.balance_after,
                "status": t.status.value,
                "description": t.description,
                "booking_id": t.booking_id,
                "created_at": t.created_at.isoformat(),
                "processed_at": t.processed_at.isoformat() if t.processed_at else None
            })
        
        return {
            "transactions": transaction_data,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": total_count > (offset + limit)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transactions for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get transactions: {str(e)}"
        )

@router.get("/alerts/{agent_id}")
async def get_wallet_alerts(
    agent_id: int,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get wallet alerts for agent
    """
    try:
        # Verify access
        if current_user.get("user_id") != agent_id and not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        from .models import WalletAlert
        from sqlalchemy import and_, desc
        
        query = db.query(WalletAlert).filter(
            WalletAlert.agent_id == agent_id
        )
        
        if unread_only:
            query = query.filter(WalletAlert.is_read == False)
        
        alerts = query.order_by(desc(WalletAlert.created_at)).limit(20).all()
        
        alert_data = []
        for alert in alerts:
            alert_data.append({
                "id": alert.id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "message": alert.message,
                "is_read": alert.is_read,
                "trigger_balance": alert.trigger_balance,
                "created_at": alert.created_at.isoformat(),
                "read_at": alert.read_at.isoformat() if alert.read_at else None
            })
        
        return {
            "alerts": alert_data,
            "unread_count": len([a for a in alert_data if not a["is_read"]])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting alerts for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get alerts: {str(e)}"
        )

@router.post("/mark-alert-read/{alert_id}")
async def mark_alert_as_read(
    alert_id: int,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Mark wallet alert as read
    """
    try:
        from .models import WalletAlert
        
        alert = db.query(WalletAlert).filter(WalletAlert.id == alert_id).first()
        
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        
        # Verify access
        if current_user.get("user_id") != alert.agent_id and not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        alert.is_read = True
        alert.read_at = datetime.utcnow()
        db.commit()
        
        return {"success": True, "message": "Alert marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking alert as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark alert as read: {str(e)}"
        )

@router.get("/low-balance-agents")
async def get_low_balance_agents(
    threshold: Optional[float] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get list of agents with low wallet balance (Admin only)
    """
    try:
        # Verify admin access
        if not current_user.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        wallet_service = WalletService(db)
        low_balance_agents = wallet_service.get_agents_with_low_balance(threshold)
        
        return {
            "agents": low_balance_agents,
            "count": len(low_balance_agents),
            "threshold": threshold or 20.0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting low balance agents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get low balance agents: {str(e)}"
        )

# Background task functions
async def notify_agent_insufficient_balance(agent_id: int, current_balance: float):
    """
    Background task to notify agent of insufficient balance
    This would integrate with notification system
    """
    try:
        # This would send notification to agent
        logger.info(f"🚨 Agent {agent_id} has insufficient balance: ₹{current_balance}")
        # TODO: Integrate with WebSocket notification system
        
    except Exception as e:
        logger.error(f"Error notifying agent of insufficient balance: {e}")