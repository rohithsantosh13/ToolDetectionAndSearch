"""
Pydantic schemas for API request/response models
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class UploadResponse(BaseModel):
    """Response schema for image upload"""
    id: str
    filename: str
    original_filename: Optional[str] = None
    tags: List[str]
    confidences: List[float]
    latitude: float
    longitude: float
    created_at: datetime
    file_size: Optional[float] = None
    mime_type: Optional[str] = None


class SearchRequest(BaseModel):
    """Request schema for image search"""
    query: Optional[str] = Field(None, description="Text query to search in tags")
    lat: Optional[float] = Field(None, description="Latitude for location-based search")
    lon: Optional[float] = Field(None, description="Longitude for location-based search")
    radius_m: float = Field(10000, description="Search radius in meters")
    limit: int = Field(50, description="Maximum number of results")


class SearchResponse(BaseModel):
    """Response schema for image search"""
    id: str
    filename: str
    original_filename: Optional[str] = None
    tags: List[str]
    confidences: List[float]
    latitude: float
    longitude: float
    created_at: datetime
    file_size: Optional[float] = None
    mime_type: Optional[str] = None


class SearchResultsResponse(BaseModel):
    """Response schema for search results"""
    results: List[SearchResponse]
    total: int
    query: Optional[str] = None
    location: Optional[dict] = None
    radius_m: Optional[float] = None


class ErrorResponse(BaseModel):
    """Error response schema"""
    error: str
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response schema"""
    status: str
    models_loaded: bool
    database_connected: bool
    timestamp: datetime
