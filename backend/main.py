"""
Tool Detection & Geotag Search Application
FastAPI Backend Entry Point
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.api.routes import router
# from app.api.chat_routes import router as chat_router
from app.database.connection import init_db

# Load environment variables
load_dotenv()

# Create uploads directory if it doesn't exist
upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(upload_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and models on startup"""
    init_db()
    yield
    # Cleanup on shutdown if needed


# Create FastAPI app
app = FastAPI(
    title="Tool Detection API",
    description="API for detecting and geotagging work tools from images",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
# Add ngrok support - allow all origins for development
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Include API routes
app.include_router(router, prefix="/api")
# app.include_router(chat_router, prefix="/api")

# Serve uploaded images
app.mount("/images", StaticFiles(directory=upload_dir), name="images")


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Tool Detection & Geotag Search API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    print(os.getenv("API_HOST"))

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True
    )
