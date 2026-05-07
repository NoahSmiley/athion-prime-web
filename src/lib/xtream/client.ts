/**
 * Browser-side wrapper around athion.me's `/api/prime/xtream/*` proxy.
 * Never sees Xtream credentials — those live server-side. Mirrors the
 * shape of the Jellyfin client so we can hand both to view code.
 */

export type XtreamCategory = {
  category_id: string;
  category_name: string;
  parent_id: number;
};

export type XtreamStream = {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string | null;
  epg_channel_id: string | null;
  category_id: string | null;
  tv_archive: number;
};

export type XtreamEPGEntry = {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  channel_id: string | null;
  stream_id: string | null;
};

const API_BASE: string =
  (import.meta.env.VITE_ATHION_API_BASE as string | undefined) ?? "https://athion.me";

/**
 * In dev, browsers can't send the athion `auth_token` cookie cross-site to
 * athion.me, so the SPA optionally exposes a JWT (the same one used to mint
 * VITE_PRIME_DEV_SESSION) and we send it as Bearer auth instead.
 */
const DEV_JWT: string | undefined = import.meta.env.VITE_PRIME_DEV_JWT as string | undefined;

async function get<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (DEV_JWT) headers.Authorization = `Bearer ${DEV_JWT}`;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    throw new Error(`xtream ${path} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const xtream = {
  getCategories(): Promise<XtreamCategory[]> {
    return get<XtreamCategory[]>("/api/prime/xtream/categories");
  },
  getLiveStreams(categoryId?: string): Promise<XtreamStream[]> {
    const q = categoryId ? `?category=${encodeURIComponent(categoryId)}` : "";
    return get<XtreamStream[]>(`/api/prime/xtream/streams${q}`);
  },
  getEPG(streamId: number): Promise<XtreamEPGEntry[]> {
    return get<XtreamEPGEntry[]>(`/api/prime/xtream/epg/${streamId}`);
  },
  /**
   * Returns the URL to play a channel. The browser follows the 302 our
   * route returns; the m3u8 URL with embedded Xtream creds is opaque to
   * us. Pass this directly into hls.js / `<video src>`.
   *
   * In dev, the browser can't attach the auth_token cookie cross-site, and
   * `<video>` / hls.js can't easily attach an Authorization header. Append
   * the dev JWT as a query param so the route can accept it from there.
   * In prod, the cookie travels with the request normally.
   */
  playUrl(streamId: number): string {
    const url = new URL(`/api/prime/xtream/play/${streamId}`, API_BASE);
    if (DEV_JWT) url.searchParams.set("dev_token", DEV_JWT);
    return url.toString();
  },
};
