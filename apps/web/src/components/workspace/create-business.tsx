import { BusinessHandle } from "./business-handle";
import { useState } from "react";
import { IconBuildingStore, IconPhotoPlus } from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import { readBusinessLogo } from "./business-logo";
import type { CreateBusinessProps } from "./types/create-business.type";

export function CreateBusiness({ onCreated, onCancel }: CreateBusinessProps) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logo, setLogo] = useState("");
  const [slug, setSlug] = useState("");
  const [editedSlug, setEditedSlug] = useState(false);
  return (
    <form
      className="workspace-card business-create"
      onSubmit={async (event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const value = (key: string) => String(fields.get(key) ?? "").trim();
        setSaving(true);
        setError("");
        try {
          const business = await createApiRequest<{ id: string; name: string }>("/organizations", {
            method: "POST",
            body: JSON.stringify({
              name: value("name"),
              slug,
              logo: logo || undefined,
              businessDetails: {
                ownerName: value("ownerName"),
                phone: value("phone"),
                address: value("address"),
                shopNumber: value("shopNumber") || undefined,
                email: value("email") || undefined,
                registrationNumber: value("registrationNumber") || undefined,
              },
            }),
          });
          onCreated(business);
        } catch (reason) {
          setError((reason as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <header className="business-create-heading">
        <span className="business-create-icon">
          <IconBuildingStore size={26} />
        </span>
        <div>
          <h2>Make it your business</h2>
          <p>Add your shop details for a workspace and invoices that feel like yours.</p>
        </div>
      </header>
      <fieldset disabled={saving}>
        <div className="business-logo-row">
          <div className="business-logo-preview">
            {logo ? <img src={logo} alt="Your business logo" /> : <IconBuildingStore size={32} />}
          </div>
          <div>
            <label className="business-logo-upload">
              <IconPhotoPlus size={18} /> {logo ? "Change logo" : "Upload your logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={logoBusy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setLogoBusy(true);
                  setError("");
                  try {
                    setLogo(await readBusinessLogo(file));
                  } catch (reason) {
                    setError((reason as Error).message);
                  } finally {
                    setLogoBusy(false);
                  }
                }}
              />
            </label>
            <p>Optional · PNG, JPG or WebP, up to 5 MB</p>
            {logo && (
              <button type="button" onClick={() => setLogo("")}>
                Remove logo
              </button>
            )}
          </div>
        </div>
        <section className="business-form-section">
          <h3>Business details</h3>
          <div className="business-form-grid">
            <label>
              Business name
              <input
                autoFocus
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Ada Stores"
                onChange={(event) => {
                  if (!editedSlug)
                    setSlug(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                    );
                }}
              />
            </label>
            <label>
              Your name
              <input
                name="ownerName"
                required
                maxLength={100}
                autoComplete="name"
                placeholder="Full name"
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                required
                maxLength={40}
                autoComplete="tel"
                placeholder="e.g. +234 801 234 5678"
              />
            </label>
            <label>
              Email <small>Optional</small>
              <input
                name="email"
                type="email"
                maxLength={160}
                autoComplete="email"
                placeholder="hello@yourbusiness.com"
              />
            </label>
            <label className="business-field-wide">
              Shop address
              <input
                name="address"
                required
                maxLength={240}
                autoComplete="street-address"
                placeholder="Street, market or plaza, city and state"
              />
            </label>
            <label>
              Shop number <small>Optional</small>
              <input name="shopNumber" maxLength={40} placeholder="e.g. Shop B12" />
            </label>
            <label>
              Business registration number <small>Optional</small>
              <input name="registrationNumber" maxLength={80} placeholder="e.g. RC 1234567" />
            </label>
          </div>
        </section>
        <section className="business-form-section">
          <h3>Workspace handle</h3>
          <p>A unique name for your business on Nomidat. We’ve suggested one for you.</p>
          <label className="business-handle">
            Business handle
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setEditedSlug(true);
                setSlug(event.target.value);
              }}
              required
              pattern="[a-z0-9-]+"
              maxLength={100}
              placeholder="ada-stores"
            />
            <BusinessHandle value={slug} />
          </label>
        </section>
      </fieldset>
      <p className="business-invoice-note">
        Your logo, business name, address, phone and any provided email, shop or registration number
        will appear on invoices. Your personal name stays in your business profile.
      </p>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <footer className="workspace-actions business-create-actions">
        {onCancel && (
          <button
            type="button"
            className="workspace-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button className="workspace-primary" disabled={saving || logoBusy}>
          {saving ? "Creating…" : logoBusy ? "Preparing logo…" : "Create business"}
        </button>
      </footer>
    </form>
  );
}
