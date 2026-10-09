import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { resolveActiveOrg } from "@/lib/active-org";
import { DASHBOARD_NAV, SETTINGS_NAV } from "@/lib/dashboard-nav";

export function OrgRedirect({ section }: { section: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    const target =
      [...DASHBOARD_NAV, SETTINGS_NAV].find((item) => item.section === section)?.to ?? "/$orgSlug";
    void resolveActiveOrg().then(({ signedIn, slug }) => {
      if (slug) void navigate({ to: target, params: { orgSlug: slug } });
      else if (signedIn) void navigate({ to: "/create-organization" });
      else void navigate({ to: "/login" });
    });
    // Nothing is written to, so there is no stale answer to discard: the redirect
    // happens once, and navigating twice to the same place is the router's problem.
  }, [navigate, section]);

  return (
    <div className="workspace-empty" role="status">
      Opening {section}…
    </div>
  );
}
