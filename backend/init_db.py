#!/usr/bin/env python3
"""
Database initialization script for Tool Detection Application
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Fix Windows Unicode encoding issues
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

# Load environment variables
load_dotenv()

def init_database():
    """Initialize the database with PostGIS extension"""
    
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ Error: DATABASE_URL not found in environment variables")
        print("Please set DATABASE_URL in your .env file")
        sys.exit(1)
    
    try:
        # Create engine
        engine = create_engine(database_url)
        
        # Test connection
        with engine.connect() as conn:
            print("✅ Connected to database successfully")
            
            # Enable PostGIS extension
            print("🔧 Enabling PostGIS extension...")
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            conn.commit()
            print("✅ PostGIS extension enabled")
            
            # Check PostGIS version
            result = conn.execute(text("SELECT PostGIS_version();"))
            version = result.scalar()
            print(f"📍 PostGIS version: {version}")
            
            # Create tables
            print("📊 Creating database tables...")
            from app.database.models import Base
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables created successfully")
            
            # Verify tables exist
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'images';
            """))
            
            if result.fetchone():
                print("✅ Images table verified")
            else:
                print("❌ Images table not found")
                sys.exit(1)
                
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        sys.exit(1)

def check_dependencies():
    """Check if required dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    try:
        import psycopg2
        print("✅ psycopg2 installed")
    except ImportError:
        print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)
    
    try:
        import geoalchemy2
        print("✅ geoalchemy2 installed")
    except ImportError:
        print("❌ geoalchemy2 not installed. Run: pip install geoalchemy2")
        sys.exit(1)
    
    try:
        import sqlalchemy
        print("✅ sqlalchemy installed")
    except ImportError:
        print("❌ sqlalchemy not installed. Run: pip install sqlalchemy")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Initializing Tool Detection Database...")
    print("=" * 50)
    
    check_dependencies()
    init_database()
    
    print("=" * 50)
    print("🎉 Database initialization completed successfully!")
    print("\nNext steps:")
    print("1. Start the backend server: python main.py")
    print("2. Start the frontend: cd ../frontend && npm start")
    print("3. Open http://localhost:3000 in your browser")
