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
    filters = []
    
    # Text search in tags
    if query:
        # Search for query in any tag (case-insensitive)
        tag_filter = func.array_to_string(Image.tags, ' ').ilike(f'%{query}%')
        filters.append(tag_filter)
    
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
    
    return db_query.limit(limit).all()


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
