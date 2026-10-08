import { describe, expect, it } from "vitest";
import {
  assertSafeWebhookUrl,
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../webhook-signing";

/**
 * The outbound webhook contract, from both ends.
 *
 * The URL check is the security boundary: a subscription URL is supplied by a
 * tenant, and the server fetches it. Without this a tenant points a subscription
 * at cloud metadata or a loopback service and reads the response back out of the
 * delivery log.
 *
 * The signature pair is the other half. Nomidat only sends, so nothing in the
 * codebase verifies — but a receiver has to, and the two functions must agree on
 * the canonical input or every delivery looks forged.
 */
describe("a subscription URL", () => {
  it("acceptsAnOrdinaryHttpsEndpoint", () => {
    expect(assertSafeWebhookUrl("https://hooks.example.com/nomidat").hostname).toBe(
      "hooks.example.com",
    );
  });

  it("refusesAPlaintextUrl", () => {
    // The body carries sale and invoice figures, so it must not cross the wire
    // in the clear even to an endpoint the tenant controls.
    expect(() => assertSafeWebhookUrl("http://hooks.example.com")).toThrow(/https/i);
  });

  it("refusesSomethingThatIsNotAUrlAtAll", () => {
    expect(() => assertSafeWebhookUrl("not a url")).toThrow();
  });

  it("refusesLoopbackAndMetadataAddresses", () => {
    // 169.254.169.254 is where a cloud instance's credentials live. Fetching it
    // on a tenant's behalf is the attack this exists to stop.
    for (const url of [
      "https://localhost/nomidat",
      "https://127.0.0.1/nomidat",
      "https://169.254.169.254/latest/meta-data",
      "https://metadata.google.internal/",
    ]) {
      expect(() => assertSafeWebhookUrl(url)).toThrow(/not reachable/i);
    }
  });

  it("refusesTheRestOfThePrivateRanges", () => {
    for (const url of [
      "https://10.0.0.5/nomidat",
      "https://172.16.0.1/nomidat",
      "https://192.168.1.1/nomidat",
    ]) {
      expect(() => assertSafeWebhookUrl(url)).toThrow(/not reachable/i);
    }
  });

  it("refusesCredentialsEmbeddedInTheUrl", () => {
    // Otherwise a delivery to `https://user:pass@…` sends the password to a host
    // the tenant chose, and it lands in their access logs.
    expect(() => assertSafeWebhookUrl("https://user:pass@hooks.example.com")).toThrow(
      /credentials/i,
    );
  });

  it("allowsAPublicAddressOnTheSameBlockedNameShape", () => {
    // The check must not be a naive string match: this host merely contains
    // "127.0.0.1" as a label and is perfectly reachable.
    expect(assertSafeWebhookUrl("https://127.0.0.1.example.com/nomidat").hostname).toBe(
      "127.0.0.1.example.com",
    );
  });
});

describe("the signature of a delivery", () => {
  const secret = generateWebhookSecret();
  const body = JSON.stringify({ event: "sale.created", data: { totalMinor: 450_000 } });

  it("isPrefixedSoItsShapeIsSelfDescribing", () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_/);
  });

  it("carriesTheTimestampAndTheSignature", () => {
    const header = signWebhookPayload(secret, body, 1_700_000_000);
    expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
  });

  it("isTheSameForTheSameBodyAndTimestamp", () => {
    // A retry must produce an identical signature; a receiver rejecting the
    // second attempt as forged would break redelivery.
    expect(signWebhookPayload(secret, body, 1_700_000_000)).toBe(
      signWebhookPayload(secret, body, 1_700_000_000),
    );
  });

  it("changesWhenTheBodyChangesByOneCharacter", () => {
    expect(signWebhookPayload(secret, body, 1_700_000_000)).not.toBe(
      signWebhookPayload(secret, `${body} `, 1_700_000_000),
    );
  });

  it("verifiesAgainstItsOwnSignature", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookPayload(secret, body, now);
    expect(verifyWebhookSignature(secret, body, header)).toBe(true);
  });

  it("refusesABodyThatWasAlteredInFlight", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookPayload(secret, body, now);
    // The figure a receiver acts on is the one that must be protected: a body
    // edited after signing would otherwise verify.
    expect(verifyWebhookSignature(secret, body.replace("450000", "999999"), header)).toBe(false);
  });

  it("refusesADifferentSecret", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookPayload(secret, body, now);
    expect(verifyWebhookSignature(generateWebhookSecret(), body, header)).toBe(false);
  });

  it("refusesAReplayedDeliveryOnceTheTimestampIsStale", () => {
    // A captured request is still a valid signature; the timestamp is what makes
    // it expire. This is the reason the timestamp is inside the signed input.
    const old = Math.floor(Date.now() / 1000) - 3_600;
    const header = signWebhookPayload(secret, body, old);
    expect(verifyWebhookSignature(secret, body, header)).toBe(false);
    expect(verifyWebhookSignature(secret, body, header, 7_200)).toBe(true);
  });

  it("refusesAMalformedHeaderRatherThanThrowing", () => {
    // A receiver must not crash on a hostile header, and must not accept one
    // that is missing its signature.
    for (const header of ["", "garbage", "t=abc,v1=zzz", "v1=deadbeef", "t=1700000000"]) {
      expect(verifyWebhookSignature(secret, body, header)).toBe(false);
    }
  });
});
