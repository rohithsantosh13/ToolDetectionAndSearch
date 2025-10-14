"""
Database connection and session management
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from geoalchemy2 import Geography

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://username:password@localhost:5432/tool_detection")

# Create engine with PostGIS support
engine = create_engine(DATABASE_URL, echo=False)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    # Import all models here to ensure they are registered with Base
    from app.database.models import Image
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Enable PostGIS extension if not already enabled
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        conn.commit()
