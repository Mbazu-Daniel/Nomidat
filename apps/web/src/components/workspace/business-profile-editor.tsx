import { BusinessHandle } from "./business-handle";
import { useMemo, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { errorMessage, useApiResource, useSubmit } from "@/lib/use-api-resource";
import { readBusinessLogo } from "./business-logo";
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
  const logoFromProfile = profile?.logo ?? null;
  // A logo chosen in this session replaces the stored one without a round trip, so
  // "Remove logo" is a local edit the seller can still change their mind about.
  const [logoOverride, setLogo] = useState<string | null | undefined>(undefined);
  const logo = logoOverride === undefined ? logoFromProfile : logoOverride;
  const { busy, error: writeError, setError, submit } = useSubmit();
  const error = loaded.error || writeError;
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
                  logo,
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
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  // Reading the file is local work, not a write, so it gets its own
                  // error path rather than pretending to be a save.
                  try {
                    setLogo(await readBusinessLogo(file));
                  } catch (reason) {
                    setError(errorMessage(reason));
                  }
                }}
              />
            </label>
            {logo && (
              <button type="button" onClick={() => setLogo(null)}>
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
