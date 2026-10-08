import { timingSafeEqual } from "node:crypto";

/**
 * Compares a caller-supplied secret against the expected one in constant time.
 *
 * `===` on a string short-circuits at the first differing character, so the time
 * a rejection takes reveals how much of the guess was right. Every webhook and
 * shared-secret check in this API goes through here rather than comparing
 * directly, so no new endpoint can reintroduce the timing leak.
 *
 * A missing expectation is a configuration fault, not a match: an unset
 * `WHATSAPP_VERIFY_TOKEN` must reject every request rather than accept an absent
 * header, which is what `undefined === undefined` would have done.
 */
export function secretsMatch(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected) return false;
  if (typeof provided !== "string") return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on unequal lengths, and the length of a secret is not
  // itself secret, so the mismatch is decided before the comparison.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
