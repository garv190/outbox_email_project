@echo off
echo ====================================
echo ReachInbox Email Scheduler
echo ====================================
echo.

echo Step 1: Starting Docker services...
docker-compose up -d
if errorlevel 1 (
    echo ERROR: Failed to start Docker services
    pause
    exit /b 1
)
echo Docker services started successfully!
echo.

timeout /t 5 /nobreak > nul

echo Step 2: Starting Backend Server...
echo Please keep this window open!
echo.
cd backend
start "Backend Server" cmd /k "npm run dev"
cd ..

timeout /t 3 /nobreak > nul

echo Step 3: Starting Frontend Server...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..

echo.
echo ====================================
echo Services Starting...
echo ====================================
echo Backend will run on: http://localhost:3001
echo Frontend will run on: http://localhost:3000
echo.
echo Two new windows will open:
echo - Backend Server (keep this running)
echo - Frontend Server (keep this running)
echo.
echo Wait for both to fully start, then open:
echo http://localhost:3000
echo.
pause

