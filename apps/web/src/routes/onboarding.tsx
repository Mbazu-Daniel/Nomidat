import { Onboarding } from "@/components/auth/onboarding";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveActiveOrg } from "@/lib/active-org";

/**
 * Sign-up and first-business setup in one flow.
 *
 * The first step IS the sign-up form, so this route is reachable while signed
 * out. It previously bounced signed-out visitors to /login, and because /register
 * pointed here, pressing "Register now" walked straight back to the login page —
 * which read as a flicker rather than as a routing mistake.
 *
 * `?step=business` is where a Google or Telegram return lands, since those
 * providers own their own redirect and cannot be chained onto the account form.
 * That step needs a session, so asking for it while signed out drops back to the
 * account step rather than to /login.
 */
export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    step: search.step === "business" ? ("business" as const) : undefined,
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { slug } = await resolveActiveOrg();
    // Someone who already has a business does not need onboarding.
    if (slug) throw redirect({ to: "/$orgSlug", params: { orgSlug: slug } });
  },
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const { step } = Route.useSearch();
  // The business step is only reachable with a session. Guarding here rather
  // than redirecting means a stale ?step=business link lands on the account
  // form instead of bouncing to /login.
  return <Onboarding initialStep={step === "business" ? "business" : "account"} />;
}
