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
from app.services.unified_inference import get_unified_detector
from app.services.onedrive_service import onedrive_service
from app.api.schemas import (
    UploadResponse, SearchRequest, SearchResultsResponse, 
    SearchResponse, ErrorResponse, HealthResponse
)

router = APIRouter()

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB
ALLOWED_EXTENSIONS = os.getenv("ALLOWED_EXTENSIONS", "jpg,jpeg,png").split(",")


@router.post("/detect-tools", response_model=dict)
async def detect_tools_only(
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Detect tools in an image using AI without saving to database
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
        
        # Create temporary file for AI processing
        temp_file_id = str(uuid.uuid4())
        temp_filename = f"{temp_file_id}.{file_extension}"
        temp_file_path = os.path.join(UPLOAD_DIR, temp_filename)
        
        # Save to temporary file
        with open(temp_file_path, "wb") as buffer:
            buffer.write(contents)
        
        try:
            # Run AI inference using Google Cloud AI
            unified_detector = get_unified_detector()
            tags, confidences, metadata = unified_detector.detect_tools(temp_file_path)
            
            # Return only the detection results, no database save
            return {
                "tags": tags,
                "confidences": confidences,
                "metadata": metadata,
                "temp_file_id": temp_file_id,
                "temp_filename": temp_filename
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in tool detection: {e}")
        raise HTTPException(status_code=500, detail="Tool detection failed")


@router.post("/save-image", response_model=UploadResponse)
async def save_image_with_tags(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    tags: str = Form(...),  # JSON string of tags
    db: Session = Depends(get_db)
):
    """
    Save an image to database with user-confirmed tags
    """
    try:
        import json
        
        # Parse tags from JSON string
        try:
            tags_list = json.loads(tags)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid tags format")
        
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
        
        # Validate image can be opened (using temporary file)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            temp_file.write(contents)
            temp_file_path = temp_file.name
        
        try:
            # Validate image
            with PILImage.open(temp_file_path) as img:
                img.verify()
        except Exception:
            os.unlink(temp_file_path)
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Always save locally first for reliable serving
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        local_file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Copy from temp file to local storage
        shutil.copy2(temp_file_path, local_file_path)
        print(f"File saved locally: {local_file_path}")
        
        # Try OneDrive upload as backup/cloud storage
        onedrive_result = onedrive_service.upload_file(contents, filename)
        
        if onedrive_result.get("success"):
            print(f"OneDrive upload successful: {onedrive_result.get('file_url')}")
            # Create database record with both local and OneDrive info
            db_image = Image(
                filename=filename,
                original_filename=image.filename,
                tags=tags_list,
                confidences=[],  # No confidence scores for user-edited tags
                latitude=latitude,
                longitude=longitude,
                location=f'POINT({longitude} {latitude})',
                file_size=len(contents),
                mime_type=image.content_type,
                onedrive_file_id=onedrive_result.get("file_id"),
                onedrive_file_url=onedrive_result.get("file_url"),
                onedrive_download_url=onedrive_result.get("download_url")
            )
        else:
            print(f"OneDrive upload failed, using local storage only: {onedrive_result.get('error')}")
            # Create database record with local storage only
            db_image = Image(
                filename=filename,
                original_filename=image.filename,
                tags=tags_list,
                confidences=[],  # No confidence scores for user-edited tags
                latitude=latitude,
                longitude=longitude,
                location=f'POINT({longitude} {latitude})',
                file_size=len(contents),
                mime_type=image.content_type,
                onedrive_file_id=None,
                onedrive_file_url=None,
                onedrive_download_url=None
            )
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        response = UploadResponse(
            id=str(db_image.id),
            filename=db_image.filename,
            original_filename=db_image.original_filename,
            tags=db_image.tags,
            confidences=db_image.confidences,
            latitude=db_image.latitude,
            longitude=db_image.longitude,
            created_at=db_image.created_at,
            file_size=db_image.file_size,
            mime_type=db_image.mime_type,
            onedrive_file_id=db_image.onedrive_file_id,
            onedrive_file_url=db_image.onedrive_file_url,
            onedrive_download_url=db_image.onedrive_download_url
        )
        
        print(f"Image saved successfully - ID: {response.id}, Tags: {response.tags}, OneDrive URL: {response.onedrive_file_url}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving image: {e}")
        raise HTTPException(status_code=500, detail="Failed to save image")


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
        
        # Validate image can be opened (using temporary file)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            temp_file.write(contents)
            temp_file_path = temp_file.name
        
        try:
            # Validate image
            with PILImage.open(temp_file_path) as img:
                img.verify()
        except Exception:
            os.unlink(temp_file_path)
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Run AI inference using Google Cloud AI
        unified_detector = get_unified_detector()
        tags, confidences, metadata = unified_detector.detect_tools(temp_file_path)
        
        # Always save locally first for reliable serving
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        local_file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Copy from temp file to local storage
        shutil.copy2(temp_file_path, local_file_path)
        print(f"File saved locally: {local_file_path}")
        
        # Try OneDrive upload as backup/cloud storage
        onedrive_result = onedrive_service.upload_file(contents, filename)
        
        if onedrive_result.get("success"):
            print(f"OneDrive upload successful: {onedrive_result.get('file_url')}")
            # Create database record with both local and OneDrive info
            db_image = Image(
                filename=filename,
                original_filename=image.filename,
                tags=tags,
                confidences=confidences,
                latitude=latitude,
                longitude=longitude,
                location=f'POINT({longitude} {latitude})',
                file_size=len(contents),
                mime_type=image.content_type,
                onedrive_file_id=onedrive_result.get("file_id"),
                onedrive_file_url=onedrive_result.get("file_url"),
                onedrive_download_url=onedrive_result.get("download_url")
            )
        else:
            print(f"OneDrive upload failed, using local storage only: {onedrive_result.get('error')}")
            # Create database record with local storage only
            db_image = Image(
                filename=filename,
                original_filename=image.filename,
                tags=tags,
                confidences=confidences,
                latitude=latitude,
                longitude=longitude,
                location=f'POINT({longitude} {latitude})',
                file_size=len(contents),
                mime_type=image.content_type,
                onedrive_file_id=None,
                onedrive_file_url=None,
                onedrive_download_url=None
            )
        
        # Clean up temporary file
        os.unlink(temp_file_path)
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        response = UploadResponse(
            id=str(db_image.id),
            filename=db_image.filename,
            original_filename=db_image.original_filename,
            tags=db_image.tags,
            confidences=db_image.confidences,
            latitude=db_image.latitude,
            longitude=db_image.longitude,
            created_at=db_image.created_at,
            file_size=db_image.file_size,
            mime_type=db_image.mime_type,
            onedrive_file_id=db_image.onedrive_file_id,
            onedrive_file_url=db_image.onedrive_file_url,
            onedrive_download_url=db_image.onedrive_download_url
        )
        
        print(f"Upload successful - Image ID: {response.id}, Filename: {response.filename}, OneDrive URL: {response.onedrive_file_url}")
        return response
        
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
        # Validate query is not empty
        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty")
        
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
        print(f"Text search query: '{query}'")
        results = search_images(db, query, lat, lon, radius_m, limit)
        print(f"Text search found {len(results)} results")
        
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
                mime_type=image.mime_type,
                onedrive_file_id=image.onedrive_file_id,
                onedrive_file_url=image.onedrive_file_url,
                onedrive_download_url=image.onedrive_download_url
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
    Serve an image file by ID - prioritizes local files for reliability
    """
    try:
        print(f"Serving image request for ID: {image_id}")
        
        # Get image record from database
        db_image = get_image_by_id(db, image_id)
        if not db_image:
            print(f"Image not found in database: {image_id}")
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Always try local file first for reliability
        file_path = os.path.join(UPLOAD_DIR, db_image.filename)
        print(f"Checking local file: {file_path}")
        
        if os.path.exists(file_path):
            print(f"Serving local image file: {db_image.filename}")
            return FileResponse(
                path=file_path,
                media_type=db_image.mime_type or "image/jpeg",
                filename=db_image.original_filename or db_image.filename
            )
        
        # If local file doesn't exist, try SharePoint as fallback
        print(f"Local file not found, trying SharePoint fallback")
        
        # Try SharePoint download URL first
        if db_image.onedrive_download_url:
            print(f"Redirecting to SharePoint download URL: {db_image.onedrive_download_url}")
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=db_image.onedrive_download_url)
        
        # Try SharePoint web URL with proxy
        elif db_image.onedrive_file_url:
            print(f"Proxying SharePoint content from: {db_image.onedrive_file_url}")
            try:
                import requests
                headers = {
                    'Authorization': f'Bearer {onedrive_service.access_token}'
                }
                response = requests.get(db_image.onedrive_file_url, headers=headers)
                if response.status_code == 200:
                    from fastapi.responses import Response
                    return Response(
                        content=response.content,
                        media_type=db_image.mime_type or "image/jpeg"
                    )
                else:
                    print(f"Failed to fetch SharePoint content: {response.status_code}")
            except Exception as e:
                print(f"Error fetching SharePoint content: {e}")
        
        # If all else fails
        print(f"No image file found for: {image_id}")
        raise HTTPException(status_code=404, detail="Image file not found")
        
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
            mime_type=db_image.mime_type,
            onedrive_file_id=db_image.onedrive_file_id,
            onedrive_file_url=db_image.onedrive_file_url,
            onedrive_download_url=db_image.onedrive_download_url
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
        unified_detector = get_unified_detector()
        available_models = unified_detector.get_available_models()
        models_loaded = any(available_models.values())
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
        unified_detector = get_unified_detector()
        return unified_detector.get_model_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


@router.get("/models/available")
async def get_available_models():
    """
    Get information about available AI models
    """
    try:
        unified_detector = get_unified_detector()
        return unified_detector.get_available_models()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available models: {str(e)}")


@router.post("/search-by-image", response_model=SearchResultsResponse)
async def search_by_image(
    image: UploadFile = File(...),
    lat: Optional[float] = Query(None, description="Latitude for location-based search"),
    lon: Optional[float] = Query(None, description="Longitude for location-based search"),
    radius_m: float = Query(10000, description="Search radius in meters"),
    limit: int = Query(50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Search for similar tool images using an uploaded image
    """
    try:
        # Validate file
        if not image.filename:
            raise HTTPException(status_code=400, detail="No image provided")
        
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
        
        # Create temporary file for processing
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            temp_file.write(contents)
            temp_file_path = temp_file.name
        
        try:
            # Analyze the uploaded image to get tags
            unified_detector = get_unified_detector()
            search_tags, _, _ = unified_detector.detect_tools(temp_file_path)
            
            if not search_tags:
                raise HTTPException(status_code=400, detail="No tools detected in the uploaded image")
            
            # Search for images with similar tags using database query
            from app.database.queries import search_images_by_tags
            results = search_images_by_tags(db, search_tags, lat, lon, radius_m, limit)
            
            # Database already filtered the results, so use them directly
            print(f"Search tags: {search_tags}")
            print(f"Database returned {len(results)} matching images")
            
            # Debug: Show what was found
            if results:
                print("Matching images found:")
                for i, img in enumerate(results[:5]):  # Show first 5 images
                    print(f"  Image {i+1}: ID={img.id}, Tags={img.tags}")
            else:
                print("No matching images found in database")
            
            # Use the database results directly (they're already filtered)
            similar_images = results[:limit]
            
            # Convert to response format
            search_results = []
            for image in similar_images:
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
                    mime_type=image.mime_type,
                    onedrive_file_id=image.onedrive_file_id,
                    onedrive_file_url=image.onedrive_file_url,
                    onedrive_download_url=image.onedrive_download_url
                ))
            
            location_info = None
            if lat is not None and lon is not None:
                location_info = {"lat": lat, "lon": lon}
            
            return SearchResultsResponse(
                results=search_results,
                total=len(search_results),
                query=f"Image search with tags: {', '.join(search_tags)}",
                location=location_info,
                radius_m=radius_m if lat is not None else None
            )
            
        finally:
            # Clean up temporary file
            import os
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image search failed: {str(e)}")
