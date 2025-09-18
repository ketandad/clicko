from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from geoalchemy2 import Geography
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    address = Column(String, nullable=True)
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    is_agent = Column(Boolean, default=False)
    profile_image_url = Column(String, nullable=True)
    
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
    
    # KYC fields
    kyc_document_type = Column(String, nullable=True)
    kyc_document_path = Column(String, nullable=True)
    kyc_status = Column(String, default="pending")  # pending, verified, rejected
    
    # Relationships
    user = relationship("User", back_populates="agent")
    categories = relationship("AgentCategory", back_populates="agent")
    bookings = relationship("Booking", back_populates="agent")

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

class AgentCategory(Base):
    __tablename__ = "agent_category"
    
    agent_id = Column(Integer, ForeignKey("agents.id"), primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), primary_key=True)
    
    # Relationships
    agent = relationship("Agent", back_populates="categories")
    category = relationship("Category", back_populates="agents")

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, accepted, rejected, completed, cancelled
    scheduled_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    visit_charge = Column(Float, nullable=False)
    user_location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
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