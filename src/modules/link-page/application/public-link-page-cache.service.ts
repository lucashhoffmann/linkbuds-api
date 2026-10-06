import { normalizeHostname } from 'src/shared/utils/hostname';
import { Injectable } from '@nestjs/common';
import { RedisClient, positiveIntFromEnv } from 'src/shared/redis/redis.client';

const defaultPublicCacheTtlSeconds = 300;
const publicCacheKeyPrefix = 'linkbuds:public-link-page';

function encodeCachePart(value: string) {
  return encodeURIComponent(value);
}

@Injectable()
export class PublicLinkPageCacheService {
  private readonly ttlSeconds = positiveIntFromEnv(
    process.env.LINK_PAGE_PUBLIC_CACHE_TTL_SECONDS,
    defaultPublicCacheTtlSeconds,
  );

  constructor(private readonly client: RedisClient) {}

  private get redis() {
    return this.client.redis;
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

  private ensureConnected() {
    return this.client.ensureConnected();
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
    await this.deleteByPattern(this.hostSlugPattern(slug));
  }

  /** Drops every cached path starting with `prefix` (e.g. a bio's posts). */
  async invalidatePrefix(prefix: string) {
    if (!(await this.ensureConnected())) {
      return;
    }

    const encoded = encodeCachePart(prefix);
    await this.deleteByPattern(`${publicCacheKeyPrefix}:default:${encoded}*`);
    await this.deleteByPattern(`${publicCacheKeyPrefix}:host:*:${encoded}*`);
  }

  /** Drops every cached page served under a custom domain. */
  async invalidateHost(hostname: string) {
    if (!(await this.ensureConnected())) {
      return;
    }

    await this.deleteByPattern(
      `${publicCacheKeyPrefix}:host:${encodeCachePart(normalizeHostname(hostname))}:*`,
    );
  }

  private async deleteByPattern(pattern: string) {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis
        .scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        .catch(() => ['0', []] as [string, string[]]);

      if (keys.length) {
        await this.redis.del(...keys).catch(() => undefined);
      }

      cursor = nextCursor;
    } while (cursor !== '0');
  }
}
