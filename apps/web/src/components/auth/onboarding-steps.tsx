import { AuthError, AuthField } from "./auth-shell";
import { ChoiceGroup, ImagePicker } from "./onboarding-fields";
import { BUSINESS_THEMES, BUSINESS_TYPES, EMPLOYEE_BANDS } from "./onboarding-options";
import { Button } from "@/components/ui/button";

/**
 * The business and profile steps of onboarding, split from `onboarding.tsx`
 * so both files stay under the 300-line limit. Each form owns only its markup;
 * the values and the submit action stay with the parent flow.
 */

export type BusinessField = "logo" | "businessName" | "businessType" | "employees" | "theme";
export type ProfileField = "avatar" | "firstName" | "lastName";

export function BusinessStepForm(props: {
  logo: string;
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
    logo,
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
      <ImagePicker
        value={logo}
        onChange={(value) => onChange("logo", value)}
        label="Upload logo"
        hint="Optional · PNG, JPG or WebP, up to 5 MB"
        fallback="building"
      />

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
        legend="How many people work here?"
        options={EMPLOYEE_BANDS}
        value={employees}
        onChange={(value) => onChange("employees", value)}
        showHint={false}
      />

      <ChoiceGroup
        legend="Workspace theme"
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
        {saving ? "Finishing up…" : "Enter your workspace"}
      </Button>
    </form>
  );
}
