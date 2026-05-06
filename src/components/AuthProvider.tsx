import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchJellyfinSession, redirectToLogin, type JellyfinSession } from "@/lib/auth/session";

interface AuthState {
  session: JellyfinSession | null;
  status: "loading" | "ready" | "unauthenticated" | "error";
  error: string | null;
}

const AuthContext = createContext<AuthState>({
  session: null,
  status: "loading",
  error: null,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * Resolves a Jellyfin session before rendering children. On 401:
 *   - In production (running under athion.me), redirects to the athion login page.
 *   - In dev, shows a guidance card (so the developer can set VITE_PRIME_DEV_SESSION
 *     instead of being thrown into a redirect loop).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    status: "loading",
    error: null,
  });

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

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
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
