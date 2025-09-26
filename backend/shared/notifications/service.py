"""
Notification utilities and helper functions
"""

import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from .models import AgentNotification, NotificationLog, AgentAvailability, NotificationTemplate

logger = logging.getLogger(__name__)

class NotificationService:
    """
    Service class for handling notifications with database persistence
    Works alongside WebSocket manager for real-time notifications
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_notification_record(
        self, 
        notification_id: str,
        agent_id: int,
        booking_id: str,
        notification_data: dict
    ) -> AgentNotification:
        """Create persistent notification record in database"""
        try:
            # Calculate expiry time (30 seconds from now)
            expires_at = datetime.utcnow() + timedelta(seconds=30)
            
            notification = AgentNotification(
                notification_id=notification_id,
                agent_id=agent_id,
                booking_id=booking_id,
                type="booking_request",
                title=f"New Booking Request - {notification_data.get('service_type', 'Service')}",
                message=f"Booking request from {notification_data.get('customer_name', 'Customer')}",
                
                # Notification data
                customer_name=notification_data.get('customer_name'),
                customer_phone=notification_data.get('customer_phone'),
                service_type=notification_data.get('service_type'),
                service_details=json.dumps(notification_data.get('service_details', {})),
                location_lat=notification_data.get('location', {}).get('latitude'),
                location_lng=notification_data.get('location', {}).get('longitude'),
                address=notification_data.get('address'),
                scheduled_time=self._parse_datetime(notification_data.get('scheduled_time')),
                estimated_cost=notification_data.get('estimated_cost'),
                visit_charges=notification_data.get('visit_charges'),
                service_charges=notification_data.get('service_charges'),
                is_emergency=notification_data.get('emergency', False),
                customer_notes=notification_data.get('customer_notes'),
                
                # Notification settings
                status="pending",
                requires_response=True,
                priority="critical" if notification_data.get('emergency') else "high",
                expires_at=expires_at
            )
            
            self.db.add(notification)
            self.db.commit()
            self.db.refresh(notification)
            
            # Log the notification creation
            self.log_notification_event(
                notification_id, agent_id, "sent", 
                {"booking_id": booking_id, "customer_name": notification_data.get('customer_name')}
            )
            
            logger.info(f"💾 Notification {notification_id} saved to database for agent {agent_id}")
            return notification
            
        except Exception as e:
            logger.error(f"Error creating notification record: {e}")
            self.db.rollback()
            raise
    
    def update_notification_response(
        self, 
        notification_id: str, 
        response: str, 
        response_data: dict = None
    ) -> bool:
        """Update notification with agent response"""
        try:
            notification = self.db.query(AgentNotification).filter(
                AgentNotification.notification_id == notification_id
            ).first()
            
            if not notification:
                return False
            
            # Update response details
            notification.response = response
            notification.response_data = json.dumps(response_data or {})
            notification.response_reason = response_data.get('reason') if response_data else None
            notification.responded_at = datetime.utcnow()
            notification.status = "responded"
            
            # Calculate response time
            response_time_ms = None
            if notification.delivered_at:
                response_time_delta = notification.responded_at - notification.delivered_at
                response_time_ms = int(response_time_delta.total_seconds() * 1000)
            
            self.db.commit()
            
            # Log the response
            self.log_notification_event(
                notification_id, notification.agent_id, "responded",
                {
                    "response": response, 
                    "response_data": response_data,
                    "response_time_ms": response_time_ms
                },
                response_time_ms=response_time_ms
            )
            
            # Update agent availability metrics
            self.update_agent_response_metrics(notification.agent_id, response_time_ms)
            
            logger.info(f"📝 Notification {notification_id} response updated: {response}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating notification response: {e}")
            self.db.rollback()
            return False
    
    def mark_notification_delivered(self, notification_id: str, agent_id: int) -> bool:
        """Mark notification as delivered"""
        try:
            notification = self.db.query(AgentNotification).filter(
                AgentNotification.notification_id == notification_id,
                AgentNotification.agent_id == agent_id
            ).first()
            
            if notification and not notification.delivered_at:
                notification.delivered_at = datetime.utcnow()
                notification.status = "delivered" if notification.status == "pending" else notification.status
                notification.delivery_attempts += 1
                notification.last_delivery_attempt = datetime.utcnow()
                
                self.db.commit()
                
                # Log delivery
                self.log_notification_event(
                    notification_id, agent_id, "delivered",
                    {"delivery_attempt": notification.delivery_attempts}
                )
                
                return True
                
        except Exception as e:
            logger.error(f"Error marking notification as delivered: {e}")
            self.db.rollback()
        
        return False
    
    def expire_notification(self, notification_id: str) -> bool:
        """Mark notification as expired (timeout)"""
        try:
            notification = self.db.query(AgentNotification).filter(
                AgentNotification.notification_id == notification_id
            ).first()
            
            if notification and notification.status not in ["responded", "expired"]:
                notification.status = "expired"
                notification.is_expired = True
                notification.response = "rejected"
                notification.response_reason = "Timeout - Agent did not respond within 30 seconds"
                notification.responded_at = datetime.utcnow()
                
                self.db.commit()
                
                # Log expiry
                self.log_notification_event(
                    notification_id, notification.agent_id, "expired",
                    {"reason": "timeout", "timeout_seconds": 30}
                )
                
                logger.warning(f"⏰ Notification {notification_id} expired due to timeout")
                return True
                
        except Exception as e:
            logger.error(f"Error expiring notification: {e}")
            self.db.rollback()
        
        return False
    
    def get_agent_pending_notifications(self, agent_id: int) -> List[AgentNotification]:
        """Get pending notifications for an agent"""
        try:
            notifications = self.db.query(AgentNotification).filter(
                AgentNotification.agent_id == agent_id,
                AgentNotification.status == "pending",
                AgentNotification.expires_at > datetime.utcnow()
            ).order_by(AgentNotification.created_at.desc()).all()
            
            return notifications
            
        except Exception as e:
            logger.error(f"Error getting pending notifications: {e}")
            return []
    
    def update_agent_availability(self, agent_id: int, is_online: bool, status: str = None) -> bool:
        """Update agent availability status"""
        try:
            availability = self.db.query(AgentAvailability).filter(
                AgentAvailability.agent_id == agent_id
            ).first()
            
            if not availability:
                availability = AgentAvailability(
                    agent_id=agent_id,
                    is_online=is_online,
                    status=status or ("online" if is_online else "offline"),
                    last_activity=datetime.utcnow()
                )
                self.db.add(availability)
            else:
                availability.is_online = is_online
                if status:
                    availability.status = status
                availability.last_activity = datetime.utcnow()
                availability.updated_at = datetime.utcnow()
            
            if is_online:
                availability.last_websocket_connection = datetime.utcnow()
            
            self.db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Error updating agent availability: {e}")
            self.db.rollback()
            return False
    
    def log_notification_event(
        self, 
        notification_id: str, 
        agent_id: int, 
        event_type: str, 
        event_data: dict = None,
        success: bool = True,
        error_message: str = None,
        response_time_ms: int = None
    ):
        """Log notification event for analytics"""
        try:
            log_entry = NotificationLog(
                notification_id=notification_id,
                agent_id=agent_id,
                event_type=event_type,
                event_data=json.dumps(event_data or {}),
                connection_type="websocket",
                timestamp=datetime.utcnow(),
                success=success,
                error_message=error_message,
                response_time_ms=response_time_ms
            )
            
            self.db.add(log_entry)
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Error logging notification event: {e}")
            self.db.rollback()
    
    def update_agent_response_metrics(self, agent_id: int, response_time_ms: int = None):
        """Update agent response time metrics"""
        try:
            availability = self.db.query(AgentAvailability).filter(
                AgentAvailability.agent_id == agent_id
            ).first()
            
            if availability:
                availability.total_notifications_responded += 1
                
                if response_time_ms and availability.total_notifications_responded > 0:
                    # Calculate rolling average response time
                    current_avg = availability.average_response_time_seconds or 0
                    total_responses = availability.total_notifications_responded
                    
                    new_avg = ((current_avg * (total_responses - 1)) + (response_time_ms / 1000)) / total_responses
                    availability.average_response_time_seconds = new_avg
                
                availability.updated_at = datetime.utcnow()
                self.db.commit()
                
        except Exception as e:
            logger.error(f"Error updating agent response metrics: {e}")
            self.db.rollback()
    
    def cleanup_expired_notifications(self) -> int:
        """Clean up expired notifications from database"""
        try:
            current_time = datetime.utcnow()
            
            # Mark expired notifications
            expired_count = self.db.query(AgentNotification).filter(
                AgentNotification.expires_at <= current_time,
                AgentNotification.status.in_(["pending", "delivered"]),
                AgentNotification.is_expired == False
            ).update({
                "status": "expired",
                "is_expired": True,
                "response": "rejected",
                "response_reason": "Expired - Timeout"
            })
            
            self.db.commit()
            
            if expired_count > 0:
                logger.info(f"🧹 Marked {expired_count} notifications as expired")
            
            return expired_count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired notifications: {e}")
            self.db.rollback()
            return 0
    
    def get_notification_analytics(self, agent_id: int = None, days: int = 7) -> dict:
        """Get notification analytics for dashboard"""
        try:
            from_date = datetime.utcnow() - timedelta(days=days)
            
            query = self.db.query(AgentNotification).filter(
                AgentNotification.created_at >= from_date
            )
            
            if agent_id:
                query = query.filter(AgentNotification.agent_id == agent_id)
            
            notifications = query.all()
            
            # Calculate metrics
            total_notifications = len(notifications)
            responded_notifications = len([n for n in notifications if n.status == "responded"])
            accepted_notifications = len([n for n in notifications if n.response == "accepted"])
            expired_notifications = len([n for n in notifications if n.status == "expired"])
            
            response_rate = (responded_notifications / total_notifications * 100) if total_notifications > 0 else 0
            acceptance_rate = (accepted_notifications / responded_notifications * 100) if responded_notifications > 0 else 0
            
            # Calculate average response time
            response_times = []
            for n in notifications:
                if n.delivered_at and n.responded_at:
                    response_time = (n.responded_at - n.delivered_at).total_seconds()
                    response_times.append(response_time)
            
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0
            
            return {
                "period_days": days,
                "total_notifications": total_notifications,
                "responded_notifications": responded_notifications,
                "accepted_notifications": accepted_notifications,
                "expired_notifications": expired_notifications,
                "response_rate_percent": round(response_rate, 2),
                "acceptance_rate_percent": round(acceptance_rate, 2),
                "average_response_time_seconds": round(avg_response_time, 2),
                "agent_id": agent_id
            }
            
        except Exception as e:
            logger.error(f"Error getting notification analytics: {e}")
            return {}
    
    def _parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        """Parse datetime string safely"""
        if not datetime_str:
            return None
        
        try:
            # Handle ISO format
            return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
        except:
            try:
                # Handle common formats
                return datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
            except:
                return None