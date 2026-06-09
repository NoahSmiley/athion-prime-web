/**
 * Athion SSO session — talks to athion.me's /api/prime/jellyfin-token endpoint
 * to get a Jellyfin access token bound to the current athion user.
 *
 * Cookie flow: athion.me sets `auth_token` with `domain=.athion.me`, so any
 * subdomain (including prime.athion.me) sends it on cross-origin requests
 * back to athion.me with `credentials: "include"`.
 *
 * Dev caveat: when this dev server runs on localhost:1420 and the backend is
 * on athion.me, the cookie is cross-site and won't be sent. Set
 * `VITE_PRIME_DEV_SESSION` to a JSON string of {jellyfinUrl, accessToken,
 * userId, username} to bypass for local development.
 */

export interface JellyfinSession {
  jellyfinUrl: string;
  accessToken: string;
  userId: string;
  username: string;
  deviceId: string;
}

const TOKEN_ENDPOINT =
  import.meta.env.VITE_ATHION_API_BASE ?? "https://athion.me";

const LOGIN_URL =
  (import.meta.env.VITE_ATHION_LOGIN_URL as string | undefined) ??
  "https://athion.me/login";

/**
 * Fetches a fresh Jellyfin session from athion.me. Returns null on 401.
 * Throws on transport / 5xx errors.
 */
export async function fetchJellyfinSession(): Promise<JellyfinSession | null> {
  const devOverride = import.meta.env.VITE_PRIME_DEV_SESSION as string | undefined;
  if (devOverride) {
    try {
      return JSON.parse(devOverride) as JellyfinSession;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("VITE_PRIME_DEV_SESSION is set but not valid JSON", e);
    }
  }

  const res = await fetch(`${TOKEN_ENDPOINT}/api/prime/jellyfin-token`, {
    credentials: "include",
    // Bypass the HTTP cache — a cached token response can outlive the token
    // itself (Jellyfin revokes it when the same device re-authenticates),
    // which leaves the app stuck on 401s until the cache entry expires.
    cache: "no-store",
  });

  if (res.status === 401) return null;
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.error ?? "";
    } catch {
      // ignore
    }
    throw new Error(`Token endpoint returned ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as JellyfinSession;
}

/**
 * Send the user to athion.me's login, with a redirect back to where they were.
 */
export function redirectToLogin(): void {
  const next = window.location.href;
  window.location.href = `${LOGIN_URL}?redirect=${encodeURIComponent(next)}`;
}
