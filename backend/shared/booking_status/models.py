"""
Booking Status Tracking Models and Database Schema
Handles real-time booking status updates with timestamp logging
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum

Base = declarative_base()

class BookingStatus(str, Enum):
    """Booking status enumeration"""
    PENDING = "pending"                    # Waiting for agent response
    ACCEPTED = "accepted"                  # Agent accepted booking
    AGENT_EN_ROUTE = "agent_en_route"     # Agent traveling to customer
    SERVICE_IN_PROGRESS = "service_in_progress"  # Agent performing service
    COMPLETED = "completed"               # Service finished successfully
    CANCELLED = "cancelled"               # Booking cancelled
    REJECTED = "rejected"                 # Agent rejected booking
    EXPIRED = "expired"                   # Booking request timed out

class BookingStatusHistory(Base):
    """
    Track all status changes for a booking with timestamps
    Provides complete audit trail of booking lifecycle
    """
    __tablename__ = "booking_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(String, ForeignKey("bookings.booking_id"), nullable=False, index=True)
    
    # Status information
    status = Column(String, nullable=False, index=True)  # BookingStatus enum
    previous_status = Column(String, index=True)
    
    # Who made the change
    changed_by_user_id = Column(Integer, index=True)  # User who triggered status change
    changed_by_type = Column(String, default="system")  # system, customer, agent, admin
    
    # Change details
    reason = Column(Text)  # Optional reason for status change
    notes = Column(Text)   # Additional notes
    metadata = Column(JSON)  # Additional data (location, ETA, etc.)
    
    # Timing
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Location data (for en-route tracking)
    location_latitude = Column(Float)
    location_longitude = Column(Float)
    estimated_arrival_time = Column(DateTime)
    
    # System metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    # booking = relationship("Booking", back_populates="status_history")

class BookingProgress(Base):
    """
    Current booking progress and real-time information
    Optimized for frequent reads and updates
    """
    __tablename__ = "booking_progress"
    
    booking_id = Column(String, ForeignKey("bookings.booking_id"), primary_key=True, index=True)
    
    # Current status
    current_status = Column(String, nullable=False, default=BookingStatus.PENDING, index=True)
    status_updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Progress tracking
    progress_percentage = Column(Integer, default=0)  # 0-100%
    estimated_completion_time = Column(DateTime)
    
    # Agent location and ETA (for en-route and in-progress)
    agent_latitude = Column(Float)
    agent_longitude = Column(Float)
    agent_location_updated_at = Column(DateTime)
    estimated_arrival_time = Column(DateTime)
    
    # Service details
    service_started_at = Column(DateTime)
    service_completed_at = Column(DateTime)
    
    # Customer interaction
    customer_notified_at = Column(DateTime)
    customer_last_seen_status = Column(String)
    
    # Agent interaction
    agent_last_location_update = Column(DateTime)
    agent_status_message = Column(String)  # "On my way", "Starting service", etc.
    
    # System metadata
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # booking = relationship("Booking", back_populates="progress")

class StatusNotification(Base):
    """
    Track status notifications sent to customers and agents
    Ensures proper delivery and prevents duplicate notifications
    """
    __tablename__ = "status_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(String, ForeignKey("bookings.booking_id"), nullable=False, index=True)
    
    # Notification details
    notification_type = Column(String, nullable=False)  # status_update, eta_update, reminder
    recipient_type = Column(String, nullable=False)    # customer, agent
    recipient_user_id = Column(Integer, nullable=False, index=True)
    
    # Status information
    booking_status = Column(String, nullable=False)
    status_message = Column(Text)
    
    # Delivery tracking
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    
    # Notification channels
    sent_via_push = Column(Boolean, default=False)
    sent_via_websocket = Column(Boolean, default=False)
    sent_via_sms = Column(Boolean, default=False)
    sent_via_email = Column(Boolean, default=False)
    
    # Response tracking
    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime)
    
    # System metadata
    created_at = Column(DateTime, default=datetime.utcnow)

class BookingTimer(Base):
    """
    Track timing-related events for bookings
    Used for automatic status transitions and SLA monitoring
    """
    __tablename__ = "booking_timers"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(String, ForeignKey("bookings.booking_id"), nullable=False, index=True)
    
    # Timer details
    timer_type = Column(String, nullable=False)  # acceptance_timeout, arrival_timeout, completion_reminder
    scheduled_time = Column(DateTime, nullable=False, index=True)
    
    # Timer configuration
    timeout_seconds = Column(Integer, default=30)
    action_on_timeout = Column(String)  # auto_cancel, send_reminder, escalate
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    executed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    # Results
    timeout_occurred = Column(Boolean, default=False)
    action_taken = Column(String)
    
    # System metadata
    created_at = Column(DateTime, default=datetime.utcnow)

# Database indexes for optimal performance
"""
-- Status tracking indexes
CREATE INDEX idx_status_history_booking_timestamp ON booking_status_history(booking_id, timestamp DESC);
CREATE INDEX idx_status_history_status ON booking_status_history(status, timestamp DESC);
CREATE INDEX idx_booking_progress_status ON booking_progress(current_status, status_updated_at DESC);
CREATE INDEX idx_booking_progress_location ON booking_progress(agent_latitude, agent_longitude);

-- Notification indexes
CREATE INDEX idx_status_notifications_recipient ON status_notifications(recipient_user_id, sent_at DESC);
CREATE INDEX idx_status_notifications_booking ON status_notifications(booking_id, notification_type);
CREATE INDEX idx_status_notifications_delivery ON status_notifications(delivered_at, read_at);

-- Timer indexes
CREATE INDEX idx_booking_timers_active ON booking_timers(is_active, scheduled_time);
CREATE INDEX idx_booking_timers_booking ON booking_timers(booking_id, timer_type);
"""

# Status transition validation
VALID_STATUS_TRANSITIONS = {
    BookingStatus.PENDING: [BookingStatus.ACCEPTED, BookingStatus.REJECTED, BookingStatus.EXPIRED, BookingStatus.CANCELLED],
    BookingStatus.ACCEPTED: [BookingStatus.AGENT_EN_ROUTE, BookingStatus.CANCELLED],
    BookingStatus.AGENT_EN_ROUTE: [BookingStatus.SERVICE_IN_PROGRESS, BookingStatus.CANCELLED],
    BookingStatus.SERVICE_IN_PROGRESS: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    BookingStatus.COMPLETED: [],  # Terminal state
    BookingStatus.CANCELLED: [],  # Terminal state
    BookingStatus.REJECTED: [],   # Terminal state
    BookingStatus.EXPIRED: [],    # Terminal state
}

def is_valid_status_transition(current_status: str, new_status: str) -> bool:
    """Check if a status transition is valid"""
    if current_status not in VALID_STATUS_TRANSITIONS:
        return False
    
    return new_status in VALID_STATUS_TRANSITIONS[current_status]