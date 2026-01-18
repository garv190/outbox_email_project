# Testing Guide - ReachInbox Email Scheduler

This guide ensures your submission works correctly for company evaluation.

## ✅ Pre-Submission Checklist

### 1. **Start All Services**
```bash
# Terminal 1: Start Docker services
docker-compose up -d

# Terminal 2: Start backend
cd backend
npm install
npm run db:migrate  # Run this once
npm run dev

# Terminal 3: Start frontend
cd frontend
npm install
npm run dev
```

### 2. **Verify Services Are Running**

**Backend Health Check:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Check Worker Status:**
```bash
curl http://localhost:3001/api/status
# Should show queue stats and database status
```

**Verify in Backend Console:**
- Look for: "MySQL connected successfully"
- Look for: "Email service initialized successfully"
- Look for: "Worker started with concurrency: 5"
- Look for Ethereal credentials (save these!)

### 3. **Test Email Sending Flow**

#### **Test Case 1: Schedule Immediate Email**
1. Login with Google OAuth
2. Click "Compose New Email"
3. Fill in:
   - Subject: "Test Email"
   - Body: "This is a test email"
   - Upload CSV with your test email: `test@example.com`
   - Start Time: Set to 1-2 minutes in the future (to test delay)
   - Delay: 2000ms (2 seconds)
   - Hourly Limit: 10
4. Click "Schedule"
5. **Verify:**
   - Modal closes successfully
   - Check "Scheduled Emails" tab - should show the email
   - Wait for start time
   - Check backend console - should show "Processing dispatch..."
   - Check "Sent Emails" tab - email should appear with status "SENT"

#### **Test Case 2: View Sent Email**
1. Go to "Sent Emails" tab
2. Should see email with:
   - Status: "SENT"
   - Sent Time: timestamp
   - Email address

#### **Test Case 3: Ethereal Email Preview**
1. Note the Ethereal credentials from backend console startup
2. Visit: https://ethereal.email
3. Login with the credentials
4. You should see the sent email in the inbox

### 4. **Edge Case Testing**

#### **Test Past Date**
- Try scheduling with start time in the past
- Should show error: "Start time cannot be in the past"

#### **Test Duplicate Emails**
- Upload CSV with duplicate emails
- System should deduplicate automatically

#### **Test Empty Email List**
- Try submitting without uploading a file
- Should show validation error

#### **Test Rate Limiting**
- Schedule many emails (e.g., 100+) with same start time
- System should rate-limit and reschedule automatically
- Check "Scheduled Emails" - some may show "RATE_LIMITED" status

#### **Test Server Restart (Persistence)**
1. Schedule emails for future time (e.g., 10 minutes)
2. Stop backend server (Ctrl+C)
3. Start backend again
4. Emails should still send at the correct time
5. No duplicate sends should occur

### 5. **Common Issues & Solutions**

#### **Emails Not Sending**
- **Check:** Worker is started (console shows "Worker started")
- **Check:** Redis is running (`docker ps` should show redis container)
- **Check:** Backend console shows "Processing dispatch..." messages
- **Check:** Queue has jobs: `curl http://localhost:3001/api/status`

#### **Text Color Issue**
- **Fixed:** All input fields now have `text-gray-900` class
- If still invisible, clear browser cache

#### **Database Connection Issues**
- **Check:** MySQL container is running (`docker ps`)
- **Check:** Port is correct (3307 for Docker)
- **Check:** Database exists: `docker exec -it reachinbox-mysql mysql -u user -ppassword -e "SHOW DATABASES;"`

#### **Google OAuth Not Working**
- **Check:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set in `frontend/.env.local`
- **Check:** Google OAuth credentials are valid
- **Check:** Redirect URI in Google Console matches `http://localhost:3000`

### 6. **Production Readiness Checklist**

- ✅ All text is visible (compose modal fixed)
- ✅ Email validation works
- ✅ Duplicate emails are handled
- ✅ Past dates are rejected
- ✅ Worker processes jobs correctly
- ✅ Database persistence works
- ✅ Rate limiting functions
- ✅ Error handling is in place
- ✅ Queue stats endpoint available
- ✅ Health check endpoint works

### 7. **Demo Video Checklist**

When recording your demo, show:

1. **Login** - Google OAuth working
2. **Compose Email** - Fill form, upload CSV, schedule
3. **Scheduled Emails Tab** - Show scheduled emails
4. **Wait for Processing** - Show emails being processed (backend console)
5. **Sent Emails Tab** - Show sent emails with status
6. **Restart Test** - Stop server, start again, emails still send
7. **Ethereal Email** - Show email preview in Ethereal inbox

### 8. **API Endpoints for Testing**

```bash
# Health check
GET http://localhost:3001/health

# System status
GET http://localhost:3001/api/status

# Create campaign (example)
POST http://localhost:3001/api/campaigns
Content-Type: application/json

{
  "userId": "your-user-id",
  "subject": "Test",
  "body": "Test body",
  "recipientEmails": ["test@example.com"],
  "startTime": "2024-01-01T12:00:00Z",
  "delayBetweenMs": 2000,
  "hourlyLimit": 50
}
```

## 🎯 Key Points for Company Evaluation

1. **Emails WILL be sent** - The system uses Ethereal Email (fake SMTP) which:
   - Creates real test accounts
   - Sends emails successfully
   - Provides preview URLs
   - Perfect for testing/demo

2. **Persistence works** - BullMQ stores jobs in Redis, so:
   - Jobs survive server restarts
   - No duplicate sends
   - Scheduled times are preserved

3. **Rate limiting works** - Custom Redis implementation:
   - Enforces hourly limits
   - Reschedules automatically
   - Thread-safe across workers

4. **Error handling** - Comprehensive:
   - Validation errors caught
   - Database errors handled
   - Email send failures tracked
   - Retry logic in place

## 🚀 Quick Test Script

```bash
# 1. Start services
docker-compose up -d
cd backend && npm run dev &
cd frontend && npm run dev &

# 2. Wait for services to start (30 seconds)

# 3. Test health
curl http://localhost:3001/health

# 4. Test status
curl http://localhost:3001/api/status

# If both return successfully, system is ready!
```

---

**Note:** Ethereal Email is a testing service. In production, replace with real SMTP (SendGrid, AWS SES, etc.).

