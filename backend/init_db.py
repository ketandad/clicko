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
        
        # Create sample users for agents
        sample_agents_data = [
            {"name": "Rajesh Kumar", "email": "rajesh.kumar@example.com", "phone": "+91-9876543210", "is_agent": True},
            {"name": "Priya Sharma", "email": "priya.sharma@example.com", "phone": "+91-9876543211", "is_agent": True},
            {"name": "Amit Singh", "email": "amit.singh@example.com", "phone": "+91-9876543212", "is_agent": True},
            {"name": "Sunita Patel", "email": "sunita.patel@example.com", "phone": "+91-9876543213", "is_agent": True},
            {"name": "Vikram Gupta", "email": "vikram.gupta@example.com", "phone": "+91-9876543214", "is_agent": True},
            {"name": "Kavitha Reddy", "email": "kavitha.reddy@example.com", "phone": "+91-9876543215", "is_agent": True},
        ]
        
        agent_users = []
        for agent_data in sample_agents_data:
            user = User(
                name=agent_data["name"],
                email=agent_data["email"],
                phone=agent_data["phone"],
                is_agent=agent_data["is_agent"],
                password_hash="dummy_hash"  # In production, this would be properly hashed
            )
            db.add(user)
            agent_users.append(user)
        
        db.commit()
        
        # Create sample agents
        sample_agents = [
            {"user": agent_users[0], "rate_per_km": 20.0, "avg_rating": 4.8, "total_ratings": 156, "categories": [1, 3]},  # Rajesh - Cleaning, Electrical
            {"user": agent_users[1], "rate_per_km": 18.0, "avg_rating": 4.6, "total_ratings": 89, "categories": [1, 7]},   # Priya - Cleaning, Gardening  
            {"user": agent_users[2], "rate_per_km": 22.0, "avg_rating": 4.9, "total_ratings": 234, "categories": [2, 4]},  # Amit - Plumbing, Carpentry
            {"user": agent_users[3], "rate_per_km": 19.0, "avg_rating": 4.7, "total_ratings": 67, "categories": [5, 1]},   # Sunita - Painting, Cleaning
            {"user": agent_users[4], "rate_per_km": 21.0, "avg_rating": 4.5, "total_ratings": 123, "categories": [6, 3]},  # Vikram - AC Service, Electrical
            {"user": agent_users[5], "rate_per_km": 17.0, "avg_rating": 4.9, "total_ratings": 201, "categories": [8, 7]},  # Kavitha - Pest Control, Gardening
        ]
        
        for i, agent_data in enumerate(sample_agents):
            agent = Agent(
                user_id=agent_data["user"].id,
                rate_per_km=agent_data["rate_per_km"],
                avg_rating=agent_data["avg_rating"],
                total_ratings=agent_data["total_ratings"],
                is_online=True if i % 2 == 0 else False,  # Make half online
                kyc_status="verified"  # Mark all as verified for testing
            )
            db.add(agent)
            db.commit()  # Commit to get agent.id
            
            # Add agent categories
            for category_id in agent_data["categories"]:
                agent_category = AgentCategory(agent_id=agent.id, category_id=category_id)
                db.add(agent_category)
        
        db.commit()
        
        print("✅ Database initialized successfully!")
        print("✅ Sample categories created")
        print("✅ Sample agent users created")
        print("✅ Sample agents created with categories")
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