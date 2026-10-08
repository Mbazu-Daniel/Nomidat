import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Register is the first step of onboarding.
 *
 * This route exists only so an old or shared `/register` link still lands
 * somewhere sensible. It used to redirect unconditionally, which combined with
 * onboarding's own guard produced a redirect loop back to /login and the form
 * could never be reached.
 */
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ to: "/onboarding", search: { step: undefined } });
  },
});
