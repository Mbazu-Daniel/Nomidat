import { getOrganizations } from "@/data/nomidat";

const ACTIVE_ORG_KEY = "nomidat.organization";

export function rememberActiveOrg(organizationId: string) {
  sessionStorage.setItem(ACTIVE_ORG_KEY, organizationId);
}

export function forgetActiveOrg() {
  sessionStorage.removeItem(ACTIVE_ORG_KEY);
}

export interface ActiveOrgResolution {
  signedIn: boolean;
  slug: string | null;
}

export async function resolveActiveOrg(): Promise<ActiveOrgResolution> {
  try {
    const rows = await getOrganizations();
    const saved = sessionStorage.getItem(ACTIVE_ORG_KEY);
    const active = rows.find((row) => row.id === saved) ?? rows[0];
    return { signedIn: true, slug: active?.slug ?? null };
  } catch {
    return { signedIn: false, slug: null };
  }
}

export async function resolveOrgSlug(organizationId: string): Promise<string | null> {
  try {
    const rows = await getOrganizations();
    return rows.find((row) => row.id === organizationId)?.slug ?? null;
  } catch {
    return null;
  }
}
