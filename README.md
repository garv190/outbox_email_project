# ReachInbox(Outbox_Project) – Email Scheduler & Dashboard

This project implements a production-style email scheduling system similar to what ReachInbox uses internally.  
The focus is on **reliable background scheduling**, **rate-limited delivery**, and **restart safety**, rather than sending real emails.

The system is built with **TypeScript**, **Express**, **BullMQ**, **Redis**, **MySQL**, and a **Next.js frontend dashboard**.

---

## What this system does

The application allows users to:

- Schedule emails to be sent at a specific future time
- Process email delivery asynchronously using a queue (no cron jobs)
- Enforce hourly rate limits and per-sender throttling
- Restart the server without losing scheduled emails
- View scheduled and sent emails in a dashboard

Emails are sent using **Ethereal Email**, a fake SMTP service designed for safe testing and demos.

---

## High-level architecture

The system is split into four main parts:

- **API Server (Express)**  
  Accepts requests, validates input, and persists data

- **Database (MySQL)**  
  Stores campaigns and individual email dispatch records

- **Queue (BullMQ + Redis)**  
  Handles delayed execution and retry logic

- **Worker**  
  Processes queued jobs, enforces rate limits, and sends emails

All background work is driven by **BullMQ delayed jobs**, not cron.

---

## How scheduling works

When a campaign is created:

1. Campaign metadata is stored in `MailCampaign`
2. Each recipient becomes a separate `MailDispatch` record
3. A send time is calculated per email using:
   - campaign start time  
   - delay between emails  
4. A BullMQ job is created for each dispatch with a calculated delay

Because delayed jobs are stored in Redis, scheduled emails survive server restarts automatically.

---


## Worker behavior & email delivery

A background worker listens to the `reachinboxScheduler` queue.

For each job:

1. The worker checks the database to ensure the email hasn’t already been sent  
2. Rate limits are evaluated using Redis counters  
3. If allowed, the email is sent via Ethereal SMTP  
4. The dispatch record is updated with status and timestamps  

If a rate limit is exceeded, the job is **rescheduled** instead of failed.

---

## Rate limiting strategy

 Redis counters are used to support:

- Global hourly limits
- Per-sender hourly limits
- Correct behavior across multiple workers
- Clear auditability in the database

Counters are stored using hour-based UTC keys, for example:

- `reachSessionLimit:{senderId}:YYYY-MM-DD-HH`

When a limit is hit:

- Counter increments are rolled back
- Dispatch status is updated to `RATE_LIMITED`
- The job is moved to the next hour window.

---

## Restart safety

State is persisted at two layers:

- **MySQL** stores campaigns and dispatch records  
- **Redis** stores all BullMQ jobs  

On restart:

- BullMQ reloads delayed jobs from Redis
- The worker resumes processing automatically
- Job IDs prevent duplicate sends
- Already-sent emails are skipped defensively

No manual recovery logic is required.

---

## Ethereal Email (testing SMTP)

Emails are sent using **Ethereal**, which does not deliver real emails.

Each sent email generates a **preview URL**, which can be opened in a browser to view the email content.  
This allows safe verification without sending real emails.

---

## Running the project locally

### Prerequisites

- Node.js 18+
- Docker (for MySQL and Redis)
- Google OAuth credentials (for frontend login)

---

### Start infrastructure services

```bash
docker-compose up -d

---

## Backend setup

```bash
cd backend
npm install
npm run db:migrate
npm run dev

---

## Frontend Setup

cd frontend
npm install
npm run dev

---

## Environment Variables
PORT=
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

REDIS_HOST=
REDIS_PORT=

MAX_EMAILS_PER_HOUR=
MAX_EMAILS_PER_HOUR_PER_SENDER=
MIN_DELAY_BETWEEN_EMAILS_MS=
WORKER_CONCURRENCY=



