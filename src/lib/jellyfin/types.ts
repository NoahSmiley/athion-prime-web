/**
 * Jellyfin domain types used across the SPA. Re-exports the shapes we care
 * about from `@jellyfin/sdk` so call sites can import from a single path.
 *
 * Phase 3b will replace the legacy `src/types.ts` with these.
 */
export type {
  BaseItemDto,
  BaseItemKind,
  BaseItemPerson,
  ChapterInfo,
  ImageType,
  ItemFields,
  ItemFilter,
  ItemSortBy,
  MediaSourceInfo,
  MediaStream,
  MediaType,
  PlayMethod,
  SortOrder,
  UserDto,
  UserItemDataDto,
} from "@jellyfin/sdk/lib/generated-client/models";

export type {
  JellyfinClient,
  GetItemsOpts,
  ImageUrlOpts,
} from "./client";

export type { JellyfinSession } from "@/lib/auth/session";
