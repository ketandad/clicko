"""
Post-Service Review Service
Business logic for comprehensive review and rating system
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
import uuid
import statistics

from .models import (
    ServiceReview, ReviewHelpfulVote, ReviewReport, AgentReputationMetrics,
    ReviewInvitation, RatingCategory, ReviewStatus, ReportReason
)

logger = logging.getLogger(__name__)

class PostServiceReviewService:
    """
    Service for managing post-service reviews and agent reputation
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.review_invitation_expiry_days = 30
        self.auto_approve_verified_reviews = True
        self.min_review_length = 10
    
    def create_review_invitation(self, booking_id: int, customer_id: int, agent_id: int, 
                               service_completion_date: datetime) -> Dict[str, Any]:
        """
        Create review invitation after service completion
        """
        try:
            # Check if invitation already exists
            existing = self.db.query(ReviewInvitation).filter(
                ReviewInvitation.booking_id == booking_id
            ).first()
            
            if existing:
                return {"success": False, "error": "Review invitation already exists"}
            
            # Create invitation
            invitation_token = str(uuid.uuid4())
            expires_at = datetime.utcnow() + timedelta(days=self.review_invitation_expiry_days)
            
            invitation = ReviewInvitation(
                booking_id=booking_id,
                customer_id=customer_id,
                agent_id=agent_id,
                service_completion_date=service_completion_date,
                invitation_token=invitation_token,
                expires_at=expires_at
            )
            
            self.db.add(invitation)
            self.db.commit()
            self.db.refresh(invitation)
            
            logger.info(f"📝 Created review invitation {invitation.invitation_uuid} for booking {booking_id}")
            
            return {
                "success": True,
                "invitation_uuid": invitation.invitation_uuid,
                "invitation_token": invitation_token,
                "expires_at": expires_at.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error creating review invitation: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def submit_review(self, review_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit a new service review
        """
        try:
            # Validate review data
            if review_data['overall_rating'] < 1 or review_data['overall_rating'] > 5:
                return {"success": False, "error": "Overall rating must be between 1 and 5"}
            
            # Check if review already exists for this booking
            existing_review = self.db.query(ServiceReview).filter(
                ServiceReview.booking_id == review_data['booking_id']
            ).first()
            
            if existing_review:
                return {"success": False, "error": "Review already exists for this booking"}
            
            # Get booking details
            from ..booking.models import Booking
            booking = self.db.query(Booking).filter(Booking.id == review_data['booking_id']).first()
            if not booking:
                return {"success": False, "error": "Booking not found"}
            
            # Calculate days after service
            service_date = review_data.get('service_date') or booking.created_at
            days_after_service = (datetime.utcnow() - service_date).days
            
            # Create review
            review = ServiceReview(
                booking_id=review_data['booking_id'],
                customer_id=review_data['customer_id'],
                agent_id=review_data['agent_id'],
                overall_rating=review_data['overall_rating'],
                service_quality_rating=review_data.get('service_quality_rating'),
                punctuality_rating=review_data.get('punctuality_rating'),
                professionalism_rating=review_data.get('professionalism_rating'),
                value_for_money_rating=review_data.get('value_for_money_rating'),
                communication_rating=review_data.get('communication_rating'),
                cleanliness_rating=review_data.get('cleanliness_rating'),
                review_title=review_data.get('review_title'),
                review_text=review_data.get('review_text'),
                would_recommend=review_data.get('would_recommend', True),
                service_completed_on_time=review_data.get('service_completed_on_time'),
                service_met_expectations=review_data.get('service_met_expectations'),
                agent_was_prepared=review_data.get('agent_was_prepared'),
                review_photos=review_data.get('review_photos'),
                review_videos=review_data.get('review_videos'),
                service_date=service_date,
                days_after_service=days_after_service,
                customer_name=review_data.get('customer_name'),
                customer_avatar=review_data.get('customer_avatar'),
                is_repeat_customer=review_data.get('is_repeat_customer', False),
                is_verified=True  # Verified since it's from actual booking
            )
            
            # Auto-approve if configured and meets criteria
            if self.auto_approve_verified_reviews and self._should_auto_approve(review_data):
                review.status = ReviewStatus.APPROVED
            
            self.db.add(review)
            self.db.commit()
            self.db.refresh(review)
            
            # Update agent reputation metrics
            self.update_agent_reputation(review.agent_id)
            
            # Update review invitation status
            invitation = self.db.query(ReviewInvitation).filter(
                ReviewInvitation.booking_id == review_data['booking_id']
            ).first()
            
            if invitation:
                invitation.review_submitted = True
                invitation.review_submitted_at = datetime.utcnow()
                self.db.commit()
            
            logger.info(f"⭐ Submitted review {review.review_uuid} for agent {review.agent_id}")
            
            return {
                "success": True,
                "review_uuid": review.review_uuid,
                "status": review.status,
                "is_verified": review.is_verified
            }
            
        except Exception as e:
            logger.error(f"Error submitting review: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def get_agent_reviews(self, agent_id: int, status: str = "approved", 
                         limit: int = 20, offset: int = 0, sort_by: str = "newest") -> Dict[str, Any]:
        """
        Get reviews for an agent with filtering and pagination
        """
        try:
            query = self.db.query(ServiceReview).filter(
                and_(
                    ServiceReview.agent_id == agent_id,
                    ServiceReview.status == ReviewStatus(status)
                )
            )
            
            # Apply sorting
            if sort_by == "newest":
                query = query.order_by(desc(ServiceReview.review_submitted_at))
            elif sort_by == "oldest":
                query = query.order_by(ServiceReview.review_submitted_at)
            elif sort_by == "highest_rated":
                query = query.order_by(desc(ServiceReview.overall_rating))
            elif sort_by == "lowest_rated":
                query = query.order_by(ServiceReview.overall_rating)
            elif sort_by == "most_helpful":
                query = query.order_by(desc(ServiceReview.helpful_votes))
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            reviews = query.offset(offset).limit(limit).all()
            
            reviews_data = []
            for review in reviews:
                reviews_data.append({
                    "review_uuid": review.review_uuid,
                    "overall_rating": review.overall_rating,
                    "category_ratings": {
                        "service_quality": review.service_quality_rating,
                        "punctuality": review.punctuality_rating,
                        "professionalism": review.professionalism_rating,
                        "value_for_money": review.value_for_money_rating,
                        "communication": review.communication_rating,
                        "cleanliness": review.cleanliness_rating
                    },
                    "review_title": review.review_title,
                    "review_text": review.review_text,
                    "would_recommend": review.would_recommend,
                    "service_indicators": {
                        "completed_on_time": review.service_completed_on_time,
                        "met_expectations": review.service_met_expectations,
                        "agent_was_prepared": review.agent_was_prepared
                    },
                    "media": {
                        "photos": review.review_photos,
                        "videos": review.review_videos
                    },
                    "customer_info": {
                        "name": review.customer_name,
                        "avatar": review.customer_avatar,
                        "is_repeat_customer": review.is_repeat_customer
                    },
                    "engagement": {
                        "helpful_votes": review.helpful_votes,
                        "unhelpful_votes": review.unhelpful_votes,
                        "helpfulness_score": review.helpfulness_score
                    },
                    "metadata": {
                        "service_date": review.service_date.isoformat(),
                        "review_date": review.review_submitted_at.isoformat(),
                        "days_after_service": review.days_after_service,
                        "is_verified": review.is_verified,
                        "is_featured": review.is_featured,
                        "review_age_days": review.review_age_days
                    },
                    "agent_response": {
                        "response_text": review.agent_response,
                        "response_date": review.agent_response_date.isoformat() if review.agent_response_date else None
                    }
                })
            
            return {
                "success": True,
                "reviews": reviews_data,
                "pagination": {
                    "total_count": total_count,
                    "limit": limit,
                    "offset": offset,
                    "has_next": (offset + limit) < total_count,
                    "has_previous": offset > 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting agent reviews: {e}")
            return {"success": False, "error": str(e)}
    
    def get_agent_reputation_summary(self, agent_id: int) -> Dict[str, Any]:
        """
        Get comprehensive reputation summary for an agent
        """
        try:
            # Get or create reputation metrics
            metrics = self.db.query(AgentReputationMetrics).filter(
                AgentReputationMetrics.agent_id == agent_id
            ).first()
            
            if not metrics:
                metrics = self.create_initial_reputation_metrics(agent_id)
            
            # Get recent reviews stats
            recent_date = datetime.utcnow() - timedelta(days=30)
            recent_reviews = self.db.query(ServiceReview).filter(
                and_(
                    ServiceReview.agent_id == agent_id,
                    ServiceReview.review_submitted_at >= recent_date,
                    ServiceReview.status == ReviewStatus.APPROVED
                )
            ).all()
            
            # Calculate rating trends
            rating_trend = self.calculate_rating_trend(agent_id)
            
            reputation_summary = {
                "overall_metrics": {
                    "total_reviews": metrics.total_reviews,
                    "average_rating": round(metrics.average_overall_rating, 2),
                    "recommendation_percentage": round(metrics.recommendation_percentage, 1),
                    "reputation_score": round(metrics.reputation_score, 1),
                    "reputation_badge": metrics.reputation_badge
                },
                "category_averages": {
                    "service_quality": round(metrics.avg_service_quality, 2),
                    "punctuality": round(metrics.avg_punctuality, 2),
                    "professionalism": round(metrics.avg_professionalism, 2),
                    "value_for_money": round(metrics.avg_value_for_money, 2),
                    "communication": round(metrics.avg_communication, 2),
                    "cleanliness": round(metrics.avg_cleanliness, 2)
                },
                "rating_distribution": {
                    "5_star": metrics.rating_5_count,
                    "4_star": metrics.rating_4_count,
                    "3_star": metrics.rating_3_count,
                    "2_star": metrics.rating_2_count,
                    "1_star": metrics.rating_1_count
                },
                "performance_indicators": {
                    "on_time_percentage": round(metrics.on_time_percentage, 1),
                    "expectations_met_percentage": round(metrics.expectations_met_percentage, 1),
                    "prepared_percentage": round(metrics.prepared_percentage, 1)
                },
                "engagement_stats": {
                    "total_helpful_votes": metrics.total_helpful_votes,
                    "featured_reviews": metrics.featured_reviews_count,
                    "verified_reviews": metrics.verified_reviews_count,
                    "response_rate": round(metrics.response_rate, 1),
                    "avg_response_time_hours": round(metrics.average_response_time_hours, 1)
                },
                "recent_performance": {
                    "recent_reviews_count": len(recent_reviews),
                    "recent_average_rating": round(metrics.recent_average_rating, 2),
                    "rating_trend": rating_trend
                },
                "last_review": {
                    "date": metrics.last_review_date.isoformat() if metrics.last_review_date else None,
                    "rating": metrics.last_review_rating
                }
            }
            
            return {
                "success": True,
                "reputation_summary": reputation_summary
            }
            
        except Exception as e:
            logger.error(f"Error getting reputation summary: {e}")
            return {"success": False, "error": str(e)}
    
    def vote_on_review_helpfulness(self, review_uuid: str, user_id: int, is_helpful: bool) -> Dict[str, Any]:
        """
        Vote on review helpfulness
        """
        try:
            # Get review
            review = self.db.query(ServiceReview).filter(
                ServiceReview.review_uuid == review_uuid
            ).first()
            
            if not review:
                return {"success": False, "error": "Review not found"}
            
            # Check if user already voted
            existing_vote = self.db.query(ReviewHelpfulVote).filter(
                and_(
                    ReviewHelpfulVote.review_id == review.id,
                    ReviewHelpfulVote.user_id == user_id
                )
            ).first()
            
            if existing_vote:
                # Update existing vote
                old_helpful = existing_vote.is_helpful
                existing_vote.is_helpful = is_helpful
                
                # Update review counters
                if old_helpful != is_helpful:
                    if is_helpful:
                        review.helpful_votes += 1
                        review.unhelpful_votes = max(0, review.unhelpful_votes - 1)
                    else:
                        review.helpful_votes = max(0, review.helpful_votes - 1)
                        review.unhelpful_votes += 1
            else:
                # Create new vote
                vote = ReviewHelpfulVote(
                    review_id=review.id,
                    user_id=user_id,
                    is_helpful=is_helpful
                )
                self.db.add(vote)
                
                # Update review counters
                if is_helpful:
                    review.helpful_votes += 1
                else:
                    review.unhelpful_votes += 1
                
                review.total_votes += 1
            
            self.db.commit()
            
            logger.info(f"👍 User {user_id} voted on review {review_uuid}: {'helpful' if is_helpful else 'unhelpful'}")
            
            return {
                "success": True,
                "helpful_votes": review.helpful_votes,
                "unhelpful_votes": review.unhelpful_votes,
                "helpfulness_score": review.helpfulness_score
            }
            
        except Exception as e:
            logger.error(f"Error voting on review: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def report_review(self, review_uuid: str, reporter_id: int, reason: str, description: str = None) -> Dict[str, Any]:
        """
        Report a review for inappropriate content
        """
        try:
            # Get review
            review = self.db.query(ServiceReview).filter(
                ServiceReview.review_uuid == review_uuid
            ).first()
            
            if not review:
                return {"success": False, "error": "Review not found"}
            
            # Check if user already reported this review
            existing_report = self.db.query(ReviewReport).filter(
                and_(
                    ReviewReport.review_id == review.id,
                    ReviewReport.reporter_id == reporter_id
                )
            ).first()
            
            if existing_report:
                return {"success": False, "error": "You have already reported this review"}
            
            # Create report
            report = ReviewReport(
                review_id=review.id,
                reporter_id=reporter_id,
                reason=ReportReason(reason),
                description=description
            )
            
            self.db.add(report)
            
            # Update review report count
            review.report_count += 1
            
            # Auto-flag review if it has multiple reports
            if review.report_count >= 3 and review.status == ReviewStatus.APPROVED:
                review.status = ReviewStatus.FLAGGED
            
            self.db.commit()
            self.db.refresh(report)
            
            logger.info(f"🚨 Review {review_uuid} reported by user {reporter_id} for {reason}")
            
            return {
                "success": True,
                "report_uuid": report.report_uuid,
                "review_status": review.status
            }
            
        except Exception as e:
            logger.error(f"Error reporting review: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def update_agent_reputation(self, agent_id: int):
        """
        Update agent reputation metrics after review changes
        """
        try:
            # Get all approved reviews for the agent
            reviews = self.db.query(ServiceReview).filter(
                and_(
                    ServiceReview.agent_id == agent_id,
                    ServiceReview.status == ReviewStatus.APPROVED
                )
            ).all()
            
            if not reviews:
                return
            
            # Calculate overall metrics
            total_reviews = len(reviews)
            avg_overall_rating = statistics.mean([r.overall_rating for r in reviews])
            recommendation_count = sum(1 for r in reviews if r.would_recommend)
            recommendation_percentage = (recommendation_count / total_reviews) * 100
            
            # Calculate category averages
            category_ratings = {
                'service_quality': [r.service_quality_rating for r in reviews if r.service_quality_rating],
                'punctuality': [r.punctuality_rating for r in reviews if r.punctuality_rating],
                'professionalism': [r.professionalism_rating for r in reviews if r.professionalism_rating],
                'value_for_money': [r.value_for_money_rating for r in reviews if r.value_for_money_rating],
                'communication': [r.communication_rating for r in reviews if r.communication_rating],
                'cleanliness': [r.cleanliness_rating for r in reviews if r.cleanliness_rating]
            }
            
            category_averages = {
                category: statistics.mean(ratings) if ratings else 0
                for category, ratings in category_ratings.items()
            }
            
            # Rating distribution
            rating_distribution = {i: sum(1 for r in reviews if r.overall_rating == i) for i in range(1, 6)}
            
            # Performance indicators
            performance_indicators = {
                'on_time': [r.service_completed_on_time for r in reviews if r.service_completed_on_time is not None],
                'expectations_met': [r.service_met_expectations for r in reviews if r.service_met_expectations is not None],
                'prepared': [r.agent_was_prepared for r in reviews if r.agent_was_prepared is not None]
            }
            
            performance_percentages = {
                indicator: (sum(values) / len(values)) * 100 if values else 0
                for indicator, values in performance_indicators.items()
            }
            
            # Recent performance (last 30 days)
            recent_date = datetime.utcnow() - timedelta(days=30)
            recent_reviews = [r for r in reviews if r.review_submitted_at >= recent_date]
            recent_avg_rating = statistics.mean([r.overall_rating for r in recent_reviews]) if recent_reviews else 0
            
            # Engagement metrics
            total_helpful_votes = sum(r.helpful_votes for r in reviews)
            featured_count = sum(1 for r in reviews if r.is_featured)
            verified_count = sum(1 for r in reviews if r.is_verified)
            responded_count = sum(1 for r in reviews if r.agent_response)
            response_rate = (responded_count / total_reviews) * 100 if total_reviews > 0 else 0
            
            # Get or create reputation metrics
            metrics = self.db.query(AgentReputationMetrics).filter(
                AgentReputationMetrics.agent_id == agent_id
            ).first()
            
            if not metrics:
                metrics = AgentReputationMetrics(agent_id=agent_id)
                self.db.add(metrics)
            
            # Update metrics
            metrics.total_reviews = total_reviews
            metrics.average_overall_rating = avg_overall_rating
            metrics.recommendation_percentage = recommendation_percentage
            
            metrics.avg_service_quality = category_averages['service_quality']
            metrics.avg_punctuality = category_averages['punctuality']
            metrics.avg_professionalism = category_averages['professionalism']
            metrics.avg_value_for_money = category_averages['value_for_money']
            metrics.avg_communication = category_averages['communication']
            metrics.avg_cleanliness = category_averages['cleanliness']
            
            metrics.rating_1_count = rating_distribution[1]
            metrics.rating_2_count = rating_distribution[2]
            metrics.rating_3_count = rating_distribution[3]
            metrics.rating_4_count = rating_distribution[4]
            metrics.rating_5_count = rating_distribution[5]
            
            metrics.on_time_percentage = performance_percentages['on_time']
            metrics.expectations_met_percentage = performance_percentages['expectations_met']
            metrics.prepared_percentage = performance_percentages['prepared']
            
            metrics.recent_reviews_count = len(recent_reviews)
            metrics.recent_average_rating = recent_avg_rating
            
            metrics.total_helpful_votes = total_helpful_votes
            metrics.featured_reviews_count = featured_count
            metrics.verified_reviews_count = verified_count
            metrics.response_rate = response_rate
            
            # Last review info
            if reviews:
                last_review = max(reviews, key=lambda r: r.review_submitted_at)
                metrics.last_review_date = last_review.review_submitted_at
                metrics.last_review_rating = last_review.overall_rating
            
            metrics.last_updated = datetime.utcnow()
            
            self.db.commit()
            
            logger.info(f"📊 Updated reputation metrics for agent {agent_id}")
            
        except Exception as e:
            logger.error(f"Error updating agent reputation: {e}")
            self.db.rollback()
    
    def _should_auto_approve(self, review_data: Dict[str, Any]) -> bool:
        """
        Determine if a review should be auto-approved
        """
        # Auto-approve if review text is reasonable length and no inappropriate content detected
        review_text = review_data.get('review_text', '')
        
        if len(review_text) < self.min_review_length:
            return False
        
        # Add content moderation logic here
        # For now, auto-approve all verified reviews
        return True
    
    def calculate_rating_trend(self, agent_id: int) -> str:
        """
        Calculate rating trend (improving, declining, stable)
        """
        try:
            # Get last 10 reviews
            recent_reviews = self.db.query(ServiceReview).filter(
                and_(
                    ServiceReview.agent_id == agent_id,
                    ServiceReview.status == ReviewStatus.APPROVED
                )
            ).order_by(desc(ServiceReview.review_submitted_at)).limit(10).all()
            
            if len(recent_reviews) < 5:
                return "insufficient_data"
            
            # Split into two halves
            mid_point = len(recent_reviews) // 2
            recent_half = recent_reviews[:mid_point]
            older_half = recent_reviews[mid_point:]
            
            recent_avg = statistics.mean([r.overall_rating for r in recent_half])
            older_avg = statistics.mean([r.overall_rating for r in older_half])
            
            difference = recent_avg - older_avg
            
            if difference > 0.3:
                return "improving"
            elif difference < -0.3:
                return "declining"
            else:
                return "stable"
                
        except Exception:
            return "unknown"
    
    def create_initial_reputation_metrics(self, agent_id: int) -> AgentReputationMetrics:
        """
        Create initial reputation metrics for new agent
        """
        metrics = AgentReputationMetrics(agent_id=agent_id)
        self.db.add(metrics)
        self.db.commit()
        self.db.refresh(metrics)
        return metrics