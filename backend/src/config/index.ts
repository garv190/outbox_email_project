import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3307', 10), // Default to 3307 (Docker mapped port)
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
    name: process.env.DB_NAME || 'reachinbox_email',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  ethereal: {
    user: process.env.ETHEREAL_EMAIL_USER || '',
    pass: process.env.ETHEREAL_EMAIL_PASS || '',
  },
  rateLimiting: {
    maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
    maxEmailsPerHourPerSender: parseInt(
      process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50',
      10
    ),
    minDelayBetweenEmailsMs: parseInt(
      process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000',
      10
    ),
    workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  },
};

