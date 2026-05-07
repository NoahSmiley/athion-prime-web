import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  QUALITY_OPTIONS,
  THEME_OPTIONS,
  type PrimeSettings,
  type QualityKey,
} from "@/lib/settings";
import { useTheme } from "@/lib/use-theme";

const ATHION_BASE: string =
  (import.meta.env.VITE_ATHION_API_BASE as string | undefined) ?? "https://athion.me";
const ATHION_HOME: string = ATHION_BASE.replace(/\/+$/, "");

/**
 * Settings view — three sections:
 *   - Account: athion + Jellyfin identities, read from the live session.
 *   - Playback: bitrate ceiling for Jellyfin transcodes, persisted locally.
 *   - Sign out: clears the shared .athion.me cookie via athion.me's logout
 *     endpoint, then sends the user back to athion.me's home page.
 */
export function SettingsView() {
  const { session } = useAuth();
  const [theme, setTheme] = useTheme();
  const [settings, setSettings] = useState<PrimeSettings>(DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const updateQuality = (q: QualityKey) => {
    const next: PrimeSettings = { ...settings, quality: q };
    setSettings(next);
    saveSettings(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const onLogout = async () => {
    setSigningOut(true);
    setLogoutError(null);
    try {
      const res = await fetch(`${ATHION_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      // Even if the response is non-2xx (e.g. dev cross-site cookie can't be
      // cleared), redirect to athion.me home so the user perceives a sign-out.
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[settings] logout returned ${res.status}`);
      }
    } catch (e) {
      // Network errors shouldn't block the redirect — just log them.
      // eslint-disable-next-line no-console
      console.warn("[settings] logout request failed:", e);
    }
    window.location.href = ATHION_HOME;
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-medium text-foreground">Settings</h1>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-10 px-8 py-8">
          <Section title="Account">
            <Row label="Athion username">
              <span className="text-sm text-foreground">
                {session?.username ?? <em className="text-muted-foreground">unknown</em>}
              </span>
            </Row>
            <Row label="Jellyfin user">
              <span className="text-sm text-foreground">{session?.username ?? "—"}</span>
            </Row>
            <Row label="Device id">
              <code className="rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                {session?.deviceId ?? "—"}
              </code>
            </Row>
          </Section>

          <Section
            title="Appearance"
            subtitle="Hybrid keeps poster grids; Spare is a directory-style view that mirrors athion.me."
          >
            <div className="flex flex-col gap-2">
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTheme(opt.key)}
                    className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-left transition ${
                      active ? "border-foreground/60 bg-card" : "border-border bg-card/40 hover:bg-card/70"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.hint}</span>
                    </div>
                    {active ? <span className="text-xs text-muted-foreground">active</span> : null}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Playback quality"
            subtitle={
              savedFlash ? (
                <span className="text-emerald-400">Saved</span>
              ) : (
                "Caps the Jellyfin transcode bitrate. Direct-play is preferred when the browser supports the source codec."
              )
            }
          >
            <div className="flex flex-col gap-2">
              {QUALITY_OPTIONS.map((opt) => {
                const active = settings.quality === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => updateQuality(opt.key)}
                    className={`flex items-start justify-between gap-4 rounded-md border px-4 py-3 text-left transition ${
                      active
                        ? "border-foreground/60 bg-card"
                        : "border-border bg-card/40 hover:bg-card/70"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.hint}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(opt.bitrate / 1_000_000)} Mbps
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Session">
            <button
              type="button"
              onClick={onLogout}
              disabled={signingOut}
              className="self-start rounded-md border border-destructive/60 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
            {logoutError ? (
              <p className="mt-2 text-xs text-destructive">{logoutError}</p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Returns you to athion.me. The shared <code>auth_token</code> cookie is cleared on
              that domain so Prime, Press, and athion.me all sign out together.
            </p>
          </Section>

          <Section title="Credits">
            <p className="text-xs text-muted-foreground">
              Athion Prime is built on Trevor Kerney's{" "}
              <a
                className="underline hover:text-foreground"
                href="https://github.com/trevorkerney/Waverunner"
                target="_blank"
                rel="noreferrer"
              >
                Waverunner
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
