import { Injectable } from '@nestjs/common';
import { lookup as dnsLookup } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';

export type LinkPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

const timeoutMs = 5000;
const maxBytes = 512 * 1024;
const maxRedirects = 3;

// Server-side fetch of a user URL: never reach loopback/private/link-local (SSRF).
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is matched by BlockList against the IPv4 rules.
const blockedRanges = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedRanges.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedRanges.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  return (
    family !== 0 &&
    !blockedRanges.check(address, family === 4 ? 'ipv4' : 'ipv6')
  );
}

// Validates the address actually connected to, so DNS rebinding can't slip through.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, list) => {
    if (error) return callback(error, '', 0);
    if (!list.length || list.some((item) => !isPublicAddress(item.address))) {
      return callback(new Error('blocked address'), '', 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

function request(url: URL): Promise<IncomingMessage> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    return Promise.reject(new Error('blocked address'));
  }

  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, {
      lookup: safeLookup,
      timeout: timeoutMs,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; LinkBudsBot/1.0)',
        accept: 'text/html,application/xhtml+xml',
        'accept-encoding': 'identity',
      },
    });
    req.on('response', resolve);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function readHtml(response: IncomingMessage) {
  const contentType = response.headers['content-type'] ?? '';
  if (!/html/i.test(contentType)) {
    response.destroy();
    throw new Error('not html');
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const buffer = chunk as Buffer;
    chunks.push(buffer);
    size += buffer.length;
    // OG tags live in <head>: the first chunk of the page is enough.
    if (size >= maxBytes) {
      response.destroy();
      break;
    }
  }

  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8';
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  return decoder.decode(Buffer.concat(chunks));
}

async function fetchHtml(startUrl: string) {
  let url = new URL(startUrl);
  for (let redirects = 0; ; redirects += 1) {
    const response = await request(url);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;

    if (status >= 300 && status < 400 && location) {
      response.resume();
      url = new URL(location, url);
      if (
        redirects >= maxRedirects ||
        !['http:', 'https:'].includes(url.protocol)
      ) {
        throw new Error('bad redirect');
      }
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      throw new Error(`status ${status}`);
    }

    return { html: await readHtml(response), url };
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function clean(value: string | undefined, max: number) {
  const text = decodeEntities(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, max) : null;
}

// ponytail: regex over <meta> tags, not a DOM parser; enough for OG/Twitter tags.
export function parseLinkPreview(html: string, baseUrl: URL): LinkPreview {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
    )) {
      attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]);
    }
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = attrs.get('content');
    if (key && content && !meta.has(key)) meta.set(key, content);
  }

  const pageTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  const rawImage =
    meta.get('og:image') ??
    meta.get('og:image:url') ??
    meta.get('og:image:secure_url') ??
    meta.get('twitter:image');
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      const resolved = new URL(decodeEntities(rawImage.trim()), baseUrl);
      if (['http:', 'https:'].includes(resolved.protocol)) {
        imageUrl = resolved.toString();
      }
    } catch {
      imageUrl = null;
    }
  }

  return {
    title: clean(
      meta.get('og:title') ?? meta.get('twitter:title') ?? pageTitle,
      120,
    ),
    description: clean(
      meta.get('og:description') ??
        meta.get('twitter:description') ??
        meta.get('description'),
      300,
    ),
    imageUrl,
  };
}

@Injectable()
export class LinkPreviewService {
  async fetch(url: string): Promise<LinkPreview> {
    try {
      const { html, url: finalUrl } = await fetchHtml(url);
      return parseLinkPreview(html, finalUrl);
    } catch (cause) {
      throw new AppException(ERROR_CODES.LINK_PAGE_PREVIEW_UNAVAILABLE, {
        cause,
      });
    }
  }
}
