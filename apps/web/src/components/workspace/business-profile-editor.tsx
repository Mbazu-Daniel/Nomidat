import { BusinessHandle } from "./business-handle";
import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
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
  const [profile, setProfile] = useState<BusinessProfile>();
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [details, setDetails] = useState<BusinessDetails>({});
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/organizations/${organizationId}`;
  useEffect(() => {
    let cancelled = false;
    void createApiRequest<BusinessProfile>(path)
      .then((result) => {
        if (cancelled) return;
        const data =
          typeof result.metadata === "string"
            ? JSON.parse(result.metadata)
            : (result.metadata ?? {});
        setProfile(result);
        setMetadata(data);
        setDetails(data.businessDetails ?? {});
        setLogo(result.logo ?? null);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return (
    <section className="workspace-card settings-section">
      <h2>Business profile</h2>
      <p>Your shop details appear on invoice previews and downloads.</p>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!profile ? (
        <p>Loading business details…</p>
      ) : (
        <form
          className="workspace-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const value = (key: string) => String(fields.get(key) ?? "").trim();
            setBusy(true);
            setError("");
            try {
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
              window.location.reload();
            } catch (reason) {
              setError((reason as Error).message);
              setBusy(false);
            }
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
                    setBusy(true);
                    setError("");
                    try {
                      setLogo(await readBusinessLogo(file));
                    } catch (reason) {
                      setError((reason as Error).message);
                    } finally {
                      setBusy(false);
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
      )}
    </section>
  );
}
