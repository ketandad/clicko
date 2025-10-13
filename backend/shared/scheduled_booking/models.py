"""
Scheduled Booking Models
Database models for future date/time bookings and agent calendar management
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum as SQLEnum, Date, Time
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, date, time, timedelta
from enum import Enum
import uuid

Base = declarative_base()

class TimeSlotStatus(Enum):
    """Time slot availability status"""
    AVAILABLE = "available"
    BOOKED = "booked"
    BLOCKED = "blocked"          # Agent manually blocked this slot
    UNAVAILABLE = "unavailable"  # Agent not working this time

class ScheduleRecurrence(Enum):
    """Recurring schedule patterns"""
    NONE = "none"           # One-time booking
    DAILY = "daily"         # Daily recurring
    WEEKLY = "weekly"       # Weekly recurring
    MONTHLY = "monthly"     # Monthly recurring

class AgentSchedule(Base):
    """
    Agent's working schedule and availability
    Defines when agent is available for bookings
    """
    __tablename__ = "agent_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False, index=True)
    
    # Schedule Information
    day_of_week = Column(Integer, nullable=False, index=True)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)  # e.g., 09:00
    end_time = Column(Time, nullable=False)    # e.g., 18:00
    
    # Schedule Settings
    is_active = Column(Boolean, default=True, nullable=False)
    slot_duration_minutes = Column(Integer, default=60, nullable=False)  # Default 1 hour slots
    break_duration_minutes = Column(Integer, default=15, nullable=False)  # Break between bookings
    
    # Capacity Management
    max_bookings_per_slot = Column(Integer, default=1, nullable=False)  # Usually 1 for service agents
    advance_booking_days = Column(Integer, default=30, nullable=False)  # How far in advance bookings allowed
    
    # Special Settings
    allow_emergency_bookings = Column(Boolean, default=True, nullable=False)
    emergency_extra_charge = Column(Integer, default=0, nullable=False)  # Extra charge for emergency
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    scheduled_bookings = relationship("ScheduledBooking", back_populates="agent_schedule")
    time_slots = relationship("AgentTimeSlot", back_populates="agent_schedule")
    
    def __repr__(self):
        return f"<AgentSchedule(agent_id={self.agent_id}, day={self.day_of_week}, {self.start_time}-{self.end_time})>"

class AgentTimeSlot(Base):
    """
    Individual time slots for agent availability
    Generated from AgentSchedule for specific dates
    """
    __tablename__ = "agent_time_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False, index=True)
    agent_schedule_id = Column(Integer, ForeignKey('agent_schedules.id'), nullable=False)
    
    # Slot Timing
    slot_date = Column(Date, nullable=False, index=True)
    slot_start_time = Column(Time, nullable=False)
    slot_end_time = Column(Time, nullable=False)
    
    # Slot Status
    status = Column(SQLEnum(TimeSlotStatus), default=TimeSlotStatus.AVAILABLE, nullable=False, index=True)
    current_bookings = Column(Integer, default=0, nullable=False)  # Number of current bookings
    max_bookings = Column(Integer, default=1, nullable=False)      # Maximum allowed bookings
    
    # Slot Metadata
    is_emergency_slot = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)  # Agent notes for this slot
    blocked_reason = Column(String(255), nullable=True)  # Reason if blocked
    
    # Pricing Override
    custom_rate = Column(Integer, nullable=True)  # Custom rate for this slot (if different from standard)
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    agent_schedule = relationship("AgentSchedule", back_populates="time_slots")
    scheduled_bookings = relationship("ScheduledBooking", back_populates="time_slot")
    
    def __repr__(self):
        return f"<AgentTimeSlot(agent_id={self.agent_id}, date={self.slot_date}, {self.slot_start_time}-{self.slot_end_time}, status={self.status.value})>"
    
    @property
    def is_available(self):
        """Check if slot is available for booking"""
        return (
            self.status == TimeSlotStatus.AVAILABLE and 
            self.current_bookings < self.max_bookings
        )
    
    @property
    def datetime_start(self):
        """Get full datetime for slot start"""
        return datetime.combine(self.slot_date, self.slot_start_time)
    
    @property
    def datetime_end(self):
        """Get full datetime for slot end"""
        return datetime.combine(self.slot_date, self.slot_end_time)

class ScheduledBooking(Base):
    """
    Bookings scheduled for future dates/times
    Extends the main booking system with scheduling capabilities
    """
    __tablename__ = "scheduled_bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_uuid = Column(String(36), default=lambda: str(uuid.uuid4()), unique=True, nullable=False, index=True)
    
    # References
    booking_id = Column(String(36), ForeignKey('bookings.booking_uuid'), nullable=False, index=True)  # Main booking record
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    time_slot_id = Column(Integer, ForeignKey('agent_time_slots.id'), nullable=False, index=True)
    agent_schedule_id = Column(Integer, ForeignKey('agent_schedules.id'), nullable=False)
    
    # Scheduling Information
    scheduled_date = Column(Date, nullable=False, index=True)
    scheduled_start_time = Column(Time, nullable=False)
    scheduled_end_time = Column(Time, nullable=False)
    estimated_duration_minutes = Column(Integer, nullable=False, default=60)
    
    # Booking Type
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurrence_pattern = Column(SQLEnum(ScheduleRecurrence), default=ScheduleRecurrence.NONE)
    recurrence_end_date = Column(Date, nullable=True)  # When recurring ends
    parent_booking_id = Column(String(36), nullable=True, index=True)  # For recurring bookings
    
    # Customer Preferences
    customer_notes = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)
    preferred_agent_gender = Column(String(10), nullable=True)
    
    # Booking Status Specific to Scheduling
    is_confirmed_by_agent = Column(Boolean, default=False, nullable=False)
    is_confirmed_by_customer = Column(Boolean, default=True, nullable=False)  # Customer confirms when booking
    confirmation_deadline = Column(DateTime, nullable=True)  # Agent must confirm by this time
    
    # Reminder Settings
    send_reminder_24h = Column(Boolean, default=True, nullable=False)
    send_reminder_2h = Column(Boolean, default=True, nullable=False)
    reminder_sent_24h = Column(Boolean, default=False, nullable=False)
    reminder_sent_2h = Column(Boolean, default=False, nullable=False)
    
    # Pricing for Scheduled Booking
    scheduled_rate = Column(Integer, nullable=False)  # Rate at time of booking
    advance_booking_discount = Column(Integer, default=0, nullable=False)  # Discount for advance booking
    total_scheduled_amount = Column(Integer, nullable=False)
    
    # Status Tracking
    is_rescheduled = Column(Boolean, default=False, nullable=False)
    reschedule_count = Column(Integer, default=0, nullable=False)
    original_scheduled_date = Column(Date, nullable=True)  # Track original date if rescheduled
    
    # Cancellation
    is_cancelled = Column(Boolean, default=False, nullable=False)
    cancellation_reason = Column(String(255), nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by_user_id = Column(Integer, nullable=True)
    cancellation_penalty = Column(Integer, default=0, nullable=False)
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    time_slot = relationship("AgentTimeSlot", back_populates="scheduled_bookings")
    agent_schedule = relationship("AgentSchedule", back_populates="scheduled_bookings")
    
    def __repr__(self):
        return f"<ScheduledBooking(uuid={self.booking_uuid}, date={self.scheduled_date}, time={self.scheduled_start_time})>"
    
    @property
    def scheduled_datetime(self):
        """Get full datetime for scheduled booking"""
        return datetime.combine(self.scheduled_date, self.scheduled_start_time)
    
    @property
    def is_upcoming(self):
        """Check if booking is in the future"""
        return self.scheduled_datetime > datetime.now()
    
    @property
    def is_today(self):
        """Check if booking is today"""
        return self.scheduled_date == date.today()
    
    @property
    def days_until_booking(self):
        """Days until the booking"""
        if self.scheduled_date >= date.today():
            return (self.scheduled_date - date.today()).days
        return -1

class BookingReminder(Base):
    """
    Reminders for scheduled bookings
    """
    __tablename__ = "booking_reminders"
    
    id = Column(Integer, primary_key=True, index=True)
    scheduled_booking_id = Column(Integer, ForeignKey('scheduled_bookings.id'), nullable=False, index=True)
    
    # Reminder Details
    reminder_type = Column(String(50), nullable=False)  # "24h_before", "2h_before", "30m_before"
    reminder_time = Column(DateTime, nullable=False, index=True)
    
    # Reminder Status
    is_sent = Column(Boolean, default=False, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    
    # Reminder Content
    recipient_type = Column(String(20), nullable=False)  # "customer", "agent", "both"
    message_template = Column(String(100), nullable=True)
    
    # Audit Fields
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<BookingReminder(type={self.reminder_type}, time={self.reminder_time}, sent={self.is_sent})>"

# Database indexes for performance optimization
"""
-- Performance indexes for scheduled bookings
CREATE INDEX idx_agent_schedules_agent_day ON agent_schedules(agent_id, day_of_week, is_active);
CREATE INDEX idx_agent_time_slots_agent_date ON agent_time_slots(agent_id, slot_date, status);
CREATE INDEX idx_agent_time_slots_date_status ON agent_time_slots(slot_date, status) WHERE status = 'available';
CREATE INDEX idx_scheduled_bookings_agent_date ON scheduled_bookings(agent_id, scheduled_date);
CREATE INDEX idx_scheduled_bookings_upcoming ON scheduled_bookings(scheduled_date, scheduled_start_time) WHERE is_cancelled = false;
CREATE INDEX idx_booking_reminders_pending ON booking_reminders(reminder_time) WHERE is_sent = false;

-- Composite indexes for calendar queries
CREATE INDEX idx_calendar_agent_date_range ON scheduled_bookings(agent_id, scheduled_date) WHERE is_cancelled = false;
CREATE INDEX idx_time_slots_availability ON agent_time_slots(agent_id, slot_date, status, current_bookings, max_bookings);
"""