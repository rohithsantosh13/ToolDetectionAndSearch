#!/bin/bash

# Tool Detection App Startup Script

echo "🔧 Starting Tool Detection & Geotag Search Application"
echo "=================================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy env.example to .env and configure your settings:"
    echo "cp env.example .env"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd backend
    python -m venv venv
    cd ..
fi

# Activate virtual environment and install dependencies
echo "📦 Installing Python dependencies..."
cd backend
source venv/bin/activate 2>/dev/null || venv\Scripts\activate 2>/dev/null
pip install -r requirements.txt

# Initialize database
echo "🗄️  Initializing database..."
python init_db.py

# Start backend server in background
echo "🚀 Starting backend server..."
python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

# Start frontend server
echo "🚀 Starting frontend server..."
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 Application started successfully!"
echo "=================================================="
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for processes
wait
