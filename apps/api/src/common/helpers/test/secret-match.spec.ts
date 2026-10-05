import { describe, expect, it } from "vitest";
import { secretsMatch } from "../secret-match";

/**
 * The invariant is that an unset expectation rejects everything, including an
 * absent header. `undefined === undefined` is how an unconfigured deployment
 * ends up accepting every webhook sent to it.
 */
describe("secret comparison", () => {
  it("accepts_theSecret_whenItMatchesExactly", () => {
    expect(secretsMatch("s3cr3t", "s3cr3t")).toBe(true);
  });

  it("rejects_aDifferentSecret_evenWhenOnlyTheLastCharacterDiffers", () => {
    // The case === gets wrong: it returns on the first differing byte, so a
    // longer correct prefix is measurably slower to reject.
    expect(secretsMatch("s3cr3t", "s3cr3T")).toBe(false);
  });

  it("rejects_everyRequest_whenNoSecretIsConfigured", () => {
    expect(secretsMatch("anything", undefined)).toBe(false);
    // An absent header against an absent expectation must not read as a match.
    expect(secretsMatch(undefined, undefined)).toBe(false);
  });

  it("rejects_anAbsentHeader_evenWhenASecretIsConfigured", () => {
    expect(secretsMatch(undefined, "s3cr3t")).toBe(false);
  });

  it("rejects_aSecretOfADifferentLength_ratherThanThrowing", () => {
    // timingSafeEqual throws on unequal buffer lengths; the comparison has to
    // decide this before reaching it.
    expect(secretsMatch("short", "a-much-longer-secret")).toBe(false);
  });

  it("treats_aUnicodeSecretAsBytes_notCharacters", () => {
    // "é" is two UTF-8 bytes, so a char-length check would misjudge equality.
    expect(secretsMatch("pássw0rd", "pássw0rd")).toBe(true);
    expect(secretsMatch("pássw0rd", "password")).toBe(false);
  });
});