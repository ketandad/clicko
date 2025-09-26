from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from shared.user.routes import router as user_router
from shared.auth.routes import router as auth_router
from shared.admin.routes import router as admin_router
from shared.category.routes import router as category_router
from shared.agent.routes import router as agent_router
from shared.rating.routes import router as rating_router
from shared.booking.routes import router as booking_router
from shared.database import engine, Base
# Import models so they register with Base
from shared.user.models import User, Agent, Category, AgentCategory, Booking, Rating
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ClickO API",
    description="Service marketplace API",
    version="1.0.0"
)

# Configure CORS with optimized settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting ClickO API...")
    
    # Verify database connection and create tables
    try:
        # Test database connection
        connection = engine.connect()
        connection.close()
        logger.info("✅ Database connection verified")
        
        # Create all tables
        from shared.database import create_tables
        create_tables()
        logger.info("✅ Database tables created/verified")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise e
    
    logger.info("✅ ClickO API startup complete")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down ClickO API...")
    engine.dispose()
    logger.info("✅ ClickO API shutdown complete")

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(category_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(rating_router, prefix="/api")
app.include_router(booking_router)

@app.get("/")
async def root():
    return {"message": "Welcome to ClickO API", "status": "running", "timestamp": time.time()}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        connection = engine.connect()
        connection.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

@app.get("/api/status")
async def api_status():
    """API status endpoint"""
    return {
        "api": "ClickO",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "auth": "/api/auth/*",
            "users": "/api/users/*",
            "admin": "/api/admin/*"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
