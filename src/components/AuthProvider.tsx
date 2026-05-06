import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchJellyfinSession, redirectToLogin, type JellyfinSession } from "@/lib/auth/session";
import { createJellyfinClient, type JellyfinClient } from "@/lib/jellyfin/client";

interface AuthState {
  session: JellyfinSession | null;
  client: JellyfinClient | null;
  status: "loading" | "ready" | "unauthenticated" | "error";
  error: string | null;
}

const AuthContext = createContext<AuthState>({
  session: null,
  client: null,
  status: "loading",
  error: null,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * Convenience hook for components that only need the Jellyfin client. Throws
 * if called outside <AuthProvider> (or while still loading) — `AuthProvider`
 * blocks render until the client is ready, so child components can rely on it.
 */
export function useJellyfin(): JellyfinClient {
  const { client } = useContext(AuthContext);
  if (!client) {
    throw new Error("useJellyfin called outside an AuthProvider with a ready session");
  }
  return client;
}

/**
 * Resolves a Jellyfin session before rendering children. On 401:
 *   - In production (running under athion.me), redirects to the athion login page.
 *   - In dev, shows a guidance card (so the developer can set VITE_PRIME_DEV_SESSION
 *     instead of being thrown into a redirect loop).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "client">>({
    session: null,
    status: "loading",
    error: null,
  });

  const client = useMemo(
    () => (state.session ? createJellyfinClient(state.session) : null),
    [state.session]
  );

  useEffect(() => {
    let cancelled = false;
    fetchJellyfinSession()
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          if (import.meta.env.PROD) {
            redirectToLogin();
            return;
          }
          setState({ session: null, status: "unauthenticated", error: null });
          return;
        }
        setState({ session, status: "ready", error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ session: null, status: "error", error: message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <FullscreenMessage title="Connecting to Jellyfin…" />;
  }

  if (state.status === "unauthenticated") {
    return (
      <FullscreenMessage
        title="Not signed in to athion.me"
        body={
          "In production, you'd be redirected to the login page. " +
          "For local dev, set VITE_PRIME_DEV_SESSION in .env.local " +
          "to a JSON object {jellyfinUrl, accessToken, userId, username, deviceId}."
        }
      />
    );
  }

  if (state.status === "error") {
    return (
      <FullscreenMessage
        title="Couldn't reach athion.me"
        body={state.error ?? "Unknown error"}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ ...state, client }}>{children}</AuthContext.Provider>
  );
}

function FullscreenMessage({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-8 text-center">
      <div className="max-w-md">
        <h1 className="mb-3 text-base font-medium text-foreground">{title}</h1>
        {body ? (
          <p className="text-sm text-muted-foreground">{body}</p>
        ) : null}
      </div>
    </div>
  );
}
