import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/shell/header";
import { OrgContextProvider } from "@/components/shell/org-context";
import { Sidebar } from "@/components/shell/sidebar";
import { rememberActiveOrg } from "@/lib/active-org";
import { CurrencyProvider } from "@/lib/currency-context";
import { getMoneyPolicy, FALLBACK_MONEY_POLICY } from "@/data/money";
import { createApiRequest } from "@/lib/api";
import { canAccess } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { getOrganizations } from "@/data/nomidat";
import { readThrough } from "@/lib/offline/snapshot-store";
import { useLoadedResource } from "@/lib/use-api-resource";

type Status = "loading" | "ready" | "unauthorized" | "unknown-org" | "error";

export const Route = createFileRoute("/$orgSlug")({ component: OrgLayout });

const UNAUTHORIZED = /session|authentication|sign in/i;

function OrgLayout() {
  const { orgSlug } = Route.useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);

  /*
   * Everything the shell needs, resolved in one load.
   *
   * Read-through, so a till that was opened while online can be reopened with no
   * network at all. The cache is for rendering only: it decides what the shell
   * shows, never what a write is allowed. Every mutation is re-authorised
   * server-side, so a stale role here cannot grant a permission the API would
   * refuse.
   */
  const loaded = useLoadedResource(
    async () => {
      const [session, organizations] = await Promise.all([
        readThrough("auth:session", () => getSession()),
        readThrough("auth:organizations", () => getOrganizations()),
      ]);

      if (!session?.user) return { kind: "unauthorized" } as const;

      const organization = organizations.find((row) => row.slug === orgSlug);
      if (!organization?.slug) return { kind: "unknown-org" } as const;

      const access = await readThrough(`org:access:${organization.id}`, () =>
        createApiRequest<{ userId: string; role: string }>(
          `/organizations/${organization.id}/access`,
        ),
      );
      rememberActiveOrg(organization.id);
      return {
        kind: "ready",
        value: {
          organization: { ...organization, slug: organization.slug },
          organizations,
          user: session.user,
          role: access.role,
          canAccess: (permission?: string) => canAccess(access.role, permission),
        },
      } as const;
    },
    [orgSlug, attempt],
    null,
  );

  const outcome = loaded.data;
  const status: Status = loaded.loading
    ? "loading"
    : outcome?.kind === "ready"
      ? "ready"
      : outcome?.kind === "unauthorized"
        ? "unauthorized"
        : outcome?.kind === "unknown-org"
          ? "unknown-org"
          : loaded.error && UNAUTHORIZED.test(loaded.error)
            ? "unauthorized"
            : "error";
  const value = outcome?.kind === "ready" ? outcome.value : null;
  const message = loaded.error;

  /*
   * The business currency, read through the offline cache so a reopened till
   * formats money in the right currency without a network. Until it arrives the
   * provider keeps the fallback, which is only ever wrong for a second.
   */
  const money = useLoadedResource(
    () => {
      const orgId = value?.organization.id;
      if (!orgId) return Promise.resolve(null);
      return readThrough(`org:money:${orgId}`, () => getMoneyPolicy(orgId));
    },
    [value?.organization.id],
    null,
    Boolean(value?.organization.id),
  );
  const currency = money.data?.currency ?? FALLBACK_MONEY_POLICY.currency;

  useEffect(() => {
    if (money.error) toast.error(`Could not load currency: ${money.error}`);
  }, [money.error]);

  useEffect(() => {
    if (status === "unauthorized") void navigate({ to: "/login", replace: true });
    if (status === "unknown-org") void navigate({ to: "/", replace: true });
  }, [status, navigate]);

  if (status === "ready" && value) {
    return (
      <OrgContextProvider value={value}>
        <CurrencyProvider currency={currency}>
          <div className="workspace-shell">
            <Sidebar />
            <div className="workspace-body">
              <Header />
              <main className="workspace-main">
                <Outlet />
              </main>
            </div>
          </div>
        </CurrencyProvider>
      </OrgContextProvider>
    );
  }

  if (status === "error") {
    return (
      <div className="workspace-empty" role="alert">
        {message}
        <p>
          <button
            type="button"
            className="workspace-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-empty" role={status === "loading" ? "status" : undefined}>
      {status === "loading" ? "Loading your workspace…" : ""}
    </div>
  );
}
