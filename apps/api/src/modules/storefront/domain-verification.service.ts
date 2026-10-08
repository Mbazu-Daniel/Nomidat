import { resolveTxt } from "node:dns/promises";
import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, isNotNull } from "@nomidat/db";
import { storefrontDomain } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { normalizeHostname } from "./hostname";

const DNS_LABEL = "_nomidat";

/** The TXT value a seller must publish. */
function expectedValue(token: string): string {
  return `nomidat-verify=${token}`;
}

/** The DNS record a seller must create, derived in one place so the API and the
 * settings page cannot disagree about which record to publish. */
export function dnsRecordFor(hostname: string, token: string) {
  return { name: `${DNS_LABEL}.${normalizeHostname(hostname)}`, value: expectedValue(token) };
}

/**
 * Hostname ownership checks. A seller may claim any hostname they type, so a
 * hostname is only served once DNS proves they control it. Without this check
 * anyone could point a popular domain at their own shop.
 */
@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);

  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  /**
   * A hostname is servable once its DNS TXT record carries this shop's token.
   * Until then the storefront falls back to its path slug, which is always safe.
   */
  async isVerified(organizationId: string, hostname: string): Promise<boolean> {
    const [row] = await this.db
      .select({ verifiedAt: storefrontDomain.verifiedAt })
      .from(storefrontDomain)
      .where(
        and(
          eq(storefrontDomain.organizationId, organizationId),
          eq(storefrontDomain.hostname, normalizeHostname(hostname)),
          isNotNull(storefrontDomain.verifiedAt),
        ),
      )
      .limit(1);

    return Boolean(row?.verifiedAt);
  }

  /**
   * Checks the TXT record and marks the hostname verified when it matches.
   * Returns the outcome rather than throwing, so the seller sees which step failed.
   */
  async verifyDomain(organizationId: string, hostname: string, token: string) {
    const recordName = `${DNS_LABEL}.${normalizeHostname(hostname)}`;

    let records: string[][];
    try {
      records = await resolveTxt(recordName);
    } catch (reason) {
      // A missing record and a failed lookup both mean "not yet".
      this.logger.warn(`DNS lookup failed for ${recordName}: ${String(reason)}`);
      return {
        verified: false,
        recordName,
        reason: "No TXT record found. Add it in DNS.",
        dns: { name: recordName, value: expectedValue(token) },
      };
    }

    const expected = `nomidat-verify=${token}`;
    const matched = records.some((parts) => parts.join("") === expected);

    if (!matched) {
      return {
        verified: false,
        recordName,
        reason: `TXT record does not contain ${expected}.`,
        dns: { name: recordName, value: expectedValue(token) },
      };
    }

    await this.db
      .update(storefrontDomain)
      .set({ verifiedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(storefrontDomain.organizationId, organizationId),
          eq(storefrontDomain.hostname, normalizeHostname(hostname)),
        ),
      );

    return { verified: true, recordName };
  }

  /** Validates a hostname before it is stored, so junk never enters the table. */
  assertClaimableHostname(hostname: string): string {
    const normalized = normalizeHostname(hostname);
    if (!normalized) throw new BadRequestException("A hostname is required.");
    if (!/^[a-z0-9.-]+$/.test(normalized)) {
      throw new BadRequestException("That hostname contains characters a domain cannot have.");
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
      throw new BadRequestException("An IP address cannot be used for a shop.");
    }
    if (normalized.split(".").length < 2) {
      throw new BadRequestException("That hostname cannot be used for a shop.");
    }
    return normalized;
  }
}
