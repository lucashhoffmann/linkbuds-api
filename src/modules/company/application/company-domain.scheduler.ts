import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CompanyDomainService } from './company-domain.service';

const EVERY_MS = 2 * 60 * 1000;
const FIRST_RUN_MS = 20 * 1000;
/** pg advisory lock id: only one API instance re-checks domains at a time. */
const LOCK_ID = 7_301_002;

/**
 * Re-checks DNS of domains still waiting (PENDING/VERIFIED/FAILED, last 72h)
 * every 2 minutes, so a domain turns ACTIVE without the user clicking Verify.
 * ponytail: in-process timer + pg advisory lock, same as BillingScheduler;
 * move to a queue worker if the batch outgrows one tick.
 */
@Injectable()
export class CompanyDomainScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CompanyDomainScheduler.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly companyDomainService: CompanyDomainService,
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
        const result = await this.companyDomainService.recheckPending();
        if (result.activated) {
          this.logger.log(
            `Domains: ${result.activated} of ${result.checked} became active`,
          );
        }
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
      }
    } catch (error) {
      this.logger.error(
        'Domain re-check failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      await runner.release();
    }
  }
}
