import redis from '../redis/client';
import { config } from '../config';



interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}


 
function getHourKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}`;
}


export async function checkRateLimit(
  senderId?: string
): Promise<RateLimitResult> {
  const hourKey = getHourKey();
  const now = Date.now();
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const resetTime = nextHour.getTime();

  
  const globalKey = `reachSessionLimit:global:${hourKey}`;
  const globalCount = await redis.incr(globalKey);
  await redis.expire(globalKey, 3600); 

  if (globalCount > config.rateLimiting.maxEmailsPerHour) {
    await redis.decr(globalKey); 
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }

  if (senderId) {
    const senderKey = `reachSessionLimit:${senderId}:${hourKey}`;
    const senderCount = await redis.incr(senderKey);
    await redis.expire(senderKey, 3600);

    if (senderCount > config.rateLimiting.maxEmailsPerHourPerSender) {
      await redis.decr(senderKey); 
      await redis.decr(globalKey); 
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


