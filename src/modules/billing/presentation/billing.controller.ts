import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { IncomingHttpHeaders } from 'node:http';
import { GetAuth } from 'src/shared/decorators/get-auth.decorator';
import { AdminApiKeyGuard } from 'src/shared/guards/admin-api-key.guard';
import { AuthGuard } from 'src/shared/guards/auth.guard';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { BillingService } from '../application/billing.service';
import { CouponsService } from '../application/coupons.service';
import {
  createCouponDto,
  redeemCouponDto,
  subscribeDto,
  updateCouponDto,
  type CreateCouponDto,
  type RedeemCouponDto,
  type SubscribeDto,
  type UpdateCouponDto,
} from '../application/dto/billing.dto';

/** Payer's IP for the gateway's anti-fraud: first hop behind the proxy. */
function clientIp(request: { headers: IncomingHttpHeaders; ip?: string }) {
  const forwarded = request.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(',')[0]
    ?.trim();

  return first || request.ip?.replace(/^::ffff:/, '') || '0.0.0.0';
}

@Controller('billing')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly couponsService: CouponsService,
  ) {}

  @Get()
  overview(@GetAuth() auth: AuthPayload) {
    return this.billingService.overview(auth);
  }

  /** History entry details: plan vs fee, card, receipt. */
  @Get('ledger/:id')
  ledgerEntry(
    @GetAuth() auth: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.billingService.ledgerEntry(auth, id);
  }

  /** Plan prices with the card fee included (what the payer will see charged). */
  @Get('quote')
  quote(@GetAuth() auth: AuthPayload) {
    return this.billingService.companyQuote(auth);
  }

  @Post('subscribe')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  subscribe(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(subscribeDto)) dto: SubscribeDto,
    @Req() request: { headers: IncomingHttpHeaders; ip?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billingService.subscribe(
      auth,
      dto,
      clientIp(request),
      idempotencyKey,
    );
  }

  @Post('cancel')
  cancel(@GetAuth() auth: AuthPayload) {
    return this.billingService.cancel(auth);
  }

  @Post('coupons/redeem')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  redeemCoupon(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(redeemCouponDto)) dto: RedeemCouponDto,
  ) {
    return this.couponsService.redeem(auth, dto);
  }
}

/** Catalog prices with the card fee, for the public plans dialog. */
@Controller('billing/quote/public')
@UseInterceptors(TransformResponseInterceptor)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class PublicQuoteController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  quote() {
    return this.billingService.quote(null);
  }
}

/** Public: gateways call this; authenticity comes from the provider signature. */
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':provider')
  @HttpCode(200)
  receive(
    @Param('provider') provider: string,
    @Req() request: { rawBody?: Buffer; headers: IncomingHttpHeaders },
  ) {
    return this.billingService.handleWebhook(
      provider,
      request.rawBody,
      request.headers,
    );
  }
}

/** Internal coupon management. Usage: docs/monetizacao.md */
@Controller('admin/coupons')
@UseGuards(AdminApiKeyGuard)
@UseInterceptors(TransformResponseInterceptor)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list() {
    return this.couponsService.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createCouponDto)) dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(updateCouponDto)) dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(code, dto);
  }
}
