import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  EMPTY_STOREFRONT_SETTINGS,
  getStorefrontDomains,
  getStorefrontSettings,
  updateStorefrontSettings,
  type StorefrontDomainRow,
  type StorefrontSettingsOverview,
  type StorefrontTemplate,
} from "@/data/storefront-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StorefrontDomainPanel } from "./storefront-domain-panel";
import { StorefrontSeoFields, readSeo, writeSeo, type SeoFieldKey } from "./storefront-seo-fields";
import "./storefront-admin.css";

const TEMPLATES: StorefrontTemplate[] = ["minimal", "catalog", "boutique"];

/**
 * The seller's control room for their shop: whether it is live, where it is
 * reachable, and how it looks.
 */
export function StorefrontSettingsPanel({ organizationId }: { organizationId: string }) {
  const [settings, setSettings] = useState<StorefrontSettingsOverview>(EMPTY_STOREFRONT_SETTINGS);
  const [domains, setDomains] = useState<StorefrontDomainRow[]>([]);
  const [css, setCss] = useState("");
  const [seo, setSeo] = useState<Record<SeoFieldKey, string>>({
    title: "",
    description: "",
    keywords: "",
    ogImage: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shopUrl, setShopUrl] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [next, rows] = await Promise.all([
        getStorefrontSettings(organizationId),
        getStorefrontDomains(organizationId),
      ]);
      setSettings(next);
      setCss(next.customCss ?? "");
      setSeo(readSeo(next.seo));
      setDomains(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load shop settings.");
    }
  }, [organizationId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  // The origin is only known in the browser, so the link is built after mount.
  useEffect(() => {
    if (settings.slug) setShopUrl(`${window.location.origin}/store/${settings.slug}`);
  }, [settings.slug]);

  async function save(patch: Parameters<typeof updateStorefrontSettings>[1]) {
    setBusy(true);
    try {
      const next = await updateStorefrontSettings(organizationId, patch);
      setSettings((current) => ({ ...current, ...next }));
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished() {
    const next = !settings.published;
    const ok = await save({ published: next });
    if (ok) toast.success(next ? "Your shop is live." : "Your shop is hidden.");
  }

  async function saveCss() {
    const ok = await save({ customCss: css });
    if (ok) toast.success("Stylesheet saved and sanitised.");
  }

  async function saveSeo() {
    const ok = await save({ seo: writeSeo(seo) });
    if (ok) toast.success("Search details saved.");
  }

  if (loading) return <p className="shop-admin-empty">Loading shop settings…</p>;

  if (error) {
    return (
      <div className="shop-admin-error" role="alert">
        {error}
        <Button type="button" variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <section className="shop-admin">
      <header className="shop-admin-head">
        <div>
          <h1>Shop</h1>
          <p className="shop-admin-note">
            Everything you sell is already here. Publishing puts it in front of customers.
          </p>
        </div>
        <Button type="button" onClick={togglePublished} disabled={busy}>
          {settings.published ? "Unpublish" : "Publish shop"}
        </Button>
      </header>

      <div className="shop-admin-status" data-live={settings.published}>
        {settings.published ? "Live" : "Not published"}
      </div>

      {settings.published && shopUrl && (
        <div className="shop-admin-row">
          <Label htmlFor="shop-url">Public address</Label>
          <div className="shop-admin-inline">
            <Input id="shop-url" readOnly value={shopUrl} />
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(shopUrl)}
            >
              Copy
            </Button>
            <a className="shop-admin-link" href={shopUrl} target="_blank" rel="noreferrer">
              Visit
            </a>
          </div>
          <p className="shop-admin-hint">
            Until a domain below is verified, this is the address to share.
          </p>
        </div>
      )}

      <div className="shop-admin-row">
        <Label htmlFor="template">Template</Label>
        <select
          id="template"
          className="shop-admin-select"
          value={settings.template}
          disabled={busy}
          onChange={(event) => void save({ template: event.target.value })}
        >
          {TEMPLATES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <StorefrontSeoFields
        values={seo}
        onChange={setSeo}
        onSave={() => void saveSeo()}
        busy={busy}
      />

      <div className="shop-admin-row">
        <Label htmlFor="custom-css">Custom stylesheet</Label>
        <textarea
          id="custom-css"
          className="shop-admin-css"
          value={css}
          spellCheck={false}
          placeholder="/* e.g. .storefront-price { letter-spacing: 0.02em; } */"
          onChange={(event) => setCss(event.target.value)}
        />
        <div className="shop-admin-inline">
          <Button type="button" onClick={saveCss} disabled={busy}>
            Save stylesheet
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setCss("");
              void save({ customCss: "" });
            }}
          >
            Clear
          </Button>
        </div>
        {/* Sellers should not be surprised when a rule disappears. */}
        <p className="shop-admin-hint">
          Unsafe rules — remote imports, expressions and scripts — are stripped before your shop
          ever loads them.
        </p>
      </div>

      <StorefrontDomainPanel
        organizationId={organizationId}
        domains={domains}
        onChanged={load}
        onBusy={setBusy}
      />
    </section>
  );
}
