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
   */
  getPlaybackUrl(itemId: string, opts?: { maxBitrate?: number }): Promise<string>;

  // Playback reporting
  reportPlaybackStart(itemId: string, positionTicks: number): Promise<void>;
  reportPlaybackProgress(itemId: string, positionTicks: number, isPaused: boolean): Promise<void>;
  reportPlaybackStopped(itemId: string, positionTicks: number): Promise<void>;
}

export function createJellyfinClient(session: JellyfinSession): JellyfinClient {
  const jellyfin = new Jellyfin({
    clientInfo: CLIENT_INFO,
    deviceInfo: { name: "Prime Web", id: session.deviceId },
  });
  const api = jellyfin.createApi(session.jellyfinUrl);
  api.accessToken = session.accessToken;

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

    async getPlaybackUrl(itemId, { maxBitrate = 40_000_000 } = {}) {
      const profile = {
        Name: "Athion Prime Web",
        MaxStreamingBitrate: maxBitrate,
        MaxStaticBitrate: 100_000_000,
        MusicStreamingTranscodingBitrate: 192_000,
        DirectPlayProfiles: [
          {
            Container: "mp4,m4v",
            Type: "Video",
            VideoCodec: "h264,hevc,vp9,av1",
            AudioCodec: "aac,mp3,opus,flac",
          },
          { Container: "webm", Type: "Video", VideoCodec: "vp8,vp9,av1", AudioCodec: "vorbis,opus" },
        ],
        TranscodingProfiles: [
          {
            Container: "ts",
            Type: "Video",
            Protocol: "hls",
            VideoCodec: "h264",
            AudioCodec: "aac,mp3",
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
        return new URL(ms.TranscodingUrl, session.jellyfinUrl).toString();
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
