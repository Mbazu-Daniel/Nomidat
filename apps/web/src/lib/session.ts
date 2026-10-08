import { authClient } from "@/lib/api";
import { snapshotStore } from "@/lib/offline/snapshot-store";

export interface SessionUser {
  name?: string;
  email?: string;
  image?: string;
}

export interface AuthSession {
  user?: SessionUser;
}

/** The typed session from Better Auth, narrowed to what the shell renders. */
export async function getSession(): Promise<AuthSession | null> {
  const { data } = await authClient.getSession();
  return (data as AuthSession | null) ?? null;
}

export async function clearSession() {
  // The offline cache holds the last session so a till survives a reload with no
  // network. Signing out must purge it, or the next offline load would render a
  // workspace for someone who just left.
  await authClient.signOut();
  await snapshotStore().clear();
}
