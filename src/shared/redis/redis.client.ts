import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export function positiveIntFromEnv(
  value: string | undefined,
  fallback: number,
) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * One shared, lazy Redis connection. Callers degrade gracefully (cache miss,
 * zero online) when Redis is down: `ensureConnected()` returns false.
 */
@Injectable()
export class RedisClient implements OnModuleDestroy {
  readonly redis = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    },
  );

  constructor() {
    this.redis.on('error', () => undefined);
  }

  async ensureConnected() {
    if ((this.redis.status as string) === 'ready') {
      return true;
    }

    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      await this.redis.connect().catch(() => undefined);
    }

    return (this.redis.status as string) === 'ready';
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
