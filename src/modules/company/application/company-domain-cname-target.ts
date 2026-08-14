const defaultCnameTarget = 'linksbuds.com';

function hostnameFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function normalizeHostname(value?: string | null) {
  if (!value) {
    return null;
  }

  const hostname = hostnameFromUrl(value.trim())
    .split('/')[0]
    ?.split(':')[0]
    ?.toLowerCase()
    .replace(/\.$/, '');

  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return null;
  }

  if (hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return null;
  }

  return hostname;
}

export function getCustomDomainCnameTarget() {
  return (
    normalizeHostname(process.env.CUSTOM_DOMAIN_CNAME_TARGET) ??
    normalizeHostname(process.env.PUBLIC_WEB_URL) ??
    defaultCnameTarget
  );
}
