"""
Agent Rating and Review API Routes
Handles all rating and review operations
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import json

from ..database import get_db
from ..auth.jwt import get_current_user
from ..user.models import User, Agent

router = APIRouter(prefix="/ratings", tags=["ratings"])

# Pydantic models for request/response
class RatingCreate(BaseModel):
    agent_id: int
    booking_id: Optional[int] = None
    rating: float = Field(..., ge=1, le=5)
    review_text: Optional[str] = None
    service_quality_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    value_for_money_rating: Optional[int] = Field(None, ge=1, le=5)
    would_recommend: bool = True
    review_photos: Optional[List[str]] = []

class RatingUpdate(BaseModel):
    rating: Optional[float] = Field(None, ge=1, le=5)
    review_text: Optional[str] = None
    service_quality_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    value_for_money_rating: Optional[int] = Field(None, ge=1, le=5)
    would_recommend: Optional[bool] = None

class AgentResponseCreate(BaseModel):
    response_text: str = Field(..., min_length=10, max_length=1000)

class RatingResponse(BaseModel):
    id: int
    user_id: int
    agent_id: int
    booking_id: Optional[int]
    rating: float
    review_text: Optional[str]
    service_quality_rating: Optional[int]
    punctuality_rating: Optional[int]
    communication_rating: Optional[int]
    value_for_money_rating: Optional[int]
    would_recommend: bool
    review_photos: List[str]
    is_verified: bool
    moderation_status: str
    created_at: datetime
    updated_at: datetime
    helpful_votes: int = 0
    user_name: Optional[str] = None
    agent_response: Optional[str] = None

class AgentRatingStats(BaseModel):
    agent_id: int
    total_ratings: int
    avg_rating: float
    avg_service_quality: float
    avg_punctuality: float
    avg_communication: float
    avg_value_for_money: float
    five_star_count: int
    four_star_count: int
    three_star_count: int
    two_star_count: int
    one_star_count: int
    total_reviews: int
    total_recommendations: int
    recommendation_percentage: float = 0

def execute_raw_sql(db: Session, query: str, params: dict = None):
    """Execute raw SQL query"""
    if params:
        result = db.execute(query, params)
    else:
        result = db.execute(query)
    return result

def get_agent_rating_stats(db: Session, agent_id: int) -> AgentRatingStats:
    """Get aggregated rating statistics for an agent"""
    query = """
    SELECT * FROM agent_rating_aggregates WHERE agent_id = :agent_id
    """
    result = execute_raw_sql(db, query, {"agent_id": agent_id}).fetchone()
    
    if not result:
        # Initialize if not exists
        init_query = """
        INSERT OR IGNORE INTO agent_rating_aggregates 
        (agent_id, last_updated) VALUES (:agent_id, :now)
        """
        execute_raw_sql(db, init_query, {
            "agent_id": agent_id, 
            "now": datetime.utcnow()
        })
        db.commit()
        
        # Return default stats
        return AgentRatingStats(
            agent_id=agent_id,
            total_ratings=0,
            avg_rating=0,
            avg_service_quality=0,
            avg_punctuality=0,
            avg_communication=0,
            avg_value_for_money=0,
            five_star_count=0,
            four_star_count=0,
            three_star_count=0,
            two_star_count=0,
            one_star_count=0,
            total_reviews=0,
            total_recommendations=0,
            recommendation_percentage=0
        )
    
    # Convert result to dict for easier access
    stats = dict(result._asdict()) if hasattr(result, '_asdict') else dict(result)
    
    # Calculate recommendation percentage
    rec_percentage = 0
    if stats['total_ratings'] > 0:
        rec_percentage = (stats['total_recommendations'] / stats['total_ratings']) * 100
    
    return AgentRatingStats(
        agent_id=stats['agent_id'],
        total_ratings=stats['total_ratings'],
        avg_rating=round(stats['avg_rating'], 2),
        avg_service_quality=round(stats['avg_service_quality'], 2),
        avg_punctuality=round(stats['avg_punctuality'], 2),
        avg_communication=round(stats['avg_communication'], 2),
        avg_value_for_money=round(stats['avg_value_for_money'], 2),
        five_star_count=stats['five_star_count'],
        four_star_count=stats['four_star_count'],
        three_star_count=stats['three_star_count'],
        two_star_count=stats['two_star_count'],
        one_star_count=stats['one_star_count'],
        total_reviews=stats['total_reviews'],
        total_recommendations=stats['total_recommendations'],
        recommendation_percentage=round(rec_percentage, 1)
    )

@router.post("/", response_model=dict)
async def create_rating(
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new rating for an agent"""
    
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == rating_data.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Check if user already rated this agent for this booking
    if rating_data.booking_id:
        existing_query = """
        SELECT id FROM agent_ratings 
        WHERE user_id = :user_id AND agent_id = :agent_id AND booking_id = :booking_id
        """
        existing = execute_raw_sql(db, existing_query, {
            "user_id": current_user.id,
            "agent_id": rating_data.agent_id,
            "booking_id": rating_data.booking_id
        }).fetchone()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already rated this agent for this booking"
            )
    
    # Insert new rating
    insert_query = """
    INSERT INTO agent_ratings (
        user_id, agent_id, booking_id, rating, review_text,
        service_quality_rating, punctuality_rating, communication_rating,
        value_for_money_rating, would_recommend, review_photos,
        moderation_status, created_at, updated_at
    ) VALUES (
        :user_id, :agent_id, :booking_id, :rating, :review_text,
        :service_quality_rating, :punctuality_rating, :communication_rating,
        :value_for_money_rating, :would_recommend, :review_photos,
        'approved', :now, :now
    )
    """
    
    execute_raw_sql(db, insert_query, {
        "user_id": current_user.id,
        "agent_id": rating_data.agent_id,
        "booking_id": rating_data.booking_id,
        "rating": rating_data.rating,
        "review_text": rating_data.review_text,
        "service_quality_rating": rating_data.service_quality_rating,
        "punctuality_rating": rating_data.punctuality_rating,
        "communication_rating": rating_data.communication_rating,
        "value_for_money_rating": rating_data.value_for_money_rating,
        "would_recommend": rating_data.would_recommend,
        "review_photos": json.dumps(rating_data.review_photos or []),
        "now": datetime.utcnow()
    })
    
    db.commit()
    
    return {
        "message": "Rating created successfully",
        "rating": rating_data.rating,
        "agent_id": rating_data.agent_id
    }

@router.get("/agent/{agent_id}", response_model=List[RatingResponse])
async def get_agent_ratings(
    agent_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get all ratings for a specific agent"""
    
    query = """
    SELECT 
        r.*,
        u.name as user_name,
        resp.response_text as agent_response,
        COALESCE(hv.helpful_count, 0) as helpful_votes
    FROM agent_ratings r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN agent_review_responses resp ON r.id = resp.rating_id
    LEFT JOIN (
        SELECT rating_id, COUNT(*) as helpful_count 
        FROM rating_helpful_votes 
        WHERE is_helpful = 1 
        GROUP BY rating_id
    ) hv ON r.id = hv.rating_id
    WHERE r.agent_id = :agent_id AND r.moderation_status = 'approved'
    ORDER BY r.created_at DESC
    LIMIT :limit OFFSET :skip
    """
    
    results = execute_raw_sql(db, query, {
        "agent_id": agent_id,
        "limit": limit,
        "skip": skip
    }).fetchall()
    
    ratings = []
    for row in results:
        row_dict = dict(row._asdict()) if hasattr(row, '_asdict') else dict(row)
        
        # Parse review photos
        photos = []
        if row_dict.get('review_photos'):
            try:
                photos = json.loads(row_dict['review_photos'])
            except:
                photos = []
        
        ratings.append(RatingResponse(
            id=row_dict['id'],
            user_id=row_dict['user_id'],
            agent_id=row_dict['agent_id'],
            booking_id=row_dict['booking_id'],
            rating=row_dict['rating'],
            review_text=row_dict['review_text'],
            service_quality_rating=row_dict['service_quality_rating'],
            punctuality_rating=row_dict['punctuality_rating'],
            communication_rating=row_dict['communication_rating'],
            value_for_money_rating=row_dict['value_for_money_rating'],
            would_recommend=bool(row_dict['would_recommend']),
            review_photos=photos,
            is_verified=bool(row_dict['is_verified']),
            moderation_status=row_dict['moderation_status'],
            created_at=row_dict['created_at'],
            updated_at=row_dict['updated_at'],
            helpful_votes=row_dict.get('helpful_votes', 0),
            user_name=row_dict.get('user_name'),
            agent_response=row_dict.get('agent_response')
        ))
    
    return ratings

@router.get("/agent/{agent_id}/stats", response_model=AgentRatingStats)
async def get_agent_rating_statistics(
    agent_id: int,
    db: Session = Depends(get_db)
):
    """Get aggregated rating statistics for an agent"""
    
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    return get_agent_rating_stats(db, agent_id)

@router.post("/agent/{agent_id}/response")
async def create_agent_response(
    agent_id: int,
    rating_id: int,
    response_data: AgentResponseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allow agent to respond to a review"""
    
    # Verify current user is the agent
    agent = db.query(Agent).filter(
        Agent.id == agent_id, 
        Agent.user_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to your own reviews"
        )
    
    # Check if rating exists and belongs to this agent
    rating_query = """
    SELECT id FROM agent_ratings 
    WHERE id = :rating_id AND agent_id = :agent_id
    """
    rating = execute_raw_sql(db, rating_query, {
        "rating_id": rating_id,
        "agent_id": agent_id
    }).fetchone()
    
    if not rating:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating not found"
        )
    
    # Insert or update agent response
    response_query = """
    INSERT OR REPLACE INTO agent_review_responses 
    (rating_id, agent_id, response_text, created_at, updated_at)
    VALUES (:rating_id, :agent_id, :response_text, :now, :now)
    """
    
    execute_raw_sql(db, response_query, {
        "rating_id": rating_id,
        "agent_id": agent_id,
        "response_text": response_data.response_text,
        "now": datetime.utcnow()
    })
    
    db.commit()
    
    return {"message": "Response posted successfully"}

@router.post("/helpful/{rating_id}")
async def vote_rating_helpful(
    rating_id: int,
    is_helpful: bool,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Vote if a rating is helpful or not"""
    
    # Insert or update helpful vote
    vote_query = """
    INSERT OR REPLACE INTO rating_helpful_votes 
    (rating_id, user_id, is_helpful, created_at)
    VALUES (:rating_id, :user_id, :is_helpful, :now)
    """
    
    execute_raw_sql(db, vote_query, {
        "rating_id": rating_id,
        "user_id": current_user.id,
        "is_helpful": is_helpful,
        "now": datetime.utcnow()
    })
    
    db.commit()
    
    return {"message": "Vote recorded successfully"}

@router.get("/user/my-ratings", response_model=List[RatingResponse])
async def get_my_ratings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's ratings"""
    
    query = """
    SELECT 
        r.*,
        a.user_id as agent_user_id,
        u.name as agent_name,
        resp.response_text as agent_response
    FROM agent_ratings r
    LEFT JOIN agents a ON r.agent_id = a.id
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN agent_review_responses resp ON r.id = resp.rating_id
    WHERE r.user_id = :user_id
    ORDER BY r.created_at DESC
    LIMIT :limit OFFSET :skip
    """
    
    results = execute_raw_sql(db, query, {
        "user_id": current_user.id,
        "limit": limit,
        "skip": skip
    }).fetchall()
    
    ratings = []
    for row in results:
        row_dict = dict(row._asdict()) if hasattr(row, '_asdict') else dict(row)
        
        # Parse review photos
        photos = []
        if row_dict.get('review_photos'):
            try:
                photos = json.loads(row_dict['review_photos'])
            except:
                photos = []
        
        ratings.append(RatingResponse(
            id=row_dict['id'],
            user_id=row_dict['user_id'],
            agent_id=row_dict['agent_id'],
            booking_id=row_dict['booking_id'],
            rating=row_dict['rating'],
            review_text=row_dict['review_text'],
            service_quality_rating=row_dict['service_quality_rating'],
            punctuality_rating=row_dict['punctuality_rating'],
            communication_rating=row_dict['communication_rating'],
            value_for_money_rating=row_dict['value_for_money_rating'],
            would_recommend=bool(row_dict['would_recommend']),
            review_photos=photos,
            is_verified=bool(row_dict['is_verified']),
            moderation_status=row_dict['moderation_status'],
            created_at=row_dict['created_at'],
            updated_at=row_dict['updated_at'],
            user_name=row_dict.get('agent_name'),  # Agent name in this case
            agent_response=row_dict.get('agent_response')
        ))
    
    return ratings