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
import { getOrganizations } from "@/data/nomidat";
import { createApiRequest } from "@/lib/api";
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
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [active, setActive] = useState(section);
  const [status, setStatus] = useState("Loading your workspace…");
  const current = miniApp ? active : section;
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState(false);
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (miniApp) {
        const result = await createTelegramSession(window.Telegram?.WebApp);
        if (!result.ok) throw new Error(result.message);
      }
      const rows = await getOrganizations();
      if (cancelled) return;
      const saved = sessionStorage.getItem("nomidat.organization");
      setOrganizations(rows);
      setOrganizationId(rows.find((row) => row.id === saved)?.id ?? rows[0]?.id ?? "");
      setStatus(rows.length ? "" : "Create a business to start tracking your stock and sales.");
    }
    void load().catch((reason: Error) => {
      if (!cancelled) {
        setStatus(reason.message);
        setError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [miniApp]);
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    sessionStorage.setItem("nomidat.organization", organizationId);
    setCanWrite(false);
    void createApiRequest<{ role: string }>(`/organizations/${organizationId}/access`)
      .then(({ role }) => {
        if (!cancelled) setCanWrite(canWriteArea(role, current));
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setStatus(reason.message);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, current]);
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
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link to="/" className="workspace-brand">
          <span>n</span>nomidat<span className="workspace-brand-dot">.</span>
        </Link>
        <p className="workspace-eyebrow">YOUR BUSINESS, IN ORDER</p>
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
          {(creatingBusiness ||
            (!organizationId &&
              current !== "settings" &&
              !error &&
              organizations.length === 0 &&
              !status.startsWith("Loading"))) && (
            <CreateBusiness
              onCancel={organizationId ? () => setCreatingBusiness(false) : undefined}
              onCreated={(business) => {
                setOrganizations((rows) => [...rows, business]);
                setCanWrite(false);
                sessionStorage.setItem("nomidat.organization", business.id);
                setOrganizationId(business.id);
                setCreatingBusiness(false);
                setStatus("");
                setError(false);
              }}
            />
          )}
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
