from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, Table, UniqueConstraint
import sqlalchemy as sa
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from ..database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)  # Basic phone for customers
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    is_agent = Column(Boolean, default=False)
    
    # If user is also an agent
    agent = relationship("Agent", uselist=False, back_populates="user")
    
    # User bookings
    bookings = relationship("Booking", back_populates="user")
    
    # For password reset functionality
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rate_per_km = Column(Float, nullable=False, default=20.0)  # Default ₹20/km
    wallet_balance = Column(Float, nullable=False, default=1000.0)  # Default ₹1000
    is_online = Column(Boolean, default=False)
    last_online = Column(DateTime, nullable=True)
    offline_until = Column(DateTime, nullable=True)
    avg_rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Enhanced profile fields (moved from User model - agents need these)
    formatted_phone = Column(String, nullable=True)  # E.164 format: +919876543210
    profile_photo_url = Column(String, nullable=True)  # Profile photo for agent card
    selfie_verification_url = Column(String, nullable=True)  # Selfie for identity verification
    experience_years = Column(Integer, nullable=True, default=0)  # Experience in years
    bio = Column(String, nullable=True)  # Short description about the agent
    
    # Agent address fields (service area/base location)
    address = Column(String, nullable=True)  # Legacy field
    address_line_1 = Column(String, nullable=True)  # Street address
    address_line_2 = Column(String, nullable=True)  # Apartment, suite, etc.
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    country = Column(String, nullable=True, default="India")
    google_place_id = Column(String, nullable=True)  # For Google Places integration
    location = Column(String, nullable=True)  # Legacy format: "latitude,longitude"
    
    # Enhanced location tracking for geospatial queries and scalability
    current_latitude = Column(Float, nullable=True, index=True)  # Current GPS latitude
    current_longitude = Column(Float, nullable=True, index=True)  # Current GPS longitude
    service_radius_km = Column(Float, nullable=False, default=10.0)  # Service area radius in KM
    last_location_update = Column(DateTime, nullable=True)  # Last GPS update timestamp
    location_accuracy = Column(Float, nullable=True)  # GPS accuracy in meters
    is_location_enabled = Column(Boolean, default=True)  # Agent's location sharing preference
    
    # Base/home location (where agent is based - for service area calculation)
    base_latitude = Column(Float, nullable=True)  # Agent's home/base latitude
    base_longitude = Column(Float, nullable=True)  # Agent's home/base longitude
    
    # KYC fields
    kyc_document_type = Column(String, nullable=True)
    kyc_document_path = Column(String, nullable=True)
    kyc_status = Column(String, default="pending")  # pending, verified, rejected
    selfie_verification_status = Column(String, default="pending")  # pending, verified, rejected
    
    # Relationships
    user = relationship("User", back_populates="agent")
    categories = relationship("AgentCategory", back_populates="agent")
    sub_categories = relationship("AgentSubCategory", back_populates="agent")
    bookings = relationship("Booking", back_populates="agent")
    service_pricing = relationship("AgentServicePricing", back_populates="agent")

# Association table for agent-category many-to-many relationship
agent_categories = Table(
    "agent_categories",
    Base.metadata,
    Column("agent_id", Integer, ForeignKey("agents.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id"), primary_key=True)
)

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    agents = relationship("AgentCategory", back_populates="category")
    sub_categories = relationship("SubCategory", back_populates="category")

class SubCategory(Base):
    __tablename__ = "sub_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    category = relationship("Category", back_populates="sub_categories")
    agent_sub_categories = relationship("AgentSubCategory", back_populates="sub_category")
    agent_pricing = relationship("AgentServicePricing", back_populates="sub_category")

class AgentCategory(Base):
    __tablename__ = "agent_category"
    
    agent_id = Column(Integer, ForeignKey("agents.id"), primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), primary_key=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="categories")
    category = relationship("Category", back_populates="agents")

class AgentSubCategory(Base):
    __tablename__ = "agent_sub_category"
    
    agent_id = Column(Integer, ForeignKey("agents.id"), primary_key=True)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), primary_key=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="sub_categories")
    sub_category = relationship("SubCategory", back_populates="agent_sub_categories")

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, accepted, rejected, completed, cancelled
    scheduled_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    visit_charge = Column(Float, nullable=False)
    # Using string for location coordinates as "lat,lng" for SQLite compatibility  
    user_location = Column(String, nullable=False)  # Format: "latitude,longitude"
    address = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="bookings")
    agent = relationship("Agent", back_populates="bookings")
    rating = relationship("Rating", uselist=False, back_populates="booking")

class Rating(Base):
    __tablename__ = "ratings"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    feedback = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    booking = relationship("Booking", back_populates="rating")

class AgentServicePricing(Base):
    __tablename__ = "agent_service_pricing"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    sub_category_id = Column(Integer, ForeignKey("sub_categories.id"), nullable=False)
    
    # Pricing details
    price_type = Column(String, nullable=False, default="fixed")  # fixed, hourly, per_visit, range
    base_price = Column(Float, nullable=False)  # Main price
    min_price = Column(Float, nullable=True)   # For range pricing (optional)
    max_price = Column(Float, nullable=True)   # For range pricing (optional)
    
    # Additional info
    description = Column(String, nullable=True)  # Optional pricing notes/details
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agent = relationship("Agent", back_populates="service_pricing")
    sub_category = relationship("SubCategory", back_populates="agent_pricing")
    
    # Unique constraint: one pricing per agent per subcategory
    __table_args__ = (
        UniqueConstraint('agent_id', 'sub_category_id', name='unique_agent_subcategory_pricing'),
    )