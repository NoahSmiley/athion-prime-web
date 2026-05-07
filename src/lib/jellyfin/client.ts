/**
 * Typed Jellyfin client used by the entire SPA. Wraps `@jellyfin/sdk` with
 * Athion's auth context (the `JellyfinSession` returned by athion.me's
 * /api/prime/jellyfin-token endpoint).
 *
 * Phase 3a: this is the substantive surface; Phase 3b rewires the UI to use it.
 */
import { Jellyfin } from "@jellyfin/sdk";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getUserLibraryApi } from "@jellyfin/sdk/lib/utils/api/user-library-api";
import { getUserViewsApi } from "@jellyfin/sdk/lib/utils/api/user-views-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import { getSearchApi } from "@jellyfin/sdk/lib/utils/api/search-api";
import type {
  BaseItemDto,
  BaseItemKind,
  ImageType,
  ItemFields,
  ItemSortBy,
  PlayMethod,
  SortOrder,
} from "@jellyfin/sdk/lib/generated-client/models";
import type { JellyfinSession } from "@/lib/auth/session";

export type {
  BaseItemDto,
  BaseItemKind,
  ImageType,
  ItemFields,
  ItemSortBy,
  PlayMethod,
  SortOrder,
};

const CLIENT_INFO = { name: "Athion Prime", version: "1.0.0" };

interface CodecSupport {
  hevc: boolean;
  av1: boolean;
  vp9: boolean;
}

let cachedCaps: CodecSupport | null = null;

/**
 * Probe the browser's MSE codec support so we only ask Jellyfin for codecs
 * the player can actually decode. Without this, declaring HEVC in the
 * DeviceProfile causes Jellyfin to remux a HEVC source for browsers that
 * can't play it — hls.js then errors with manifestIncompatibleCodecsError.
 */
function detectCodecSupport(): CodecSupport {
  if (cachedCaps) return cachedCaps;
  if (typeof MediaSource === "undefined") {
    return (cachedCaps = { hevc: false, av1: false, vp9: false });
  }
  const probe = (type: string) => MediaSource.isTypeSupported(type);
  cachedCaps = {
    hevc:
      probe('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
      probe('video/mp4; codecs="hev1.1.6.L93.B0"'),
    av1: probe('video/mp4; codecs="av01.0.05M.08"'),
    vp9: probe('video/webm; codecs="vp9"') || probe('video/mp4; codecs="vp09.00.10.08"'),
  };
  return cachedCaps;
}

const DEFAULT_FIELDS: ItemFields[] = [
  "Overview" as ItemFields,
  "Genres" as ItemFields,
  "ProductionYear" as ItemFields,
  "PrimaryImageAspectRatio" as ItemFields,
  "MediaSources" as ItemFields,
  "MediaStreams" as ItemFields,
  "Chapters" as ItemFields,
];

export interface GetItemsOpts {
  parentId?: string;
  includeItemTypes?: BaseItemKind[];
  excludeItemTypes?: BaseItemKind[];
  sortBy?: ItemSortBy[];
  sortOrder?: SortOrder;
  startIndex?: number;
  limit?: number;
  searchTerm?: string;
  recursive?: boolean;
  genres?: string[];
  isFavorite?: boolean;
}

export interface ImageUrlOpts {
  type?: ImageType;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  tag?: string;
}

export interface JellyfinClient {
  readonly session: JellyfinSession;

  // Browsing
  getViews(): Promise<BaseItemDto[]>;
  getLatestItems(opts?: { parentId?: string; limit?: number; includeItemTypes?: BaseItemKind[] }): Promise<BaseItemDto[]>;
  getResumeItems(opts?: { limit?: number }): Promise<BaseItemDto[]>;
  getItems(opts: GetItemsOpts): Promise<{ items: BaseItemDto[]; totalRecordCount: number }>;
  getItem(itemId: string): Promise<BaseItemDto | null>;
  getSeasons(seriesId: string): Promise<BaseItemDto[]>;
  getEpisodes(seriesId: string, seasonId?: string): Promise<BaseItemDto[]>;
  search(query: string, opts?: { limit?: number; includeItemTypes?: BaseItemKind[] }): Promise<BaseItemDto[]>;

  // URLs
  imageUrl(itemId: string, opts?: ImageUrlOpts): string;
  hlsUrl(itemId: string, mediaSourceId?: string): string;
  /**
   * Resolve the right HLS URL for this client by doing a PlaybackInfo
   * round-trip with our DeviceProfile. Yields significantly better
   * quality than the synchronous hlsUrl() because the server picks the
   * transcoding params (resolution, bitrate, codec profile) based on
   * what the client says it can handle.
   * Set `forceH264: true` to drop HEVC from the profile after a codec
   * mismatch — useful as a one-shot fallback from the player.
   */
  getPlaybackUrl(itemId: string, opts?: { maxBitrate?: number; forceH264?: boolean }): Promise<string>;

  // Playback reporting
  reportPlaybackStart(itemId: string, positionTicks: number): Promise<void>;
  reportPlaybackProgress(itemId: string, positionTicks: number, isPaused: boolean): Promise<void>;
  reportPlaybackStopped(itemId: string, positionTicks: number): Promise<void>;
}

export function createJellyfinClient(
  session: JellyfinSession,
  onUnauthorized?: () => Promise<JellyfinSession | null>,
): JellyfinClient {
  const jellyfin = new Jellyfin({
    clientInfo: CLIENT_INFO,
    deviceInfo: { name: "Prime Web", id: session.deviceId },
  });
  const api = jellyfin.createApi(session.jellyfinUrl);
  api.accessToken = session.accessToken;

  // Auto-refresh on 401 — when Jellyfin invalidates our access token (e.g.
  // after a long idle), refetch a new session via the provided callback,
  // patch the access token onto the live Api instance + headers, and
  // replay the original request once. Caps at one retry to avoid loops if
  // the refresh itself returns 401.
  if (onUnauthorized) {
    api.axiosInstance.interceptors.response.use(
      (r) => r,
      async (err: unknown) => {
        const e = err as { response?: { status?: number }; config?: { _primeRetried?: boolean; headers?: Record<string, string> } };
        if (e.response?.status !== 401 || !e.config || e.config._primeRetried) {
          throw err;
        }
        const fresh = await onUnauthorized();
        if (!fresh) throw err;
        api.accessToken = fresh.accessToken;
        e.config._primeRetried = true;
        if (e.config.headers) {
          // Jellyfin uses `Authorization: MediaBrowser Token=<token>`
          e.config.headers["Authorization"] = `MediaBrowser Token=${fresh.accessToken}`;
        }
        return api.axiosInstance.request(e.config);
      },
    );
  }

  const itemsApi = getItemsApi(api);
  const userLibraryApi = getUserLibraryApi(api);
  const userViewsApi = getUserViewsApi(api);
  const tvShowsApi = getTvShowsApi(api);
  const playstateApi = getPlaystateApi(api);
  const searchApi = getSearchApi(api);

  return {
    session,

    async getViews() {
      const res = await userViewsApi.getUserViews({ userId: session.userId });
      return res.data.Items ?? [];
    },

    async getLatestItems({ parentId, limit = 20, includeItemTypes } = {}) {
      const res = await userLibraryApi.getLatestMedia({
        userId: session.userId,
        parentId,
        limit,
        includeItemTypes,
        enableImages: true,
        fields: DEFAULT_FIELDS,
      });
      return res.data ?? [];
    },

    async getResumeItems({ limit = 20 } = {}) {
      const res = await itemsApi.getResumeItems({
        userId: session.userId,
        limit,
        enableImages: true,
        mediaTypes: ["Video"],
        fields: DEFAULT_FIELDS,
      });
      return res.data.Items ?? [];
    },

    async getItems(opts) {
      const res = await itemsApi.getItems({
        userId: session.userId,
        parentId: opts.parentId,
        includeItemTypes: opts.includeItemTypes,
        excludeItemTypes: opts.excludeItemTypes,
        sortBy: opts.sortBy,
        sortOrder: opts.sortOrder ? [opts.sortOrder] : undefined,
        startIndex: opts.startIndex,
        limit: opts.limit,
        searchTerm: opts.searchTerm,
        recursive: opts.recursive ?? true,
        genres: opts.genres,
        isFavorite: opts.isFavorite,
        enableImages: true,
        fields: DEFAULT_FIELDS,
      });
      return {
        items: res.data.Items ?? [],
        totalRecordCount: res.data.TotalRecordCount ?? 0,
      };
    },

    async getItem(itemId) {
      try {
        const res = await userLibraryApi.getItem({ userId: session.userId, itemId });
        return res.data ?? null;
      } catch {
        return null;
      }
    },

    async getSeasons(seriesId) {
      const res = await tvShowsApi.getSeasons({ seriesId, userId: session.userId });
      return res.data.Items ?? [];
    },

    async getEpisodes(seriesId, seasonId) {
      const res = await tvShowsApi.getEpisodes({
        seriesId,
        seasonId,
        userId: session.userId,
        fields: DEFAULT_FIELDS,
      });
      return res.data.Items ?? [];
    },

    async search(query, { limit = 50, includeItemTypes } = {}) {
      const res = await searchApi.getSearchHints({
        userId: session.userId,
        searchTerm: query,
        limit,
        includeItemTypes,
      });
      // SearchHints map onto BaseItemDto-shaped objects for our purposes (Id is `ItemId`).
      const hints = res.data.SearchHints ?? [];
      return hints.map((h) => ({ ...h, Id: h.ItemId })) as unknown as BaseItemDto[];
    },

    imageUrl(itemId, { type = "Primary" as ImageType, maxWidth, maxHeight, quality = 90, tag } = {}) {
      const url = new URL(`/Items/${encodeURIComponent(itemId)}/Images/${type}`, session.jellyfinUrl);
      if (maxWidth != null) url.searchParams.set("maxWidth", String(maxWidth));
      if (maxHeight != null) url.searchParams.set("maxHeight", String(maxHeight));
      url.searchParams.set("quality", String(quality));
      if (tag) url.searchParams.set("tag", tag);
      return url.toString();
    },

    hlsUrl(itemId, mediaSourceId) {
      // Synchronous fallback — used if PlaybackInfo fails. For best quality
      // prefer getPlaybackUrl() which lets the server pick resolution/bitrate.
      const url = new URL(`/Videos/${encodeURIComponent(itemId)}/master.m3u8`, session.jellyfinUrl);
      url.searchParams.set("userId", session.userId);
      url.searchParams.set("deviceId", session.deviceId);
      url.searchParams.set("api_key", session.accessToken);
      url.searchParams.set("MediaSourceId", mediaSourceId ?? itemId);
      url.searchParams.set("VideoCodec", "h264");
      url.searchParams.set("AudioCodec", "aac");
      url.searchParams.set("MaxStreamingBitrate", "40000000");
      return url.toString();
    },

    async getPlaybackUrl(itemId, { maxBitrate = 80_000_000, forceH264 = false } = {}) {
      const caps = forceH264
        ? { hevc: false, av1: false, vp9: false }
        : detectCodecSupport();
      const videoCodecs = ["h264"];
      if (caps.hevc) videoCodecs.push("hevc");
      if (caps.av1) videoCodecs.push("av1");
      if (caps.vp9) videoCodecs.push("vp9");

      // Audio: AAC is universally browser-decodable. EAC3/AC3 work on Chrome
      // on some platforms but break Linux Chromium / Firefox. When the user
      // already hit a codec error, restrict to AAC + MP3 only.
      const transcodeAudioCodecs = forceH264 ? "aac,mp3" : "aac,mp3,ac3,eac3";
      const directPlayAudioCodecs = forceH264
        ? "aac,mp3,opus,flac"
        : "aac,mp3,opus,flac,ac3,eac3";

      const profile = {
        Name: "Athion Prime Web",
        MaxStreamingBitrate: maxBitrate,
        MaxStaticBitrate: 100_000_000,
        MusicStreamingTranscodingBitrate: 192_000,
        DirectPlayProfiles: [
          {
            Container: "mp4,m4v,webm",
            Type: "Video",
            VideoCodec: videoCodecs.join(","),
            AudioCodec: directPlayAudioCodecs,
          },
        ],
        TranscodingProfiles: [
          {
            Container: "ts",
            Type: "Video",
            Protocol: "hls",
            VideoCodec: videoCodecs.join(","),
            AudioCodec: transcodeAudioCodecs,
            BreakOnNonKeyFrames: true,
          },
        ],
        ContainerProfiles: [],
        CodecProfiles: [],
        SubtitleProfiles: [{ Format: "vtt", Method: "External" }],
      };

      const params = new URLSearchParams({
        UserId: session.userId,
        MaxStreamingBitrate: String(maxBitrate),
      });
      const res = await fetch(
        `${session.jellyfinUrl}/Items/${encodeURIComponent(itemId)}/PlaybackInfo?${params}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `MediaBrowser Token=${session.accessToken}`,
          },
          body: JSON.stringify({ DeviceProfile: profile }),
        }
      );
      if (!res.ok) {
        throw new Error(`PlaybackInfo returned ${res.status}`);
      }
      const data = (await res.json()) as {
        PlaySessionId?: string;
        MediaSources?: Array<{
          Id?: string;
          TranscodingUrl?: string;
          SupportsDirectStream?: boolean;
          DirectStreamUrl?: string;
          Container?: string;
        }>;
      };
      const ms = data.MediaSources?.[0];
      if (!ms) throw new Error("PlaybackInfo returned no MediaSources");

      // Prefer DirectStream when supported (no transcoding = original quality)
      if (ms.SupportsDirectStream && ms.DirectStreamUrl) {
        return new URL(ms.DirectStreamUrl, session.jellyfinUrl).toString();
      }
      if (ms.TranscodingUrl) {
        const url = new URL(ms.TranscodingUrl, session.jellyfinUrl);
        // Force a sane H.264 profile + level when we're transcoding to h264.
        // Without these, Jellyfin sometimes stamps the manifest with avc1.424029
        // (Baseline level 4.1) but encodes at 4K — browsers refuse the
        // out-of-spec combo with manifestIncompatibleCodecsError.
        if (videoCodecs[0] === "h264" && videoCodecs.length === 1) {
          url.searchParams.set("Profile", "high");
          url.searchParams.set("Level", "51");
          if (forceH264) {
            // Cap to 1080p on the fallback path so the encoder picks a level/
            // resolution combo guaranteed to play in any browser. 4K transcode
            // to h264 stresses cheap decoders anyway; 1080p at ~28 Mbps is
            // visually equivalent at typical viewing distances.
            url.searchParams.set("MaxWidth", "1920");
            url.searchParams.set("MaxHeight", "1080");
          }
        }
        return url.toString();
      }
      // Last-resort: build a master.m3u8 by hand
      return this.hlsUrl(itemId, ms.Id);
    },

    async reportPlaybackStart(itemId, positionTicks) {
      await playstateApi.reportPlaybackStart({
        playbackStartInfo: {
          ItemId: itemId,
          PositionTicks: positionTicks,
          PlayMethod: "Transcode" as PlayMethod,
        },
      });
    },

    async reportPlaybackProgress(itemId, positionTicks, isPaused) {
      await playstateApi.reportPlaybackProgress({
        playbackProgressInfo: {
          ItemId: itemId,
          PositionTicks: positionTicks,
          IsPaused: isPaused,
          PlayMethod: "Transcode" as PlayMethod,
        },
      });
    },

    async reportPlaybackStopped(itemId, positionTicks) {
      await playstateApi.reportPlaybackStopped({
        playbackStopInfo: {
          ItemId: itemId,
          PositionTicks: positionTicks,
        },
      });
    },
  };
}
