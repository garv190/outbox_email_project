import { Queue, QueueOptions } from 'bullmq';
import { config } from '../config';

/

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
      delay: 5000, 
    },
    removeOnComplete: {
      age: 24 * 3600, 
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, 
    },
  },
};


export const reachinboxScheduler = new Queue('reachinboxScheduler', schedulerConfig);


export interface OutgoingMailTask {
  dispatchId: string;
  campaignId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string; 
  senderId?: string; 
}


export async function enqueueOutgoingMail(
  taskData: OutgoingMailTask,
  calculatedDelay: number
): Promise<void> {
  await reachinboxScheduler.add(
    'deliverEmailTask', 
    taskData,
    {
      delay: calculatedDelay, 
      jobId: `emailTask-${taskData.dispatchId}`, 
    }
  );
}


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

