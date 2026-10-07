import { paymentProvidersFactory } from '../billing.module';

describe('paymentProvidersFactory', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('disables checkout when no gateway is configured', () => {
    delete process.env.BILLING_PROVIDER;
    delete process.env.BILLING_LEGACY_PROVIDERS;

    const providers = paymentProvidersFactory();

    expect(providers.active).toBeNull();
    expect(providers.byName.size).toBe(0);
  });

  it('keeps legacy gateways for existing records without making them active', () => {
    delete process.env.BILLING_PROVIDER;
    process.env.BILLING_LEGACY_PROVIDERS = ' fake , ';

    const providers = paymentProvidersFactory();

    expect(providers.active).toBeNull();
    expect([...providers.byName.keys()]).toEqual(['fake']);
  });

  it('registers the active gateway once even if also listed as legacy', () => {
    process.env.BILLING_PROVIDER = 'fake';
    process.env.BILLING_LEGACY_PROVIDERS = 'fake';

    const providers = paymentProvidersFactory();

    expect(providers.active?.name).toBe('fake');
    expect(providers.byName.get('fake')).toBe(providers.active);
    expect(providers.byName.size).toBe(1);
  });

  it('fails fast on an unknown gateway name', () => {
    process.env.BILLING_PROVIDER = 'fake';
    process.env.BILLING_LEGACY_PROVIDERS = 'nope';

    expect(() => paymentProvidersFactory()).toThrow(
      'Unknown billing provider "nope"',
    );
  });
});
