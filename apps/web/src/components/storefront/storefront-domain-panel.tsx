import {
  addStorefrontDomain,
  verifyStorefrontDomain,
  type StorefrontDomainRow,
} from "@/data/storefront-admin";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A domain is served only after its DNS TXT record proves the seller controls
 * it, so claiming one is a two-step dance rather than a single save.
 */
export function StorefrontDomainPanel({
  organizationId,
  domains,
  onChanged,
  onBusy,
}: {
  organizationId: string;
  domains: StorefrontDomainRow[];
  onChanged: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [hostname, setHostname] = useState("");

  async function claim() {
    if (!hostname.trim()) return;
    onBusy(true);
    try {
      await addStorefrontDomain(organizationId, { hostname: hostname.trim() });
      setHostname("");
      await onChanged();
      toast.success("Domain added. Add the DNS TXT record, then verify.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not add that domain.");
    } finally {
      onBusy(false);
    }
  }

  async function verify(domain: StorefrontDomainRow) {
    onBusy(true);
    try {
      const result = await verifyStorefrontDomain(organizationId, domain.id);
      await onChanged();
      toast[result.verified ? "success" : "error"](
        result.verified
          ? `${domain.hostname} is verified.`
          : (result.reason ?? "The DNS record was not found yet."),
      );
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Verification failed.");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="shop-admin-row">
      <Label htmlFor="domain">Your own domain</Label>
      <div className="shop-admin-inline">
        <Input
          id="domain"
          value={hostname}
          placeholder="shop.yourbrand.com"
          onChange={(event) => setHostname(event.target.value)}
        />
        <Button type="button" onClick={() => void claim()} disabled={!hostname.trim()}>
          Add domain
        </Button>
      </div>
      <p className="shop-admin-hint">
        A domain is served only after its DNS TXT record proves you control it.
      </p>

      {domains.length > 0 && (
        <table className="shop-admin-domains">
          <thead>
            <tr>
              <th scope="col">Domain</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <tr key={domain.id}>
                <td>
                  {domain.hostname}
                  {domain.dns && (
                    <div className="shop-admin-dns">
                      <code>
                        {domain.dns.name} → {domain.dns.value}
                      </code>
                      <button
                        type="button"
                        className="shop-admin-copy"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            `${domain.dns?.name} TXT ${domain.dns?.value}`,
                          )
                        }
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </td>
                <td>
                  <span className="shop-admin-badge" data-verified={Boolean(domain.verifiedAt)}>
                    {domain.verifiedAt ? "Verified" : "Pending DNS"}
                  </span>
                </td>
                <td>
                  {!domain.verifiedAt && (
                    <Button type="button" variant="outline" onClick={() => void verify(domain)}>
                      Verify
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
