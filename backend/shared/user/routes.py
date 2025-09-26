from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..auth.jwt import get_current_user
from .models import User, Agent, Category, SubCategory, AgentCategory, AgentSubCategory
import shutil
import os
import json
import uuid
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
    
    # Return user profile data (only User model fields - no Agent-specific fields)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,  # Basic phone for customers
        "created_at": user.created_at,
        "is_agent": user.is_agent,
        # Default notification preferences (could be added to User model later if needed)
        "email_notifications": True,
        "push_notifications": True
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

@router.post("/agent/onboard")
async def complete_agent_onboarding(
    # Personal details
    formatted_phone: str = Form(...),
    experience_years: int = Form(0),
    bio: str = Form(""),
    
    # Address details
    address_line_1: str = Form(...),
    address_line_2: str = Form(""),
    city: str = Form(...),
    state: str = Form(...),
    postal_code: str = Form(...),
    location: str = Form(...),  # "latitude,longitude"
    
    # Category and sub-category selections
    primary_category_id: int = Form(...),
    sub_category_ids: str = Form("[]"),  # JSON array string
    
    # KYC details
    kyc_document_type: str = Form(...),
    
    # File uploads
    profile_image: UploadFile = File(...),
    selfie_verification: UploadFile = File(...),
    kyc_document: UploadFile = File(...),
    
    # Dependencies
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Complete agent onboarding with all data and files in a single submission
    """
    try:
        # Parse sub-category IDs
        sub_category_list = json.loads(sub_category_ids) if sub_category_ids else []
        
        # Check if user already has an agent profile
        existing_agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
        if existing_agent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has an agent profile"
            )
        
        # Validate category exists
        category = db.query(Category).filter(Category.id == primary_category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid category selected"
            )
        
        # Validate sub-categories exist and belong to the selected category
        sub_categories = []
        if sub_category_list:
            sub_categories = db.query(SubCategory).filter(
                SubCategory.id.in_(sub_category_list),
                SubCategory.category_id == primary_category_id
            ).all()
            
            if len(sub_categories) != len(sub_category_list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid sub-categories selected"
                )
        
        # Create upload directories
        upload_dirs = {
            'profile': './uploads/profile_images',
            'selfie': './uploads/selfie_verifications',
            'kyc': './uploads/kyc_documents'
        }
        
        for dir_path in upload_dirs.values():
            os.makedirs(dir_path, exist_ok=True)
        
        # Upload files and generate URLs
        file_uploads = {}
        files_to_upload = [
            ('profile', profile_image),
            ('selfie', selfie_verification),
            ('kyc', kyc_document)
        ]
        
        for file_type, file_obj in files_to_upload:
            if file_obj and file_obj.filename:
                # Generate unique filename
                ext = os.path.splitext(file_obj.filename)[1] or '.jpg'
                filename = f"{file_type}_{current_user.id}_{uuid.uuid4().hex}{ext}"
                file_path = os.path.join(upload_dirs[file_type], filename)
                
                # Save file
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file_obj.file, buffer)
                
                # Store relative URL
                file_uploads[file_type] = f"/uploads/{file_type}_{'verifications' if file_type == 'selfie' else 'images' if file_type == 'profile' else 'documents'}/{filename}"
        
        # Create agent profile
        new_agent = Agent(
            user_id=current_user.id,
            formatted_phone=formatted_phone,
            experience_years=experience_years,
            bio=bio,
            
            # Address details
            address_line_1=address_line_1,
            address_line_2=address_line_2,
            city=city,
            state=state,
            postal_code=postal_code,
            location=location,
            
            # File URLs
            profile_photo_url=file_uploads.get('profile'),
            selfie_verification_url=file_uploads.get('selfie'),
            kyc_document_path=file_uploads.get('kyc'),
            kyc_document_type=kyc_document_type,
            
            # Default values
            rate_per_km=20.0,
            wallet_balance=1000.0,
            kyc_status="pending",
            selfie_verification_status="pending"
        )
        
        db.add(new_agent)
        db.flush()  # Get the agent ID
        
        # Update user to mark as agent
        current_user.is_agent = True
        current_user.updated_at = datetime.utcnow()
        
        # Add category relationship
        agent_category = AgentCategory(
            agent_id=new_agent.id,
            category_id=primary_category_id
        )
        db.add(agent_category)
        
        # Add sub-category relationships
        for sub_category in sub_categories:
            agent_sub_category = AgentSubCategory(
                agent_id=new_agent.id,
                sub_category_id=sub_category.id
            )
            db.add(agent_sub_category)
        
        # Commit all changes
        db.commit()
        
        return {
            "message": "Agent onboarding completed successfully",
            "agent_id": new_agent.id,
            "status": "pending_verification",
            "kyc_status": "pending",
            "selfie_verification_status": "pending",
            "files_uploaded": {
                "profile_image": bool(file_uploads.get('profile')),
                "selfie_verification": bool(file_uploads.get('selfie')),
                "kyc_document": bool(file_uploads.get('kyc'))
            },
            "categories": {
                "primary_category": category.name,
                "sub_categories": [sc.name for sc in sub_categories]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Onboarding failed: {str(e)}"
        )