/**
 * Normalises a Host header into a comparable hostname.
 *
 * `Shop.Example.com:3000` and `shop.example.com` are the same shop, so both
 * must reduce to the same key before a lookup can match. Getting this wrong is
 * how a storefront silently stops resolving in production.
 */
export function normalizeHostname(rawHost: string | undefined | null): string {
  if (!rawHost) return "";

  // Strip an IPv6 literal's brackets and any :port suffix. A bare IPv6 address
  // has many colons, so only split on the last one.
  let host = rawHost.trim().toLowerCase();
  if (host.startsWith("[")) {
    host = host.slice(1, host.indexOf("]") > 0 ? host.indexOf("]") : undefined);
  } else {
    const lastColon = host.lastIndexOf(":");
    if (lastColon > 0 && !host.slice(lastColon + 1).includes(":")) {
      host = host.slice(0, lastColon);
    }
  }

  return host.replace(/\.+$/, "");
}
