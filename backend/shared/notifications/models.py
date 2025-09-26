"""
Notification models and database schemas
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class AgentNotification(Base):
    """
    Model for storing agent notifications in database
    Used for persistent storage and offline notifications
    """
    __tablename__ = "agent_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(String, unique=True, index=True, nullable=False)  # UUID for tracking
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    booking_id = Column(String, ForeignKey("bookings.booking_id"), nullable=False, index=True)
    
    # Notification details
    type = Column(String, nullable=False, default="booking_request")  # booking_request, status_update, etc.
    title = Column(String, nullable=False)
    message = Column(Text)
    
    # Notification data (JSON stored as text)
    customer_name = Column(String)
    customer_phone = Column(String)
    service_type = Column(String)
    service_details = Column(Text)
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(Text)
    scheduled_time = Column(DateTime)
    estimated_cost = Column(Float)
    visit_charges = Column(Float)
    service_charges = Column(Float)
    is_emergency = Column(Boolean, default=False)
    customer_notes = Column(Text)
    
    # Notification status
    status = Column(String, nullable=False, default="pending")  # pending, delivered, read, responded, expired
    requires_response = Column(Boolean, default=True)
    priority = Column(String, default="normal")  # low, normal, high, critical
    
    # Response details
    response = Column(String)  # accepted, rejected
    response_data = Column(Text)  # JSON string for additional response data
    response_reason = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    responded_at = Column(DateTime)
    expires_at = Column(DateTime, nullable=False, index=True)  # 30 seconds from created_at
    
    # Metadata
    delivery_attempts = Column(Integer, default=0)
    last_delivery_attempt = Column(DateTime)
    is_read = Column(Boolean, default=False, index=True)
    is_expired = Column(Boolean, default=False, index=True)
    
    # Relationships
    # agent = relationship("Agent", back_populates="notifications")
    # booking = relationship("Booking", back_populates="notifications")

class NotificationTemplate(Base):
    """
    Templates for different types of notifications
    """
    __tablename__ = "notification_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String, unique=True, nullable=False, index=True)
    template_type = Column(String, nullable=False, index=True)  # booking_request, status_update, system_message
    
    # Template content
    title_template = Column(String, nullable=False)
    message_template = Column(Text, nullable=False)
    sound_type = Column(String, default="default")  # default, bell_continuous, alert, none
    
    # Template settings
    requires_response = Column(Boolean, default=False)
    timeout_seconds = Column(Integer, default=30)
    priority = Column(String, default="normal")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True, index=True)

class NotificationLog(Base):
    """
    Log of all notification events for analytics and debugging
    """
    __tablename__ = "notification_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(String, nullable=False, index=True)
    agent_id = Column(Integer, index=True)
    
    # Event details
    event_type = Column(String, nullable=False, index=True)  # sent, delivered, read, responded, expired, failed
    event_data = Column(Text)  # JSON string for additional event data
    
    # Connection info
    connection_type = Column(String)  # websocket, push_notification, sms, etc.
    device_info = Column(Text)  # JSON string with device/client information
    
    # Timing
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    response_time_ms = Column(Integer)  # Time taken for agent to respond (milliseconds)
    
    # Metadata
    success = Column(Boolean, default=True, index=True)
    error_message = Column(Text)
    retry_attempt = Column(Integer, default=0)

class AgentAvailability(Base):
    """
    Track agent availability for notifications
    """
    __tablename__ = "agent_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), unique=True, nullable=False, index=True)
    
    # Availability status
    is_online = Column(Boolean, default=False, index=True)
    is_accepting_bookings = Column(Boolean, default=True, index=True)
    status = Column(String, default="offline")  # online, offline, busy, away
    
    # Connection info
    last_websocket_connection = Column(DateTime)
    last_activity = Column(DateTime)
    connection_count = Column(Integer, default=0)
    
    # Notification preferences
    notification_enabled = Column(Boolean, default=True)
    sound_enabled = Column(Boolean, default=True)
    vibration_enabled = Column(Boolean, default=True)
    
    # Response metrics
    total_notifications_received = Column(Integer, default=0)
    total_notifications_responded = Column(Integer, default=0)
    average_response_time_seconds = Column(Float)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # agent = relationship("Agent", back_populates="availability")

# Database indexes for performance
"""
CREATE INDEX idx_notifications_agent_status ON agent_notifications(agent_id, status);
CREATE INDEX idx_notifications_created_at ON agent_notifications(created_at DESC);
CREATE INDEX idx_notifications_expires_at ON agent_notifications(expires_at);
CREATE INDEX idx_notification_logs_timestamp ON notification_logs(timestamp DESC);
CREATE INDEX idx_notification_logs_agent_event ON notification_logs(agent_id, event_type);
CREATE INDEX idx_agent_availability_online ON agent_availability(is_online, is_accepting_bookings);
"""