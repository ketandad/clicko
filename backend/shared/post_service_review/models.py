"""
Enhanced Review and Rating System Models
Post-service rating system with detailed reviews and reputation management
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, JSON, Index, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timedelta
from enum import Enum
import uuid
import json

Base = declarative_base()

class RatingCategory(str, Enum):
    OVERALL = "overall"
    SERVICE_QUALITY = "service_quality"
    PUNCTUALITY = "punctuality"
    PROFESSIONALISM = "professionalism"
    VALUE_FOR_MONEY = "value_for_money"
    COMMUNICATION = "communication"
    CLEANLINESS = "cleanliness"

class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    FLAGGED = "flagged"
    REMOVED = "removed"

class ReportReason(str, Enum):
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    FAKE_REVIEW = "fake_review"
    SPAM = "spam"
    OFFENSIVE_LANGUAGE = "offensive_language"
    PERSONAL_INFO = "personal_info"
    OTHER = "other"

class ServiceReview(Base):
    """
    Comprehensive post-service review system
    """
    __tablename__ = "service_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    review_uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Overall Rating (1-5 stars)
    overall_rating = Column(Integer, nullable=False, index=True)
    
    # Detailed Category Ratings (1-5 stars each)
    service_quality_rating = Column(Integer, nullable=True)
    punctuality_rating = Column(Integer, nullable=True)
    professionalism_rating = Column(Integer, nullable=True)
    value_for_money_rating = Column(Integer, nullable=True)
    communication_rating = Column(Integer, nullable=True)
    cleanliness_rating = Column(Integer, nullable=True)
    
    # Review Content
    review_title = Column(String(200), nullable=True)
    review_text = Column(Text, nullable=True)
    would_recommend = Column(Boolean, default=True, index=True)
    
    # Service Details
    service_completed_on_time = Column(Boolean, nullable=True)
    service_met_expectations = Column(Boolean, nullable=True)
    agent_was_prepared = Column(Boolean, nullable=True)
    
    # Media Attachments
    review_photos = Column(JSON, nullable=True)  # Array of photo URLs
    review_videos = Column(JSON, nullable=True)  # Array of video URLs
    
    # Review Metadata
    status = Column(SQLEnum(ReviewStatus), default=ReviewStatus.PENDING, index=True)
    is_verified = Column(Boolean, default=False, index=True)  # Verified purchase
    is_featured = Column(Boolean, default=False, index=True)  # Featured review
    
    # Engagement Metrics
    helpful_votes = Column(Integer, default=0, index=True)
    unhelpful_votes = Column(Integer, default=0)
    total_votes = Column(Integer, default=0)
    report_count = Column(Integer, default=0, index=True)
    
    # Agent Response
    agent_response = Column(Text, nullable=True)
    agent_response_date = Column(DateTime, nullable=True)
    
    # Timing Information
    service_date = Column(DateTime, nullable=False, index=True)
    review_submitted_at = Column(DateTime, default=datetime.utcnow, index=True)
    days_after_service = Column(Integer, nullable=True)  # Auto-calculated
    
    # Admin Moderation
    moderated_by = Column(String(100), nullable=True)
    moderated_at = Column(DateTime, nullable=True)
    moderation_notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Customer Information (for review context)
    customer_name = Column(String(100), nullable=True)  # For display
    customer_avatar = Column(String(200), nullable=True)
    is_repeat_customer = Column(Boolean, default=False)
    
    # Relationships
    booking = relationship("Booking", back_populates="review")
    customer = relationship("User", foreign_keys=[customer_id], back_populates="reviews_given")
    agent = relationship("Agent", back_populates="reviews_received")
    helpful_votes_records = relationship("ReviewHelpfulVote", back_populates="review", cascade="all, delete-orphan")
    reports = relationship("ReviewReport", back_populates="review", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_review_agent_rating", "agent_id", "overall_rating"),
        Index("idx_review_agent_date", "agent_id", "review_submitted_at"),
        Index("idx_review_status_date", "status", "review_submitted_at"),
        Index("idx_review_verified_featured", "is_verified", "is_featured"),
        Index("idx_review_service_date", "service_date"),
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.service_date and not self.days_after_service:
            self.days_after_service = (datetime.utcnow() - self.service_date).days
    
    @property
    def average_category_rating(self):
        """Calculate average of all category ratings"""
        ratings = [
            self.service_quality_rating,
            self.punctuality_rating, 
            self.professionalism_rating,
            self.value_for_money_rating,
            self.communication_rating,
            self.cleanliness_rating
        ]
        valid_ratings = [r for r in ratings if r is not None]
        return sum(valid_ratings) / len(valid_ratings) if valid_ratings else 0
    
    @property
    def helpfulness_score(self):
        """Calculate review helpfulness percentage"""
        if self.total_votes == 0:
            return 0
        return round((self.helpful_votes / self.total_votes) * 100, 1)
    
    @property
    def is_recent(self):
        """Check if review is from last 30 days"""
        return (datetime.utcnow() - self.review_submitted_at).days <= 30
    
    @property
    def review_age_days(self):
        """Get review age in days"""
        return (datetime.utcnow() - self.review_submitted_at).days

class ReviewHelpfulVote(Base):
    """
    Track helpful/unhelpful votes on reviews
    """
    __tablename__ = "review_helpful_votes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    review_id = Column(Integer, ForeignKey("service_reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Vote Details
    is_helpful = Column(Boolean, nullable=False)  # True = helpful, False = unhelpful
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    review = relationship("ServiceReview", back_populates="helpful_votes_records")
    user = relationship("User", back_populates="review_votes")
    
    # Unique constraint to prevent duplicate votes
    __table_args__ = (
        Index("idx_unique_review_vote", "review_id", "user_id", unique=True),
    )

class ReviewReport(Base):
    """
    Reports for inappropriate or fake reviews
    """
    __tablename__ = "review_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    review_id = Column(Integer, ForeignKey("service_reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Report Details
    reason = Column(SQLEnum(ReportReason), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Status and Resolution
    status = Column(String(20), default="pending", index=True)  # pending, investigating, resolved, dismissed
    priority = Column(String(20), default="medium")  # low, medium, high
    
    # Admin Resolution
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    admin_notes = Column(Text, nullable=True)
    action_taken = Column(String(50), nullable=True)  # none, warning, removal, ban
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    review = relationship("ServiceReview", back_populates="reports")
    reporter = relationship("User", back_populates="review_reports")
    
    @property
    def is_resolved(self):
        """Check if report has been resolved"""
        return self.status in ["resolved", "dismissed"]
    
    @property
    def days_open(self):
        """Calculate days since report was created"""
        return (datetime.utcnow() - self.created_at).days

class AgentReputationMetrics(Base):
    """
    Pre-calculated reputation metrics for agents
    Updated automatically when reviews are added/updated
    """
    __tablename__ = "agent_reputation_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Overall Statistics
    total_reviews = Column(Integer, default=0, index=True)
    average_overall_rating = Column(Float, default=0.0, index=True)
    recommendation_percentage = Column(Float, default=0.0)
    
    # Category Averages
    avg_service_quality = Column(Float, default=0.0)
    avg_punctuality = Column(Float, default=0.0)
    avg_professionalism = Column(Float, default=0.0)
    avg_value_for_money = Column(Float, default=0.0)
    avg_communication = Column(Float, default=0.0)
    avg_cleanliness = Column(Float, default=0.0)
    
    # Rating Distribution
    rating_1_count = Column(Integer, default=0)
    rating_2_count = Column(Integer, default=0)
    rating_3_count = Column(Integer, default=0)
    rating_4_count = Column(Integer, default=0)
    rating_5_count = Column(Integer, default=0)
    
    # Service Performance Indicators
    on_time_percentage = Column(Float, default=0.0)
    expectations_met_percentage = Column(Float, default=0.0)
    prepared_percentage = Column(Float, default=0.0)
    
    # Review Engagement
    total_helpful_votes = Column(Integer, default=0)
    featured_reviews_count = Column(Integer, default=0)
    verified_reviews_count = Column(Integer, default=0)
    
    # Recent Performance (last 30 days)
    recent_reviews_count = Column(Integer, default=0)
    recent_average_rating = Column(Float, default=0.0)
    
    # Quality Indicators
    response_rate = Column(Float, default=0.0)  # Percentage of reviews with agent responses
    average_response_time_hours = Column(Float, default=0.0)
    
    # Last Review Information
    last_review_date = Column(DateTime, nullable=True, index=True)
    last_review_rating = Column(Integer, nullable=True)
    
    # Calculation Metadata
    calculated_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="reputation_metrics")
    
    @property
    def reputation_score(self):
        """
        Calculate overall reputation score (0-100)
        Weighted combination of rating, review count, and engagement
        """
        if self.total_reviews == 0:
            return 0
        
        # Base score from average rating (0-20 points)
        rating_score = (self.average_overall_rating / 5) * 20
        
        # Review volume bonus (0-20 points, logarithmic)
        import math
        volume_score = min(20, math.log(self.total_reviews + 1) * 3)
        
        # Quality indicators (0-30 points)
        quality_score = (
            (self.on_time_percentage / 100) * 10 +
            (self.expectations_met_percentage / 100) * 10 +
            (self.recommendation_percentage / 100) * 10
        )
        
        # Engagement bonus (0-15 points)
        engagement_score = min(15, 
            (self.verified_reviews_count / max(1, self.total_reviews)) * 10 +
            (self.featured_reviews_count / max(1, self.total_reviews)) * 5
        )
        
        # Recent activity bonus (0-15 points)
        recent_score = 0
        if self.recent_reviews_count > 0:
            recent_score = min(15,
                (self.recent_average_rating / 5) * 10 +
                min(5, self.recent_reviews_count)
            )
        
        return min(100, rating_score + volume_score + quality_score + engagement_score + recent_score)
    
    @property
    def reputation_badge(self):
        """Get reputation badge based on score"""
        score = self.reputation_score
        if score >= 90:
            return "platinum"
        elif score >= 80:
            return "gold"
        elif score >= 70:
            return "silver"
        elif score >= 60:
            return "bronze"
        else:
            return "standard"

class ReviewInvitation(Base):
    """
    Track review invitations sent to customers after service completion
    """
    __tablename__ = "review_invitations"
    
    id = Column(Integer, primary_key=True, index=True)
    invitation_uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Invitation Status
    invitation_sent = Column(Boolean, default=False, index=True)
    invitation_sent_at = Column(DateTime, nullable=True)
    
    # Response Tracking
    invitation_opened = Column(Boolean, default=False)
    invitation_opened_at = Column(DateTime, nullable=True)
    
    review_submitted = Column(Boolean, default=False, index=True)
    review_submitted_at = Column(DateTime, nullable=True)
    
    # Reminder System
    first_reminder_sent = Column(Boolean, default=False)
    first_reminder_sent_at = Column(DateTime, nullable=True)
    
    second_reminder_sent = Column(Boolean, default=False)
    second_reminder_sent_at = Column(DateTime, nullable=True)
    
    # Service Details
    service_completion_date = Column(DateTime, nullable=False, index=True)
    
    # Invitation Details
    invitation_method = Column(String(20), default="email")  # email, sms, push, in_app
    invitation_token = Column(String(100), unique=True, index=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    booking = relationship("Booking", back_populates="review_invitation")
    customer = relationship("User", foreign_keys=[customer_id])
    agent = relationship("Agent", foreign_keys=[agent_id])
    
    @property
    def is_expired(self):
        """Check if invitation has expired"""
        return self.expires_at and datetime.utcnow() > self.expires_at
    
    @property
    def days_since_service(self):
        """Calculate days since service completion"""
        return (datetime.utcnow() - self.service_completion_date).days
    
    @property
    def needs_reminder(self):
        """Check if customer needs a reminder"""
        if self.review_submitted:
            return False
        
        days_since = self.days_since_service
        
        # First reminder after 3 days
        if days_since >= 3 and not self.first_reminder_sent:
            return True
        
        # Second reminder after 7 days
        if days_since >= 7 and not self.second_reminder_sent:
            return True
        
        return False