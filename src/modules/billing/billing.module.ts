import { Module } from '@nestjs/common';
import { BillingScheduler } from './application/billing-scheduler';
import { BillingService } from './application/billing.service';
import { CouponsService } from './application/coupons.service';
import {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  type PaymentProviders,
} from './application/payment-provider';
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

function buildProvider(name: string): PaymentProvider {
  if (name === 'asaas') {
    return AsaasPaymentProvider.fromEnv();
  }

  if (name === 'fake') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Billing provider "fake" is not allowed in production');
    }

    return new FakePaymentProvider();
  }

  throw new Error(`Unknown billing provider "${name}"`);
}

/**
 * BILLING_PROVIDER = gateway for new checkouts. Unset = checkout disabled
 * (BILLING_NOT_CONFIGURED); coupons keep working.
 * BILLING_LEGACY_PROVIDERS = comma list of former gateways kept configured
 * until their subscriptions end (webhooks, cancel, renewals, receipts).
 * Add a real gateway: implement PaymentProvider and map its name above.
 */
export function paymentProvidersFactory(): PaymentProviders {
  const active = process.env.BILLING_PROVIDER?.trim() || null;
  const legacy = (process.env.BILLING_LEGACY_PROVIDERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const byName = new Map(
    [...new Set([...(active ? [active] : []), ...legacy])].map((name) => [
      name,
      buildProvider(name),
    ]),
  );

  return { active: active ? byName.get(active)! : null, byName };
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
    { provide: PAYMENT_PROVIDERS, useFactory: paymentProvidersFactory },
  ],
})
export class BillingModule {}
