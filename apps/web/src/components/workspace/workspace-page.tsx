import { canWriteArea } from "./staff-permissions";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  IconLayoutDashboard,
  IconPackage,
  IconUsers,
  IconReceipt,
  IconWallet,
  IconFileInvoice,
  IconMessageCircle,
  IconPlug,
  IconChartBar,
} from "@tabler/icons-react";
import { getOrganizations, type OrganizationSummary } from "@/data/nomidat";
import { useApiResource, useLoadedResource } from "@/lib/use-api-resource";
import { createTelegramSession } from "@/lib/telegram-session";
import { ReportsPanel } from "./reports-panel";
import { ChannelsPanel } from "./channels-panel";
import { SettingsPanel } from "./settings-panel";
import { RecordsPanel } from "./records-panel";
import { ChatPanel } from "./chat-panel";
import { OverviewPanel } from "./overview-panel";
import { CreateBusiness } from "./create-business";
import type { WorkspaceProps } from "./types";

const navigation = [
  {
    section: "overview",
    label: "Overview",
    to: "/",
    icon: IconLayoutDashboard,
  },
  {
    section: "inventory",
    label: "Inventory",
    to: "/inventory",
    icon: IconPackage,
  },
  {
    section: "customers",
    label: "Contacts",
    to: "/customers",
    icon: IconUsers,
  },
  { section: "sales", label: "Sales", to: "/sales", icon: IconReceipt },
  { section: "expenses", label: "Expenses", to: "/expenses", icon: IconWallet },
  {
    section: "invoices",
    label: "Invoices",
    to: "/invoices",
    icon: IconFileInvoice,
  },
  {
    section: "chat",
    label: "Ask Nomidat",
    to: "/chat",
    icon: IconMessageCircle,
  },
  {
    section: "channels",
    label: "Connected channels",
    to: "/channels",
    icon: IconPlug,
  },
  { section: "reports", label: "Reports", to: "/reports", icon: IconChartBar },
  { section: "settings", label: "Settings", to: "/settings", icon: IconPlug },
] as const;

export function WorkspacePage({ section, miniApp = false }: WorkspaceProps) {
  const [organizationId, setOrganizationId] = useState("");
  const [active, setActive] = useState(section);
  const current = miniApp ? active : section;
  const [status, setStatus] = useState("Loading your workspace…");
  const [error, setError] = useState(false);
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const loaded = useLoadedResource(
    async () => {
      // Inside Telegram the shell needs a session before the API will answer, so
      // the exchange has to happen before the business list is asked for.
      if (miniApp) {
        const result = await createTelegramSession(window.Telegram?.WebApp);
        if (!result.ok) throw new Error(result.message);
      }
      return getOrganizations();
    },
    [miniApp],
    null,
  );
  const organizations: OrganizationSummary[] = loaded.data ?? [];
  const access = useApiResource<{ role: string }>(
    organizationId ? `/organizations/${organizationId}/access` : null,
    { role: "" },
  );

  // Remembered in sessionStorage rather than per-render state: a reload should land
  // the seller back in the business they were in, and only a sign-out clears it.
  useEffect(() => {
    if (!organizations.length || organizationId) return;
    const saved = sessionStorage.getItem("nomidat.organization");
    setOrganizationId(
      organizations.find((row) => row.id === saved)?.id ?? organizations[0]?.id ?? "",
    );
    setStatus(
      organizations.length ? "" : "Create a business to start tracking your stock and sales.",
    );
  }, [organizations, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    sessionStorage.setItem("nomidat.organization", organizationId);
  }, [organizationId]);

  useEffect(() => {
    if (loaded.error) {
      setStatus(loaded.error);
      setError(true);
    } else if (access.error) {
      setStatus(access.error);
      setError(true);
    }
  }, [loaded.error, access.error]);

  const canWrite = Boolean(organizationId) && canWriteArea(access.data.role, current);
  function renderBusinessSection() {
    if (current === "settings") return null;
    return current === "overview" ? (
      <OverviewPanel organizationId={organizationId} />
    ) : current === "reports" ? (
      <ReportsPanel organizationId={organizationId} />
    ) : current === "channels" ? (
      <ChannelsPanel organizationId={organizationId} canWrite={canWrite} />
    ) : current === "chat" ? (
      <ChatPanel organizationId={organizationId} canWrite={canWrite} />
    ) : (
      <RecordsPanel
        key={current}
        organizationId={organizationId}
        section={current}
        canWrite={canWrite}
      />
    );
  }
  function renderStatus() {
    return (
      status && (
        <div
          className={error ? "workspace-error" : "workspace-empty"}
          role={error ? "alert" : "status"}
        >
          {status}
          {error && (
            <p>
              <Link to="/login">Sign in</Link> or reload to try again.
            </p>
          )}
        </div>
      )
    );
  }
  function renderBusinessCreation() {
    if (
      !(
        creatingBusiness ||
        (!organizationId &&
          current !== "settings" &&
          !error &&
          organizations.length === 0 &&
          !status.startsWith("Loading"))
      )
    )
      return null;
    return (
      <CreateBusiness
        onCancel={organizationId ? () => setCreatingBusiness(false) : undefined}
        onCreated={(business) => {
          loaded.setData((rows) => [...(rows ?? []), business]);
          sessionStorage.setItem("nomidat.organization", business.id);
          setOrganizationId(business.id);
          setCreatingBusiness(false);
          setStatus("");
          setError(false);
        }}
      />
    );
  }
  function renderNavigation() {
    return (
      <nav aria-label="Business navigation">
        {navigation
          .filter((item) => item.section !== "settings")
          .map((item) =>
            miniApp ? (
              <button
                key={item.section}
                type="button"
                className={current === item.section ? "active" : ""}
                onClick={() => setActive(item.section)}
              >
                <item.icon size={19} />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.section}
                to={item.to}
                className={current === item.section ? "active" : ""}
              >
                <item.icon size={19} />
                {item.label}
              </Link>
            ),
          )}
        {miniApp ? (
          <button
            type="button"
            className={current === "settings" ? "active" : ""}
            onClick={() => setActive("settings")}
          >
            <IconPlug size={19} />
            Settings
          </button>
        ) : (
          <Link to="/settings" className={current === "settings" ? "active" : ""}>
            <IconPlug size={19} />
            Settings
          </Link>
        )}
      </nav>
    );
  }
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link to="/" className="workspace-brand">
          <span>n</span>nomidat<span className="workspace-brand-dot">.</span>
        </Link>
        <p className="workspace-eyebrow">YOUR BUSINESS, IN ORDER</p>
        {renderNavigation()}

        <div className="workspace-sidebar-note">
          <span className="workspace-dot" /> Made for your everyday business.
          <p>Stock, customers and money — all in one place.</p>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <span className="workspace-breadcrumb">
            Workspace <span>/</span> {navigation.find((item) => item.section === current)?.label}
          </span>
          <label className="workspace-business">
            Business
            <select
              aria-label="Selected business"
              value={creatingBusiness ? "__create__" : organizationId}
              onChange={(event) => {
                if (event.target.value === "__create__") {
                  setCreatingBusiness(true);
                  return;
                }
                setCreatingBusiness(false);
                setStatus("");
                setError(false);
                setOrganizationId(event.target.value);
              }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
              <option value="__create__">+ Create business</option>
            </select>
          </label>
        </header>
        <main className="workspace-main">
          {renderStatus()}
          {renderBusinessCreation()}
          {organizationId && !creatingBusiness && current !== "settings" && (
            <div key={organizationId}>{renderBusinessSection()}</div>
          )}
          {current === "settings" && !creatingBusiness && (
            <SettingsPanel key={organizationId || "account"} organizationId={organizationId} />
          )}
        </main>
      </div>
    </div>
  );
}
