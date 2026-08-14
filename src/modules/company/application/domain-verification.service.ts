import { Injectable } from '@nestjs/common';
import { resolveCname } from 'node:dns/promises';

@Injectable()
export class DomainVerificationService {
  async verifyCname(hostname: string) {
    const expectedTarget = process.env.CUSTOM_DOMAIN_CNAME_TARGET?.trim();

    if (!expectedTarget) {
      return false;
    }

    try {
      const records = await resolveCname(hostname);
      const normalizedExpected = expectedTarget
        .toLowerCase()
        .replace(/\.$/, '');

      return records.some(
        (record) =>
          record.toLowerCase().replace(/\.$/, '') === normalizedExpected,
      );
    } catch {
      return false;
    }
  }
}
