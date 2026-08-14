import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { Throttle } from '@nestjs/throttler';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import {
  analyticsEventDto,
  analyticsPresenceDto,
  type AnalyticsEventDto,
  type AnalyticsPresenceDto,
} from '../application/dto/link-page.dto';
import { LinkPageService } from '../application/link-page.service';

@Controller('public/link-pages')
export class PublicLinkPageController {
  constructor(private readonly linkPageService: LinkPageService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  sitemap() {
    return this.linkPageService.getPublicSitemap(
      process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
    );
  }

  @Get(':slug')
  @UseInterceptors(TransformResponseInterceptor)
  @Header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
  resolve(
    @Param('slug') slug: string,
    @Headers('x-linkbuds-host') requestedHost?: string,
    @Headers('x-forwarded-host') forwardedHost?: string,
    @Headers('host') host?: string,
  ) {
    return this.linkPageService.resolvePublic(
      requestedHost ?? forwardedHost ?? host,
      slug,
    );
  }

  @Post(':id/events')
  @UseInterceptors(TransformResponseInterceptor)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  recordEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(analyticsEventDto)) dto: AnalyticsEventDto,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return this.linkPageService.recordPublicEvent(id, dto, { headers });
  }

  @Post(':id/presence')
  @UseInterceptors(TransformResponseInterceptor)
  @Throttle({ default: { limit: 240, ttl: 60000 } })
  recordPresence(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(analyticsPresenceDto))
    dto: AnalyticsPresenceDto,
  ) {
    return this.linkPageService.recordPresence(id, dto.sessionId);
  }
}
