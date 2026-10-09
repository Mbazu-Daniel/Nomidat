import { AuthError, AuthField } from "./auth-shell";
import { ChoiceGroup, ImagePicker } from "./onboarding-fields";
import { downscaleImage } from "@/lib/browser-image";
import { BUSINESS_THEMES, BUSINESS_TYPES, EMPLOYEE_BANDS } from "./onboarding-options";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The business and profile steps of onboarding, split from `onboarding.tsx`
 * so both files stay under the 300-line limit. Each form owns only its markup;
 * the values and the submit action stay with the parent flow.
 */

export type BusinessField = "logo" | "businessName" | "businessType" | "employees" | "theme";
export type ProfileField = "avatar" | "firstName" | "lastName";

/**
 * The logo control for the business step.
 *
 * Not `ImagePicker`, which hands back a data URL and is used for the member
 * avatar. The avatar is stored inline on the profile; the logo goes to the bucket,
 * so this keeps the downsized Blob rather than a string that would have to be
 * turned back into bytes later. The preview is a local object URL, revoked when
 * the component goes away, so nothing is held after the step moves on.
 */
export function LogoPicker({
  onChange,
}: {
  onChange: (file: Blob | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
        {preview ? (
          <img src={preview} alt="Preview" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? "Change logo" : "Upload logo"}
        </button>
        <span>Optional · PNG, JPG or WebP, up to 5 MB</span>
        <AuthError message={error} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        disabled={busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            const blob = await downscaleImage(file);
            // The previous object URL is revoked here rather than on unmount alone:
            // a seller who changes their mind three times holds one preview, not
            // three, and each is a full-size image.
            setPreview((current) => {
              if (current) URL.revokeObjectURL(current);
              return URL.createObjectURL(blob);
            });
            onChange(blob);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not read that logo.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function BusinessStepForm(props: {
  logoLabel: React.ReactNode;
  businessName: string;
  businessType: string;
  employees: string;
  theme: string;
  slug: string;
  error: string;
  saving: boolean;
  onChange: (field: BusinessField, value: string) => void;
  onSubmit: () => void;
}) {
  const {
    logoLabel,
    businessName,
    businessType,
    employees,
    theme,
    slug,
    error,
    saving,
    onChange,
    onSubmit,
  } = props;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      {logoLabel}

      <AuthField
        label="Business name"
        required
        maxLength={100}
        autoComplete="organization"
        placeholder="e.g. Ada Stores"
        hint={businessName ? `Your workspace will be /${slug}` : undefined}
        value={businessName}
        onChange={(event) => onChange("businessName", event.target.value)}
      />

      <ChoiceGroup
        legend="Type of business"
        options={BUSINESS_TYPES}
        value={businessType}
        onChange={(value) => onChange("businessType", value)}
      />

      <ChoiceGroup
        legend="Team size"
        options={EMPLOYEE_BANDS}
        value={employees}
        onChange={(value) => onChange("employees", value)}
      />

      <ChoiceGroup
        legend="Theme"
        options={BUSINESS_THEMES}
        value={theme}
        onChange={(value) => onChange("theme", value)}
      />

      <AuthError message={error} />
      <Button type="submit" size="lg" disabled={saving || !businessName.trim()}>
        {saving ? "Creating your business…" : "Continue"}
      </Button>
    </form>
  );
}

export function ProfileStepForm(props: {
  avatar: string;
  firstName: string;
  lastName: string;
  error: string;
  saving: boolean;
  onChange: (field: ProfileField, value: string) => void;
  onSubmit: () => void;
}) {
  const { avatar, firstName, lastName, error, saving, onChange, onSubmit } = props;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <ImagePicker
        value={avatar}
        onChange={(value) => onChange("avatar", value)}
        label="Add a photo"
        hint="Optional · This is how your team sees you"
        fallback="person"
      />

      <div className="auth-field-grid">
        <AuthField
          label="First name"
          required
          maxLength={80}
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => onChange("firstName", event.target.value)}
        />
        <AuthField
          label="Last name"
          maxLength={80}
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => onChange("lastName", event.target.value)}
        />
      </div>

      <AuthError message={error} />
      <Button type="submit" size="lg" disabled={saving || !firstName.trim()}>
        {saving ? "Saving…" : "Finish"}
      </Button>
    </form>
  );
}
