import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOutIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DASHBOARD_NAV, SETTINGS_NAV, isNavActive } from "@/lib/dashboard-nav";
import { forgetActiveOrg } from "@/lib/active-org";
import { clearSession } from "@/lib/session";
import { useOrgContext } from "./org-context";

function currentLabel(pathname: string, slug: string): string {
  const match = [...DASHBOARD_NAV, SETTINGS_NAV].find((item) =>
    isNavActive(item.to, slug, pathname),
  );
  return match?.label ?? "Workspace";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Header() {
  const { organization, user } = useOrgContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [busy, setBusy] = useState(false);
  const name = user.name ?? user.email ?? "Account";

  async function signOut() {
    setBusy(true);
    try {
      await clearSession();
    } finally {
      forgetActiveOrg();
      setBusy(false);
      void navigate({ to: "/" });
    }
  }

  return (
    <header className="workspace-topbar">
      <span className="workspace-breadcrumb">
        Workspace <span>/</span> {currentLabel(pathname, organization.slug)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            disabled={busy}
            className="flex items-center gap-3 rounded-full border border-[#e8ebef] py-1 pl-1 pr-3 hover:bg-[#fff6f1] disabled:opacity-60"
          >
            <Avatar className="size-8">
              {user.image ? <AvatarImage src={user.image} alt={name} /> : null}
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-[13px] font-medium text-[#242b35] sm:block">
              {name}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block truncate">{name}</span>
            {user.email ? (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/$orgSlug/settings" params={{ orgSlug: organization.slug }}>
              <SettingsIcon className="size-4" />
              Account settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/create-business">
              <PlusIcon className="size-4" />
              New business
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => void signOut()}>
            <LogOutIcon className="size-4" />
            {busy ? "Signing out…" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
