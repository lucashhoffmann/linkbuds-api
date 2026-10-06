import { Injectable } from '@nestjs/common';
import { RedisClient, positiveIntFromEnv } from 'src/shared/redis/redis.client';

const defaultOnlineTtlSeconds = 90;

@Injectable()
export class LinkPagePresenceService {
  private readonly ttlSeconds = positiveIntFromEnv(
    process.env.LINK_PAGE_ONLINE_TTL_SECONDS,
    defaultOnlineTtlSeconds,
  );

  constructor(private readonly client: RedisClient) {}

  private get redis() {
    return this.client.redis;
  }

  private key(linkPageId: string) {
    return `linkbuds:link-page-online:${linkPageId}`;
  }

  private ensureConnected() {
    return this.client.ensureConnected();
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

  /** Session ids still online, for the realtime globe. */
  async onlineSessions(linkPageId: string) {
    if (!(await this.ensureConnected())) {
      return [];
    }

    return this.redis.zrangebyscore(this.key(linkPageId), Date.now(), '+inf');
  }
}
