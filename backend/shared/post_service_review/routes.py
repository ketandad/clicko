"""
Post-Service Review API Routes
FastAPI endpoints for comprehensive review and rating system
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any
from datetime import datetime, date, timedelta
import logging

from ..database import get_db
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session
from .service import PostServiceReviewService
from .models import ReviewStatus, ReportReason

router = APIRouter(prefix="/reviews", tags=["reviews"])
logger = logging.getLogger(__name__)

# Pydantic Models
class ReviewSubmission(BaseModel):
    booking_id: int
    customer_id: int
    agent_id: int
    overall_rating: int = Field(..., ge=1, le=5)
    
    # Category ratings (optional)
    service_quality_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    professionalism_rating: Optional[int] = Field(None, ge=1, le=5)
    value_for_money_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    cleanliness_rating: Optional[int] = Field(None, ge=1, le=5)
    
    # Review content
    review_title: Optional[str] = Field(None, max_length=200)
    review_text: Optional[str] = Field(None, max_length=2000)
    would_recommend: bool = Field(default=True)
    
    # Service experience indicators
    service_completed_on_time: Optional[bool] = None
    service_met_expectations: Optional[bool] = None
    agent_was_prepared: Optional[bool] = None
    
    # Media attachments
    review_photos: Optional[List[str]] = None
    review_videos: Optional[List[str]] = None
    
    # Customer information
    customer_name: Optional[str] = None
    customer_avatar: Optional[str] = None
    is_repeat_customer: bool = Field(default=False)
    
    @validator('review_text')
    def validate_review_text(cls, v):
        if v and len(v.strip()) < 10:
            raise ValueError('Review text must be at least 10 characters long')
        return v

class ReviewVote(BaseModel):
    is_helpful: bool

class ReviewReport(BaseModel):
    reason: ReportReason
    description: Optional[str] = Field(None, max_length=500)

class AgentResponse(BaseModel):
    response_text: str = Field(..., max_length=1000)

# API Routes
@router.post("/submit")
async def submit_review(
    review_data: ReviewSubmission,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submit a new service review
    """
    try:
        service = PostServiceReviewService(db)
        
        # Convert Pydantic model to dict
        review_dict = review_data.dict()
        
        result = service.submit_review(review_dict)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # TODO: Add background tasks for notifications
        # background_tasks.add_task(send_review_notifications, result["review_uuid"])
        
        return {
            "success": True,
            "message": "Review submitted successfully",
            "review_uuid": result["review_uuid"],
            "status": result["status"],
            "is_verified": result["is_verified"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting review: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit review")

@router.get("/agent/{agent_id}")
async def get_agent_reviews(
    agent_id: int,
    status: str = Query("approved", description="Review status filter"),
    sort_by: str = Query("newest", description="Sort order"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Get reviews for a specific agent
    """
    try:
        service = PostServiceReviewService(db)
        
        # Validate status
        if status not in ["pending", "approved", "flagged", "removed"]:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        
        # Validate sort_by
        valid_sorts = ["newest", "oldest", "highest_rated", "lowest_rated", "most_helpful"]
        if sort_by not in valid_sorts:
            raise HTTPException(status_code=400, detail="Invalid sort order")
        
        result = service.get_agent_reviews(agent_id, status, limit, offset, sort_by)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {
            "success": True,
            "reviews": result["reviews"],
            "pagination": result["pagination"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent reviews: {e}")
        raise HTTPException(status_code=500, detail="Failed to get reviews")

@router.get("/agent/{agent_id}/reputation")
async def get_agent_reputation(
    agent_id: int,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive reputation summary for an agent
    """
    try:
        service = PostServiceReviewService(db)
        
        result = service.get_agent_reputation_summary(agent_id)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {
            "success": True,
            "reputation": result["reputation_summary"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting agent reputation: {e}")
        raise HTTPException(status_code=500, detail="Failed to get reputation data")

@router.post("/{review_uuid}/vote")
async def vote_on_review(
    review_uuid: str,
    vote_data: ReviewVote,
    user_id: int = Query(..., description="ID of user voting"),
    db: Session = Depends(get_db)
):
    """
    Vote on review helpfulness
    """
    try:
        service = PostServiceReviewService(db)
        
        result = service.vote_on_review_helpfulness(review_uuid, user_id, vote_data.is_helpful)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "message": "Vote recorded successfully",
            "helpful_votes": result["helpful_votes"],
            "unhelpful_votes": result["unhelpful_votes"],
            "helpfulness_score": result["helpfulness_score"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error voting on review: {e}")
        raise HTTPException(status_code=500, detail="Failed to record vote")

@router.post("/{review_uuid}/report")
async def report_review(
    review_uuid: str,
    report_data: ReviewReport,
    reporter_id: int = Query(..., description="ID of user reporting"),
    db: Session = Depends(get_db)
):
    """
    Report a review for inappropriate content
    """
    try:
        service = PostServiceReviewService(db)
        
        result = service.report_review(
            review_uuid, 
            reporter_id, 
            report_data.reason.value, 
            report_data.description
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "message": "Review reported successfully",
            "report_uuid": result["report_uuid"],
            "review_status": result["review_status"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reporting review: {e}")
        raise HTTPException(status_code=500, detail="Failed to report review")

@router.post("/invitation/create")
async def create_review_invitation(
    booking_id: int,
    customer_id: int,
    agent_id: int,
    service_completion_date: datetime,
    db: Session = Depends(get_db)
):
    """
    Create review invitation after service completion
    Internal API for system use
    """
    try:
        service = PostServiceReviewService(db)
        
        result = service.create_review_invitation(
            booking_id, customer_id, agent_id, service_completion_date
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "message": "Review invitation created",
            "invitation_uuid": result["invitation_uuid"],
            "invitation_token": result["invitation_token"],
            "expires_at": result["expires_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating review invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to create invitation")

@router.get("/invitation/{invitation_token}")
async def get_review_invitation(
    invitation_token: str,
    db: Session = Depends(get_db)
):
    """
    Get review invitation details by token
    """
    try:
        from .models import ReviewInvitation
        
        invitation = db.query(ReviewInvitation).filter(
            ReviewInvitation.invitation_token == invitation_token
        ).first()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        
        if invitation.is_expired:
            raise HTTPException(status_code=410, detail="Invitation has expired")
        
        if invitation.review_submitted:
            raise HTTPException(status_code=409, detail="Review already submitted")
        
        # Mark invitation as opened
        if not invitation.invitation_opened:
            invitation.invitation_opened = True
            invitation.invitation_opened_at = datetime.utcnow()
            db.commit()
        
        return {
            "success": True,
            "invitation": {
                "invitation_uuid": invitation.invitation_uuid,
                "booking_id": invitation.booking_id,
                "customer_id": invitation.customer_id,
                "agent_id": invitation.agent_id,
                "service_completion_date": invitation.service_completion_date.isoformat(),
                "days_since_service": invitation.days_since_service,
                "expires_at": invitation.expires_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting review invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to get invitation")

@router.post("/{review_uuid}/agent-response")
async def add_agent_response(
    review_uuid: str,
    response_data: AgentResponse,
    agent_id: int = Query(..., description="ID of agent responding"),
    db: Session = Depends(get_db)
):
    """
    Add agent response to a review
    """
    try:
        from .models import ServiceReview
        
        # Get review
        review = db.query(ServiceReview).filter(
            ServiceReview.review_uuid == review_uuid
        ).first()
        
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        
        if review.agent_id != agent_id:
            raise HTTPException(status_code=403, detail="Not authorized to respond to this review")
        
        if review.agent_response:
            raise HTTPException(status_code=409, detail="Agent has already responded to this review")
        
        # Add response
        review.agent_response = response_data.response_text
        review.agent_response_date = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"💬 Agent {agent_id} responded to review {review_uuid}")
        
        return {
            "success": True,
            "message": "Response added successfully",
            "response_date": review.agent_response_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding agent response: {e}")
        raise HTTPException(status_code=500, detail="Failed to add response")

@router.get("/stats/system")
async def get_system_review_stats(
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get system-wide review statistics
    Admin endpoint
    """
    try:
        from .models import ServiceReview, ReviewReport
        from sqlalchemy import func
        
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        # Overall review stats
        total_reviews = db.query(func.count(ServiceReview.id)).filter(
            ServiceReview.review_submitted_at >= datetime.combine(start_date, datetime.min.time()),
            ServiceReview.review_submitted_at <= datetime.combine(end_date, datetime.max.time())
        ).scalar()
        
        # Average rating
        avg_rating = db.query(func.avg(ServiceReview.overall_rating)).filter(
            ServiceReview.review_submitted_at >= datetime.combine(start_date, datetime.min.time()),
            ServiceReview.review_submitted_at <= datetime.combine(end_date, datetime.max.time()),
            ServiceReview.status == ReviewStatus.APPROVED
        ).scalar()
        
        # Status breakdown
        status_breakdown = db.query(
            ServiceReview.status,
            func.count(ServiceReview.id)
        ).filter(
            ServiceReview.review_submitted_at >= datetime.combine(start_date, datetime.min.time()),
            ServiceReview.review_submitted_at <= datetime.combine(end_date, datetime.max.time())
        ).group_by(ServiceReview.status).all()
        
        # Rating distribution
        rating_distribution = db.query(
            ServiceReview.overall_rating,
            func.count(ServiceReview.id)
        ).filter(
            ServiceReview.review_submitted_at >= datetime.combine(start_date, datetime.min.time()),
            ServiceReview.review_submitted_at <= datetime.combine(end_date, datetime.max.time()),
            ServiceReview.status == ReviewStatus.APPROVED
        ).group_by(ServiceReview.overall_rating).all()
        
        # Recent reports
        recent_reports = db.query(func.count(ReviewReport.id)).filter(
            ReviewReport.created_at >= datetime.combine(start_date, datetime.min.time()),
            ReviewReport.created_at <= datetime.combine(end_date, datetime.max.time())
        ).scalar()
        
        return {
            "success": True,
            "stats": {
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "overall": {
                    "total_reviews": total_reviews,
                    "average_rating": round(float(avg_rating or 0), 2),
                    "recent_reports": recent_reports
                },
                "status_breakdown": {
                    status.value: count for status, count in status_breakdown
                },
                "rating_distribution": {
                    f"{rating}_star": count for rating, count in rating_distribution
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting system review stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get review statistics")

# Additional utility endpoints
@router.get("/featured")
async def get_featured_reviews(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Get featured reviews across all agents
    """
    try:
        from .models import ServiceReview
        
        featured_reviews = db.query(ServiceReview).filter(
            and_(
                ServiceReview.is_featured == True,
                ServiceReview.status == ReviewStatus.APPROVED
            )
        ).order_by(desc(ServiceReview.review_submitted_at))\
         .limit(limit).all()
        
        reviews_data = []
        for review in featured_reviews:
            reviews_data.append({
                "review_uuid": review.review_uuid,
                "agent_id": review.agent_id,
                "overall_rating": review.overall_rating,
                "review_title": review.review_title,
                "review_text": review.review_text,
                "customer_name": review.customer_name,
                "service_date": review.service_date.isoformat(),
                "helpful_votes": review.helpful_votes,
                "helpfulness_score": review.helpfulness_score
            })
        
        return {
            "success": True,
            "featured_reviews": reviews_data,
            "total_count": len(reviews_data)
        }
        
    except Exception as e:
        logger.error(f"Error getting featured reviews: {e}")
        raise HTTPException(status_code=500, detail="Failed to get featured reviews")