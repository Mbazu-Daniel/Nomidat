import { Link, useRouterState } from "@tanstack/react-router";
import { SETTINGS_NAV, filterDashboardNav, isNavActive } from "@/lib/dashboard-nav";
import { OrganizationSwitcher } from "./organization-switcher";
import { useOrgContext } from "./org-context";

export function Sidebar() {
  const { organization, role, canAccess } = useOrgContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = canAccess(SETTINGS_NAV.permission)
    ? [...filterDashboardNav(role), SETTINGS_NAV]
    : filterDashboardNav(role);
  const slug = organization.slug;

  return (
    <aside className="workspace-sidebar">
      <Link to="/" className="workspace-brand">
        <span>n</span>nomidat<span className="workspace-brand-dot">.</span>
      </Link>
      <div className="mt-6 px-1">
        <OrganizationSwitcher />
      </div>
      <p className="workspace-eyebrow">YOUR BUSINESS, IN ORDER</p>
      <nav aria-label="Business navigation">
        {items.map((item) => (
          <Link
            key={item.section}
            to={item.to}
            params={{ orgSlug: slug }}
            className={isNavActive(item.to, slug, pathname) ? "active" : undefined}
          >
            <item.icon size={19} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="workspace-sidebar-note">
        <span className="workspace-dot" /> Made for your everyday business.
        <p>Stock, customers and money — all in one place.</p>
      </div>
    </aside>
  );
}
