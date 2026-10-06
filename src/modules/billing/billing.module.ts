import { Module } from '@nestjs/common';
import { BillingScheduler } from './application/billing-scheduler';
import { BillingService } from './application/billing.service';
import { CouponsService } from './application/coupons.service';
import { PAYMENT_PROVIDER } from './application/payment-provider';
import { AsaasPaymentProvider } from './infra/asaas-payment.provider';
import { FakePaymentProvider } from './infra/fake-payment.provider';
import {
  AdminCouponsController,
  BillingController,
  BillingWebhookController,
  PublicQuoteController,
} from './presentation/billing.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingCheckoutEntity } from './domain/entities/billing-checkout.entity';
import { CouponRedemptionEntity } from './domain/entities/coupon-redemption.entity';
import { CouponEntity } from './domain/entities/coupon.entity';
import { IdempotencyKeyEntity } from './domain/entities/idempotency-key.entity';
import { LedgerEntryEntity } from './domain/entities/ledger-entry.entity';
import { SubscriptionEntity } from './domain/entities/subscription.entity';
import { WebhookEventEntity } from './domain/entities/webhook-event.entity';

/**
 * BILLING_PROVIDER picks the gateway adapter. Unset = billing disabled
 * (checkout answers BILLING_NOT_CONFIGURED); coupons keep working.
 * Add a real gateway: implement PaymentProvider and map its name here.
 */
function paymentProviderFactory() {
  const name = process.env.BILLING_PROVIDER?.trim();

  if (name === 'asaas') {
    return AsaasPaymentProvider.fromEnv();
  }

  if (name === 'fake') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BILLING_PROVIDER=fake is not allowed in production');
    }

    return new FakePaymentProvider();
  }

  if (name) {
    throw new Error(`Unknown BILLING_PROVIDER "${name}"`);
  }

  return null;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CouponEntity,
      CouponRedemptionEntity,
      SubscriptionEntity,
      BillingCheckoutEntity,
      LedgerEntryEntity,
      IdempotencyKeyEntity,
      WebhookEventEntity,
    ]),
  ],
  controllers: [
    BillingController,
    PublicQuoteController,
    BillingWebhookController,
    AdminCouponsController,
  ],
  providers: [
    BillingService,
    BillingScheduler,
    CouponsService,
    { provide: PAYMENT_PROVIDER, useFactory: paymentProviderFactory },
  ],
})
export class BillingModule {}
