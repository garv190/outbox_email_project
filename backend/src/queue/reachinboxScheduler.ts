import { Queue, QueueOptions } from 'bullmq';
import { config } from '../config';

/**
 * ReachInbox email scheduling pipeline
 * 
 * We chose to separate this into its own module because we needed fine-grained
 * control over job scheduling and wanted to track each email dispatch independently.
 * The queue name "reachinboxScheduler" reflects our product name rather than
 * generic "email-queue" to make the system uniquely identifiable.
 */

const schedulerConfig: QueueOptions = {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // Start with 5s, then 25s, then 125s on retries
    },
    removeOnComplete: {
      age: 24 * 3600, // Retain completed jobs for 24h for debugging
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days for analysis
    },
  },
};

// Main scheduler queue - this name reflects our product identity
export const reachinboxScheduler = new Queue('reachinboxScheduler', schedulerConfig);

/**
 * Payload structure for individual email delivery tasks
 * 
 * We keep campaignId here even though it's in dispatchId because
 * it helps with debugging and bulk operations without hitting the DB.
 */
export interface OutgoingMailTask {
  dispatchId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string; // ISO string for cross-timezone consistency
  senderId?: string; // Optional - allows per-sender rate limiting later
}

/**
 * Enqueues an email delivery task with calculated delay
 * 
 * The delay is computed from the user's start time and position in the campaign.
 * We use the dispatch ID as part of the job ID to ensure idempotency -
 * if the same dispatch is somehow scheduled twice, BullMQ will dedupe it.
 */
export async function enqueueOutgoingMail(
  taskData: OutgoingMailTask,
  calculatedDelay: number
): Promise<void> {
  await reachinboxScheduler.add(
    'deliverEmailTask', // Job type identifier
    taskData,
    {
      delay: calculatedDelay, // Milliseconds until execution
      jobId: `emailTask-${taskData.dispatchId}`, // Ensures no duplicate sends
    }
  );
}

/**
 * Retrieves current scheduler statistics for monitoring
 * 
 * Useful for dashboard display and debugging queue health.
 * We track waiting/active/completed/failed/delayed counts separately
 * to understand system behavior under load.
 */
export async function getSchedulerMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    reachinboxScheduler.getWaitingCount(),
    reachinboxScheduler.getActiveCount(),
    reachinboxScheduler.getCompletedCount(),
    reachinboxScheduler.getFailedCount(),
    reachinboxScheduler.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

