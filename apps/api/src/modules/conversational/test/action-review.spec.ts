import { describe, expect, it } from "vitest";
import { getActionReview } from "../action-review";
import { parsedActionSchema } from "../action-schema";

/**
 * The confirmation a seller approves before money moves.
 *
 * The figures come from whatever the seller typed, so the sentence has to put
 * them in the business's own currency. Two ways it goes wrong, both silent: the
 * currency is ignored and a dollar amount is shown with a naira sign, or the
 * amount is scaled for a cent-style currency and a yen figure appears a hundred
 * times too large. The seller reads "50" and approves "5,000".
 */
function action(fields: Parameters<typeof parsedActionSchema.parse>[0]) {
  return parsedActionSchema.parse(fields);
}

describe("the review of an expense", () => {
  it("quotesItInTheBusinesssOwnCurrency", () => {
    const text = getActionReview(
      action({ intent: "record_expense", amountNaira: 50, description: "Fuel" }),
      "USD",
    );
    expect(text).toContain("$50.00");
    expect(text).not.toContain("₦");
  });

  it("quotesItInNaira_forANigerianBusiness", () => {
    const text = getActionReview(
      action({ intent: "record_expense", amountNaira: 5_000, description: "Transport" }),
      "NGN",
    );
    expect(text).toContain("₦5,000.00");
  });

  it("doesNotScaleACurrencyThatHasNoHundredths", () => {
    // 5,000 yen is 5,000 yen. Scaling it as if it were cent-style would show the
    // seller ¥500,000 — or rather ₦500,000.00 if the currency was ignored too.
    const text = getActionReview(
      action({ intent: "record_expense", amountNaira: 5_000, description: "Freight" }),
      "JPY",
    );
    expect(text).toContain("5,000");
    expect(text).not.toContain("500,000");
    expect(text).not.toContain("₦");
    expect(text).not.toContain(".00");
  });
});

describe("the review of a sale", () => {
  it("pricesEveryLineInTheBusinesssOwnCurrency", () => {
    const text = getActionReview(
      action({
        intent: "record_sale",
        items: [{ description: "Shirt", quantity: 2, unitPriceNaira: 450 }],
        taxNaira: 0,
        discountNaira: 0,
        paid: true,
        customerName: "Ada",
      }),
      "GBP",
    );
    expect(text).toContain("£450.00");
    expect(text).not.toContain("NGN");
    expect(text).not.toContain("₦");
  });

  it("showsAnAbsentAmountAsUnspecified_ratherThanNaN", () => {
    const text = getActionReview(
      action({ intent: "record_sale", quantity: 3, productName: "Soap" }),
      "NGN",
    );
    expect(text).toContain("total unspecified");
    expect(text).not.toContain("NaN");
  });
});

describe("a review that quotes no money", () => {
  it("isUnaffectedByTheCurrency", () => {
    const fields = { intent: "add_note", customerName: "Ada", description: "Call back" };
    expect(getActionReview(action(fields), "JPY")).toBe(
      getActionReview(action(fields), "USD"),
    );
    expect(getActionReview(action(fields), "USD")).toContain("Ada");
  });

  it("fallsBackRatherThanThrowing_forAnIntentWithNoReview", () => {
    expect(getActionReview(action({ intent: "check_balance" }), "NGN")).toBe(
      "Review the requested action.",
    );
  });
});