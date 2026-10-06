import { Injectable } from '@nestjs/common';
import { resolve4, resolveCname, resolveTxt } from 'node:dns/promises';
import { getCustomDomainCnameTarget } from './company-domain-cname-target';

export const VERIFICATION_RECORD_PREFIX = '_linkbuds';

function normalize(value: string) {
  return value.toLowerCase().replace(/\.$/, '');
}

const noRecords = (): string[] => [];

export interface DomainCheck {
  /** TXT `_linkbuds.<hostname>` contains the token: the company owns the domain. */
  ownership: boolean;
  /** Traffic reaches LinkBuds: CNAME to the target, or same IPs (apex/ALIAS). */
  routing: boolean;
}

@Injectable()
export class DomainVerificationService {
  async check(hostname: string, token: string): Promise<DomainCheck> {
    const [ownership, routing] = await Promise.all([
      this.hasTxtToken(hostname, token),
      this.pointsToLinkBuds(hostname),
    ]);

    return { ownership, routing };
  }

  private async hasTxtToken(hostname: string, token: string) {
    const records = await resolveTxt(
      `${VERIFICATION_RECORD_PREFIX}.${hostname}`,
    ).catch((): string[][] => []);

    return records.some((chunks) => chunks.join('').trim() === token);
  }

  private async pointsToLinkBuds(hostname: string) {
    const target = normalize(getCustomDomainCnameTarget());
    const cnames = await resolveCname(hostname).catch(noRecords);

    if (cnames.some((record) => normalize(record) === target)) {
      return true;
    }

    const [hostIps, targetIps] = await Promise.all([
      resolve4(hostname).catch(noRecords),
      resolve4(target).catch(noRecords),
    ]);

    return hostIps.length > 0 && hostIps.every((ip) => targetIps.includes(ip));
  }
}
