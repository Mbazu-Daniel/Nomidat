import { describe, expect, it } from "vitest";
import { formatMoney, minorToDecimalInput, minorUnitDigits, parseMoneyToMinor } from "@/lib/money";

/**
 * Money is stored as an integer count of minor units, so every conversion between
 * the stored form and what a person reads or types depends on the scale coming
 * from the currency rather than from a hardcoded hundred.
 *
 * These are the conversions that were written as `* 100` and `/ 100`, which are
 * correct for naira and quietly wrong for the eleven currencies
 * `MoneyPolicyService` accepts.
 */
describe("the minor-unit scale", () => {
  it("is two digits for a cent-style currency", () => {
    expect(minorUnitDigits("NGN")).toBe(2);
    expect(minorUnitDigits("USD")).toBe(2);
  });

  it("is zero for a currency with no hundredths", () => {
    // Yen and won have no minor unit, so 500 means ¥500, not ¥5.00. Dividing by
    // 100 here would show a fifth of the real amount.
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("KRW")).toBe(0);
  });

  it("ignores the case a currency was written in", () => {
    expect(minorUnitDigits("jpy")).toBe(0);
    expect(minorUnitDigits("ngn")).toBe(2);
  });
});

describe("reading an amount a person typed", () => {
  it("scalesByTheCurrencyRatherThanAFixedHundred", () => {
    expect(parseMoneyToMinor("450", "NGN")).toBe(45_000);
    // No hundredths, so the same 450 is 450 minor units — not 45,000.
    expect(parseMoneyToMinor("450", "JPY")).toBe(450);
  });

  it("padsAFractionToTheCurrencysDigits", () => {
    expect(parseMoneyToMinor("4.5", "NGN")).toBe(450);
  });

  it("refusesAFractionTheCurrencyCannotHold", () => {
    // Yen has no hundredths, so 4.5 yen is not an amount that can be stored.
    expect(parseMoneyToMinor("4.5", "JPY")).toBeNull();
    expect(parseMoneyToMinor("4.555", "NGN")).toBeNull();
  });

  it("refusesTextThatIsNotAnAmount", () => {
    // Returning null rather than NaN: NaN would be sent as the amount and the
    // server would have to decide what that means.
    expect(parseMoneyToMinor("", "NGN")).toBeNull();
    expect(parseMoneyToMinor("abc", "NGN")).toBeNull();
    expect(parseMoneyToMinor("1,000", "NGN")).toBeNull();
    expect(parseMoneyToMinor("-5", "NGN")).toBeNull();
  });

  it("roundTripsThroughTheInputField", () => {
    // What an amount reads as is what it must save back as. A field that showed a
    // rounded value would change the number on every visit.
    for (const minor of [0, 1, 450, 45_000, 123_456]) {
      expect(parseMoneyToMinor(minorToDecimalInput(minor, "NGN"), "NGN")).toBe(minor);
    }
  });

  it("roundTripsForACurrencyWithNoHundredths", () => {
    for (const minor of [0, 1, 450, 100_000]) {
      expect(parseMoneyToMinor(minorToDecimalInput(minor, "JPY"), "JPY")).toBe(minor);
    }
  });
});

describe("showing an amount", () => {
  it("dividesByTheCurrencysScale", () => {
    expect(formatMoney(450_000, "NGN")).toContain("4,500");
    // 100,000 minor yen is ¥100,000, not ¥1,000.
    expect(formatMoney(100_000, "JPY")).toContain("100,000");
  });

  it("namesTheCurrencyRatherThanAssumingOne", () => {
    expect(formatMoney(450_000, "USD")).toMatch(/\$|USD/);
    expect(formatMoney(450_000, "NGN")).toMatch(/₦|NGN/);
  });

  it("showsAZeroDecimalForACurrencyWithNoHundredths", () => {
    // A yen amount with ".00" on it reads as a different number than the yen
    // amount that was stored.
    expect(formatMoney(450, "JPY")).not.toContain(".00");
  });
});

describe("the amount a number field is given", () => {
  it("isAPlainDecimalWithNoSymbolOrSeparator", () => {
    // formatMoney cannot be used here: a symbol or a thousands separator would
    // not parse back.
    expect(minorToDecimalInput(45_000, "NGN")).toBe("450.00");
    expect(minorToDecimalInput(100_000, "JPY")).toBe("100000");
  });
});
