from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from sqlalchemy.orm import Session
from ..user.models import User, Agent
from ..auth.jwt import create_access_token, get_current_user, verify_password, get_password_hash
from ..database import get_db
from datetime import datetime, timedelta
import sqlalchemy as sa

router = APIRouter(prefix="/admin", tags=["admin"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="admin/login")

# Admin authentication
@router.post("/login")
async def admin_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # In production, use a separate admin table instead of checking is_admin flag
    user = db.query(User).filter(User.email == form_data.username, User.is_admin == True).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email, "is_admin": True})
    
    return {
        "token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
        }
    }

@router.get("/verify-token")
async def verify_token(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access this endpoint",
        )
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
    }

# KYC verification endpoints
@router.get("/agents-kyc")
async def get_agents_with_kyc(
    status: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access this endpoint",
        )
    
    query = db.query(Agent).filter(Agent.kyc_document_path.isnot(None))
    
    if status:
        query = query.filter(Agent.kyc_status == status)
    
    agents = query.order_by(sa.desc(Agent.updated_at)).all()
    
    return agents

@router.post("/agent/kyc/verify")
async def verify_agent_kyc(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access this endpoint",
        )
    
    agent_id = data.get("agent_id")
    status_value = data.get("status")
    
    if not agent_id or not status_value or status_value not in ["verified", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request data",
        )
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id {agent_id} not found",
        )
    
    agent.kyc_status = status_value
    agent.updated_at = datetime.now()
    db.commit()
    
    # Could also trigger notifications here to inform the agent
    
    return {"message": f"KYC status updated to {status_value}", "agent_id": agent_id}

# Dashboard statistics endpoints
@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access this endpoint",
        )
    
    users_count = db.query(sa.func.count(User.id)).scalar()
    agents_count = db.query(sa.func.count(Agent.id)).scalar()
    pending_kyc_count = db.query(sa.func.count(Agent.id)).filter(
        Agent.kyc_status == "pending"
    ).scalar()
    
    # This is a placeholder - you would need to query your bookings table
    bookings_count = 0
    
    # Placeholder for service distribution
    service_distribution = [
        {"service": "Electrician", "count": 45},
        {"service": "Plumber", "count": 32},
        {"service": "Cleaning", "count": 28},
        {"service": "Carpenter", "count": 18},
        {"service": "Driver", "count": 12}
    ]
    
    return {
        "users": users_count,
        "agents": agents_count,
        "bookings": bookings_count,
        "pendingKyc": pending_kyc_count,
        "serviceDistribution": service_distribution
    }

@router.get("/dashboard/bookings-by-date")
async def get_bookings_by_date(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access this endpoint",
        )
    
    # Placeholder data - in production query the bookings table
    # and aggregate by date
    start_date = datetime.now() - timedelta(days=days)
    
    # Generate sample data for last N days
    booking_stats = []
    for i in range(days):
        date = start_date + timedelta(days=i)
        booking_stats.append({
            "date": date.strftime("%Y-%m-%d"),
            "bookings": int(10 + i % 15)  # Random sample data
        })
    
    return booking_stats
