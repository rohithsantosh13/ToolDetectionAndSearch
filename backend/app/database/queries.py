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
    Search images by tag and/or location with location-based prioritization
    
    Args:
        db: Database session
        query: Text query to search in tags
        lat: Latitude for location-based search
        lon: Longitude for location-based search
        radius_m: Search radius in meters
        limit: Maximum number of results
    
    Returns:
        List of matching Image objects, prioritized by location proximity
    """
    try:
        # Simple text search without complex geospatial queries
        db_query = db.query(Image)
        
        # Text search in tags
        if query:
            query_lower = query.lower().strip()
            # Simple text search in tags
            db_query = db_query.filter(
                func.array_to_string(Image.tags, ' ').ilike(f'%{query_lower}%')
            )
        
        # Simple location filtering if coordinates provided
        if lat is not None and lon is not None:
            # Simple lat/lon range filtering (rough approximation)
            lat_range = radius_m / 111000  # Rough conversion: 1 degree ≈ 111km
            lon_range = radius_m / (111000 * 0.7)  # Approximate for longitude
            
            db_query = db_query.filter(
                and_(
                    Image.latitude.between(lat - lat_range, lat + lat_range),
                    Image.longitude.between(lon - lon_range, lon + lon_range)
                )
            )
        
        # Order by creation date (newest first)
        db_query = db_query.order_by(Image.created_at.desc())
        
        # Return results directly from database - no file existence check
        return db_query.limit(limit).all()
        
    except Exception as e:
        print(f"Search failed: {e}")
        return []


def simple_search_images(db: Session, query: Optional[str] = None, limit: int = 50) -> List[Image]:
    """
    Simple search function without complex geospatial queries
    Fallback for when the main search function fails
    """
    try:
        db_query = db.query(Image)
        
        if query:
            query_lower = query.lower().strip()
            db_query = db_query.filter(
                func.array_to_string(Image.tags, ' ').ilike(f'%{query_lower}%')
            )
        
        db_query = db_query.order_by(Image.created_at.desc())
        
        # Return results directly from database - no file existence check
        return db_query.limit(limit).all()
        
    except Exception as e:
        print(f"Simple search failed: {e}")
        return []


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
    
    # Location-based search (simplified)
    if lat is not None and lon is not None:
        # Simple lat/lon range filtering (rough approximation)
        lat_range = radius_m / 111000  # Rough conversion: 1 degree ≈ 111km
        lon_range = radius_m / (111000 * 0.7)  # Approximate for longitude
        
        location_filter = and_(
            Image.latitude.between(lat - lat_range, lat + lat_range),
            Image.longitude.between(lon - lon_range, lon + lon_range)
        )
        filters.append(location_filter)
    
    # Build query
    db_query = db.query(Image)
    
    if filters:
        db_query = db_query.filter(and_(*filters))
    
    # Order by creation date (most recent first)
    db_query = db_query.order_by(Image.created_at.desc())
    
    # Get results directly from database - no file existence check needed
    results = db_query.limit(limit).all()
    
    print(f"Database query returned {len(results)} results")
    return results
