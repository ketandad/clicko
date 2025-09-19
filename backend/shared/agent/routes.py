from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..auth.jwt import get_current_user
from ..user.models import User, Agent, Category, AgentCategory
from pydantic import BaseModel
import sqlalchemy as sa
from sqlalchemy.sql.expression import func
import math

router = APIRouter(prefix="/agents", tags=["agents"])

class AgentResponse(BaseModel):
    id: int
    user_id: int
    name: str
    rate_per_km: float
    is_online: bool
    avg_rating: float
    total_ratings: int
    distance_km: Optional[float] = None
    categories: List[str] = []

class AgentProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    rate_per_km: float
    wallet_balance: float
    is_online: bool
    avg_rating: float
    total_ratings: int
    kyc_status: str
    categories: List[str] = []

class CreateAgentRequest(BaseModel):
    name: str
    phone: str
    address: str
    experience: str
    selectedCategories: List[int]
    location: dict
    rate_per_km: Optional[float] = 20.0

class LocationRequest(BaseModel):
    latitude: float
    longitude: float

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    Returns distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r

@router.get("/", response_model=List[AgentResponse])
async def get_agents(
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    latitude: Optional[float] = Query(None, description="User latitude for distance calculation"),
    longitude: Optional[float] = Query(None, description="User longitude for distance calculation"),
    max_distance: Optional[float] = Query(25.0, description="Maximum distance in km (default: 25km)"),
    is_online: Optional[bool] = Query(None, description="Filter by online status"),
    db: Session = Depends(get_db)
):
    """
    Get agents with optional location-based filtering and sorting
    """
    # Base query with user information
    query = db.query(
        Agent,
        User.name.label('user_name')
    ).join(
        User, Agent.user_id == User.id
    ).filter(
        Agent.kyc_status == 'verified'  # Only show verified agents
    )
    
    # Filter by category if specified
    if category_id:
        query = query.join(
            AgentCategory, Agent.id == AgentCategory.agent_id
        ).filter(
            AgentCategory.category_id == category_id
        )
    
    # Filter by online status if specified
    if is_online is not None:
        query = query.filter(Agent.is_online == is_online)
    
    agents_data = query.all()
    
    # Process results and calculate distances
    result = []
    for agent, user_name in agents_data:
        # Get agent categories
        categories = db.query(Category.name).join(
            AgentCategory, Category.id == AgentCategory.category_id
        ).filter(
            AgentCategory.agent_id == agent.id
        ).all()
        
        agent_response = AgentResponse(
            id=agent.id,
            user_id=agent.user_id,
            name=user_name,
            rate_per_km=agent.rate_per_km,
            is_online=agent.is_online,
            avg_rating=agent.avg_rating,
            total_ratings=agent.total_ratings,
            categories=[cat.name for cat in categories]
        )
        
        # Calculate distance if user location provided
        if latitude is not None and longitude is not None:
            # For now, using dummy location for agents (Delhi area)
            # In production, agents would have their current/preferred location
            agent_lat = 28.7041 + (agent.id % 100) * 0.001  # Spread agents around Delhi
            agent_lng = 77.1025 + (agent.id % 100) * 0.001
            
            distance = calculate_distance(latitude, longitude, agent_lat, agent_lng)
            agent_response.distance_km = round(distance, 2)
            
            # Filter by max distance
            if distance > max_distance:
                continue
        
        result.append(agent_response)
    
    # Sort by distance if location provided, otherwise by rating
    if latitude is not None and longitude is not None:
        result.sort(key=lambda x: x.distance_km or float('inf'))
    else:
        result.sort(key=lambda x: x.avg_rating, reverse=True)
    
    return result

@router.get("/nearby", response_model=List[AgentResponse])
async def get_nearby_agents(
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    radius: float = Query(10.0, description="Search radius in km"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    limit: int = Query(20, description="Maximum number of agents to return"),
    db: Session = Depends(get_db)
):
    """
    Get agents within a specific radius of user location
    """
    agents = await get_agents(
        category_id=category_id,
        latitude=latitude,
        longitude=longitude,
        max_distance=radius,
        is_online=True,  # Only online agents for nearby search
        db=db
    )
    
    return agents[:limit]

@router.get("/search", response_model=List[AgentResponse])
async def search_agents(
    query: str = Query(..., description="Search query for agent names, categories, or services"),
    latitude: Optional[float] = Query(None, description="User latitude for location-based prioritization"),
    longitude: Optional[float] = Query(None, description="User longitude for location-based prioritization"),
    max_distance: Optional[float] = Query(25.0, description="Maximum distance in km"),
    is_online: Optional[bool] = Query(True, description="Filter by online status (default: true)"),
    limit: int = Query(20, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Search agents by name, category, or service with location-based prioritization
    """
    # Search in multiple fields: agent names, category names
    search_term = f"%{query.lower()}%"
    
    # Base query with user information
    base_query = db.query(
        Agent,
        User.name.label('user_name')
    ).join(
        User, Agent.user_id == User.id
    ).filter(
        Agent.kyc_status == 'verified'
    )
    
    # Filter by online status if specified
    if is_online is not None:
        base_query = base_query.filter(Agent.is_online == is_online)
    
    # Search by agent name
    name_results = base_query.filter(
        sa.func.lower(User.name).like(search_term)
    ).all()
    
    # Search by category name
    category_results = base_query.join(
        AgentCategory, Agent.id == AgentCategory.agent_id
    ).join(
        Category, AgentCategory.category_id == Category.id
    ).filter(
        sa.func.lower(Category.name).like(search_term)
    ).all()
    
    # Combine results and remove duplicates
    all_results = {}
    for agent, user_name in name_results + category_results:
        if agent.id not in all_results:
            all_results[agent.id] = (agent, user_name)
    
    # Process results and calculate distances
    result = []
    for agent, user_name in all_results.values():
        # Get agent categories
        categories = db.query(Category.name).join(
            AgentCategory, Category.id == AgentCategory.category_id
        ).filter(
            AgentCategory.agent_id == agent.id
        ).all()
        
        agent_response = AgentResponse(
            id=agent.id,
            user_id=agent.user_id,
            name=user_name,
            rate_per_km=agent.rate_per_km,
            is_online=agent.is_online,
            avg_rating=agent.avg_rating,
            total_ratings=agent.total_ratings,
            categories=[cat.name for cat in categories]
        )
        
        # Calculate distance if user location provided
        if latitude is not None and longitude is not None:
            agent_lat = 28.7041 + (agent.id % 100) * 0.001
            agent_lng = 77.1025 + (agent.id % 100) * 0.001
            
            distance = calculate_distance(latitude, longitude, agent_lat, agent_lng)
            agent_response.distance_km = round(distance, 2)
            
            # Filter by max distance
            if distance > max_distance:
                continue
        
        result.append(agent_response)
    
    # Sort by relevance and location
    if latitude is not None and longitude is not None:
        # Prioritize by distance for location-based searches
        result.sort(key=lambda x: (
            x.distance_km or float('inf'),  # Primary: distance
            -x.avg_rating,  # Secondary: rating (negative for descending)
            -x.total_ratings  # Tertiary: number of ratings
        ))
    else:
        # Sort by relevance (rating and reviews) without location
        result.sort(key=lambda x: (-x.avg_rating, -x.total_ratings))
    
    return result[:limit]

class AgentStatsResponse(BaseModel):
    today_earnings: float
    today_bookings: int
    today_distance: float
    total_earnings: float
    total_bookings: int
    avg_rating: float

@router.get("/stats")
async def get_agent_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get agent statistics for today and overall"""
    # Find agent by user_id
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # TODO: Calculate real stats from bookings table when it's implemented
    # For now, return zero values instead of dummy data to avoid confusion
    
    return AgentStatsResponse(
        today_earnings=0.0,      # Will be calculated from real bookings
        today_bookings=0,        # Will be calculated from real bookings  
        today_distance=0.0,      # Will be calculated from real bookings
        total_earnings=agent.wallet_balance,  # Use wallet balance as total earnings
        total_bookings=0,        # Will be calculated from real bookings
        avg_rating=agent.avg_rating
    )

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent_by_id(
    agent_id: int,
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get specific agent details by ID
    """
    agent_data = db.query(
        Agent,
        User.name.label('user_name')
    ).join(
        User, Agent.user_id == User.id
    ).filter(
        Agent.id == agent_id
    ).first()
    
    if not agent_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with id {agent_id} not found"
        )
    
    agent, user_name = agent_data
    
    # Get agent categories
    categories = db.query(Category.name).join(
        AgentCategory, Category.id == AgentCategory.category_id
    ).filter(
        AgentCategory.agent_id == agent.id
    ).all()
    
    agent_response = AgentResponse(
        id=agent.id,
        user_id=agent.user_id,
        name=user_name,
        rate_per_km=agent.rate_per_km,
        is_online=agent.is_online,
        avg_rating=agent.avg_rating,
        total_ratings=agent.total_ratings,
        categories=[cat.name for cat in categories]
    )
    
    # Calculate distance if user location provided
    if latitude is not None and longitude is not None:
        agent_lat = 28.7041 + (agent.id % 100) * 0.001
        agent_lng = 77.1025 + (agent.id % 100) * 0.001
        
        distance = calculate_distance(latitude, longitude, agent_lat, agent_lng)
        agent_response.distance_km = round(distance, 2)
    
    return agent_response

@router.get("/profile/{user_id}", response_model=AgentProfileResponse)
async def get_agent_profile(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Get agent profile details by user ID including wallet balance
    """
    agent_data = db.query(
        Agent,
        User.name.label('user_name')
    ).join(
        User, Agent.user_id == User.id
    ).filter(
        Agent.user_id == user_id
    ).first()
    
    if not agent_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent profile not found for user {user_id}"
        )
    
    agent, user_name = agent_data
    
    # Get agent categories
    categories = db.query(Category.name).join(
        AgentCategory, Category.id == AgentCategory.category_id
    ).filter(
        AgentCategory.agent_id == agent.id
    ).all()
    
    return AgentProfileResponse(
        id=agent.id,
        user_id=agent.user_id,
        name=user_name,
        rate_per_km=agent.rate_per_km,
        wallet_balance=agent.wallet_balance,
        is_online=agent.is_online,
        avg_rating=agent.avg_rating,
        total_ratings=agent.total_ratings,
        kyc_status=agent.kyc_status,
        categories=[cat.name for cat in categories]
    )

@router.post("/create", response_model=AgentProfileResponse)
async def create_agent(
    agent_data: CreateAgentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new agent profile for the current user
    """
    # Check if user already has an agent profile
    existing_agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if existing_agent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has an agent profile"
        )
    
    # Create new agent
    new_agent = Agent(
        user_id=current_user.id,
        rate_per_km=agent_data.rate_per_km,
        wallet_balance=1000.0,  # Welcome bonus
        is_online=False,
        avg_rating=0.0,
        total_ratings=0,
        kyc_status='verified'  # Auto-approve for MVP
    )
    
    db.add(new_agent)
    db.commit()
    db.refresh(new_agent)
    
    # Add agent categories
    for category_id in agent_data.selectedCategories:
        agent_category = AgentCategory(
            agent_id=new_agent.id,
            category_id=category_id
        )
        db.add(agent_category)
    
    db.commit()
    
    # Get categories for response
    categories = db.query(Category.name).join(
        AgentCategory, Category.id == AgentCategory.category_id
    ).filter(
        AgentCategory.agent_id == new_agent.id
    ).all()
    
    return AgentProfileResponse(
        id=new_agent.id,
        user_id=new_agent.user_id,
        name=current_user.name,
        rate_per_km=new_agent.rate_per_km,
        wallet_balance=new_agent.wallet_balance,
        is_online=new_agent.is_online,
        avg_rating=new_agent.avg_rating,
        total_ratings=new_agent.total_ratings,
        kyc_status=new_agent.kyc_status,
        categories=[cat.name for cat in categories]
    )

class UpdateStatusRequest(BaseModel):
    is_online: bool

@router.put("/status")
async def update_agent_status(
    status_data: UpdateStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update agent online/offline status"""
    # Find agent by user_id
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # Update status
    agent.is_online = status_data.is_online
    db.commit()
    db.refresh(agent)
    
    return {
        "success": True,
        "message": f"Agent status updated to {'online' if status_data.is_online else 'offline'}",
        "is_online": agent.is_online
    }

class UpdateLocationRequest(BaseModel):
    latitude: float
    longitude: float
    area: str

@router.put("/location")
async def update_agent_location(
    location_data: UpdateLocationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update agent current location"""
    # Find agent by user_id
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # Update user location (stored as "lat,lng")
    location_string = f"{location_data.latitude},{location_data.longitude}"
    current_user.location = location_string
    
    # Update timestamp
    from datetime import datetime
    agent.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Location updated successfully",
        "location": {
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
            "area": location_data.area
        }
    }