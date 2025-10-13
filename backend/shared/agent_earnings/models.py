"""
Agent Earnings Database Models
Comprehensive earnings tracking, payment history, and financial analytics for agents
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, Date, Index, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, date
from enum import Enum
import uuid

Base = declarative_base()

class EarningType(str, Enum):
    BOOKING_PAYMENT = "booking_payment"
    BONUS_PAYMENT = "bonus_payment"
    REFERRAL_BONUS = "referral_bonus"
    PENALTY_REFUND = "penalty_refund"
    PERFORMANCE_BONUS = "performance_bonus"
    CANCELLATION_FEE = "cancellation_fee"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class PaymentMethod(str, Enum):
    BANK_TRANSFER = "bank_transfer"
    UPI = "upi"
    WALLET = "wallet"
    CASH = "cash"

class EarningPeriod(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"

class AgentEarning(Base):
    """
    Individual earning record for each completed booking/transaction
    """
    __tablename__ = "agent_earnings"
    
    id = Column(Integer, primary_key=True, index=True)
    earning_uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Earning Details
    earning_type = Column(SQLEnum(EarningType), nullable=False, index=True)
    gross_amount = Column(Float, nullable=False)  # Total amount before deductions
    platform_fee = Column(Float, default=0.0)  # Platform commission (if any)
    tax_deduction = Column(Float, default=0.0)  # Tax deducted at source
    service_charge = Column(Float, default=0.0)  # Payment processing charges
    net_amount = Column(Float, nullable=False)  # Final amount to be paid to agent
    
    # Payment Information
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=True)
    payment_reference = Column(String(100), nullable=True, index=True)
    paid_at = Column(DateTime, nullable=True)
    
    # Service Details
    service_category = Column(String(100), nullable=True, index=True)
    service_duration_minutes = Column(Integer, nullable=True)
    customer_rating = Column(Float, nullable=True)  # Rating received for this service
    
    # Metadata
    earning_date = Column(Date, nullable=False, index=True, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional Information
    description = Column(Text, nullable=True)
    bonus_reason = Column(String(200), nullable=True)  # For bonus earnings
    is_disputed = Column(Boolean, default=False, index=True)
    dispute_reason = Column(Text, nullable=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="earnings")
    booking = relationship("Booking", back_populates="earning")
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_agent_earnings_date", "agent_id", "earning_date"),
        Index("idx_agent_earnings_status", "agent_id", "payment_status"),
        Index("idx_earnings_type_date", "earning_type", "earning_date"),
        Index("idx_earnings_payment_ref", "payment_reference"),
    )
    
    @property
    def commission_percentage(self):
        """Calculate commission percentage"""
        if self.gross_amount > 0:
            return round((self.platform_fee / self.gross_amount) * 100, 2)
        return 0.0
    
    @property
    def days_since_earning(self):
        """Calculate days since earning was created"""
        return (date.today() - self.earning_date).days
    
    @property
    def is_recent(self):
        """Check if earning is from last 7 days"""
        return self.days_since_earning <= 7
    
    @property
    def is_paid(self):
        """Check if earning has been paid"""
        return self.payment_status == PaymentStatus.COMPLETED

class AgentEarningSummary(Base):
    """
    Pre-calculated earning summaries for different time periods
    Updated daily by background job for performance
    """
    __tablename__ = "agent_earning_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Time Period
    period_type = Column(SQLEnum(EarningPeriod), nullable=False, index=True)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False, index=True)
    period_label = Column(String(50), nullable=False)  # "Jan 2024", "Week 1 Jan 2024", etc.
    
    # Earning Metrics
    total_bookings = Column(Integer, default=0)
    completed_bookings = Column(Integer, default=0)
    cancelled_bookings = Column(Integer, default=0)
    
    total_gross_earnings = Column(Float, default=0.0)
    total_platform_fees = Column(Float, default=0.0)
    total_tax_deductions = Column(Float, default=0.0)
    total_service_charges = Column(Float, default=0.0)
    total_net_earnings = Column(Float, default=0.0)
    
    # Payment Status Breakdown
    pending_amount = Column(Float, default=0.0)
    processing_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    failed_amount = Column(Float, default=0.0)
    
    # Performance Metrics
    average_rating = Column(Float, default=0.0)
    total_service_hours = Column(Float, default=0.0)
    earnings_per_hour = Column(Float, default=0.0)
    
    # Bonus Earnings
    bonus_earnings = Column(Float, default=0.0)
    referral_bonuses = Column(Float, default=0.0)
    performance_bonuses = Column(Float, default=0.0)
    
    # Metadata
    calculated_at = Column(DateTime, default=datetime.utcnow)
    is_current_period = Column(Boolean, default=False, index=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="earning_summaries")
    
    # Indexes
    __table_args__ = (
        Index("idx_agent_summary_period", "agent_id", "period_type", "period_start"),
        Index("idx_summary_current", "agent_id", "is_current_period"),
        Index("idx_period_type_date", "period_type", "period_start"),
    )
    
    @property
    def completion_rate(self):
        """Calculate booking completion rate"""
        if self.total_bookings > 0:
            return round((self.completed_bookings / self.total_bookings) * 100, 2)
        return 0.0
    
    @property
    def cancellation_rate(self):
        """Calculate booking cancellation rate"""
        if self.total_bookings > 0:
            return round((self.cancelled_bookings / self.total_bookings) * 100, 2)
        return 0.0
    
    @property
    def average_commission_rate(self):
        """Calculate average commission percentage"""
        if self.total_gross_earnings > 0:
            return round((self.total_platform_fees / self.total_gross_earnings) * 100, 2)
        return 0.0

class PaymentBatch(Base):
    """
    Batch payment processing for multiple agent earnings
    """
    __tablename__ = "payment_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Batch Details
    batch_name = Column(String(100), nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    total_amount = Column(Float, nullable=False)
    total_agents = Column(Integer, nullable=False)
    total_earnings = Column(Integer, nullable=False)
    
    # Processing Status
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    processed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    
    # Payment Provider Details
    provider_batch_id = Column(String(200), nullable=True, index=True)
    provider_response = Column(Text, nullable=True)
    
    # Metadata
    created_by = Column(String(100), nullable=False)  # Admin user who created batch
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Processing Information
    processing_started_at = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # Relationships
    earnings = relationship("AgentEarning", backref="payment_batch")
    
    @property
    def is_processing(self):
        """Check if batch is currently being processed"""
        return self.status == PaymentStatus.PROCESSING
    
    @property
    def success_rate(self):
        """Calculate batch success rate"""
        if self.total_earnings > 0:
            successful_earnings = len([e for e in self.earnings if e.payment_status == PaymentStatus.COMPLETED])
            return round((successful_earnings / self.total_earnings) * 100, 2)
        return 0.0

class AgentPaymentMethod(Base):
    """
    Agent's preferred payment methods and bank details
    """
    __tablename__ = "agent_payment_methods"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Payment Method Details
    method_type = Column(SQLEnum(PaymentMethod), nullable=False)
    is_primary = Column(Boolean, default=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    
    # Bank Details (for bank transfer)
    bank_name = Column(String(100), nullable=True)
    account_holder_name = Column(String(100), nullable=True)
    account_number = Column(String(50), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    branch_name = Column(String(100), nullable=True)
    
    # UPI Details
    upi_id = Column(String(100), nullable=True)
    upi_provider = Column(String(50), nullable=True)  # GPay, PhonePe, etc.
    
    # Verification Status
    is_verified = Column(Boolean, default=False, index=True)
    verified_at = Column(DateTime, nullable=True)
    verification_document = Column(String(200), nullable=True)  # Document path/URL
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional Information
    notes = Column(Text, nullable=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="payment_methods")
    
    # Indexes
    __table_args__ = (
        Index("idx_agent_payment_primary", "agent_id", "is_primary"),
        Index("idx_payment_method_active", "agent_id", "is_active"),
    )

class EarningDispute(Base):
    """
    Disputes raised by agents regarding their earnings
    """
    __tablename__ = "earning_disputes"
    
    id = Column(Integer, primary_key=True, index=True)
    dispute_uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    earning_id = Column(Integer, ForeignKey("agent_earnings.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Dispute Details
    dispute_reason = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    expected_amount = Column(Float, nullable=True)
    
    # Status and Resolution
    status = Column(String(20), default="open", index=True)  # open, investigating, resolved, rejected
    priority = Column(String(20), default="medium", index=True)  # low, medium, high, urgent
    
    # Resolution Details
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)  # Admin user
    resolution_note = Column(Text, nullable=True)
    adjustment_amount = Column(Float, nullable=True)  # Amount adjusted if any
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Supporting Documents
    supporting_documents = Column(Text, nullable=True)  # JSON array of document URLs
    
    # Relationships
    agent = relationship("Agent", back_populates="earning_disputes")
    earning = relationship("AgentEarning", back_populates="disputes")
    
    @property
    def is_open(self):
        """Check if dispute is still open"""
        return self.status == "open"
    
    @property
    def days_open(self):
        """Calculate days since dispute was opened"""
        return (datetime.utcnow() - self.created_at).days
    
    @property
    def is_urgent(self):
        """Check if dispute is urgent"""
        return self.priority == "urgent" or self.days_open > 7