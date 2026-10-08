import { createContext, useContext } from "react";

/**
 * The business's currency, resolved once at the organization layout. Components
 * read it from here rather than threading it through props, so no display code
 * can fall back to a hardcoded country.
 */
const CurrencyContext = createContext<string>("NGN");

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): string {
  return useContext(CurrencyContext);
}
