"""
FastAPI routes for the Tool Detection API
"""

import os
import uuid
import shutil
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image as PILImage

from app.database.connection import get_db
from app.database.models import Image
from app.database.queries import search_images, get_image_by_id
from app.services.inference import get_tool_detector
from app.api.schemas import (
    UploadResponse, SearchRequest, SearchResultsResponse, 
    SearchResponse, ErrorResponse, HealthResponse
)

router = APIRouter()

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB
ALLOWED_EXTENSIONS = os.getenv("ALLOWED_EXTENSIONS", "jpg,jpeg,png").split(",")


@router.post("/upload", response_model=UploadResponse)
async def upload_image(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    db: Session = Depends(get_db)
):
    """
    Upload an image and detect tools using AI
    """
    try:
        # Validate file
        if not image.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Check file extension
        file_extension = image.filename.split('.')[-1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Read and validate image
        contents = await image.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        # Validate image can be opened
        try:
            with PILImage.open(file_path) as img:
                img.verify()
        except Exception:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Run AI inference
        tool_detector = get_tool_detector()
        tags, confidences = tool_detector.detect_tools(file_path)
        
        # Create database record
        db_image = Image(
            filename=filename,
            original_filename=image.filename,
            tags=tags,
            confidences=confidences,
            latitude=latitude,
            longitude=longitude,
            location=f'POINT({longitude} {latitude})',
            file_size=len(contents),
            mime_type=image.content_type
        )
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        return UploadResponse(
            id=str(db_image.id),
            filename=db_image.filename,
            original_filename=db_image.original_filename,
            tags=db_image.tags,
            confidences=db_image.confidences,
            latitude=db_image.latitude,
            longitude=db_image.longitude,
            created_at=db_image.created_at,
            file_size=db_image.file_size,
            mime_type=db_image.mime_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file if database operation fails
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/search", response_model=SearchResultsResponse)
async def search_images_endpoint(
    query: Optional[str] = Query(None, description="Text query to search in tags"),
    lat: Optional[float] = Query(None, description="Latitude for location-based search"),
    lon: Optional[float] = Query(None, description="Longitude for location-based search"),
    radius_m: float = Query(10000, description="Search radius in meters"),
    limit: int = Query(50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Search images by tags and/or location
    """
    try:
        # Validate coordinates if provided
        if (lat is None) != (lon is None):
            raise HTTPException(
                status_code=400, 
                detail="Both latitude and longitude must be provided together"
            )
        
        if lat is not None and (lat < -90 or lat > 90):
            raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
        
        if lon is not None and (lon < -180 or lon > 180):
            raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
        
        # Perform search
        results = search_images(db, query, lat, lon, radius_m, limit)
        
        # Convert to response format
        search_results = []
        for image in results:
            search_results.append(SearchResponse(
                id=str(image.id),
                filename=image.filename,
                original_filename=image.original_filename,
                tags=image.tags,
                confidences=image.confidences,
                latitude=image.latitude,
                longitude=image.longitude,
                created_at=image.created_at,
                file_size=image.file_size,
                mime_type=image.mime_type
            ))
        
        location_info = None
        if lat is not None and lon is not None:
            location_info = {"lat": lat, "lon": lon}
        
        return SearchResultsResponse(
            results=search_results,
            total=len(search_results),
            query=query,
            location=location_info,
            radius_m=radius_m if lat is not None else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/images/{image_id}")
async def get_image_file(image_id: str, db: Session = Depends(get_db)):
    """
    Serve an image file by ID
    """
    try:
        # Get image record from database
        db_image = get_image_by_id(db, image_id)
        if not db_image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Check if file exists
        file_path = os.path.join(UPLOAD_DIR, db_image.filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Image file not found")
        
        # Return file
        return FileResponse(
            path=file_path,
            media_type=db_image.mime_type or "image/jpeg",
            filename=db_image.original_filename or db_image.filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve image: {str(e)}")


@router.get("/images/{image_id}/info", response_model=SearchResponse)
async def get_image_info(image_id: str, db: Session = Depends(get_db)):
    """
    Get image metadata by ID
    """
    try:
        db_image = get_image_by_id(db, image_id)
        if not db_image:
            raise HTTPException(status_code=404, detail="Image not found")
        
        return SearchResponse(
            id=str(db_image.id),
            filename=db_image.filename,
            original_filename=db_image.original_filename,
            tags=db_image.tags,
            confidences=db_image.confidences,
            latitude=db_image.latitude,
            longitude=db_image.longitude,
            created_at=db_image.created_at,
            file_size=db_image.file_size,
            mime_type=db_image.mime_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve image info: {str(e)}")


@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    """
    try:
        # Check database connection
        db.execute("SELECT 1")
        database_connected = True
    except Exception:
        database_connected = False
    
    # Check model loading
    try:
        tool_detector = get_tool_detector()
        models_loaded = tool_detector.get_detection_info()["models_loaded"]
    except Exception:
        models_loaded = False
    
    return HealthResponse(
        status="healthy" if database_connected and models_loaded else "degraded",
        models_loaded=models_loaded,
        database_connected=database_connected,
        timestamp=datetime.utcnow()
    )


@router.get("/models/info")
async def get_models_info():
    """
    Get information about loaded AI models
    """
    try:
        tool_detector = get_tool_detector()
        return tool_detector.get_detection_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")
