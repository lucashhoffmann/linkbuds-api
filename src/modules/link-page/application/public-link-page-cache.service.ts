import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const defaultPublicCacheTtlSeconds = 300;
const publicCacheKeyPrefix = 'linkbuds:public-link-page';

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeHostname(hostname?: string) {
  return (hostname ?? '').split(':')[0]?.trim().toLowerCase() ?? '';
}

function encodeCachePart(value: string) {
  return encodeURIComponent(value);
}

@Injectable()
export class PublicLinkPageCacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly ttlSeconds = parsePositiveInteger(
    process.env.LINK_PAGE_PUBLIC_CACHE_TTL_SECONDS,
    defaultPublicCacheTtlSeconds,
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

  private key(hostname: string | undefined, slug: string) {
    const normalizedHostname = normalizeHostname(hostname);
    const slugKey = encodeCachePart(slug);

    if (!normalizedHostname) {
      return `${publicCacheKeyPrefix}:default:${slugKey}`;
    }

    return `${publicCacheKeyPrefix}:host:${encodeCachePart(
      normalizedHostname,
    )}:${slugKey}`;
  }

  private hostSlugPattern(slug: string) {
    return `${publicCacheKeyPrefix}:host:*:${encodeCachePart(slug)}`;
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

  async get<T>(hostname: string | undefined, slug: string) {
    if (!(await this.ensureConnected())) {
      return null;
    }

    const value = await this.redis
      .get(this.key(hostname, slug))
      .catch(() => null);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      await this.redis.del(this.key(hostname, slug)).catch(() => undefined);
      return null;
    }
  }

  async set<T>(hostname: string | undefined, slug: string, value: T) {
    if (!(await this.ensureConnected())) {
      return;
    }

    await this.redis
      .set(
        this.key(hostname, slug),
        JSON.stringify(value),
        'EX',
        this.ttlSeconds,
      )
      .catch(() => undefined);
  }

  async invalidateSlug(slug: string) {
    if (!(await this.ensureConnected())) {
      return;
    }

    await this.redis.del(this.key(undefined, slug)).catch(() => undefined);

    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis
        .scan(cursor, 'MATCH', this.hostSlugPattern(slug), 'COUNT', 100)
        .catch(() => ['0', []] as [string, string[]]);

      if (keys.length) {
        await this.redis.del(...keys).catch(() => undefined);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  }
}
