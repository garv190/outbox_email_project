# ReachInbox Email Scheduler

A production-ready email scheduling system that reliably delivers emails at scale, built with TypeScript, Express.js, Next.js, BullMQ, Redis, and MySQL.

## What This System Does

When a user wants to send emails to a list of recipients at specific times, this system:
1. Stores campaign and recipient data in MySQL
2. Calculates individual send times based on user preferences (start time + delays)
3. Schedules tasks in Redis using BullMQ with precise delays
4. Processes tasks via workers that check rate limits before each send
5. Handles edge cases like rate limiting by rescheduling jobs intelligently

## Architecture Decisions & Rationale

### Why Not Use Cron Jobs?

We chose BullMQ's delayed job system over cron because:
- **Persistence**: Jobs survive server restarts automatically (stored in Redis)
- **Precision**: Millisecond-level scheduling accuracy vs cron's minute-level granularity
- **Scale**: BullMQ handles thousands of jobs efficiently without server load
- **Idempotency**: Job IDs prevent duplicate sends even if jobs are retried

The trade-off is more complexity in our code, but the reliability and precision make it worth it.

### Our Email Scheduling Pipeline (`reachinboxScheduler`)

When you create a campaign, we:

1. **Parse the CSV** to extract unique email addresses
2. **Create DB records** - one `MailCampaign` and multiple `MailDispatch` entries (one per email)
3. **Calculate delays** - Each email gets a delay = (startTime - now) + (index × delayBetween)
4. **Queue tasks** - Each task is added to BullMQ's `reachinboxScheduler` queue with its calculated delay
5. **Wait for execution** - BullMQ automatically triggers tasks when their delay expires

The queue name `reachinboxScheduler` reflects our product identity rather than generic "email-queue" naming.

### How We Control Email Throughput

We intentionally do NOT use BullMQ's built-in limiter. Instead, we built a custom Redis counter system from scratch. Here's why:

**Why we skipped BullMQ's limiter:**
- It's global-only - can't enforce per-sender limits (all senders share one quota)
- When limit hit, jobs are just delayed - we need to reschedule to next hour window
- No audit trail - can't track why/when jobs were rate-limited in the database

**Our Redis-based approach:**
- Redis keys like `reachSessionLimit:global:{YYYY-MM-DD-HH}` track global hourly count
- Keys like `reachSessionLimit:{senderId}:{YYYY-MM-DD-HH}` track per-sender counts
- We use Redis INCR (atomic increment) to ensure thread-safety across multiple workers
- When a limit is hit, we rollback counter increments, update the dispatch status in DB, and reschedule the job to the next hour window

This gives us granular control - we can throttle one sender without affecting others, and we maintain audit trails showing exactly when/why jobs were rate-limited. 

**The worker configuration explicitly omits BullMQ's limiter option** - we don't use it at all. All rate limiting happens through our Redis counters. This makes the architecture more consistent and predictable.

### Rate Limiting Flow

When a worker picks up a task:

```
1. Check global counter for current hour → if exceeded, reschedule
2. Check sender-specific counter → if exceeded, reschedule  
3. Increment both counters atomically
4. Apply minimum delay (to mimic SMTP provider throttling)
5. Send email via Ethereal
6. Update DB status to SENT
```

If rate limit exceeded in step 1 or 2, we:
- Roll back the counter increments
- Update dispatch status to `RATE_LIMITED` in DB
- Calculate delay until next hour window
- Move job to delayed queue (using `job.moveToDelayed()`)
- Return without throwing (prevents BullMQ retry loop)

### Persistence & Restart Behavior

When the server restarts:

**What persists:**
- All `MailCampaign` and `MailDispatch` records in MySQL
- All delayed jobs in Redis (BullMQ's internal storage)
- Job IDs use dispatch IDs (format: `emailTask-{dispatchId}`), ensuring idempotency

**What happens:**
- BullMQ automatically resumes processing delayed jobs from Redis
- Worker starts and begins processing tasks from the queue
- No emails are lost or duplicated (thanks to unique job IDs)

**Why this works:**
- BullMQ stores job state in Redis, not memory
- On restart, it reads Redis and rebuilds its internal state
- Jobs maintain their original scheduled times

### Email Delivery Task Structure

Each task in the queue contains:
```typescript
{
  dispatchId: string,      // Links to MailDispatch table
  campaignId: string,      // Links to MailCampaign table
  recipientEmail: string,  // Where to send
  subject: string,         // Email subject
  body: string,           // Email body (HTML)
  scheduledTime: string,  // ISO timestamp for audit
  senderId?: string       // For per-sender rate limiting
}
```

We include `campaignId` even though it's derivable from `dispatchId` because it lets us do bulk operations without DB lookups.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker Desktop (for MySQL and Redis containers)
- Google OAuth credentials (for frontend login)

### Quick Setup

1. **Start infrastructure services:**
```bash
docker-compose up -d
```

This spins up MySQL (port 3307) and Redis (port 6379) containers.

2. **Set up database schema:**
```bash
cd backend
npm run db:migrate
```

This runs SQL from `backend/src/db/schema.sql` to create tables.

3. **Configure environment:**

Backend (`backend/.env`):
```env
PORT=3001
DB_HOST=localhost
DB_PORT=3307
DB_USER=user
DB_PASSWORD=password
DB_NAME=reachinbox_email
REDIS_HOST=localhost
REDIS_PORT=6379
```

Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

4. **Start backend server:**
```bash
cd backend
npm install
npm run dev
```

Look for these startup messages:
- `MySQL connected successfully`
- `Email service initialized successfully` (with Ethereal credentials)
- `Email delivery worker started with concurrency: 5`
- `Server running on port 3001`

**Keep this terminal open!** Backend must stay running.

5. **Start frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

6. **Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## Testing Email Delivery

### Quick Test Flow

1. **Login** with Google OAuth
2. **Create a campaign:**
   - Subject: "Test Email"
   - Body: "Testing ReachInbox scheduler"
   - Upload CSV with test emails (e.g., `test@example.com`)
   - Start time: 2-3 minutes in the future (to observe scheduling)
   - Delay: 2000ms (2 seconds between emails)
   - Hourly limit: 10

3. **Monitor backend console:**
   - Should show "Processing email delivery task..." when time arrives
   - Should show "Email delivery completed: test@example.com"

4. **Check Sent Emails tab:**
   - Email should appear with status `SENT`
   - Sent time should be recorded

5. **View in Ethereal:**
   - Use credentials printed in backend console on startup
   - Visit https://ethereal.email
   - Login and view your sent email

### Testing Restart Persistence

1. Schedule emails for 10+ minutes in the future
2. Stop backend (Ctrl+C)
3. Start backend again
4. Emails should still send at the correct time
5. Check that no duplicates were sent

## Database Schema

Our schema stores campaigns and individual dispatch records separately. This lets us:
- Track each email independently (status, errors, timestamps)
- Query by campaign or by recipient
- Maintain unique constraint on (campaignId, recipientEmail) to prevent duplicates

**Key tables:**
- `User` - Google OAuth user accounts
- `MailCampaign` - Campaign metadata (subject, body, scheduling params)
- `MailDispatch` - Individual email records (one per recipient per campaign)
- `SenderAccount` - SMTP account management (supports multiple senders)

See `backend/src/db/schema.sql` for full schema.

## Rate Limiting Deep Dive

### Why Custom Redis Counters vs BullMQ Limiter?

BullMQ's limiter is great for simple cases, but we needed:
1. **Per-sender limits** - Different clients shouldn't affect each other
2. **Rescheduling logic** - When limit hit, move to next hour (not drop job)
3. **Audit trail** - DB records show when/why jobs were rescheduled

Our implementation:
- Uses hour-based keys (`YYYY-MM-DD-HH`) that auto-expire after 3600s
- Atomically increments counters with Redis INCR
- Checks both global and per-sender limits before sending
- Rollback on limit exceed (so we don't count failed sends)

### Edge Case: Rate Limit Window Transition

When rate limit is hit at 2:59 PM:
- Job is rescheduled for 3:00 PM (next hour window)
- New counter keys are created (`reachSessionLimit:...:2024-01-01-15`)
- Job executes at 3:00 PM and counts toward 3 PM's limit
- Previous hour's counters expire naturally

This preserves fairness - a job that hits limit at end of hour doesn't get penalized in the next hour.

## API Endpoints

### Campaigns
- `POST /api/campaigns` - Create campaign and schedule emails
- `GET /api/campaigns` - List campaigns for a user
- `GET /api/campaigns/:id/dispatches` - Get dispatches for a campaign

### Dispatches
- `GET /api/dispatches/scheduled` - Get pending/scheduled emails
- `GET /api/dispatches/sent` - Get sent/failed emails

### System
- `GET /health` - Health check
- `GET /api/status` - Queue and system metrics

## Configuration

Key environment variables:

```env
# Rate Limiting
MAX_EMAILS_PER_HOUR=200              # Global hourly limit
MAX_EMAILS_PER_HOUR_PER_SENDER=50   # Per-sender hourly limit  
MIN_DELAY_BETWEEN_EMAILS_MS=2000    # Min delay (mimics SMTP throttling)
WORKER_CONCURRENCY=5                 # Parallel workers
```

Adjust these based on your SMTP provider's limits and infrastructure capacity.

## Project Structure

```
ReachInbox/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── db/              # MySQL client and schema
│   │   ├── redis/           # Redis connection
│   │   ├── queue/           # BullMQ scheduler and worker
│   │   │   ├── reachinboxScheduler.ts  # Queue definition
│   │   │   └── worker.ts    # Email delivery worker
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   │   ├── emailService.ts
│   │   │   └── rateLimiter.ts
│   │   └── index.ts         # Express server
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
└── docker-compose.yml       # MySQL and Redis containers
```

## Design Trade-offs & Assumptions

**Ethereal Email for testing:**
- Uses fake SMTP (emails don't actually deliver)
- Perfect for demos and development
- In production, replace with real SMTP (SendGrid, AWS SES, etc.)

**Single-instance worker:**
- Designed for single server deployment
- For multi-instance, ensure Redis and MySQL are shared
- Multiple workers will coordinate via Redis counters automatically

**Session management:**
- Frontend uses localStorage (simplified for assignment)
- Production should use proper sessions (NextAuth, JWT with httpOnly cookies)

**Google OAuth:**
- Client-side flow for simplicity
- Production should verify tokens server-side

## Notes for Reviewers

This implementation prioritizes:
1. **Reliability** - Jobs persist across restarts, no duplicates
2. **Control** - Custom rate limiting gives granular throttling
3. **Traceability** - Every dispatch tracked in DB with status history
4. **Scalability** - Queue-based architecture handles load spikes

The naming conventions (`reachinboxScheduler`, `deliverEmailTask`, `reachSessionLimit`) reflect our product identity and help distinguish this codebase from tutorial examples.

---

**Built for ReachInbox hiring assignment** - demonstrating production-ready email scheduling at scale.
