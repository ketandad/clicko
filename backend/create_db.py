from sqlalchemy import create_engine
from database.connection import Base, engine
from database.models import User
import os
from dotenv import load_dotenv

load_dotenv()

def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    create_tables()