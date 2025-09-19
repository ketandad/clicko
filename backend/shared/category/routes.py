from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..auth.jwt import get_current_user
from ..user.models import User, Category, Agent, AgentCategory
from pydantic import BaseModel
import sqlalchemy as sa
from sqlalchemy.sql.expression import func

router = APIRouter(prefix="/categories", tags=["categories"])

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    agent_count: int = 0

@router.get("/", response_model=List[CategoryResponse])
async def get_all_categories(db: Session = Depends(get_db)):
    """
    Get all service categories with agent counts
    """
    # Query categories with agent counts
    categories = db.query(
        Category,
        sa.func.count(AgentCategory.agent_id).label('agent_count')
    ).outerjoin(
        AgentCategory, Category.id == AgentCategory.category_id
    ).group_by(
        Category.id
    ).all()
    
    return [
        {
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "icon_url": category.icon_url,
            "agent_count": agent_count
        }
        for category, agent_count in categories
    ]

@router.get("/featured/", response_model=List[CategoryResponse])
@router.get("/featured", response_model=List[CategoryResponse])
async def get_featured_categories(db: Session = Depends(get_db)):
    """
    Get featured service categories (categories with most agents)
    """
    # Query categories with most agents (limit to 5)
    featured = db.query(
        Category,
        sa.func.count(AgentCategory.agent_id).label('agent_count')
    ).outerjoin(
        AgentCategory, Category.id == AgentCategory.category_id
    ).group_by(
        Category.id
    ).order_by(
        sa.desc('agent_count')
    ).limit(5).all()
    
    return [
        {
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "icon_url": category.icon_url,
            "agent_count": agent_count
        }
        for category, agent_count in featured
    ]

@router.get("/{category_id}/", response_model=CategoryResponse)
@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category_by_id(category_id: int, db: Session = Depends(get_db)):
    """
    Get a specific category by ID
    """
    # Query category with agent count
    result = db.query(
        Category,
        sa.func.count(AgentCategory.agent_id).label('agent_count')
    ).outerjoin(
        AgentCategory, Category.id == AgentCategory.category_id
    ).filter(
        Category.id == category_id
    ).group_by(
        Category.id
    ).first()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with id {category_id} not found"
        )
    
    category, agent_count = result
    
    return {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "icon_url": category.icon_url,
        "agent_count": agent_count
    }

# Admin endpoints for managing categories
@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    name: str,
    description: Optional[str] = None,
    icon_url: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new category (admin only)
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can create categories"
        )
    
    new_category = Category(
        name=name,
        description=description,
        icon_url=icon_url
    )
    
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    
    return {
        "id": new_category.id,
        "name": new_category.name,
        "description": new_category.description,
        "icon_url": new_category.icon_url,
        "agent_count": 0
    }
