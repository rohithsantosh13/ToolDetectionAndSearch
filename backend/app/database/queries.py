"""
Database query functions for geospatial and text search
"""

from typing import List, Optional, Tuple
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session
from app.database.models import Image


def search_images(
    db: Session,
    query: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius_m: float = 10000,  # 10km default
    limit: int = 50
) -> List[Image]:
    """
    Search images by tag and/or location
    
    Args:
        db: Database session
        query: Text query to search in tags
        lat: Latitude for location-based search
        lon: Longitude for location-based search
        radius_m: Search radius in meters
        limit: Maximum number of results
    
    Returns:
        List of matching Image objects
    """
    import os
    
    filters = []
    
    # Text search in tags
    if query:
        # Enhanced text search with multiple strategies
        query_lower = query.lower().strip()
        
        # Create all possible search terms (original query + individual words)
        search_terms = [query_lower]
        query_words = [word.strip() for word in query_lower.split() if len(word.strip()) > 1]
        search_terms.extend(query_words)
        
        # Create OR filters for all search terms
        from sqlalchemy import or_
        search_filters = []
        
        for term in search_terms:
            # Direct substring match in concatenated tags
            search_filters.append(func.array_to_string(Image.tags, ' ').ilike(f'%{term}%'))
            
            # Also search in individual tags
            search_filters.append(func.array_to_string(Image.tags, ',').ilike(f'%{term}%'))
        
        # Use OR logic for all search strategies
        filters.append(or_(*search_filters))
    
    # Location-based search
    if lat is not None and lon is not None:
        point = f'POINT({lon} {lat})'
        location_filter = func.ST_DWithin(
            Image.location,
            func.ST_GeogFromText(point),
            radius_m
        )
        filters.append(location_filter)
    
    # Build query
    db_query = db.query(Image)
    
    if filters:
        db_query = db_query.filter(and_(*filters))
    
    # Order by distance if location is provided
    if lat is not None and lon is not None:
        point = f'POINT({lon} {lat})'
        db_query = db_query.order_by(
            func.ST_Distance(Image.location, func.ST_GeogFromText(point))
        )
    else:
        # Order by creation date (newest first)
        db_query = db_query.order_by(Image.created_at.desc())
    
    # Get all results first
    all_results = db_query.all()
    
    # Filter out records for missing files
    valid_results = []
    for image in all_results:
        file_path = os.path.join(os.getenv("UPLOAD_DIR", "./uploads"), image.filename)
        if os.path.exists(file_path):
            valid_results.append(image)
            if len(valid_results) >= limit:
                break
    
    return valid_results


def get_image_by_id(db: Session, image_id: str) -> Optional[Image]:
    """Get a single image by ID"""
    return db.query(Image).filter(Image.id == image_id).first()


def get_images_by_tags(db: Session, tags: List[str], limit: int = 50) -> List[Image]:
    """Get images that contain any of the specified tags"""
    tag_filters = []
    for tag in tags:
        tag_filter = func.array_to_string(Image.tags, ' ').ilike(f'%{tag}%')
        tag_filters.append(tag_filter)
    
    if tag_filters:
        return db.query(Image).filter(or_(*tag_filters)).limit(limit).all()
    else:
        return []


def get_recent_images(db: Session, limit: int = 20) -> List[Image]:
    """Get most recently uploaded images"""
    return db.query(Image).order_by(Image.created_at.desc()).limit(limit).all()


def get_images_within_bounds(
    db: Session,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    limit: int = 100
) -> List[Image]:
    """Get images within geographic bounds"""
    bounds_filter = and_(
        Image.latitude >= min_lat,
        Image.latitude <= max_lat,
        Image.longitude >= min_lon,
        Image.longitude <= max_lon
    )
    
    return db.query(Image).filter(bounds_filter).limit(limit).all()


def search_images_by_tags(db: Session, search_tags: List[str], lat: Optional[float] = None, 
                          lon: Optional[float] = None, radius_m: float = 10000, limit: int = 50) -> List[Image]:
    """
    Search images by AI-generated tags with ultra-permissive matching
    """
    import os
    
    filters = []
    
    # Create all possible search terms from AI tags
    all_search_terms = set()
    
    # Add original tags
    all_search_terms.update(search_tags)
    
    # Add individual words from each tag
    for tag in search_tags:
        clean_tag = tag.lower().replace('-', ' ').replace('_', ' ').replace(',', ' ')
        words = [w.strip() for w in clean_tag.split() if len(w.strip()) > 1]
        all_search_terms.update(words)
    
    print(f"Database search terms: {all_search_terms}")
    
    # Create OR filters for all search terms
    search_filters = []
    
    for term in all_search_terms:
        term_lower = term.lower()
        
        # Search in concatenated tags (space-separated)
        search_filters.append(func.array_to_string(Image.tags, ' ').ilike(f'%{term_lower}%'))
        
        # Search in concatenated tags (comma-separated)
        search_filters.append(func.array_to_string(Image.tags, ',').ilike(f'%{term_lower}%'))
    
    if search_filters:
        filters.append(or_(*search_filters))
    
    # Location-based search
    if lat is not None and lon is not None:
        point = f'POINT({lon} {lat})'
        location_filter = func.ST_DWithin(
            Image.location,
            func.ST_GeogFromText(point),
            radius_m
        )
        filters.append(location_filter)
    
    # Build query
    db_query = db.query(Image)
    
    if filters:
        db_query = db_query.filter(and_(*filters))
    
    # Order by creation date (most recent first)
    db_query = db_query.order_by(Image.created_at.desc())
    
    # Get all results first
    all_results = db_query.all()
    
    # Filter out records for missing files
    valid_results = []
    for image in all_results:
        file_path = os.path.join(os.getenv("UPLOAD_DIR", "./uploads"), image.filename)
        if os.path.exists(file_path):
            valid_results.append(image)
            if len(valid_results) >= limit:
                break
    
    print(f"Database query returned {len(valid_results)} results")
    return valid_results
