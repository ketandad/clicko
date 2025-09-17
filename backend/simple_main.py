from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title=os.getenv("APP_NAME", "Clicko API"),
    version=os.getenv("VERSION", "1.0.0"),
    description="Clicko Mobile App Backend API"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return JSONResponse(
        content={
            "message": "Welcome to Clicko API",
            "status": "active",
            "version": os.getenv("VERSION", "1.0.0"),
            "endpoints": {
                "health": "/health",
                "docs": "/docs",
                "auth": "/api/auth",
                "users": "/api/users"
            }
        }
    )

@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "healthy", "message": "API is running"})