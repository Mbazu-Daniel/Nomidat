const proofPoints = [
  "Offline-capable POS",
  "Paystack payments",
  "Multi-channel storefront",
  "Inventory ledger",
  "Invoices & quoting",
];

/**
 * The reference design shows a wall of customer logos here. We have no paying
 * customers yet, and inventing them would be a lie on the page, so this states
 * what the product actually does instead.
 */
export function TrustStrip() {
  return (
    <div className="border-y border-border/60 bg-card/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <p className="text-center text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Everything a seller needs, in one place
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {proofPoints.map((point) => (
            <li
              key={point}
              className="flex items-center gap-2 text-sm font-medium text-foreground/80"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
