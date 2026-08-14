import { Injectable } from '@nestjs/common';
import { resolveCname } from 'node:dns/promises';
import { getCustomDomainCnameTarget } from './company-domain-cname-target';

@Injectable()
export class DomainVerificationService {
  async verifyCname(hostname: string) {
    const expectedTarget = getCustomDomainCnameTarget();

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
