from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - using SQLite for simplicity
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./clicko.db")

# SQLite optimization settings
sqlite_connect_args = {
    "check_same_thread": False,
    "timeout": 20,  # 20 second timeout for database operations
}

# Create engine with optimizations
if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL, 
        connect_args=sqlite_connect_args,
        pool_timeout=20,
        pool_recycle=-1,
        echo=False  # Set to True for SQL debugging
    )
else:
    engine = create_engine(DATABASE_URL)

# Create session factory with optimized settings
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine,
    expire_on_commit=False  # Keep objects accessible after commit
)

# Create declarative base
Base = declarative_base()

# Dependency to get database session with timeout handling
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

# Create tables
def create_tables():
    Base.metadata.create_all(bind=engine)