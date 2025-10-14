"""
Database models for the Tool Detection application
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ARRAY, Text
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography
from app.database.connection import Base


class Image(Base):
    """Model for storing image metadata and geolocation data"""
    
    __tablename__ = "images"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Image file information
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=True)
    
    # AI-generated tags and confidences
    tags = Column(ARRAY(String), nullable=False, default=[])
    confidences = Column(ARRAY(Float), nullable=False, default=[])
    
    # Location data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # PostGIS geography column for spatial queries
    location = Column(Geography(geometry_type='POINT', srid=4326), nullable=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Optional: File size and MIME type
    file_size = Column(Float, nullable=True)
    mime_type = Column(String(100), nullable=True)
    
    def __repr__(self):
        return f"<Image(id={self.id}, filename='{self.filename}', tags={self.tags})>"
    
    def to_dict(self):
        """Convert model to dictionary for JSON serialization"""
        return {
            "id": str(self.id),
            "filename": self.filename,
            "original_filename": self.original_filename,
            "tags": self.tags,
            "confidences": self.confidences,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "file_size": self.file_size,
            "mime_type": self.mime_type
        }
