import redis from '../redis/client';
import { config } from '../config';

/**
 * Rate limiting service using Redis counters
 * 
 * We chose Redis INCR over BullMQ's built-in limiter because:
 * 1. We need per-sender limits (BullMQ limiter is global only)
 * 2. We need to reschedule jobs when limits hit (not just delay)
 * 3. We want DB audit trail of rate limit events
 * 
 * The keys use a custom format `reachSessionLimit` to avoid conflicts
 * with other Redis keys and reflect our product identity.
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Generates a UTC hour key for rate limit counters
 * 
 * Format: YYYY-MM-DD-HH (e.g., "2024-01-15-14")
 * We use UTC to ensure consistent behavior across timezones.
 * These keys naturally expire after 1 hour, cleaning up old counters.
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
 * Checks whether sending an email is allowed under current rate limits
 * 
 * This is our primary rate limiting mechanism - we don't use BullMQ's
 * built-in limiter because it's global-only and doesn't support rescheduling.
 * 
 * Flow:
 * 1. Atomically increment global counter
 * 2. Check global limit → if exceeded, rollback and return false
 * 3. If senderId provided, increment per-sender counter
 * 4. Check per-sender limit → if exceeded, rollback both and return false
 * 5. If both checks pass, return true (counters remain incremented)
 * 
 * Rollback is important - we don't want to count failed sends against limits.
 */
export async function checkRateLimit(
  senderId?: string
): Promise<RateLimitResult> {
  const hourKey = getHourKey();
  const now = Date.now();
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const resetTime = nextHour.getTime();

  // Check global rate limit - we use a custom key pattern to avoid conflicts
  const globalKey = `reachSessionLimit:global:${hourKey}`;
  const globalCount = await redis.incr(globalKey);
  await redis.expire(globalKey, 3600); // Expire after 1 hour (prevents memory bloat)

  if (globalCount > config.rateLimiting.maxEmailsPerHour) {
    await redis.decr(globalKey); // Rollback increment since we won't send
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }

  // Check per-sender rate limit if senderId provided
  // This lets us throttle individual senders independently
  if (senderId) {
    const senderKey = `reachSessionLimit:${senderId}:${hourKey}`;
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
  const globalKey = `reachSessionLimit:global:${hourKey}`;
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
    const senderKey = `reachSessionLimit:${senderId}:${hourKey}`;
    const senderCount = parseInt((await redis.get(senderKey)) || '0', 10);
    result.sender = {
      count: senderCount,
      limit: config.rateLimiting.maxEmailsPerHourPerSender,
    };
  }

  return result;
}


