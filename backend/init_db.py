from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.database import Base, get_db, DATABASE_URL, engine
from shared.user.models import User, Agent, Category, AgentCategory, Booking, Rating
import os

def init_database():
    """Initialize the database with all tables and sample data"""
    
    # Drop all tables (for fresh start)
    Base.metadata.drop_all(bind=engine)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create sample categories
        categories = [
            Category(name="Home Cleaning", description="Professional home cleaning services", icon_url="/icons/cleaning.png"),
            Category(name="Plumbing", description="Plumbing repairs and maintenance", icon_url="/icons/plumbing.png"),
            Category(name="Electrical", description="Electrical work and repairs", icon_url="/icons/electrical.png"),
            Category(name="Carpentry", description="Furniture repair and carpentry work", icon_url="/icons/carpentry.png"),
            Category(name="Painting", description="House painting and touch-ups", icon_url="/icons/painting.png"),
            Category(name="AC Service", description="Air conditioning service and repair", icon_url="/icons/ac.png"),
            Category(name="Gardening", description="Garden maintenance and landscaping", icon_url="/icons/gardening.png"),
            Category(name="Pest Control", description="Pest control and extermination", icon_url="/icons/pest.png"),
        ]
        
        for category in categories:
            db.add(category)
        
        db.commit()
        
        print("✅ Database initialized successfully!")
        print("✅ Sample categories created")
        print("✅ All tables created:")
        print("   - users")
        print("   - agents") 
        print("   - categories")
        print("   - agent_category")
        print("   - bookings")
        print("   - ratings")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()