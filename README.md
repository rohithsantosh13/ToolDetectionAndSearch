# 🔧 Tool Detection & Geotag Search Application

A mobile-first Progressive Web App that automatically detects and tags work tools from images using AI, stores them with GPS coordinates, and enables search by tag and location using only open-source technologies.

## ✨ Features

- **📸 Image Capture**: Take photos or upload existing images of work tools
- **🤖 AI Tool Detection**: Automatic tool identification using YOLOv8 and CLIP models
- **📍 GPS Tagging**: Automatic location capture with manual fallback
- **🔍 Smart Search**: Search by tool name, location, or both
- **🗺️ Interactive Maps**: Visualize tool locations with Leaflet maps
- **📱 Mobile-First**: Optimized Progressive Web App experience
- **🔒 Privacy-First**: All data stored locally or on self-hosted servers
- **🆓 Open Source**: 100% free and open-source components

## 🏗️ Architecture

```
Frontend (React PWA)          Backend (FastAPI)
├── Camera Capture            ├── Image Upload API
├── GPS Detection             ├── AI Inference (YOLOv8 + CLIP)
├── Search Interface          ├── Database (PostgreSQL + PostGIS)
└── Map Visualization         └── File Storage (Local FS)
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **PostgreSQL 14+** with PostGIS extension
- **Git**

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ToolDetectionAndSearch
```

### 2. Set Up the Database

#### Install PostgreSQL and PostGIS

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis postgresql-14-postgis-3
```

**macOS (with Homebrew):**
```bash
brew install postgresql postgis
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE tool_detection;
CREATE USER tool_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE tool_detection TO tool_user;

# Connect to the database and enable PostGIS
\c tool_detection
CREATE EXTENSION postgis;

# Exit PostgreSQL
\q
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp env.example .env

# Edit the configuration
nano .env
```

Update the `.env` file with your database credentials:

```env
DATABASE_URL=postgresql://tool_user:your_password@localhost:5432/tool_detection
POSTGRES_DB=tool_detection
POSTGRES_USER=tool_user
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

### 4. Set Up Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the backend server
python main.py
```

The backend will be available at `http://localhost:8000`

### 5. Set Up Frontend

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will be available at `http://localhost:3000`

## 📖 Usage Guide

### Capturing Tool Images

1. **Open the App**: Navigate to `http://localhost:3000`
2. **Allow Location Access**: Grant permission for GPS location when prompted
3. **Take a Photo**: Click "Take Photo" to open your device's camera
4. **Upload Alternative**: Or click "Upload Image" to select an existing file
5. **Review & Upload**: Preview your image and click "Upload & Detect Tools"
6. **View Results**: See the AI-detected tools with confidence scores

### Searching Tool Images

1. **Navigate to Search**: Click the "Search" tab in the navigation
2. **Enter Search Terms**: Type tool names like "hammer", "drill", "wrench"
3. **Set Location Filter**: Enable location-based search and adjust radius
4. **View Results**: See matching images with their locations on the map
5. **Explore Map**: Click markers to see image details and tool tags

## 🔧 API Documentation

### Endpoints

#### Upload Image
```http
POST /api/upload
Content-Type: multipart/form-data

Form Data:
- image: Image file (JPEG/PNG)
- latitude: GPS latitude (float)
- longitude: GPS longitude (float)
```

**Response:**
```json
{
  "id": "uuid",
  "filename": "generated_filename.jpg",
  "tags": ["hammer", "tool"],
  "confidences": [0.95, 0.87],
  "latitude": 40.7128,
  "longitude": -74.0060,
  "created_at": "2024-01-01T12:00:00Z"
}
```

#### Search Images
```http
GET /api/search?query=hammer&lat=40.7128&lon=-74.0060&radius_m=1000&limit=50
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "filename": "image.jpg",
      "tags": ["hammer"],
      "confidences": [0.95],
      "latitude": 40.7128,
      "longitude": -74.0060,
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 1,
  "query": "hammer",
  "location": {"lat": 40.7128, "lon": -74.0060},
  "radius_m": 1000
}
```

#### Get Image File
```http
GET /images/{image_id}
```

#### Health Check
```http
GET /api/health
```

### Interactive API Documentation

Visit `http://localhost:8000/docs` for interactive API documentation powered by FastAPI's automatic OpenAPI generation.

## 🤖 AI Models

### YOLOv8 (Primary Detection)
- **Model**: `yolov8n.pt` (nano version for speed)
- **Purpose**: Object detection with bounding boxes
- **Accuracy**: ~85-90% for common tools
- **Speed**: < 2 seconds on typical hardware

### CLIP (Zero-Shot Fallback)
- **Model**: `openai/clip-vit-base-patch32`
- **Purpose**: Zero-shot classification for unseen tools
- **Use Case**: When YOLOv8 confidence < 0.5
- **Flexibility**: Recognizes new tool categories without retraining

### Supported Tool Classes
- hammer, drill, wrench, screwdriver, pliers
- saw, measuring tape, level, chisel, clamp
- screw, nail, bolt, nut, cable, wire
- pipe, tube, connector, adapter, socket
- ratchet, torque wrench, multimeter, flashlight
- knife, scissors, tape measure, ruler, protractor

## 🗄️ Database Schema

```sql
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    tags TEXT[] NOT NULL DEFAULT '{}',
    confidences FLOAT[] NOT NULL DEFAULT '{}',
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    file_size FLOAT,
    mime_type VARCHAR(100)
);

CREATE INDEX idx_images_location ON images USING GIST (location);
CREATE INDEX idx_images_tags ON images USING GIN (tags);
CREATE INDEX idx_images_created_at ON images (created_at);
```

## 🛠️ Development

### Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes and schemas
│   │   ├── database/     # Database models and queries
│   │   └── services/     # ML inference service
│   ├── uploads/          # Image storage directory
│   ├── requirements.txt  # Python dependencies
│   └── main.py          # FastAPI app entry point
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API client
│   │   └── hooks/        # Custom React hooks
│   ├── public/          # Static assets
│   └── package.json     # Node dependencies
└── README.md
```

### Adding New Tool Classes

1. **Update CLIP Classes**: Modify `tool_classes` in `backend/app/services/inference.py`
2. **Retrain YOLOv8** (optional): For better detection of specific tools
3. **Test**: Upload sample images to verify detection accuracy

### Performance Optimization

- **Image Compression**: Images are automatically optimized during upload
- **Database Indexing**: Spatial and text indexes for fast queries
- **Model Caching**: AI models are loaded once and reused
- **CDN Ready**: Static image serving supports CDN integration

## 🔒 Security Considerations

- **File Validation**: Strict image format and size validation
- **SQL Injection**: Parameterized queries prevent SQL injection
- **CORS**: Configured for specific origins only
- **Input Sanitization**: All user inputs are validated and sanitized
- **File Storage**: Secure file naming with UUIDs

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify PostGIS extension
psql -d tool_detection -c "SELECT PostGIS_version();"
```

**Model Loading Error:**
```bash
# Check PyTorch installation
python -c "import torch; print(torch.__version__)"

# Verify model downloads
ls ~/.cache/torch/hub/
```

**Frontend Build Error:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Performance Issues

- **Slow Inference**: Reduce image size or use GPU acceleration
- **Memory Usage**: Monitor model memory consumption
- **Database Queries**: Check query performance with `EXPLAIN ANALYZE`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ultralytics](https://github.com/ultralytics/ultralytics) for YOLOv8
- [OpenAI](https://github.com/openai/CLIP) for CLIP model
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend framework
- [Leaflet](https://leafletjs.com/) for map visualization
- [PostGIS](https://postgis.net/) for geospatial database support

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

**Made with ❤️ using open-source technologies**
