import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { OutgoingMailTask } from './reachinboxScheduler';
import { sendEmail } from '../services/emailService';
import { checkRateLimit } from '../services/rateLimiter';
import pool from '../db/client';

/**
 * Worker process that handles email delivery tasks
 * 
 * We wrote this as a separate worker because we needed rate limiting
 * capabilities that BullMQ's built-in limiter doesn't provide:
 * - Per-sender rate limits (BullMQ limiter is global-only)
 * - Graceful rescheduling when limits hit (not just dropping jobs)
 * - DB audit trail of rate limit events
 * 
 * We intentionally do NOT use BullMQ's limiter option - all throughput
 * control happens via our Redis counter system for consistency.
 */

let emailWorker: Worker | null = null;

/**
 * Processes a single email delivery task from the scheduler
 * 
 * Each task goes through: validation -> rate check -> delay enforcement -> send
 * We update the DB status at each stage for traceability.
 */
async function processEmailDelivery(job: Job<OutgoingMailTask>): Promise<void> {
  const { dispatchId, recipientEmail, subject, body, scheduledTime, senderId } =
    job.data;

  console.log(`Processing email delivery task ${dispatchId} for ${recipientEmail}`);

  // Defensive check: verify dispatch hasn't already been sent
  // This protects against rare duplicate execution scenarios on restarts
  const [existingDispatch] = await pool.query<Array<{ status: string }>>(
    'SELECT status FROM MailDispatch WHERE id = ?',
    [dispatchId]
  );

  if (existingDispatch.length > 0 && existingDispatch[0].status === 'SENT') {
    console.log(`Dispatch ${dispatchId} already sent, skipping duplicate execution`);
    return; // Job already completed, exit safely
  }

  // Mark dispatch as currently being processed
  await pool.execute(
    'UPDATE MailDispatch SET status = ? WHERE id = ?',
    ['SENDING', dispatchId]
  );

  try {
    // Check our custom rate limits before sending
    // This increments Redis counters atomically - if limit exceeded, we reschedule
    const rateLimitResult = await checkRateLimit(senderId);

    if (!rateLimitResult.allowed) {
      console.log(
        `Rate limit exceeded for dispatch ${dispatchId}. Rescheduling for next hour window...`
      );

      // Note: checkRateLimit already rolled back the counter increments when limit was exceeded

      // Update DB to reflect the rescheduling
      await pool.execute(
        'UPDATE MailDispatch SET status = ?, scheduledTime = ? WHERE id = ?',
        ['RATE_LIMITED', new Date(rateLimitResult.resetTime), dispatchId]
      );

      // Move this job to the delayed queue until the next hour window
      const delayUntilNextHour = rateLimitResult.resetTime - Date.now();
      if (delayUntilNextHour > 0) {
        await job.moveToDelayed(delayUntilNextHour);
        // Return without throwing - this prevents BullMQ from retrying immediately
        return;
      } else {
        // Shouldn't happen, but if delay is somehow negative, throw to trigger retry
        throw new Error('Rate limit exceeded, retrying...');
      }
    }

    // Enforce minimum delay between individual email sends
    // This mimics provider throttling and prevents burst sending
    if (config.rateLimiting.minDelayBetweenEmailsMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.rateLimiting.minDelayBetweenEmailsMs)
      );
    }

    // Actually send the email via Ethereal (test SMTP)
    const sendResult = await sendEmail(recipientEmail, subject, body);

    // Mark as successfully sent with timestamp and message ID
    await pool.execute(
      'UPDATE MailDispatch SET status = ?, sentTime = ?, senderEmail = ? WHERE id = ?',
      ['SENT', new Date(), sendResult.messageId, dispatchId]
    );

    console.log(
      `Email delivery completed: ${recipientEmail} (Preview: ${sendResult.previewUrl || 'N/A'})`
    );
  } catch (error: any) {
    console.error(`Failed to deliver email for dispatch ${dispatchId}:`, error);

    // Record the failure with error message for debugging
    await pool.execute(
      'UPDATE MailDispatch SET status = ?, errorMessage = ? WHERE id = ?',
      ['FAILED', error.message || 'Unknown error', dispatchId]
    );

    // Re-throw rate limit errors so BullMQ knows to reschedule
    // Other errors will trigger BullMQ's retry mechanism (3 attempts)
    if (error.message?.includes('Rate limit exceeded')) {
      throw error;
    }

    // Let BullMQ handle retries for transient errors
    throw error;
  }
}

/**
 * Initializes and starts the email delivery worker
 * 
 * We configure concurrency based on env vars because different deployments
 * may have different capacity.
 * 
 * IMPORTANT: We intentionally do NOT enable BullMQ's built-in limiter here.
 * All throughput control is handled via Redis-backed counters (reachSessionLimit keys)
 * so rate limits remain consistent across workers and restarts. BullMQ's limiter
 * is global-only and doesn't support per-sender limits or rescheduling behavior.
 */
export function startWorker(): void {
  if (emailWorker) {
    console.log('Email worker already started');
    return;
  }

  emailWorker = new Worker(
    'reachinboxScheduler',
    async (job: Job<OutgoingMailTask>) => {
      return processEmailDelivery(job);
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.rateLimiting.workerConcurrency,
      // We intentionally avoid BullMQ's built-in limiter here.
      // All throughput control is handled via Redis-backed counters (reachSessionLimit keys)
      // so rate limits remain consistent across workers and restarts.
      // BullMQ's limiter is global-only and doesn't support per-sender limits or rescheduling.
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`Email delivery task ${job.id} completed`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`Email delivery task ${job?.id} failed:`, err.message);
  });

  emailWorker.on('error', (err) => {
    console.error('Email worker error:', err);
  });

  console.log(
    `Email delivery worker started with concurrency: ${config.rateLimiting.workerConcurrency}`
  );
}

/**
 * Gracefully shuts down the email delivery worker
 * 
 * Important: This lets BullMQ finish processing current jobs before exit.
 * Without this, jobs in progress might be lost on restart.
 */
export async function stopWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    console.log('Email worker stopped');
  }
}
