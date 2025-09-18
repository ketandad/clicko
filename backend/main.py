from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.user.routes import router as user_router
from shared.auth.routes import router as auth_router
from shared.admin.routes import router as admin_router
# Import other routers

app = FastAPI(title="ClickO API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Admin dashboard URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
# Include other routers

@app.get("/")
async def root():
    return {"message": "Welcome to ClickO API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
