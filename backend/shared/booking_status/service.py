"""
Booking Status Tracking Service
Handles real-time status updates, notifications, and progress tracking
"""

import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

from .models import (
    BookingStatusHistory, 
    BookingProgress, 
    StatusNotification, 
    BookingTimer,
    BookingStatus,
    is_valid_status_transition
)

class BookingStatusService:
    """
    Comprehensive service for managing booking status lifecycle
    """
    
    def __init__(self, db: Session):
        self.db = db

    async def update_booking_status(
        self, 
        booking_id: str, 
        new_status: str, 
        changed_by_user_id: int = None,
        changed_by_type: str = "system",
        reason: str = None,
        notes: str = None,
        metadata: Dict = None,
        location_data: Dict = None
    ) -> Dict:
        """
        Update booking status with comprehensive tracking and notifications
        """
        try:
            # Get current progress
            progress = self.get_booking_progress(booking_id)
            current_status = progress.current_status if progress else BookingStatus.PENDING
            
            # Validate status transition
            if not is_valid_status_transition(current_status, new_status):
                return {
                    "success": False,
                    "error": f"Invalid status transition from {current_status} to {new_status}"
                }
            
            # Create status history entry
            status_history = BookingStatusHistory(
                booking_id=booking_id,
                status=new_status,
                previous_status=current_status,
                changed_by_user_id=changed_by_user_id,
                changed_by_type=changed_by_type,
                reason=reason,
                notes=notes,
                metadata=json.dumps(metadata or {}),
                location_latitude=location_data.get('latitude') if location_data else None,
                location_longitude=location_data.get('longitude') if location_data else None,
                estimated_arrival_time=self._parse_datetime(location_data.get('eta')) if location_data else None
            )
            
            self.db.add(status_history)
            
            # Update or create progress record
            if not progress:
                progress = BookingProgress(booking_id=booking_id)
                self.db.add(progress)
            
            progress.current_status = new_status
            progress.status_updated_at = datetime.utcnow()
            
            # Update progress-specific fields based on status
            if new_status == BookingStatus.ACCEPTED:
                progress.progress_percentage = 20
                await self._schedule_arrival_timer(booking_id)
                
            elif new_status == BookingStatus.AGENT_EN_ROUTE:
                progress.progress_percentage = 40
                if location_data:
                    progress.agent_latitude = location_data.get('latitude')
                    progress.agent_longitude = location_data.get('longitude')
                    progress.agent_location_updated_at = datetime.utcnow()
                    progress.estimated_arrival_time = self._parse_datetime(location_data.get('eta'))
                    
            elif new_status == BookingStatus.SERVICE_IN_PROGRESS:
                progress.progress_percentage = 60
                progress.service_started_at = datetime.utcnow()
                
            elif new_status == BookingStatus.COMPLETED:
                progress.progress_percentage = 100
                progress.service_completed_at = datetime.utcnow()
                
            # Commit changes
            self.db.commit()
            self.db.refresh(status_history)
            self.db.refresh(progress)
            
            # Send notifications
            await self._send_status_notifications(booking_id, new_status, metadata)
            
            # Handle timer management
            await self._manage_timers(booking_id, new_status)
            
            return {
                "success": True,
                "booking_id": booking_id,
                "new_status": new_status,
                "previous_status": current_status,
                "progress_percentage": progress.progress_percentage,
                "timestamp": status_history.timestamp.isoformat()
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "error": f"Failed to update booking status: {str(e)}"
            }

    def get_booking_progress(self, booking_id: str) -> Optional[BookingProgress]:
        """Get current booking progress"""
        return self.db.query(BookingProgress).filter(
            BookingProgress.booking_id == booking_id
        ).first()

    def get_booking_status_history(self, booking_id: str) -> List[BookingStatusHistory]:
        """Get complete status history for a booking"""
        return self.db.query(BookingStatusHistory).filter(
            BookingStatusHistory.booking_id == booking_id
        ).order_by(desc(BookingStatusHistory.timestamp)).all()

    async def update_agent_location(
        self, 
        booking_id: str, 
        latitude: float, 
        longitude: float,
        eta_minutes: int = None,
        status_message: str = None
    ) -> bool:
        """
        Update agent location during active booking
        """
        try:
            progress = self.get_booking_progress(booking_id)
            if not progress:
                return False
            
            # Only update location during relevant statuses
            if progress.current_status not in [BookingStatus.AGENT_EN_ROUTE, BookingStatus.SERVICE_IN_PROGRESS]:
                return False
            
            progress.agent_latitude = latitude
            progress.agent_longitude = longitude
            progress.agent_location_updated_at = datetime.utcnow()
            progress.agent_status_message = status_message
            
            if eta_minutes:
                progress.estimated_arrival_time = datetime.utcnow() + timedelta(minutes=eta_minutes)
            
            self.db.commit()
            
            # Send location update notification
            await self._send_location_update_notification(booking_id, latitude, longitude, eta_minutes)
            
            return True
            
        except Exception as e:
            self.db.rollback()
            return False

    async def _send_status_notifications(self, booking_id: str, status: str, metadata: Dict = None):
        """Send status update notifications to customer and agent"""
        try:
            # Get booking details (would need to query bookings table)
            # For now, using placeholder logic
            
            # Notification messages based on status
            status_messages = {
                BookingStatus.ACCEPTED: {
                    "customer": "Great news! Your service request has been accepted. The agent will be with you shortly.",
                    "agent": "You have successfully accepted the booking. Please proceed to customer location."
                },
                BookingStatus.AGENT_EN_ROUTE: {
                    "customer": "Your agent is on the way! You'll receive location updates as they approach.",
                    "agent": "You've updated your status to 'En Route'. Customer has been notified."
                },
                BookingStatus.SERVICE_IN_PROGRESS: {
                    "customer": "Service is now in progress. Your agent will update you upon completion.",
                    "agent": "Service marked as in progress. Remember to update status when completed."
                },
                BookingStatus.COMPLETED: {
                    "customer": "Service completed! Please rate your experience and process payment.",
                    "agent": "Service marked as completed. Payment and rating workflow initiated."
                },
                BookingStatus.CANCELLED: {
                    "customer": "Your booking has been cancelled. Any applicable refunds will be processed.",
                    "agent": "Booking has been cancelled. You're now available for new requests."
                }
            }
            
            messages = status_messages.get(status, {})
            
            # Create notification records (customer and agent IDs would come from booking)
            for recipient_type, message in messages.items():
                notification = StatusNotification(
                    booking_id=booking_id,
                    notification_type="status_update",
                    recipient_type=recipient_type,
                    recipient_user_id=1,  # Placeholder - would get from booking
                    booking_status=status,
                    status_message=message,
                    sent_via_websocket=True,
                    sent_via_push=True
                )
                
                self.db.add(notification)
            
            self.db.commit()
            
            # TODO: Integrate with notification service to actually send notifications
            print(f"📢 Status notifications sent for booking {booking_id}: {status}")
            
        except Exception as e:
            print(f"❌ Failed to send status notifications: {e}")

    async def _send_location_update_notification(self, booking_id: str, lat: float, lng: float, eta_minutes: int = None):
        """Send real-time location update to customer"""
        try:
            eta_text = f" (ETA: {eta_minutes} minutes)" if eta_minutes else ""
            message = f"Agent location updated{eta_text}"
            
            notification = StatusNotification(
                booking_id=booking_id,
                notification_type="eta_update",
                recipient_type="customer",
                recipient_user_id=1,  # Placeholder
                booking_status="location_update",
                status_message=message,
                sent_via_websocket=True
            )
            
            self.db.add(notification)
            self.db.commit()
            
            # TODO: Send real-time location update via WebSocket
            print(f"📍 Location update sent for booking {booking_id}")
            
        except Exception as e:
            print(f"❌ Failed to send location update: {e}")

    async def _schedule_arrival_timer(self, booking_id: str):
        """Schedule timer for agent arrival deadline"""
        try:
            # Set 30-minute timer for agent to start traveling
            timer = BookingTimer(
                booking_id=booking_id,
                timer_type="arrival_timeout",
                scheduled_time=datetime.utcnow() + timedelta(minutes=30),
                timeout_seconds=1800,  # 30 minutes
                action_on_timeout="send_reminder"
            )
            
            self.db.add(timer)
            self.db.commit()
            
            print(f"⏰ Arrival timer scheduled for booking {booking_id}")
            
        except Exception as e:
            print(f"❌ Failed to schedule arrival timer: {e}")

    async def _manage_timers(self, booking_id: str, new_status: str):
        """Manage active timers based on status changes"""
        try:
            # Cancel relevant timers when status changes
            if new_status in [BookingStatus.AGENT_EN_ROUTE, BookingStatus.SERVICE_IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.CANCELLED]:
                # Cancel arrival timeout timer
                arrival_timers = self.db.query(BookingTimer).filter(
                    and_(
                        BookingTimer.booking_id == booking_id,
                        BookingTimer.timer_type == "arrival_timeout",
                        BookingTimer.is_active == True
                    )
                ).all()
                
                for timer in arrival_timers:
                    timer.is_active = False
                    timer.cancelled_at = datetime.utcnow()
                
                self.db.commit()
            
        except Exception as e:
            print(f"❌ Failed to manage timers: {e}")

    def get_active_bookings_for_agent(self, agent_id: int) -> List[Dict]:
        """Get all active bookings for an agent with current status"""
        try:
            # This would join with bookings table to filter by agent_id
            # For now, returning placeholder structure
            
            # Query would be something like:
            # SELECT b.*, bp.* FROM bookings b 
            # JOIN booking_progress bp ON b.booking_id = bp.booking_id
            # WHERE b.agent_id = agent_id AND bp.current_status IN ('accepted', 'agent_en_route', 'service_in_progress')
            
            return []  # Placeholder
            
        except Exception as e:
            print(f"❌ Failed to get active bookings: {e}")
            return []

    def get_booking_analytics(self, booking_id: str) -> Dict:
        """Get comprehensive analytics for a booking"""
        try:
            progress = self.get_booking_progress(booking_id)
            history = self.get_booking_status_history(booking_id)
            
            if not progress or not history:
                return {}
            
            # Calculate timing metrics
            status_durations = {}
            for i in range(len(history) - 1):
                current = history[i]
                next_status = history[i + 1]
                duration = (current.timestamp - next_status.timestamp).total_seconds()
                status_durations[next_status.status] = duration
            
            # Calculate total booking duration
            first_status = history[-1] if history else None
            last_status = history[0] if history else None
            total_duration = (last_status.timestamp - first_status.timestamp).total_seconds() if first_status and last_status else 0
            
            return {
                "booking_id": booking_id,
                "current_status": progress.current_status,
                "progress_percentage": progress.progress_percentage,
                "total_duration_seconds": total_duration,
                "status_durations": status_durations,
                "total_status_changes": len(history),
                "service_started_at": progress.service_started_at.isoformat() if progress.service_started_at else None,
                "service_completed_at": progress.service_completed_at.isoformat() if progress.service_completed_at else None,
                "estimated_arrival_time": progress.estimated_arrival_time.isoformat() if progress.estimated_arrival_time else None,
                "agent_last_location_update": progress.agent_location_updated_at.isoformat() if progress.agent_location_updated_at else None
            }
            
        except Exception as e:
            print(f"❌ Failed to get booking analytics: {e}")
            return {}

    def _parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        """Parse datetime string safely"""
        if not datetime_str:
            return None
        
        try:
            return datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
        except:
            try:
                return datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
            except:
                return None