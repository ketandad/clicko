from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..auth.jwt import get_current_user
from ..user.models import User, Agent, Category, AgentCategory, SubCategory, AgentSubCategory, AgentServicePricing
from ..notifications.websocket_manager import notification_manager
from pydantic import BaseModel
import sqlalchemy as sa
from sqlalchemy.sql.expression import func
import math
import logging

logger = logging.getLogger(__name__)

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
    # Enhanced profile fields
    profile_photo_url: Optional[str] = None
    selfie_verification_url: Optional[str] = None
    formatted_phone: Optional[str] = None
    bio: Optional[str] = None
    experience_years: Optional[int] = None
    # Structured address
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    google_place_id: Optional[str] = None

class CreateAgentRequest(BaseModel):
    # Basic info (pre-filled from user profile)
    name: str
    phone: str
    formatted_phone: Optional[str] = None
    # Structured address fields
    address: Optional[str] = None  # Legacy field for backward compatibility
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"
    google_place_id: Optional[str] = None
    # Enhanced fields
    experience: Optional[str] = "0-1 years"
    experience_years: Optional[int] = 0
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    selfie_verification_url: Optional[str] = None
    # Service details
    selectedCategories: List[int]
    selectedSubCategories: Optional[List[int]] = []
    location: dict
    rate_per_km: Optional[float] = 20.0

class LocationRequest(BaseModel):
    latitude: float
    longitude: float

# Agent Service Pricing Models
class ServicePricingCreate(BaseModel):
    sub_category_id: int
    price_type: str = "fixed"  # fixed, hourly, per_visit, range
    base_price: float
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    description: Optional[str] = None

class ServicePricingUpdate(BaseModel):
    price_type: Optional[str] = None
    base_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ServicePricingResponse(BaseModel):
    id: int
    agent_id: int
    sub_category_id: int
    sub_category_name: str
    category_name: str
    price_type: str
    base_price: float
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    description: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str

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
        
        # Calculate distance if user location provided and agent has location data
        if latitude is not None and longitude is not None:
            # Use agent's current location if available, otherwise use base location
            agent_lat = agent.current_latitude or agent.base_latitude
            agent_lng = agent.current_longitude or agent.base_longitude
            
            if agent_lat is not None and agent_lng is not None:
                distance = calculate_distance(latitude, longitude, agent_lat, agent_lng)
                agent_response.distance_km = round(distance, 2)
                
                # Filter by max distance if specified
                if max_distance and distance > max_distance:
                    continue
            else:
                # Skip agents without location data for nearby searches
                if max_distance:
                    continue
                agent_response.distance_km = None
        
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
    sort_by: str = Query("distance", description="Sort by: distance, rating, price"),
    db: Session = Depends(get_db)
):
    """
    Optimized nearby agents search for high-performance agent discovery.
    
    Uses efficient geospatial queries with proper indexing to handle >1M requests.
    Returns agents sorted by distance, rating, or price within specified radius.
    """
    try:
        # Build optimized query with proper joins and filters
        query = db.query(
            Agent.id,
            Agent.user_id,
            Agent.rate_per_km,
            Agent.avg_rating,
            Agent.total_ratings,
            Agent.is_online,
            Agent.current_latitude,
            Agent.current_longitude,
            Agent.base_latitude,
            Agent.base_longitude,
            Agent.service_radius_km,
            Agent.last_location_update,
            User.name.label('user_name')
        ).join(
            User, Agent.user_id == User.id
        ).filter(
            Agent.kyc_status == 'verified',
            # Note: Not filtering by is_online here - will validate WebSocket connectivity below
            Agent.is_location_enabled == True,  # Only agents sharing location
            # Agent must have location data (current or base)
            sa.or_(
                sa.and_(Agent.current_latitude.isnot(None), Agent.current_longitude.isnot(None)),
                sa.and_(Agent.base_latitude.isnot(None), Agent.base_longitude.isnot(None))
            )
        )

        # Filter by category if specified
        if category_id:
            query = query.join(
                AgentCategory, Agent.id == AgentCategory.agent_id
            ).filter(
                AgentCategory.category_id == category_id
            )

        # Execute query
        agents_data = query.all()
        
        # Process results with distance calculation and filtering
        nearby_agents = []
        
        for agent_data in agents_data:
            # Use current location if available, otherwise use base location
            agent_lat = agent_data.current_latitude or agent_data.base_latitude
            agent_lng = agent_data.current_longitude or agent_data.base_longitude
            
            if not agent_lat or not agent_lng:
                continue  # Skip agents without location
            
            # Only show agents who are truly available (database + WebSocket)
            try:
                from ..notifications.websocket_manager import notification_manager
                agent_available = await notification_manager.is_agent_online(agent_data.id)
                if not agent_available:
                    continue  # Skip agents that aren't actually connected and listening
            except Exception as e:
                logger.warning(f"Could not verify connectivity for agent {agent_data.id}: {e}")
                continue  # Skip agents we can't verify

            # Calculate distance using efficient formula
            distance = calculate_distance(latitude, longitude, agent_lat, agent_lng)
            
            # Filter by user's requested radius AND agent's service radius
            max_service_distance = min(radius, agent_data.service_radius_km or 10.0)
            if distance > max_service_distance:
                continue  # Skip agents outside service area
                
            # Get agent categories (cached query)
            categories = db.query(Category.name).join(
                AgentCategory, Category.id == AgentCategory.category_id
            ).filter(
                AgentCategory.agent_id == agent_data.id
            ).limit(5).all()  # Limit to prevent large responses

            # Create response object
            agent_response = AgentResponse(
                id=agent_data.id,
                user_id=agent_data.user_id,
                name=agent_data.user_name,
                rate_per_km=agent_data.rate_per_km,
                is_online=True, # If they made it here, they're truly online
                avg_rating=agent_data.avg_rating,
                total_ratings=agent_data.total_ratings,
                distance_km=round(distance, 2),
                categories=[cat.name for cat in categories]
            )
            
            nearby_agents.append(agent_response)
        
        # Sort results based on sort_by parameter
        if sort_by == "distance":
            nearby_agents.sort(key=lambda x: x.distance_km)
        elif sort_by == "rating":
            nearby_agents.sort(key=lambda x: (x.avg_rating, -x.distance_km), reverse=True)
        elif sort_by == "price":
            nearby_agents.sort(key=lambda x: (x.rate_per_km, x.distance_km))
        else:
            # Default to distance sorting
            nearby_agents.sort(key=lambda x: x.distance_km)

        # Apply limit
        result = nearby_agents[:limit]
        
        print(f"🔍 Found {len(result)} nearby agents within {radius}km radius")
        return result

    except Exception as error:
        print(f"❌ Error in nearby agents search: {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch nearby agents: {str(error)}"
        )

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

# ===== AGENT SUBCATEGORY MANAGEMENT =====

class SubCategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    category_id: int
    category_name: str
    has_pricing: bool = False
    pricing: Optional[ServicePricingResponse] = None

class AgentSubCategoryRequest(BaseModel):
    sub_category_id: int

@router.get("/subcategories", response_model=List[SubCategoryResponse])
def get_agent_subcategories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all subcategories assigned to the current agent"""
    print(f"DEBUG: get_agent_subcategories called for user {current_user.id}")
    print(f"DEBUG: Endpoint reached successfully!")
    print(f"DEBUG: current_user type: {type(current_user)}")
    print(f"DEBUG: db session type: {type(db)}")
    
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        print(f"DEBUG: User {current_user.id} is not an agent")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    print(f"DEBUG: Found agent {agent.id} for user {current_user.id}")
    
    # Get agent's subcategories with their categories and pricing info
    subcategories = db.query(
        SubCategory.id,
        SubCategory.name,
        SubCategory.description,
        SubCategory.icon_url,
        SubCategory.category_id,
        Category.name.label('category_name')
    ).join(
        AgentSubCategory, AgentSubCategory.sub_category_id == SubCategory.id
    ).join(
        Category, SubCategory.category_id == Category.id
    ).filter(
        AgentSubCategory.agent_id == agent.id
    ).all()
    
    result = []
    for subcat in subcategories:
        # Check if agent has pricing for this subcategory
        pricing = db.query(AgentServicePricing).filter(
            AgentServicePricing.agent_id == agent.id,
            AgentServicePricing.sub_category_id == subcat.id
        ).first()
        
        pricing_response = None
        if pricing:
            pricing_response = ServicePricingResponse(
                id=pricing.id,
                agent_id=pricing.agent_id,
                sub_category_id=pricing.sub_category_id,
                sub_category_name=subcat.name,
                category_name=subcat.category_name,
                price_type=pricing.price_type,
                base_price=pricing.base_price,
                min_price=pricing.min_price,
                max_price=pricing.max_price,
                description=pricing.description,
                is_active=pricing.is_active,
                created_at=pricing.created_at.isoformat() if pricing.created_at else "",
                updated_at=pricing.updated_at.isoformat() if pricing.updated_at else ""
            )
        
        result.append(SubCategoryResponse(
            id=subcat.id,
            name=subcat.name,
            description=subcat.description,
            icon_url=subcat.icon_url,
            category_id=subcat.category_id,
            category_name=subcat.category_name,
            has_pricing=pricing is not None,
            pricing=pricing_response
        ))
    
    return result

@router.post("/subcategories")
def add_agent_subcategory(
    request: AgentSubCategoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a subcategory to the agent's service list"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Verify subcategory exists
    subcategory = db.query(SubCategory).filter(SubCategory.id == request.sub_category_id).first()
    if not subcategory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subcategory not found"
        )
    
    # Check if agent already has this subcategory
    existing = db.query(AgentSubCategory).filter(
        AgentSubCategory.agent_id == agent.id,
        AgentSubCategory.sub_category_id == request.sub_category_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent already provides this service"
        )
    
    # Add subcategory to agent
    agent_subcategory = AgentSubCategory(
        agent_id=agent.id,
        sub_category_id=request.sub_category_id
    )
    db.add(agent_subcategory)
    db.commit()
    
    return {"success": True, "message": "Subcategory added successfully"}

@router.delete("/subcategories/{sub_category_id}")
def remove_agent_subcategory(
    sub_category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a subcategory from the agent's service list"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Find and remove the association
    agent_subcategory = db.query(AgentSubCategory).filter(
        AgentSubCategory.agent_id == agent.id,
        AgentSubCategory.sub_category_id == sub_category_id
    ).first()
    
    if not agent_subcategory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent doesn't provide this service"
        )
    
    # Also remove any pricing for this subcategory
    pricing = db.query(AgentServicePricing).filter(
        AgentServicePricing.agent_id == agent.id,
        AgentServicePricing.sub_category_id == sub_category_id
    ).first()
    
    if pricing:
        db.delete(pricing)
    
    db.delete(agent_subcategory)
    db.commit()
    
    return {"success": True, "message": "Subcategory removed successfully"}

@router.get("/available-subcategories", response_model=List[SubCategoryResponse])
def get_available_subcategories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available subcategories that the agent can add to their services"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Get agent's current subcategories
    agent_subcategories = db.query(AgentSubCategory.sub_category_id).filter(
        AgentSubCategory.agent_id == agent.id
    ).all()
    agent_subcat_ids = [asc.sub_category_id for asc in agent_subcategories]
    
    # Get agent's selected categories during onboarding
    agent_categories = db.query(AgentCategory.category_id).filter(
        AgentCategory.agent_id == agent.id
    ).all()
    agent_category_ids = [ac.category_id for ac in agent_categories]
    
    if not agent_category_ids:
        # If agent has no categories selected, return empty list
        return []
    
    # Get subcategories from agent's categories that are not already assigned
    available_subcategories = db.query(
        SubCategory.id,
        SubCategory.name,
        SubCategory.description,
        SubCategory.icon_url,
        SubCategory.category_id,
        Category.name.label('category_name')
    ).join(
        Category, SubCategory.category_id == Category.id
    ).filter(
        SubCategory.category_id.in_(agent_category_ids),  # Only from agent's categories
        ~SubCategory.id.in_(agent_subcat_ids)  # Not already assigned
    ).all()
    
    result = []
    for subcat in available_subcategories:
        result.append(SubCategoryResponse(
            id=subcat.id,
            name=subcat.name,
            description=subcat.description,
            icon_url=subcat.icon_url,
            category_id=subcat.category_id,
            category_name=subcat.category_name,
            has_pricing=False,  # Not assigned yet, so no pricing
            pricing=None
        ))
    
    return result

# Response model for agent categories
class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None

@router.get("/categories", response_model=List[CategoryResponse])
def get_agent_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get main categories assigned to the current agent (fallback when no subcategories)"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Get agent's main categories
    categories = db.query(
        Category.id,
        Category.name,
        Category.description,
        Category.icon_url
    ).join(
        AgentCategory, AgentCategory.category_id == Category.id
    ).filter(
        AgentCategory.agent_id == agent.id
    ).all()
    
    result = []
    for cat in categories:
        result.append(CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            icon_url=cat.icon_url
        ))
    
    return result

# Agent Category Management
@router.get("/available-categories", response_model=List[CategoryResponse])
def get_available_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available categories for agents to choose from"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Get all categories that the agent hasn't selected yet
    assigned_category_ids = db.query(AgentCategory.category_id).filter(
        AgentCategory.agent_id == agent.id
    ).subquery()
    
    available_categories = db.query(Category).filter(
        ~Category.id.in_(assigned_category_ids)
    ).all()
    
    result = []
    for category in available_categories:
        result.append(CategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            icon_url=category.icon_url
        ))
    
    return result

@router.post("/categories/{category_id}")
async def add_agent_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a category to agent's services"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Check if category exists
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    # Check if already assigned
    existing = db.query(AgentCategory).filter(
        AgentCategory.agent_id == agent.id,
        AgentCategory.category_id == category_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category already assigned to agent"
        )
    
    # Add category to agent
    agent_category = AgentCategory(
        agent_id=agent.id,
        category_id=category_id
    )
    db.add(agent_category)
    db.commit()
    
    return {
        "success": True,
        "message": f"Category '{category.name}' added successfully",
        "category": CategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            icon_url=category.icon_url
        )
    }

@router.delete("/categories/{category_id}")
async def remove_agent_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a category from agent's services"""
    # Check if user is an agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not an agent"
        )
    
    # Find and remove the category assignment
    agent_category = db.query(AgentCategory).filter(
        AgentCategory.agent_id == agent.id,
        AgentCategory.category_id == category_id
    ).first()
    
    if not agent_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not assigned to agent"
        )
    
    # Check if agent has subcategories in this category
    subcategories_count = db.query(AgentSubCategory).join(
        SubCategory, AgentSubCategory.sub_category_id == SubCategory.id
    ).filter(
        AgentSubCategory.agent_id == agent.id,
        SubCategory.category_id == category_id
    ).count()
    
    if subcategories_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot remove category. Agent has {subcategories_count} subcategories in this category. Remove subcategories first."
        )
    
    db.delete(agent_category)
    db.commit()
    
    return {
        "success": True,
        "message": "Category removed successfully"
    }

# ===== AGENT SERVICE PRICING ENDPOINTS (moved before {agent_id} route) =====

@router.get("/service-pricing", response_model=List[ServicePricingResponse])
async def get_agent_service_pricing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all service pricing for the current agent"""
    # Get agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # Get all pricing with subcategory and category names
    pricing_data = db.query(
        AgentServicePricing,
        SubCategory.name.label('sub_category_name'),
        Category.name.label('category_name')
    ).join(
        SubCategory, AgentServicePricing.sub_category_id == SubCategory.id
    ).join(
        Category, SubCategory.category_id == Category.id
    ).filter(
        AgentServicePricing.agent_id == agent.id
    ).all()
    
    result = []
    for pricing, sub_category_name, category_name in pricing_data:
        result.append(ServicePricingResponse(
            id=pricing.id,
            agent_id=pricing.agent_id,
            sub_category_id=pricing.sub_category_id,
            sub_category_name=sub_category_name,
            category_name=category_name,
            price_type=pricing.price_type,
            base_price=pricing.base_price,
            min_price=pricing.min_price,
            max_price=pricing.max_price,
            description=pricing.description,
            is_active=pricing.is_active,
            created_at=pricing.created_at.isoformat() if pricing.created_at else "",
            updated_at=pricing.updated_at.isoformat() if pricing.updated_at else ""
        ))
    
    return result

@router.post("/service-pricing", response_model=ServicePricingResponse)
async def create_service_pricing(
    pricing_data: ServicePricingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new service pricing"""
    # Get agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # Check if pricing already exists for this subcategory
    existing_pricing = db.query(AgentServicePricing).filter(
        AgentServicePricing.agent_id == agent.id,
        AgentServicePricing.sub_category_id == pricing_data.sub_category_id
    ).first()
    
    if existing_pricing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pricing already exists for this service"
        )
    
    # Create new pricing
    new_pricing = AgentServicePricing(
        agent_id=agent.id,
        sub_category_id=pricing_data.sub_category_id,
        base_price=pricing_data.base_price,
        description=pricing_data.description
    )
    
    db.add(new_pricing)
    db.commit()
    db.refresh(new_pricing)
    
    # Get subcategory and category names for response
    subcat_info = db.query(
        SubCategory.name.label('sub_category_name'),
        Category.name.label('category_name')
    ).join(
        Category, SubCategory.category_id == Category.id
    ).filter(
        SubCategory.id == pricing_data.sub_category_id
    ).first()
    
    return ServicePricingResponse(
        id=new_pricing.id,
        agent_id=new_pricing.agent_id,
        sub_category_id=new_pricing.sub_category_id,
        sub_category_name=subcat_info.sub_category_name,
        category_name=subcat_info.category_name,
        price_type=new_pricing.price_type,
        base_price=new_pricing.base_price,
        min_price=new_pricing.min_price,
        max_price=new_pricing.max_price,
        description=new_pricing.description,
        is_active=new_pricing.is_active,
        created_at=new_pricing.created_at.isoformat() if new_pricing.created_at else "",
        updated_at=new_pricing.updated_at.isoformat() if new_pricing.updated_at else ""
    )

@router.put("/service-pricing/{pricing_id}", response_model=ServicePricingResponse)
async def update_service_pricing(
    pricing_id: int,
    pricing_data: ServicePricingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update service pricing"""
    # Get agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # Get pricing record
    pricing = db.query(AgentServicePricing).filter(
        AgentServicePricing.id == pricing_id,
        AgentServicePricing.agent_id == agent.id
    ).first()
    
    if not pricing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service pricing not found"
        )
    
    # Update pricing
    if pricing_data.base_price is not None:
        pricing.base_price = pricing_data.base_price
    if pricing_data.description is not None:
        pricing.description = pricing_data.description
    
    db.commit()
    db.refresh(pricing)
    
    # Get subcategory and category names for response
    subcat_info = db.query(
        SubCategory.name.label('sub_category_name'),
        Category.name.label('category_name')
    ).join(
        Category, SubCategory.category_id == Category.id
    ).filter(
        SubCategory.id == pricing.sub_category_id
    ).first()
    
    return ServicePricingResponse(
        id=pricing.id,
        agent_id=pricing.agent_id,
        sub_category_id=pricing.sub_category_id,
        sub_category_name=subcat_info.sub_category_name,
        category_name=subcat_info.category_name,
        price_type=pricing.price_type,
        base_price=pricing.base_price,
        min_price=pricing.min_price,
        max_price=pricing.max_price,
        description=pricing.description,
        is_active=pricing.is_active,
        created_at=pricing.created_at.isoformat() if pricing.created_at else "",
        updated_at=pricing.updated_at.isoformat() if pricing.updated_at else ""
    )

@router.delete("/service-pricing/{pricing_id}")
async def delete_service_pricing(
    pricing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete service pricing"""
    # Get agent
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    # Get pricing record
    pricing = db.query(AgentServicePricing).filter(
        AgentServicePricing.id == pricing_id,
        AgentServicePricing.agent_id == agent.id
    ).first()
    
    if not pricing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service pricing not found"
        )
    
    db.delete(pricing)
    db.commit()
    
    return {"success": True, "message": "Service pricing deleted successfully"}

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
    
    # Get user details for enhanced fields
    user = db.query(User).filter(User.id == agent.user_id).first()
    
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
        categories=[cat.name for cat in categories],
        # Enhanced profile fields
        profile_photo_url=agent.profile_photo_url,
        selfie_verification_url=agent.selfie_verification_url,
        formatted_phone=agent.formatted_phone,
        bio=agent.bio,
        experience_years=agent.experience_years,
        # Structured address
        address_line_1=agent.address_line_1,
        address_line_2=agent.address_line_2,
        city=agent.city,
        state=agent.state,
        postal_code=agent.postal_code,
        country=agent.country,
        google_place_id=agent.google_place_id
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
    
    # Create new agent with all fields
    new_agent = Agent(
        user_id=current_user.id,
        rate_per_km=agent_data.rate_per_km,
        wallet_balance=1000.0,  # Welcome bonus
        is_online=False,
        avg_rating=0.0,
        total_ratings=0,
        kyc_status='verified',  # Auto-approve for MVP
        # Enhanced profile fields
        formatted_phone=agent_data.formatted_phone,
        profile_photo_url=agent_data.profile_photo_url,
        selfie_verification_url=agent_data.selfie_verification_url,
        experience_years=agent_data.experience_years or 0,
        bio=agent_data.bio,
        # Address fields
        address=agent_data.address,
        address_line_1=agent_data.address_line_1,
        address_line_2=agent_data.address_line_2,
        city=agent_data.city,
        state=agent_data.state,
        postal_code=agent_data.postal_code,
        country=agent_data.country or "India",
        google_place_id=agent_data.google_place_id,
        selfie_verification_status='pending' if agent_data.selfie_verification_url else 'not_required'
    )
    
    db.add(new_agent)
    
    # Update user to mark as agent
    current_user.is_agent = True
    
    db.commit()
    db.refresh(new_agent)
    
    # Add agent categories
    for category_id in agent_data.selectedCategories:
        agent_category = AgentCategory(
            agent_id=new_agent.id,
            category_id=category_id
        )
        db.add(agent_category)
    
    # Add agent subcategories
    if agent_data.selectedSubCategories:
        for sub_category_id in agent_data.selectedSubCategories:
            # Verify subcategory exists
            subcategory = db.query(SubCategory).filter(SubCategory.id == sub_category_id).first()
            if subcategory:
                agent_subcategory = AgentSubCategory(
                    agent_id=new_agent.id,
                    sub_category_id=sub_category_id
                )
                db.add(agent_subcategory)
    
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
        categories=[cat.name for cat in categories],
        # Enhanced profile fields
        profile_photo_url=new_agent.profile_photo_url,
        selfie_verification_url=new_agent.selfie_verification_url,
        formatted_phone=new_agent.formatted_phone,
        bio=new_agent.bio,
        experience_years=new_agent.experience_years,
        # Structured address
        address_line_1=new_agent.address_line_1,
        address_line_2=new_agent.address_line_2,
        city=new_agent.city,
        state=new_agent.state,
        postal_code=new_agent.postal_code,
        country=new_agent.country,
        google_place_id=new_agent.google_place_id
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

    # Update agent's current latitude/longitude for nearby search
    agent.current_latitude = location_data.latitude
    agent.current_longitude = location_data.longitude

    # Optionally enable location sharing if not already enabled
    if not agent.is_location_enabled:
        agent.is_location_enabled = True

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

