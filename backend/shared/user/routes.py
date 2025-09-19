from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..auth.jwt import get_current_user
from .models import User, Agent
import shutil
import os
from datetime import datetime
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])

# Debug route to test authentication
@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info"""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_agent": current_user.is_agent,
        "message": "Authentication working"
    }

# Pydantic models
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None

class AddressUpdate(BaseModel):
    address: str

@router.post("/agent/kyc/upload")
async def upload_kyc_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    agent_id: int = Form(...),
    db: Session = Depends(get_db)
):
    # Save file to disk (e.g., ./kyc_docs/)
    kyc_dir = "./kyc_docs"
    os.makedirs(kyc_dir, exist_ok=True)
    file_path = os.path.join(kyc_dir, f"{agent_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Update agent record
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        return {"error": "Agent not found"}
    agent.kyc_document_type = document_type
    agent.kyc_document_path = file_path
    agent.kyc_status = "pending"
    db.commit()
    return {"message": "KYC document uploaded", "status": "pending"}

@router.post("/admin/agent/kyc/verify")
def verify_kyc(
    agent_id: int,
    status: str,  # "verified" or "rejected"
    db: Session = Depends(get_db)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        return {"error": "Agent not found"}
    agent.kyc_status = status
    db.commit()
    return {"message": f"KYC status updated to {status}"}

# User profile endpoints
@router.get("/{user_id}/")
@router.get("/{user_id}")
async def get_user_profile(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Add some debug logging
    print(f"DEBUG: Requesting profile for user_id: {user_id}")
    print(f"DEBUG: Type of current_user: {type(current_user)}")
    print(f"DEBUG: Current_user content: {current_user}")
    
    # Handle both User object and dict scenarios  
    if hasattr(current_user, 'id'):
        current_user_id = current_user.id
        current_user_email = getattr(current_user, 'email', 'unknown')
        print(f"DEBUG: User object - ID: {current_user_id}, Email: {current_user_email}")
    elif isinstance(current_user, dict):
        current_user_id = current_user.get('id') or current_user.get('user_id')
        current_user_email = current_user.get('email', 'unknown')
        print(f"DEBUG: Dict object - ID: {current_user_id}, Email: {current_user_email}")
    else:
        print(f"DEBUG: Unknown current_user type: {type(current_user)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )
    
    # Users can only access their own profile
    if current_user_id != user_id:
        print(f"DEBUG: Access denied - current user {current_user_id} trying to access {user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Return user profile data
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "address": user.address,
        "profile_image_url": user.profile_image_url,
        "email_notifications": getattr(user, "email_notifications", True),
        "push_notifications": getattr(user, "push_notifications", True),
        "created_at": user.created_at,
        "is_agent": user.is_agent
    }

@router.put("/{user_id}/")
@router.put("/{user_id}")
async def update_user_profile(
    user_id: int, 
    user_data: UserProfileUpdate,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Users can only update their own profile
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields if provided
    if user_data.name is not None:
        user.name = user_data.name
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.email_notifications is not None:
        user.email_notifications = user_data.email_notifications
    if user_data.push_notifications is not None:
        user.push_notifications = user_data.push_notifications
    
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "updated_at": user.updated_at
    }

@router.put("/{user_id}/address/")
@router.put("/{user_id}/address")
async def update_user_address(
    user_id: int, 
    address_data: AddressUpdate,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Users can only update their own address
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.address = address_data.address
    user.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Address updated successfully"}

@router.post("/{user_id}/profile-image/")
@router.post("/{user_id}/profile-image")
async def upload_profile_image(
    user_id: int,
    profile_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Users can only update their own profile image
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Create upload directory if it doesn't exist
    upload_dir = "./uploads/profile_images"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    file_extension = os.path.splitext(profile_image.filename)[1]
    filename = f"user_{user_id}_{timestamp}{file_extension}"
    file_path = os.path.join(upload_dir, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(profile_image.file, buffer)
    
    # Update user profile image URL
    file_url = f"/uploads/profile_images/{filename}"
    user.profile_image_url = file_url
    user.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "Profile image uploaded successfully",
        "profile_image_url": file_url
    }