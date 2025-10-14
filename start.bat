@echo off
REM Tool Detection App Startup Script for Windows

echo 🔧 Starting Tool Detection ^& Geotag Search Application
echo ==================================================

REM Check if .env file exists
if not exist .env (
    echo ❌ Error: .env file not found
    echo Please copy env.example to .env and configure your settings:
    echo copy env.example .env
    pause
    exit /b 1
)

REM Check if virtual environment exists
if not exist "backend\venv" (
    echo 📦 Creating Python virtual environment...
    cd backend
    python -m venv venv
    cd ..
)

REM Activate virtual environment and install dependencies
echo 📦 Installing Python dependencies...
cd backend
call venv\Scripts\activate
pip install -r requirements.txt

REM Initialize database
echo 🗄️  Initializing database...
python init_db.py

REM Start backend server in background
echo 🚀 Starting backend server...
start /b python main.py
cd ..

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
npm install

REM Start frontend server
echo 🚀 Starting frontend server...
start /b npm start
cd ..

echo.
echo 🎉 Application started successfully!
echo ==================================================
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press any key to stop servers...

pause > nul

echo 🛑 Stopping servers...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo ✅ Servers stopped
