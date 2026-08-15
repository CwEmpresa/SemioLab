export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: { email?: string; user_metadata?: { name?: string; full_name?: string } };
};

const SESSION_KEY = "semiolab.auth.session";

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function saveAuthSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("semiolab:auth-changed"));
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const session = getAuthSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

export async function refreshAuthSession() {
  const current = getAuthSession();
  if (!current?.refresh_token) return null;
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", refreshToken: current.refresh_token }),
  });
  if (!response.ok) { saveAuthSession(null); return null; }
  const data = await response.json() as { session?: AuthSession };
  if (data.session) saveAuthSession(data.session);
  return data.session || null;
}

export function signOutLocal() { saveAuthSession(null); }
