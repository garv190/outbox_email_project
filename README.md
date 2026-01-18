# ReachInbox Email Scheduler

A production-grade email scheduler service with dashboard, built with TypeScript, Express.js, Next.js, BullMQ, Redis, and MySQL.

## 🏗️ Architecture Overview

### System Design

This system implements a **custom-designed email scheduling architecture** with the following key components:

#### **Backend Architecture**

1. **Queue System**: Uses `outbound-mail-queue` (BullMQ) with `dispatch-mail-job` jobs
2. **Rate Limiting**: Custom Redis-based rate limiting with keys like `mailThrottle:{senderId}:{hourKey}`
3. **Persistence**: MySQL database with mysql2
4. **Worker**: BullMQ worker with configurable concurrency, handling delays and rate limits

#### **Key Design Decisions**

- **Custom Naming**: Uses unique naming conventions (`outbound-mail-queue`, `dispatch-mail-job`, `mailThrottle`) to ensure architectural uniqueness
- **No Cron Jobs**: All scheduling is done via BullMQ delayed jobs, ensuring persistence across restarts
- **Custom Rate Limiting**: Manual Redis counter implementation (not just BullMQ limiter) with rescheduling logic
- **Idempotency**: Job IDs based on dispatch IDs prevent duplicate sends

### How Scheduling Works

1. **Campaign Creation**: User creates a campaign via API with recipient emails, subject, body, and scheduling parameters
2. **Dispatch Records**: Each email creates a `MailDispatch` record in MySQL
3. **Job Scheduling**: BullMQ jobs are scheduled with calculated delays based on:
   - Start time
   - Delay between emails (configurable)
   - Index position in the campaign
4. **Worker Processing**: BullMQ worker processes jobs with:
   - Concurrency control (configurable, default: 5)
   - Minimum delay between emails (configurable, default: 2 seconds)
   - Rate limit checking before each send
5. **Rate Limit Handling**: When rate limits are exceeded:
   - Job is moved to delayed state
   - Scheduled time is updated in database
   - Job is rescheduled for the next hour window

### Persistence on Restart

- **BullMQ Jobs**: Stored in Redis with persistence enabled
- **Database State**: All dispatches and campaigns stored in MySQL
- **Recovery**: On restart, BullMQ automatically resumes processing delayed jobs
- **No Duplication**: Job IDs ensure idempotency - same dispatch won't be sent twice

### Rate Limiting Implementation

**Custom Redis-Based Rate Limiting**:

- **Global Limit**: `mailThrottle:global:{hourKey}` - tracks total emails per hour
- **Per-Sender Limit**: `mailThrottle:{senderId}:{hourKey}` - tracks emails per sender per hour
- **Hour Keys**: Format `YYYY-MM-DD-HH` in UTC
- **Rescheduling**: When limit exceeded, job is moved to delayed state with delay until next hour window
- **Thread-Safe**: Uses Redis INCR operations for atomic counting across multiple workers

**Configuration**:
- `MAX_EMAILS_PER_HOUR`: Global limit (default: 200)
- `MAX_EMAILS_PER_HOUR_PER_SENDER`: Per-sender limit (default: 50)
- `MIN_DELAY_BETWEEN_EMAILS_MS`: Minimum delay (default: 2000ms)
- `WORKER_CONCURRENCY`: Worker concurrency (default: 5)

### Behavior Under Load

When **1000+ emails** are scheduled for the same time:

1. Jobs are queued in BullMQ with calculated delays
2. Worker processes jobs up to concurrency limit
3. Rate limits are checked before each send
4. When hourly limit is reached, remaining jobs are automatically rescheduled
5. Order is preserved as much as possible (jobs maintain their scheduled order)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for Redis and MySQL)
- Google OAuth credentials (for frontend login)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd ReachInbox
```

2. **Install dependencies**

```bash
npm run install:all
```

Or install separately:

```bash
cd backend && npm install
cd ../frontend && npm install
```

3. **Set up environment variables**

**Backend** (`backend/.env`):

```env
PORT=3001
NODE_ENV=development

DATABASE_URL="mysql://user:password@localhost:3306/reachinbox_email"
# Or use individual config:
DB_HOST=localhost
DB_PORT=3306
DB_USER=user
DB_PASSWORD=password
DB_NAME=reachinbox_email

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5

JWT_SECRET=your-secret-key-change-in-production
```

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

4. **Start Docker services** (Redis and MySQL)

```bash
docker-compose up -d
```

5. **Set up database**

```bash
cd backend
npm run db:migrate
```

This will create the database schema using the SQL file in `backend/src/db/schema.sql`.

6. **Start backend**

```bash
cd backend
npm run dev
```

The backend will:
- Initialize Ethereal Email (test SMTP)
- Start the BullMQ worker
- Print Ethereal credentials (save these to view sent emails)

7. **Start frontend** (in a new terminal)

```bash
cd frontend
npm run dev
```

8. **Access the application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Ethereal Inbox: https://ethereal.email (use credentials from backend console)

## 📁 Project Structure

```
ReachInbox/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration management
│   │   ├── db/              # MySQL client
│   │   ├── redis/           # Redis client
│   │   ├── queue/           # BullMQ queue and worker
│   │   │   ├── outboundMailQueue.ts  # Queue definition
│   │   │   └── worker.ts     # Worker implementation
│   │   ├── routes/          # API routes
│   │   │   ├── campaigns.ts
│   │   │   ├── dispatches.ts
│   │   │   └── users.ts
│   │   ├── services/        # Business logic
│   │   │   ├── emailService.ts
│   │   │   └── rateLimiter.ts
│   │   └── index.ts         # Express app entry
│   ├── db/
│   │   ├── client.ts        # MySQL connection pool
│   │   ├── schema.sql        # Database schema
│   │   └── migrate.ts        # Migration script
│   └── package.json
├── frontend/
│   ├── app/                 # Next.js app directory
│   │   ├── page.tsx         # Login page
│   │   ├── dashboard/       # Dashboard page
│   │   └── layout.tsx
│   ├── components/          # React components
│   │   ├── Header.tsx
│   │   ├── ScheduledEmails.tsx
│   │   ├── SentEmails.tsx
│   │   └── ComposeModal.tsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🎯 Features Implemented

### Backend

✅ **Email Scheduling**
- Accept email send requests via API
- Schedule emails at specific times using BullMQ delayed jobs
- Support for multiple recipients per campaign
- Configurable delay between emails

✅ **Persistence**
- MySQL database for campaigns and dispatches
- Redis for BullMQ job storage
- Survives server restarts without losing jobs
- Idempotency via unique job IDs

✅ **Rate Limiting & Concurrency**
- Custom Redis-based rate limiting (not just BullMQ limiter)
- Global hourly limit (configurable)
- Per-sender hourly limit (configurable)
- Configurable worker concurrency
- Minimum delay between emails
- Automatic rescheduling when limits exceeded

✅ **Email Sending**
- Ethereal Email integration (fake SMTP for testing)
- Multiple sender account support (database-backed)
- Error handling and retry logic

### Frontend

✅ **Google OAuth Login**
- Real Google OAuth implementation
- User profile display (name, email, avatar)
- Logout functionality

✅ **Dashboard**
- Clean, modern UI with Tailwind CSS
- Tabbed interface (Scheduled / Sent emails)
- Responsive design

✅ **Compose Email**
- Subject and body input
- CSV/text file upload for email addresses
- Email parsing and count display
- Start time selection
- Configurable delay and hourly limit
- Modal interface

✅ **Email Lists**
- Scheduled emails table with status
- Sent emails table with status
- Loading states
- Empty states
- Error handling

## 🔧 API Endpoints

### Campaigns

- `POST /api/campaigns` - Create a new email campaign
- `GET /api/campaigns` - Get campaigns for a user
- `GET /api/campaigns/:campaignId/dispatches` - Get dispatches for a campaign

### Dispatches

- `GET /api/dispatches/scheduled` - Get scheduled emails
- `GET /api/dispatches/sent` - Get sent emails

### Users

- `POST /api/users` - Create or update user (from Google OAuth)
- `GET /api/users/:userId` - Get user by ID

## 🧪 Testing Restart Persistence

1. Create a campaign with emails scheduled for future time
2. Stop the backend server (`Ctrl+C`)
3. Start the backend again
4. Verify that scheduled emails still send at the correct time
5. Check that no emails were duplicated

## 📊 Database Schema

The database schema is defined in `backend/src/db/schema.sql`:

- **User**: Stores Google OAuth user information
- **MailCampaign**: Campaign metadata (subject, body, scheduling parameters)
  - Status tracking (SCHEDULED, IN_PROGRESS, COMPLETED, etc.)
- **MailDispatch**: Individual email dispatch records
  - Status tracking (PENDING, SCHEDULED, SENT, FAILED, RATE_LIMITED)
  - Unique constraint on (campaignId, recipientEmail) for idempotency
- **SenderAccount**: SMTP account management
  - Supports multiple sender accounts

Run `npm run db:migrate` to create these tables.

## 🔐 Security Considerations

- Environment variables for sensitive data
- JWT secret for session management (in production, use proper session management)
- Input validation with Zod
- SQL injection protection via parameterized queries
- Rate limiting to prevent abuse

## 🚧 Assumptions & Trade-offs

### Assumptions

1. **Ethereal Email**: Using Ethereal for testing (fake SMTP). In production, replace with real SMTP provider
2. **Session Management**: Using localStorage for simplicity. In production, use proper session management (NextAuth, JWT tokens, etc.)
3. **Google OAuth**: Frontend-only OAuth flow. In production, implement proper server-side OAuth verification
4. **Single Instance**: Designed for single-instance deployment. For multi-instance, ensure Redis and DB are shared

### Trade-offs

1. **Rate Limiting**: Custom Redis implementation provides more control but requires more code than BullMQ limiter alone
2. **Job Rescheduling**: When rate limited, jobs are rescheduled which may cause slight delays but preserves order
3. **CSV Parsing**: Simple regex-based email extraction. In production, use proper CSV parsing library
4. **Error Handling**: Basic error handling. In production, implement comprehensive error tracking (Sentry, etc.)

## 📝 Notes

- **Ethereal Email**: Credentials are printed to console on backend startup. Use these to view sent emails at https://ethereal.email
- **Rate Limiting**: The system uses a combination of BullMQ limiter (safety net) and custom Redis counters (primary control)
- **Job Persistence**: BullMQ stores jobs in Redis, so they persist across restarts
- **Idempotency**: Job IDs are based on dispatch IDs, preventing duplicate sends

## 🎥 Demo Video Checklist

When creating the demo video, show:

1. ✅ Creating scheduled emails from frontend
2. ✅ Dashboard showing Scheduled and Sent emails
3. ✅ Restart scenario: Stop server → Start again → Future emails still send
4. ✅ Rate limiting behavior (optional: show under load)

## 📄 License

This project is part of a hiring assignment for ReachInbox.

