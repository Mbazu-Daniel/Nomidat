const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInvoiceMoney(kobo: number) {
  return currency.format(kobo / 100);
}
