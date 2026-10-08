import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Rejects URLs that would let a tenant make the server fetch internal services.
 *
 * This is the single most important check in the outbound webhook feature: the URL
 * is attacker-controlled, and without this a tenant could point a subscription at
 * 169.254.169.254 or 127.0.0.1 and read the response through delivery logs.
 *
 * Hostnames are checked rather than resolved addresses on purpose — resolving here
 * would leave a DNS-rebinding window between validation and the actual request.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
]);

export function assertSafeWebhookUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid URL, including https://");
  }

  if (url.protocol !== "https:") {
    throw new Error("Webhook endpoints must use https.");
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("That address is not reachable from the internet.");
  }

  // Any literal address in a private, loopback, link-local or reserved range.
  if (isPrivateAddress(host)) {
    throw new Error("That address is not reachable from the internet.");
  }

  if (url.username || url.password) {
    throw new Error("Credentials are not allowed in a webhook URL.");
  }

  return url;
}

function isPrivateAddress(host: string): boolean {
  if (host.startsWith("[")) return true; // any bracketed IPv6 literal
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;

  const [a, b] = ipv4.slice(1).map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** Per-subscription secret used to sign the delivery body. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/**
 * The signature a receiver verifies: `t=<unix>,v1=<hmac>` over `${timestamp}.${body}`.
 * Including the timestamp is what stops a captured delivery being replayed later.
 */
export function signWebhookPayload(secret: string, body: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300,
): boolean {
  // Split on the first "=" only: a base64url or hex signature never contains one,
  // but the timestamp is compared as a number and must not be re-serialised, or a
  // valid header would never match a fresh signature.
  const parts = new Map(
    header.split(",").map((part) => {
      const separator = part.indexOf("=");
      return [part.slice(0, separator), part.slice(separator + 1)];
    }),
  );

  const timestamp = Number(parts.get("t"));
  const provided = parts.get("v1");
  if (!Number.isFinite(timestamp) || !provided) return false;

  // Reject stale deliveries so a captured request cannot be replayed indefinitely.
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  // Compare only the HMAC, in constant time, over the same canonical input.
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}
