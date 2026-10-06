import { normalizeHostname } from 'src/shared/utils/hostname';

// ponytail: placeholder until the official domain is confirmed; set CUSTOM_DOMAIN_CNAME_TARGET in production.
const defaultCnameTarget = 'linkbuds.com';

function publicHostname(value?: string | null) {
  const hostname = normalizeHostname(value);

  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost')
  ) {
    return null;
  }

  if (hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return null;
  }

  return hostname;
}

export function getCustomDomainCnameTarget() {
  return (
    publicHostname(process.env.CUSTOM_DOMAIN_CNAME_TARGET) ??
    publicHostname(process.env.PUBLIC_WEB_URL) ??
    defaultCnameTarget
  );
}
