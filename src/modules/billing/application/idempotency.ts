import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { IdempotencyKeyEntity } from '../domain/entities/idempotency-key.entity';

const hashRequest = (body: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(body ?? null))
    .digest('hex');

/**
 * Runs `operation` once per (scope, key). Retries with the same key and body
 * get the stored response; the same key with another body is rejected.
 * A failed operation releases the key so the client can retry.
 */
export async function runIdempotent<T>(
  dataSource: DataSource,
  scope: string,
  key: string,
  body: unknown,
  operation: () => Promise<T>,
): Promise<T> {
  const repository = dataSource.getRepository(IdempotencyKeyEntity);
  const requestHash = hashRequest(body);
  const inserted = await repository
    .createQueryBuilder()
    .insert()
    .values({ scope, key, requestHash })
    .orIgnore()
    .returning(['id'])
    .execute();

  if (!inserted.raw?.length) {
    const existing = await repository.findOneByOrFail({ scope, key });

    if (existing.requestHash !== requestHash) {
      throw new AppException(ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
    }

    if (existing.response == null) {
      throw new AppException(ERROR_CODES.IDEMPOTENCY_IN_PROGRESS);
    }

    return existing.response as T;
  }

  try {
    const result = await operation();
    await repository.update({ scope, key }, { response: result as never });

    return result;
  } catch (error) {
    await repository.delete({ scope, key });
    throw error;
  }
}
