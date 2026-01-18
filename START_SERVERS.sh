#!/bin/bash

echo "===================================="
echo "ReachInbox Email Scheduler"
echo "===================================="
echo ""

echo "Step 1: Starting Docker services..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start Docker services"
    exit 1
fi
echo "Docker services started successfully!"
echo ""

sleep 5

echo "Step 2: Starting Backend Server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

sleep 3

echo "Step 3: Starting Frontend Server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "===================================="
echo "Services Starting..."
echo "===================================="
echo "Backend will run on: http://localhost:3001"
echo "Frontend will run on: http://localhost:3000"
echo ""
echo "Process IDs:"
echo "- Backend: $BACKEND_PID"
echo "- Frontend: $FRONTEND_PID"
echo ""
echo "Wait for both to fully start, then open:"
echo "http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; docker-compose down; exit" INT TERM
wait

