import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaymentProvider } from "./payment-provider";

/** Every provider the app knows about, keyed by its stable code. */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(providers: PaymentProvider[]) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: PaymentProvider): void {
    this.providers.set(provider.code, provider);
  }

  get(code: string): PaymentProvider {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new NotFoundException(`No payment provider is registered for "${code}".`);
    }
    return provider;
  }

  /** Providers that can actually settle in the given currency. */
  getForCurrency(currency: string): PaymentProvider[] {
    return [...this.providers.values()].filter((provider) =>
      provider.supportedCurrencies.includes(currency.toUpperCase()),
    );
  }

  getAll(): PaymentProvider[] {
    return [...this.providers.values()];
  }

  assertSupports(provider: PaymentProvider, capability: keyof PaymentProvider["capabilities"]) {
    if (!provider.capabilities[capability]) {
      throw new BadRequestException(
        `${provider.displayName} does not support ${String(capability)} payments.`,
      );
    }
  }

  /** What the client is allowed to offer, so it never presents an unsupported method. */
  describe() {
    return this.getAll().map((provider) => ({
      code: provider.code,
      displayName: provider.displayName,
      capabilities: provider.capabilities,
      supportedCurrencies: [...provider.supportedCurrencies],
    }));
  }
}
