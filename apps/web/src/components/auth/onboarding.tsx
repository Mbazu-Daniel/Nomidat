import { useState } from "react";
import { AuthDivider, AuthError, AuthField, AuthShell, PasswordField } from "./auth-shell";
import {
  BusinessStepForm,
  LogoPicker,
  ProfileStepForm,
  type BusinessField,
  type ProfileField,
} from "./onboarding-steps";
import { TelegramSignIn } from "./telegram-sign-in";
import { BUSINESS_THEMES, BUSINESS_TYPES, EMPLOYEE_BANDS } from "./onboarding-options";
import { Button } from "@/components/ui/button";
import {
  authClient,
  createApiRequest,
  signInWithTelegramWidget,
  TELEGRAM_BOT_USERNAME,
} from "@/lib/api";
import { rememberActiveOrg, resolveOrgSlug } from "@/lib/active-org";
import { uploadToBucket } from "@/lib/upload-to-bucket";
import { IconBrandGoogle, IconCheck } from "@tabler/icons-react";

/**
 * Everything a new business needs before the workspace is usable: who it is,
 * what kind of trade it is in, and the person running it.
 *
 * Signing up and filling this in are one flow on purpose. Creating a user and
 * then stranding them on a half-built workspace is what produced "I signed up
 * and my account is empty", so the account only ever comes into being together
 * with a business.
 */

type Step = "account" | "business" | "profile";

const STEP_ORDER: readonly Step[] = ["account", "business", "profile"];

const TITLES: Record<Step, { title: string; subtitle: string }> = {
  account: {
    title: "Create your account",
    subtitle: "Start with an email and password. It takes a minute.",
  },
  business: {
    title: "Tell us about your business",
    subtitle: "This names your workspace and shapes the tools you get.",
  },
  profile: {
    title: "And who are you?",
    subtitle: "How you appear to your team and on your invoices.",
  },
};

/** Names outside a-z0-9 are dropped, so a fully non-Latin name can reduce to "". */
function toWorkspaceSlug(businessName: string) {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `business-${businessName.length}`;
}

export function Onboarding({ initialStep = "account" }: { initialStep?: Step }) {
  const [step, setStep] = useState<Step>(initialStep);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0].value);
  const [employees, setEmployees] = useState<string>(EMPLOYEE_BANDS[0].value);
  const [theme, setTheme] = useState<string>(BUSINESS_THEMES[0].value);
  // The chosen logo is held as a Blob, not a data URL: the Blob is what the
  // upload takes, and a URL would only have to be turned back into bytes.
  const [logoFile, setLogoFile] = useState<Blob | null>(null);
  const [logoError, setLogoError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatar, setAvatar] = useState("");

  const passwordTooShort = password.length > 0 && password.length < 8;
  const slug = toWorkspaceSlug(businessName);
  const stepIndex = STEP_ORDER.indexOf(step);

  /** Updates from the extracted step forms, which hold no state of their own. */
  function setBusinessField(field: BusinessField, value: string) {
    if (field === "businessName") setBusinessName(value);
    else if (field === "businessType") setBusinessType(value);
    else if (field === "employees") setEmployees(value);
    else setTheme(value);
  }

  function setProfileField(field: ProfileField, value: string) {
    if (field === "avatar") setAvatar(value);
    else if (field === "firstName") setFirstName(value);
    else setLastName(value);
  }

  /** Sends a user into their workspace once one exists. */
  async function enterWorkspace(id: string) {
    rememberActiveOrg(id);
    const orgSlug = await resolveOrgSlug(id);
    window.location.assign(orgSlug ? `/${orgSlug}` : "/");
  }

  /**
   * If the business call fails the user stays on the business step rather than
   * back on the account form, because re-submitting there would only report
   * "already registered" and lock them out of their own onboarding.
   */
  async function createAccount() {
    setSaving(true);
    setError("");
    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: firstName || "Owner",
        email,
        password,
      });
      if (signUpError) throw new Error(signUpError.message ?? "Could not create the account.");
      setStep("business");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the account.");
    } finally {
      setSaving(false);
    }
  }

  async function createBusiness() {
    setSaving(true);
    setError("");
    try {
      // The organization is created first and the logo uploaded second, because a
      // presigned URL is scoped to an organization and there is no organization
      // until this call returns. Uploading before it would mean signing a key
      // under a business that does not exist yet.
      const business = await createApiRequest<{ id: string }>("/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: businessName,
          slug,
          // These are onboarding answers, not invoice fields, so they live in
          // organization metadata rather than the business profile document.
          metadata: { businessType, employees, theme },
        }),
      });
      setOrganizationId(business.id);

      if (logoFile) {
        try {
          // The Blob carries no original file name, so it is named for the
          // organization rather than for something the seller never named.
          const { fileKey } = await uploadToBucket(
            business.id,
            logoFile,
            "business-logos",
            `logo.${logoFile.type.split("/")[1] ?? "png"}`,
          );
          await createApiRequest(`/organizations/${business.id}/logo`, {
            method: "PATCH",
            body: JSON.stringify({ logoKey: fileKey }),
          });
        } catch (reason) {
          // Shown but not fatal: the business now exists and the seller can set a
          // logo from settings. Blocking onboarding on a picture would be worse
          // than handing them an organization without one.
          setLogoError(reason instanceof Error ? reason.message : "Could not upload the logo.");
        }
      }

      setStep("profile");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the business.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    try {
      await createApiRequest(`/organizations/${organizationId}/business-profile/member`, {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName: lastName || undefined,
          avatar: avatar || null,
        }),
      });
      await enterWorkspace(organizationId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your profile.");
      setSaving(false);
    }
  }

  return (
    <AuthShell
      title={TITLES[step].title}
      subtitle={TITLES[step].subtitle}
      showcase={{
        headline: "Set up once. Everything else follows.",
        body: "Your workspace, storefront and invoices are all built from these answers.",
        points: [
          "Your logo and name on every invoice",
          "A storefront address of your own",
          "Stock and staff tools that fit your trade",
        ],
      }}
    >
      <ol className="flex items-center gap-2 text-xs text-muted-foreground">
        {STEP_ORDER.map((name, index) => (
          <li
            key={name}
            className="flex items-center gap-2 data-[active=true]:font-medium data-[active=true]:text-foreground data-[done=true]:text-success"
            data-active={name === step}
            data-done={index < stepIndex}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-muted font-semibold data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[done=true]:bg-success-soft data-[done=true]:text-success-dark">
              {index < stepIndex ? <IconCheck size={14} /> : index + 1}
            </span>
            <span className="capitalize">{name}</span>
          </li>
        ))}
      </ol>

      {step === "account" && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createAccount();
          }}
          noValidate
        >
          <AuthField
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourbusiness.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <PasswordField
            label="Password"
            required
            minLength={8}
            autoComplete="new-password"
            error={passwordTooShort ? "Use at least 8 characters." : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <AuthError message={error} />
          <Button type="submit" size="lg" disabled={saving || passwordTooShort}>
            {saving ? "Creating your account…" : "Continue"}
          </Button>

          <AuthDivider>or sign up with</AuthDivider>

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={saving}
            onClick={() => {
              // Google owns the redirect, so onboarding resumes at the business
              // step when it returns rather than asking for the email again.
              void authClient.signIn.social({
                provider: "google",
                callbackURL: `${window.location.origin}/onboarding?step=business`,
              });
            }}
          >
            <IconBrandGoogle />
            Google
          </Button>

          {TELEGRAM_BOT_USERNAME && (
            <TelegramSignIn
              botUsername={TELEGRAM_BOT_USERNAME}
              onVerified={async (data) => {
                await signInWithTelegramWidget(data);
                setStep("business");
              }}
            />
          )}
        </form>
      )}

      {step === "business" && (
        <BusinessStepForm
          logoLabel={<LogoPicker onChange={setLogoFile} />}
          businessName={businessName}
          businessType={businessType}
          employees={employees}
          theme={theme}
          slug={slug}
          error={error || logoError}
          saving={saving}
          onChange={setBusinessField}
          onSubmit={() => void createBusiness()}
        />
      )}

      {step === "profile" && (
        <ProfileStepForm
          avatar={avatar}
          firstName={firstName}
          lastName={lastName}
          error={error}
          saving={saving}
          onChange={setProfileField}
          onSubmit={() => void saveProfile()}
        />
      )}
    </AuthShell>
  );
}
