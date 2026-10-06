/**
 * Bare hostname from a Host header, URL or user input:
 * lowercase, without protocol, path, port and trailing dot.
 */
export function normalizeHostname(value?: string | null): string {
  return (
    (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .split('/')[0]
      ?.split(':')[0]
      ?.replace(/\.$/, '') ?? ''
  );
}
