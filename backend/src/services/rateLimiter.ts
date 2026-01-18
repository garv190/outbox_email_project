import redis from '../redis/client';
import { config } from '../config';

/**
 * Custom rate limiting service using Redis counters
 * Implements per-sender and global rate limits
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Get the current hour key for rate limiting
 */
function getHourKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}`;
}

/**
 * Check if sending an email is allowed based on rate limits
 * Returns true if allowed, false if rate limited
 */
export async function checkRateLimit(
  senderId?: string
): Promise<RateLimitResult> {
  const hourKey = getHourKey();
  const now = Date.now();
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const resetTime = nextHour.getTime();

  // Check global rate limit
  const globalKey = `mailThrottle:global:${hourKey}`;
  const globalCount = await redis.incr(globalKey);
  await redis.expire(globalKey, 3600); // Expire after 1 hour

  if (globalCount > config.rateLimiting.maxEmailsPerHour) {
    await redis.decr(globalKey); // Rollback increment
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }

  // Check per-sender rate limit if senderId provided
  if (senderId) {
    const senderKey = `mailThrottle:${senderId}:${hourKey}`;
    const senderCount = await redis.incr(senderKey);
    await redis.expire(senderKey, 3600);

    if (senderCount > config.rateLimiting.maxEmailsPerHourPerSender) {
      await redis.decr(senderKey); // Rollback
      await redis.decr(globalKey); // Rollback global too
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    const remaining = Math.max(
      0,
      config.rateLimiting.maxEmailsPerHourPerSender - senderCount
    );
    return {
      allowed: true,
      remaining,
      resetTime,
    };
  }

  const remaining = Math.max(
    0,
    config.rateLimiting.maxEmailsPerHour - globalCount
  );
  return {
    allowed: true,
    remaining,
    resetTime,
  };
}

/**
 * Get current rate limit counts for monitoring
 */
export async function getRateLimitStatus(
  senderId?: string
): Promise<{
  global: { count: number; limit: number };
  sender?: { count: number; limit: number };
}> {
  const hourKey = getHourKey();
  const globalKey = `mailThrottle:global:${hourKey}`;
  const globalCount = parseInt((await redis.get(globalKey)) || '0', 10);

  const result: {
    global: { count: number; limit: number };
    sender?: { count: number; limit: number };
  } = {
    global: {
      count: globalCount,
      limit: config.rateLimiting.maxEmailsPerHour,
    },
  };

  if (senderId) {
    const senderKey = `mailThrottle:${senderId}:${hourKey}`;
    const senderCount = parseInt((await redis.get(senderKey)) || '0', 10);
    result.sender = {
      count: senderCount,
      limit: config.rateLimiting.maxEmailsPerHourPerSender,
    };
  }

  return result;
}


