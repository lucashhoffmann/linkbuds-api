import { All, Controller, Req, Res } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import {
  getBetterAuth,
  toBetterAuthHeaders,
} from '../infra/better-auth.config';

interface BetterAuthRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body?: unknown;
  rawBody?: Buffer;
}

interface BetterAuthReply {
  status(statusCode: number): BetterAuthReply;
  header(name: string, value: string): BetterAuthReply;
  send(body?: unknown): unknown;
}

function resolveProtocol(headers: IncomingHttpHeaders): string {
  const forwardedProto = headers['x-forwarded-proto'];
  const value = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;

  return value?.split(',')[0]?.trim() || 'http';
}

function resolveRequestUrl(request: BetterAuthRequest): string {
  const host = request.headers.host ?? 'localhost';

  return new URL(
    request.url,
    `${resolveProtocol(request.headers)}://${host}`,
  ).toString();
}

function resolveRequestBody(request: BetterAuthRequest): BodyInit | undefined {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  if (request.rawBody) {
    return request.rawBody as BodyInit;
  }

  if (request.body === undefined || request.body === null) {
    return undefined;
  }

  if (typeof request.body === 'string') {
    return request.body;
  }

  return JSON.stringify(request.body);
}

@Controller('api/auth')
export class BetterAuthController {
  @All()
  handleRoot(@Req() request: BetterAuthRequest, @Res() reply: BetterAuthReply) {
    return this.handle(request, reply);
  }

  @All('*')
  handleWildcard(
    @Req() request: BetterAuthRequest,
    @Res() reply: BetterAuthReply,
  ) {
    return this.handle(request, reply);
  }

  private async handle(request: BetterAuthRequest, reply: BetterAuthReply) {
    const auth = await getBetterAuth();
    const body = resolveRequestBody(request);
    const authRequest = new Request(resolveRequestUrl(request), {
      method: request.method,
      headers: await toBetterAuthHeaders(request.headers),
      ...(body ? { body } : {}),
    });

    const response = await auth.handler(authRequest);
    const responseBody = response.status === 204 ? null : await response.text();

    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));

    return reply.send(responseBody);
  }
}
