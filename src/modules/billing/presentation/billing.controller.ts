import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
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
  checkoutDto,
  createCouponDto,
  redeemCouponDto,
  updateCouponDto,
  type CheckoutDto,
  type CreateCouponDto,
  type RedeemCouponDto,
  type UpdateCouponDto,
} from '../application/dto/billing.dto';

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

  @Post('checkout')
  checkout(
    @GetAuth() auth: AuthPayload,
    @Body(new ZodValidationPipe(checkoutDto)) dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billingService.checkout(auth, dto, idempotencyKey);
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

  /** Dev only: approves a fake-provider checkout. */
  @Post('fake/checkouts/:sessionId/complete')
  completeFakeCheckout(
    @GetAuth() auth: AuthPayload,
    @Param('sessionId') sessionId: string,
  ) {
    return this.billingService.completeFakeCheckout(auth, sessionId);
  }
}

/** Public: gateways call this; authenticity comes from the provider signature. */
@Controller('billing/webhooks')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':provider')
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
