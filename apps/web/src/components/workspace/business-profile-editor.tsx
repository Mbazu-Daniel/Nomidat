import { BusinessHandle } from "./business-handle";
import { useMemo, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { useApiResource, useSubmit } from "@/lib/use-api-resource";
import { downscaleImage } from "@/lib/browser-image";
import { uploadToBucket } from "@/lib/upload-to-bucket";
import type { BusinessDetails, BusinessProfile } from "./types/settings.type";

export function BusinessProfileEditor({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [handle, setHandle] = useState("");
  const path = `/organizations/${organizationId}`;
  const loaded = useApiResource<BusinessProfile>(path, undefined as unknown as BusinessProfile);
  const profile = loaded.data;
  // Metadata arrives as a JSON string from some rows and an object from others, so
  // it is parsed once here rather than at each of the four places that read it.
  const metadata = useMemo<Record<string, unknown>>(() => {
    const raw = profile?.metadata;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw ?? {};
  }, [profile]);
  const details = (metadata.businessDetails ?? {}) as BusinessDetails;
  // The organization's logo, resolved from the bucket by the API. Read separately
  // from the Better Auth row because `logo` there is the legacy inline value and
  // the storefront and invoice both render this one.
  // Re-fetched by bumping the revision rather than by a reload call, because a
  // reload would drop the form the seller is halfway through filling in.
  const [logoRevision, setLogoRevision] = useState(0);
  const loadedLogo = useApiResource<{ logoUrl: string | null }>(
    `/organizations/${organizationId}/logo`,
    undefined as unknown as { logoUrl: string | null },
    logoRevision,
  );
  const logoFromProfile = loadedLogo.data?.logoUrl ?? null;
  const [logoOverride, setLogo] = useState<string | null | undefined>(undefined);
  const logo = logoOverride === undefined ? logoFromProfile : logoOverride;
  const { busy, error: writeError, submit } = useSubmit();
  const error = loaded.error || loadedLogo.error || writeError;

  /**
   * Uploads the logo to the bucket and points the organization at it.
   *
   * Three steps, in this order: ask for a presigned URL, PUT the bytes to it,
   * then save the key. Saving the key last matters — the other order would leave
   * the organization pointing at an object that was never written, which shows as
   * a broken logo on the storefront and on every invoice.
   */
  async function uploadLogo(file: File | Blob, fileName: string) {
    await submit(async () => {
      // Same order as everywhere else: sign, upload the bytes, then save the key.
      // Saving first would leave the organization pointing at an object that was
      // never written.
      const { fileKey, publicUrl } = await uploadToBucket(
        organizationId,
        file,
        "business-logos",
        fileName,
      );

      const saved = await createApiRequest<{ logoUrl: string | null }>(
        `/organizations/${organizationId}/logo`,
        { method: "PATCH", body: JSON.stringify({ logoKey: fileKey }) },
      );

      // From the response rather than the upload, so the preview matches what the
      // storefront and the invoice will read back.
      setLogo(saved.logoUrl ?? publicUrl ?? null);
    });
    setLogoRevision((revision) => revision + 1);
  }
  function renderProfileForm() {
    if (!profile) return null;
    return (
      <form
        className="workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          const value = (key: string) => String(fields.get(key) ?? "").trim();
          const saved = await submit(async () => {
            await createApiRequest(path, {
              method: "PATCH",
              body: JSON.stringify({
                data: {
                  name: value("name"),
                  slug: value("slug"),
                  // No logo field. The logo is a bucket key, so it goes through the
                  // logo endpoint rather than Better Auth's update, which only
                  // knows the legacy inline column.
                  metadata: {
                    ...metadata,
                    businessDetails: Object.fromEntries(
                      [
                        "ownerName",
                        "phone",
                        "address",
                        "email",
                        "shopNumber",
                        "registrationNumber",
                      ].map((key) => [key, value(key) || undefined]),
                    ),
                  },
                },
              }),
            });
          });
          // The slug is in the address bar and in every link the shell renders, so
          // a renamed business needs a reload for those to catch up.
          if (saved) window.location.reload();
        }}
      >
        <fieldset disabled={busy || !canManage} className="settings-fieldset">
          <div className="business-logo-row">
            {logo && <img className="invoice-business-logo" src={logo} alt="Business logo" />}
            <label>
              Business logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Reset so choosing the same file twice still fires change.
                  event.target.value = "";
                  if (!file) return;
                  // Downsized in the browser before it goes up: a phone camera
                  // makes a 12 MP image, and a logo is never shown larger than
                  // 160px wide.
                  void submit(async () => {
                    const blob = await downscaleImage(file);
                    await uploadLogo(blob, file.name);
                  });
                }}
              />
            </label>
            {logo && (
              <button
                type="button"
                onClick={() => {
                  // null, not an empty string: the API reads null as "remove it"
                  // and an absent field as "leave it", so an empty string would
                  // quietly do neither.
                  void submit(async () => {
                    const saved = await createApiRequest<{ logoUrl: string | null }>(
                      `/organizations/${organizationId}/logo`,
                      { method: "PATCH", body: JSON.stringify({ logoKey: null }) },
                    );
                    setLogo(saved.logoUrl);
                  });
                  setLogoRevision((revision) => revision + 1);
                }}
              >
                Remove logo
              </button>
            )}
          </div>
          <div className="workspace-form-grid">
            <label>
              Business name
              <input name="name" defaultValue={profile.name} required maxLength={100} />
            </label>
            <label>
              Business handle
              <input
                name="slug"
                onChange={(event) => setHandle(event.target.value)}
                defaultValue={profile.slug}
                required
                pattern="[a-z0-9-]+"
                maxLength={100}
              />
              {handle && handle !== profile.slug && <BusinessHandle value={handle} />}
            </label>
            <label>
              Your name
              <input name="ownerName" defaultValue={details.ownerName} maxLength={100} />
            </label>
            <label>
              Phone number
              <input name="phone" type="tel" defaultValue={details.phone} maxLength={40} />
            </label>
            <label>
              Shop address
              <input name="address" defaultValue={details.address} maxLength={240} />
            </label>
            <label>
              Shop number
              <input name="shopNumber" defaultValue={details.shopNumber} maxLength={40} />
            </label>
            <label>
              Email (optional)
              <input name="email" type="email" defaultValue={details.email} maxLength={160} />
            </label>
            <label>
              Registration number (optional)
              <input
                name="registrationNumber"
                defaultValue={details.registrationNumber}
                maxLength={80}
              />
            </label>
          </div>
          {canManage && (
            <button className="workspace-primary" disabled={busy}>
              {busy ? "Saving…" : "Save business details"}
            </button>
          )}
        </fieldset>
        {!canManage && <p>Only owners and admins can change business details.</p>}
      </form>
    );
  }
  return (
    <section className="workspace-card settings-section">
      <h2>Business profile</h2>
      <p>Your shop details appear on invoice previews and downloads.</p>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!profile ? <p>Loading business details…</p> : renderProfileForm()}
    </section>
  );
}
