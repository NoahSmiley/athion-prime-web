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
      // Jellyfin's master.m3u8 requires a MediaSourceId. For single-source items
      // (most movies/episodes) it equals the ItemId. Multi-source files would
      // need a PlaybackInfo round-trip first; we'll add that when we hit one.
      const url = new URL(`/Videos/${encodeURIComponent(itemId)}/master.m3u8`, session.jellyfinUrl);
      url.searchParams.set("userId", session.userId);
      url.searchParams.set("deviceId", session.deviceId);
      url.searchParams.set("api_key", session.accessToken);
      url.searchParams.set("MediaSourceId", mediaSourceId ?? itemId);
      url.searchParams.set("VideoCodec", "h264");
      url.searchParams.set("AudioCodec", "aac");
      return url.toString();
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
