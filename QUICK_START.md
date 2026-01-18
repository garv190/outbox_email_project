# Quick Start Guide - ReachInbox Email Scheduler

## ⚠️ Important: Start Backend Server First!

The `ERR_CONNECTION_REFUSED` error means your **backend server is not running**. Follow these steps:

## 🚀 Step-by-Step Startup

### 1. **Start Docker Services (MySQL & Redis)**
```bash
docker-compose up -d
```

Verify they're running:
```bash
docker ps
```
You should see `reachinbox-mysql` and `reachinbox-redis` containers.

### 2. **Run Database Migration (One Time)**
```bash
cd backend
npm run db:migrate
```

This creates the database tables. You only need to run this once (or after schema changes).

### 3. **Start Backend Server** ⚠️ **REQUIRED**
```bash
cd backend
npm run dev
```

**IMPORTANT:** You must see these messages in the console:
- ✅ `MySQL connected successfully`
- ✅ `Email service initialized successfully`
- ✅ `Worker started with concurrency: 5`
- ✅ `Server running on port 3001`

**Keep this terminal window open!** The backend must stay running.

### 4. **Start Frontend (In a NEW Terminal)**
```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

### 5. **Verify Backend is Running**
Open in browser or run:
```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## 🔍 Troubleshooting

### Backend Won't Start?

**Check Environment Variables:**
```bash
# In backend folder, create .env file if it doesn't exist
# Make sure it has:
PORT=3001
DB_HOST=localhost
DB_PORT=3307
DB_USER=user
DB_PASSWORD=password
DB_NAME=reachinbox_email
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Check Port 3001 is Available:**
- Windows: `netstat -ano | findstr :3001`
- If port is in use, change `PORT=3001` in `.env`

**Check MySQL is Running:**
```bash
docker ps | grep mysql
# Should show reachinbox-mysql container
```

**Check Redis is Running:**
```bash
docker ps | grep redis
# Should show reachinbox-redis container
```

### Still Getting ERR_CONNECTION_REFUSED?

1. **Verify backend is actually running:**
   - Check the terminal where you ran `npm run dev`
   - Look for error messages
   - Make sure it says "Server running on port 3001"

2. **Check backend URL in frontend:**
   - Verify `frontend/.env.local` has: `NEXT_PUBLIC_API_URL=http://localhost:3001`
   - Restart frontend after changing `.env.local`

3. **Try accessing backend directly:**
   - Open browser: `http://localhost:3001/health`
   - Should show: `{"status":"ok"...}`

## 📋 Complete Startup Checklist

- [ ] Docker containers running (`docker ps`)
- [ ] Database migrated (`npm run db:migrate` in backend)
- [ ] Backend server running (`npm run dev` in backend)
- [ ] Backend shows "Server running on port 3001"
- [ ] Frontend server running (`npm run dev` in frontend)
- [ ] Frontend shows "Ready on http://localhost:3000"
- [ ] Health check works (`http://localhost:3001/health`)

## 🎯 Expected Console Output

**Backend Terminal Should Show:**
```
MySQL connected successfully
Ethereal Email Test Account Created:
User: xxx
Pass: xxx
Email service initialized successfully
Worker started with concurrency: 5
Server running on port 3001
Environment: development
```

**Frontend Terminal Should Show:**
```
▲ Next.js 14.0.4
- Local:        http://localhost:3000
```

## 💡 Common Mistakes

1. **Forgetting to start backend** - Most common issue!
2. **Wrong port** - Backend on 3001, Frontend on 3000
3. **Docker not running** - MySQL/Redis won't work without Docker
4. **Port already in use** - Another app using port 3001

## 🆘 Still Having Issues?

1. Check all terminal windows - backend must be running
2. Check Docker: `docker ps` - MySQL and Redis must be running
3. Check backend logs - look for error messages
4. Verify `.env` files exist in both `backend/` and `frontend/` folders

