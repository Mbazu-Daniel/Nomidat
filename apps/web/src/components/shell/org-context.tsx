import { createContext, useContext, type ReactNode } from "react";
import type { OrganizationSummary } from "@/data/nomidat";
import type { SessionUser } from "@/lib/session";

export interface OrgContextValue {
  organization: OrganizationSummary & { slug: string };
  organizations: OrganizationSummary[];
  user: SessionUser;
  role: string;
  canAccess: (permission?: string) => boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgContextProvider({
  value,
  children,
}: {
  value: OrgContextValue;
  children: ReactNode;
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) throw new Error("useOrgContext must be used inside the organization layout");
  return value;
}
