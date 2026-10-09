import { describe, expect, it } from "vitest";
import {
  formatMinorAmount,
  majorToMinor,
  minorAmountPlain,
  minorUnitDigits,
  minorUnitScale,
} from "../money-format";

/**
 * The scale a currency's minor unit has is the one number every amount in this
 * system depends on. Get it wrong and the figure is either a hundred times too
 * large or a hundred times too small, in a message or a document the customer
 * keeps — so it is checked as text, which is where it becomes visible.
 */
describe("the minor unit of a currency", () => {
  it("hasTwoDigits_forACentStyleCurrency", () => {
    expect(minorUnitDigits("NGN")).toBe(2);
    expect(minorUnitScale("NGN")).toBe(100);
  });

  it("hasNoDigits_forACurrencyWithoutHundredths", () => {
    // Yen has no subunit: treating it as a cent-style currency is what turns
    // ¥1,500 into ¥150,000.
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitScale("JPY")).toBe(1);
  });

  it("ignoresTheCaseTheCodeWasWrittenIn", () => {
    expect(minorUnitDigits("jpy")).toBe(0);
    expect(minorUnitScale("Usd")).toBe(100);
  });

  it("fallsBackToTwoDigits_forACurrencyItHasNeverHeardOf", () => {
    // The safe default: the world's currencies are overwhelmingly cent-style,
    // and a wrong guess must not invent a scale for money already stored.
    expect(minorUnitDigits("XXX")).toBe(2);
  });
});

describe("an amount a person reads", () => {
  it("rendersWithTheCurrencysOwnSymbol", () => {
    expect(formatMinorAmount(150_000, "NGN")).toContain("1,500.00");
    expect(formatMinorAmount(150_000, "NGN")).toContain("₦");
  });

  it("dropsTheDecimalEntirely_forACurrencyThatHasNone", () => {
    expect(formatMinorAmount(1_500, "JPY")).not.toContain(".00");
    expect(formatMinorAmount(1_500, "JPY")).toContain("1,500");
  });

  it("printsPlainDigits_whenTheSentenceAlreadyNamesTheCurrency", () => {
    expect(minorAmountPlain(150_000, "NGN")).toBe("1,500.00");
    expect(minorAmountPlain(1_500, "JPY")).toBe("1,500");
  });
});

describe("a whole-unit figure read from a prompt", () => {
  it("multipliesByTheCurrencysScale", () => {
    expect(majorToMinor(50, "NGN")).toBe(5_000);
    expect(majorToMinor(50, "JPY")).toBe(50);
  });

  it("roundsRatherThanTruncating_theFloatingPointProduct", () => {
    // 19.99 * 100 is 1998.9999999999998; truncating it stores 19.98 for a price
    // the seller quoted as 19.99.
    expect(majorToMinor(19.99, "USD")).toBe(1_999);
    expect(majorToMinor(0.1 + 0.2, "NGN")).toBe(30);
  });
});
