import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { DispatchMailJobPayload } from './outboundMailQueue';
import { sendEmail } from '../services/emailService';
import { checkRateLimit } from '../services/rateLimiter';
import pool from '../db/client';

/**
 * BullMQ Worker for processing email dispatch jobs
 * Custom implementation with rate limiting and delay handling
 */

let worker: Worker | null = null;

/**
 * Process a single email dispatch job
 */
async function processMailDispatch(job: Job<DispatchMailJobPayload>): Promise<void> {
  const { dispatchId, recipientEmail, subject, body, scheduledTime, senderId } =
    job.data;

  console.log(`Processing dispatch ${dispatchId} for ${recipientEmail}`);

  // Update dispatch status to SENDING
  await pool.execute(
    'UPDATE MailDispatch SET status = ? WHERE id = ?',
    ['SENDING', dispatchId]
  );

  try {
    // Check rate limits before sending (this increments counters)
    const rateLimitResult = await checkRateLimit(senderId);

    if (!rateLimitResult.allowed) {
      console.log(
        `Rate limit exceeded for dispatch ${dispatchId}. Rescheduling...`
      );

      // Note: checkRateLimit already rolled back the counters when limit exceeded

      // Update status to RATE_LIMITED
      await pool.execute(
        'UPDATE MailDispatch SET status = ?, scheduledTime = ? WHERE id = ?',
        ['RATE_LIMITED', new Date(rateLimitResult.resetTime), dispatchId]
      );

      // Reschedule the job for the next hour window
      const delay = rateLimitResult.resetTime - Date.now();
      if (delay > 0) {
        // Move job to delayed queue
        await job.moveToDelayed(delay);
        // Return without throwing to prevent retry
        return;
      } else {
        // If delay is negative (shouldn't happen), retry immediately
        throw new Error('Rate limit exceeded, retrying...');
      }
    }

    // Apply minimum delay between emails
    if (config.rateLimiting.minDelayBetweenEmailsMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.rateLimiting.minDelayBetweenEmailsMs)
      );
    }

    // Send the email
    const result = await sendEmail(recipientEmail, subject, body);

    // Update dispatch as sent
    await pool.execute(
      'UPDATE MailDispatch SET status = ?, sentTime = ?, senderEmail = ? WHERE id = ?',
      ['SENT', new Date(), result.messageId, dispatchId]
    );

    console.log(
      `Email sent successfully: ${recipientEmail} (Preview: ${result.previewUrl || 'N/A'})`
    );
  } catch (error: any) {
    console.error(`Failed to send email for dispatch ${dispatchId}:`, error);

    // Update dispatch as failed
    await pool.execute(
      'UPDATE MailDispatch SET status = ?, errorMessage = ? WHERE id = ?',
      ['FAILED', error.message || 'Unknown error', dispatchId]
    );

    // Re-throw if it's a rate limit error (so BullMQ can reschedule)
    if (error.message?.includes('Rate limit exceeded')) {
      throw error;
    }

    // For other errors, let BullMQ handle retries
    throw error;
  }
}

/**
 * Initialize and start the worker
 */
export function startWorker(): void {
  if (worker) {
    console.log('Worker already started');
    return;
  }

  worker = new Worker(
    'outbound-mail-queue',
    async (job: Job<DispatchMailJobPayload>) => {
      return processMailDispatch(job);
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.rateLimiting.workerConcurrency,
      limiter: {
        // We handle rate limiting manually, but this provides additional safety
        max: config.rateLimiting.maxEmailsPerHour,
        duration: 3600000, // 1 hour
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(
    `Worker started with concurrency: ${config.rateLimiting.workerConcurrency}`
  );
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Worker stopped');
  }
}
