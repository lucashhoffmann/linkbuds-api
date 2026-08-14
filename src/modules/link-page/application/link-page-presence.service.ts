import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const defaultOnlineTtlSeconds = 90;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class LinkPagePresenceService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly ttlSeconds = parsePositiveInteger(
    process.env.LINK_PAGE_ONLINE_TTL_SECONDS,
    defaultOnlineTtlSeconds,
  );

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.redis.on('error', () => undefined);
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  private key(linkPageId: string) {
    return `linkbuds:link-page-online:${linkPageId}`;
  }

  private async ensureConnected() {
    if ((this.redis.status as string) === 'ready') {
      return true;
    }

    if (this.redis.status === 'wait' || this.redis.status === 'end') {
      await this.redis.connect().catch(() => undefined);
    }

    return (this.redis.status as string) === 'ready';
  }

  async heartbeat(linkPageId: string, sessionId: string) {
    if (!(await this.ensureConnected())) {
      return 0;
    }

    const key = this.key(linkPageId);
    const now = Date.now();
    const expiresAt = now + this.ttlSeconds * 1000;

    await this.redis
      .multi()
      .zremrangebyscore(key, '-inf', now)
      .zadd(key, expiresAt, sessionId)
      .expire(key, this.ttlSeconds * 2)
      .exec();

    return this.countOnline(linkPageId);
  }

  async countOnline(linkPageId: string) {
    if (!(await this.ensureConnected())) {
      return 0;
    }

    const key = this.key(linkPageId);
    const now = Date.now();

    await this.redis.zremrangebyscore(key, '-inf', now);

    return this.redis.zcard(key);
  }
}
