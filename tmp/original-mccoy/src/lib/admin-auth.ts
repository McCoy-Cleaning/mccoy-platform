import * as React from "react";

const KEY = "mccoy_admin_session_v1";
const DEMO_USER = "admin";
const DEMO_PASS = "mccoy2026";

export type AdminSession = { username: string; loggedInAt: number } | null;

export function getAdminSession(): AdminSession {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

export function signInAdmin(username: string, password: string): boolean {
  if (username.trim().toLowerCase() !== DEMO_USER || password !== DEMO_PASS) return false;
  const session: AdminSession = { username: DEMO_USER, loggedInAt: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("mccoy-admin-auth"));
  return true;
}

export function signOutAdmin() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("mccoy-admin-auth"));
}

export function useAdminSession(): { session: AdminSession; ready: boolean } {
  const [session, setSession] = React.useState<AdminSession>(null);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    setSession(getAdminSession());
    setReady(true);
    const sync = () => setSession(getAdminSession());
    window.addEventListener("mccoy-admin-auth", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mccoy-admin-auth", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { session, ready };
}

export const ADMIN_DEMO_CREDENTIALS = { username: DEMO_USER, password: DEMO_PASS };