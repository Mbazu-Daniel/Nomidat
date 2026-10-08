import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The SEO fields a shop can set. Kept as an explicit list rather than accepting
 * whatever is in the stored blob, because each one has to be rendered somewhere
 * or the seller is editing a field that does nothing.
 */
export const SEO_FIELDS = [
  { key: "title", label: "Page title", multiline: false },
  { key: "description", label: "Meta description", multiline: true },
  { key: "keywords", label: "Keywords", multiline: false },
  { key: "ogImage", label: "Share image URL", multiline: false },
] as const;

export type SeoFieldKey = (typeof SEO_FIELDS)[number]["key"];

export function readSeo(seo: Record<string, unknown>): Record<SeoFieldKey, string> {
  const read = (key: SeoFieldKey) => {
    const value = seo[key];
    return typeof value === "string" ? value : "";
  };
  return {
    title: read("title"),
    description: read("description"),
    keywords: read("keywords"),
    ogImage: read("ogImage"),
  };
}

/** Only the known keys go back, so a stale field in storage is never resurrected. */
export function writeSeo(values: Record<SeoFieldKey, string>) {
  return Object.fromEntries(
    SEO_FIELDS.map(({ key }) => [key, values[key].trim()]).filter(([, value]) => value !== ""),
  );
}

export function StorefrontSeoFields({
  values,
  onChange,
  onSave,
  busy,
}: {
  values: Record<SeoFieldKey, string>;
  onChange: (next: Record<SeoFieldKey, string>) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <>
      {SEO_FIELDS.map((field) => (
        <div className="shop-admin-row" key={field.key}>
          <Label htmlFor={`seo-${field.key}`}>{field.label}</Label>
          {field.multiline ? (
            <Textarea
              id={`seo-${field.key}`}
              value={values[field.key]}
              maxLength={300}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
            />
          ) : (
            <Input
              id={`seo-${field.key}`}
              value={values[field.key]}
              maxLength={field.key === "keywords" ? 300 : 120}
              onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
            />
          )}
        </div>
      ))}
      <div className="shop-admin-inline">
        <Button type="button" onClick={onSave} disabled={busy}>
          Save search details
        </Button>
      </div>
      <p className="shop-admin-hint">
        This is what a link to your shop looks like in a search result and when it is shared.
      </p>
    </>
  );
}
