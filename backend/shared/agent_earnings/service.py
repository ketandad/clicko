"""
Agent Earnings Service
Business logic for earnings tracking, payment processing, and financial analytics
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text, extract
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging
import calendar
from decimal import Decimal

from .models import (
    AgentEarning, AgentEarningSummary, PaymentBatch, 
    AgentPaymentMethod, EarningDispute,
    EarningType, PaymentStatus, PaymentMethod, EarningPeriod
)

logger = logging.getLogger(__name__)

class AgentEarningsService:
    """
    Service for managing agent earnings and financial analytics
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.platform_commission_rate = 0.10  # 10% platform commission
        self.tax_rate = 0.02  # 2% TDS
        self.payment_processing_fee = 5.0  # ₹5 per transaction
    
    def create_earning_record(self, earning_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new earning record from completed booking
        """
        try:
            # Calculate deductions
            gross_amount = earning_data['gross_amount']
            platform_fee = gross_amount * self.platform_commission_rate
            tax_deduction = gross_amount * self.tax_rate
            service_charge = self.payment_processing_fee
            net_amount = gross_amount - platform_fee - tax_deduction - service_charge
            
            # Create earning record
            earning = AgentEarning(
                agent_id=earning_data['agent_id'],
                booking_id=earning_data.get('booking_id'),
                customer_id=earning_data.get('customer_id'),
                earning_type=earning_data.get('earning_type', EarningType.BOOKING_PAYMENT),
                gross_amount=gross_amount,
                platform_fee=platform_fee,
                tax_deduction=tax_deduction,
                service_charge=service_charge,
                net_amount=net_amount,
                service_category=earning_data.get('service_category'),
                service_duration_minutes=earning_data.get('service_duration_minutes'),
                customer_rating=earning_data.get('customer_rating'),
                description=earning_data.get('description'),
                bonus_reason=earning_data.get('bonus_reason')
            )
            
            self.db.add(earning)
            self.db.commit()
            self.db.refresh(earning)
            
            # Update earning summaries
            self.update_earning_summaries(earning.agent_id)
            
            logger.info(f"💰 Created earning record {earning.earning_uuid} for agent {earning.agent_id}")
            
            return {
                "success": True,
                "earning_uuid": earning.earning_uuid,
                "gross_amount": gross_amount,
                "net_amount": net_amount,
                "platform_fee": platform_fee,
                "tax_deduction": tax_deduction
            }
            
        except Exception as e:
            logger.error(f"Error creating earning record: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def get_agent_earnings(self, agent_id: int, start_date: date = None, end_date: date = None, 
                          limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """
        Get agent's earning history with pagination
        """
        try:
            query = self.db.query(AgentEarning).filter(AgentEarning.agent_id == agent_id)
            
            # Apply date filters
            if start_date:
                query = query.filter(AgentEarning.earning_date >= start_date)
            if end_date:
                query = query.filter(AgentEarning.earning_date <= end_date)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination and ordering
            earnings = query.order_by(desc(AgentEarning.created_at))\
                          .offset(offset)\
                          .limit(limit)\
                          .all()
            
            earnings_data = []
            for earning in earnings:
                earnings_data.append({
                    "earning_uuid": earning.earning_uuid,
                    "earning_type": earning.earning_type,
                    "gross_amount": earning.gross_amount,
                    "platform_fee": earning.platform_fee,
                    "tax_deduction": earning.tax_deduction,
                    "service_charge": earning.service_charge,
                    "net_amount": earning.net_amount,
                    "payment_status": earning.payment_status,
                    "payment_method": earning.payment_method,
                    "earning_date": earning.earning_date.isoformat(),
                    "service_category": earning.service_category,
                    "service_duration_minutes": earning.service_duration_minutes,
                    "customer_rating": earning.customer_rating,
                    "description": earning.description,
                    "is_disputed": earning.is_disputed,
                    "is_paid": earning.is_paid,
                    "days_since_earning": earning.days_since_earning
                })
            
            return {
                "success": True,
                "earnings": earnings_data,
                "total_count": total_count,
                "page_info": {
                    "has_next": (offset + limit) < total_count,
                    "has_previous": offset > 0,
                    "current_page": (offset // limit) + 1,
                    "total_pages": ((total_count - 1) // limit) + 1 if total_count > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting agent earnings: {e}")
            return {"success": False, "error": str(e)}
    
    def get_agent_dashboard_stats(self, agent_id: int) -> Dict[str, Any]:
        """
        Get comprehensive dashboard statistics for agent
        """
        try:
            # Current month stats
            current_month = date.today().replace(day=1)
            next_month = (current_month + timedelta(days=32)).replace(day=1)
            
            current_month_summary = self.db.query(AgentEarningSummary).filter(
                and_(
                    AgentEarningSummary.agent_id == agent_id,
                    AgentEarningSummary.period_type == EarningPeriod.MONTHLY,
                    AgentEarningSummary.period_start == current_month
                )
            ).first()
            
            # Today's earnings
            today_earnings = self.db.query(
                func.count(AgentEarning.id).label("count"),
                func.sum(AgentEarning.net_amount).label("total"),
                func.sum(AgentEarning.gross_amount).label("gross_total")
            ).filter(
                and_(
                    AgentEarning.agent_id == agent_id,
                    AgentEarning.earning_date == date.today()
                )
            ).first()
            
            # Pending payments
            pending_earnings = self.db.query(
                func.count(AgentEarning.id).label("count"),
                func.sum(AgentEarning.net_amount).label("amount")
            ).filter(
                and_(
                    AgentEarning.agent_id == agent_id,
                    AgentEarning.payment_status == PaymentStatus.PENDING
                )
            ).first()
            
            # Recent ratings
            recent_ratings = self.db.query(
                func.avg(AgentEarning.customer_rating).label("avg_rating"),
                func.count(AgentEarning.customer_rating).label("rating_count")
            ).filter(
                and_(
                    AgentEarning.agent_id == agent_id,
                    AgentEarning.customer_rating.isnot(None),
                    AgentEarning.earning_date >= date.today() - timedelta(days=30)
                )
            ).first()
            
            # Top earning categories (last 3 months)
            three_months_ago = date.today() - timedelta(days=90)
            top_categories = self.db.query(
                AgentEarning.service_category,
                func.sum(AgentEarning.net_amount).label("total_earnings"),
                func.count(AgentEarning.id).label("booking_count")
            ).filter(
                and_(
                    AgentEarning.agent_id == agent_id,
                    AgentEarning.earning_date >= three_months_ago,
                    AgentEarning.service_category.isnot(None)
                )
            ).group_by(AgentEarning.service_category)\
             .order_by(desc("total_earnings"))\
             .limit(5).all()
            
            dashboard_stats = {
                "today": {
                    "bookings_count": today_earnings.count or 0,
                    "earnings": float(today_earnings.total or 0),
                    "gross_earnings": float(today_earnings.gross_total or 0)
                },
                "current_month": {
                    "total_bookings": current_month_summary.total_bookings if current_month_summary else 0,
                    "completed_bookings": current_month_summary.completed_bookings if current_month_summary else 0,
                    "net_earnings": current_month_summary.total_net_earnings if current_month_summary else 0,
                    "gross_earnings": current_month_summary.total_gross_earnings if current_month_summary else 0,
                    "average_rating": current_month_summary.average_rating if current_month_summary else 0,
                    "completion_rate": current_month_summary.completion_rate if current_month_summary else 0
                },
                "pending_payments": {
                    "count": pending_earnings.count or 0,
                    "total_amount": float(pending_earnings.amount or 0)
                },
                "recent_performance": {
                    "average_rating": round(float(recent_ratings.avg_rating or 0), 2),
                    "ratings_count": recent_ratings.rating_count or 0
                },
                "top_categories": [
                    {
                        "category": cat.service_category,
                        "earnings": float(cat.total_earnings),
                        "bookings": cat.booking_count
                    } for cat in top_categories
                ]
            }
            
            return {
                "success": True,
                "dashboard_stats": dashboard_stats
            }
            
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {e}")
            return {"success": False, "error": str(e)}
    
    def get_earning_analytics(self, agent_id: int, period: str = "monthly", 
                            periods_count: int = 12) -> Dict[str, Any]:
        """
        Get detailed earning analytics for charts and trends
        """
        try:
            period_enum = EarningPeriod(period)
            
            # Get earning summaries for the specified period
            summaries = self.db.query(AgentEarningSummary).filter(
                and_(
                    AgentEarningSummary.agent_id == agent_id,
                    AgentEarningSummary.period_type == period_enum
                )
            ).order_by(desc(AgentEarningSummary.period_start))\
             .limit(periods_count).all()
            
            # Prepare analytics data
            analytics_data = {
                "earnings_trend": [],
                "bookings_trend": [],
                "rating_trend": [],
                "category_breakdown": {},
                "payment_status_summary": {
                    "completed": 0,
                    "pending": 0,
                    "processing": 0,
                    "failed": 0
                }
            }
            
            for summary in reversed(summaries):
                analytics_data["earnings_trend"].append({
                    "period": summary.period_label,
                    "gross_earnings": summary.total_gross_earnings,
                    "net_earnings": summary.total_net_earnings,
                    "platform_fees": summary.total_platform_fees
                })
                
                analytics_data["bookings_trend"].append({
                    "period": summary.period_label,
                    "total_bookings": summary.total_bookings,
                    "completed_bookings": summary.completed_bookings,
                    "cancelled_bookings": summary.cancelled_bookings,
                    "completion_rate": summary.completion_rate
                })
                
                analytics_data["rating_trend"].append({
                    "period": summary.period_label,
                    "average_rating": summary.average_rating,
                    "earnings_per_hour": summary.earnings_per_hour
                })
            
            # Category breakdown (last 6 months)
            six_months_ago = date.today() - timedelta(days=180)
            category_earnings = self.db.query(
                AgentEarning.service_category,
                func.sum(AgentEarning.net_amount).label("earnings"),
                func.count(AgentEarning.id).label("count")
            ).filter(
                and_(
                    AgentEarning.agent_id == agent_id,
                    AgentEarning.earning_date >= six_months_ago,
                    AgentEarning.service_category.isnot(None)
                )
            ).group_by(AgentEarning.service_category).all()
            
            for category in category_earnings:
                analytics_data["category_breakdown"][category.service_category] = {
                    "earnings": float(category.earnings),
                    "bookings": category.count
                }
            
            # Payment status summary
            payment_summary = self.db.query(
                AgentEarning.payment_status,
                func.sum(AgentEarning.net_amount).label("amount"),
                func.count(AgentEarning.id).label("count")
            ).filter(AgentEarning.agent_id == agent_id)\
             .group_by(AgentEarning.payment_status).all()
            
            for status in payment_summary:
                if status.payment_status in analytics_data["payment_status_summary"]:
                    analytics_data["payment_status_summary"][status.payment_status] = {
                        "amount": float(status.amount),
                        "count": status.count
                    }
            
            return {
                "success": True,
                "analytics": analytics_data,
                "period": period,
                "periods_count": len(summaries)
            }
            
        except Exception as e:
            logger.error(f"Error getting earning analytics: {e}")
            return {"success": False, "error": str(e)}
    
    def update_earning_summaries(self, agent_id: int):
        """
        Update earning summaries for an agent (called after new earnings)
        """
        try:
            # Update daily summary for today
            self.update_daily_summary(agent_id, date.today())
            
            # Update weekly summary for current week
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            self.update_weekly_summary(agent_id, week_start)
            
            # Update monthly summary for current month
            month_start = today.replace(day=1)
            self.update_monthly_summary(agent_id, month_start)
            
        except Exception as e:
            logger.error(f"Error updating earning summaries: {e}")
    
    def update_daily_summary(self, agent_id: int, target_date: date):
        """Update daily earning summary"""
        try:
            # Calculate daily metrics
            daily_stats = self.db.query(
                func.count(AgentEarning.id).label("total_earnings"),
                func.sum(AgentEarning.gross_amount).label("gross_total"),
                func.sum(AgentEarning.net_amount).label("net_total"),
                func.sum(AgentEarning.platform_fee).label("fees_total"),
                func.avg(AgentEarning.customer_rating).label("avg_rating"),
                func.sum(AgentEarning.service_duration_minutes).label("total_minutes")
            ).filter(
                and_(
                    AgentEarning.agent_id == agent_id,
                    AgentEarning.earning_date == target_date
                )
            ).first()
            
            # Check if summary exists
            existing_summary = self.db.query(AgentEarningSummary).filter(
                and_(
                    AgentEarningSummary.agent_id == agent_id,
                    AgentEarningSummary.period_type == EarningPeriod.DAILY,
                    AgentEarningSummary.period_start == target_date
                )
            ).first()
            
            summary_data = {
                "total_bookings": daily_stats.total_earnings or 0,
                "completed_bookings": daily_stats.total_earnings or 0,  # Assuming all are completed
                "total_gross_earnings": float(daily_stats.gross_total or 0),
                "total_net_earnings": float(daily_stats.net_total or 0),
                "total_platform_fees": float(daily_stats.fees_total or 0),
                "average_rating": float(daily_stats.avg_rating or 0),
                "total_service_hours": float((daily_stats.total_minutes or 0) / 60),
                "calculated_at": datetime.utcnow(),
                "is_current_period": target_date == date.today()
            }
            
            if existing_summary:
                for key, value in summary_data.items():
                    setattr(existing_summary, key, value)
            else:
                summary_data.update({
                    "agent_id": agent_id,
                    "period_type": EarningPeriod.DAILY,
                    "period_start": target_date,
                    "period_end": target_date,
                    "period_label": target_date.strftime("%d %b %Y")
                })
                summary = AgentEarningSummary(**summary_data)
                self.db.add(summary)
            
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Error updating daily summary: {e}")
            self.db.rollback()
    
    def process_payment_batch(self, batch_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create and process a payment batch for multiple agents
        """
        try:
            # Create payment batch
            batch = PaymentBatch(
                batch_name=batch_data['batch_name'],
                payment_method=PaymentMethod(batch_data['payment_method']),
                total_amount=batch_data['total_amount'],
                total_agents=batch_data['total_agents'],
                total_earnings=batch_data['total_earnings'],
                created_by=batch_data['created_by']
            )
            
            self.db.add(batch)
            self.db.commit()
            self.db.refresh(batch)
            
            # Process earnings in batch
            earning_ids = batch_data.get('earning_ids', [])
            processed_count = 0
            
            for earning_id in earning_ids:
                earning = self.db.query(AgentEarning).filter(
                    AgentEarning.id == earning_id
                ).first()
                
                if earning and earning.payment_status == PaymentStatus.PENDING:
                    earning.payment_status = PaymentStatus.PROCESSING
                    earning.payment_batch_id = batch.id
                    processed_count += 1
            
            batch.status = PaymentStatus.PROCESSING
            batch.processing_started_at = datetime.utcnow()
            
            self.db.commit()
            
            logger.info(f"💳 Created payment batch {batch.batch_uuid} with {processed_count} earnings")
            
            return {
                "success": True,
                "batch_uuid": batch.batch_uuid,
                "processed_earnings": processed_count
            }
            
        except Exception as e:
            logger.error(f"Error creating payment batch: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}
    
    def create_earning_dispute(self, dispute_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new earning dispute
        """
        try:
            dispute = EarningDispute(
                agent_id=dispute_data['agent_id'],
                earning_id=dispute_data['earning_id'],
                dispute_reason=dispute_data['dispute_reason'],
                description=dispute_data['description'],
                expected_amount=dispute_data.get('expected_amount'),
                priority=dispute_data.get('priority', 'medium')
            )
            
            self.db.add(dispute)
            
            # Mark earning as disputed
            earning = self.db.query(AgentEarning).filter(
                AgentEarning.id == dispute_data['earning_id']
            ).first()
            
            if earning:
                earning.is_disputed = True
                earning.dispute_reason = dispute_data['dispute_reason']
            
            self.db.commit()
            self.db.refresh(dispute)
            
            logger.info(f"🚨 Created earning dispute {dispute.dispute_uuid}")
            
            return {
                "success": True,
                "dispute_uuid": dispute.dispute_uuid
            }
            
        except Exception as e:
            logger.error(f"Error creating dispute: {e}")
            self.db.rollback()
            return {"success": False, "error": str(e)}