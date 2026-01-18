import { Queue, QueueOptions } from 'bullmq';
import { config } from '../config';
import redis from '../redis/client';

/**
 * Custom naming: outbound-mail-queue (instead of email-queue)
 * This is the main queue for scheduling email dispatches
 */

const queueOptions: QueueOptions = {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

export const outboundMailQueue = new Queue('outbound-mail-queue', queueOptions);

/**
 * Job payload structure for dispatch-mail-job
 */
export interface DispatchMailJobPayload {
  dispatchId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string; // ISO string
  senderId?: string;
}

/**
 * Add a delayed job to the queue
 */
export async function scheduleMailDispatch(
  payload: DispatchMailJobPayload,
  delay: number
): Promise<void> {
  await outboundMailQueue.add(
    'dispatch-mail-job', // Custom job name
    payload,
    {
      delay, // Delay in milliseconds
      jobId: `dispatch-${payload.dispatchId}`, // Unique job ID for idempotency
    }
  );
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    outboundMailQueue.getWaitingCount(),
    outboundMailQueue.getActiveCount(),
    outboundMailQueue.getCompletedCount(),
    outboundMailQueue.getFailedCount(),
    outboundMailQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}


