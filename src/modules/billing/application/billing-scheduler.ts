import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BillingService } from './billing.service';

const EVERY_MS = 60 * 60 * 1000;
const FIRST_RUN_MS = 30 * 1000;
/** pg advisory lock id: only one API instance runs the billing jobs at a time. */
const LOCK_ID = 7_301_001;

/**
 * Runs BillingService.runScheduledJobs hourly. Jobs are idempotent, so a late
 * or skipped run only delays a downgrade/renewal by up to an hour.
 * ponytail: in-process timer + pg advisory lock; move to a queue/cron worker
 * if jobs grow or need per-item retries.
 */
@Injectable()
export class BillingScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BillingScheduler.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly billingService: BillingService,
  ) {}

  onApplicationBootstrap() {
    this.timers = [
      setTimeout(() => void this.tick(), FIRST_RUN_MS),
      setInterval(() => void this.tick(), EVERY_MS),
    ];
    // Never keeps the process (or a test run) alive on its own.
    this.timers.forEach((timer) => timer.unref());
  }

  onModuleDestroy() {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  async tick() {
    const runner = this.dataSource.createQueryRunner();

    try {
      await runner.connect();
      const [{ locked }] = (await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [LOCK_ID],
      )) as Array<{ locked: boolean }>;

      if (!locked) return;

      try {
        const result = await this.billingService.runScheduledJobs();
        if (result.renewed || result.downgraded) {
          this.logger.log(
            `Billing jobs: ${result.renewed} renewed, ${result.downgraded} downgraded`,
          );
        }
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
      }
    } catch (error) {
      this.logger.error(
        'Billing jobs failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      await runner.release();
    }
  }
}
