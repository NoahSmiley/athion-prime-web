import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useJellyfin } from "@/components/AuthProvider";
import type { BaseItemDto, BaseItemKind, ItemSortBy, SortOrder } from "@/lib/jellyfin/types";
import type { View } from "@/types";

export function MainContent({
  view,
  onSelectItem,
  onBack,
}: {
  view: View;
  onSelectItem: (item: BaseItemDto) => void;
  onBack: () => void;
}) {
  if (view.kind === "home") {
    return <Placeholder title="Home" body="Continue Watching, Latest Movies, Latest Shows. (Phase 5.)" />;
  }
  if (view.kind === "livetv") {
    return <Placeholder title="Live TV" body="Xtream-backed channel browser + EPG. (Phase 6.)" />;
  }
  if (view.kind === "search") {
    return <Placeholder title="Search" body="Live search across libraries. (Phase 5.)" />;
  }
  if (view.kind === "settings") {
    return <Placeholder title="Settings" body="Account info, quality preference, logout. (Phase 7.)" />;
  }
  if (view.kind === "item") {
    return <ItemDetail item={view.item} onBack={onBack} />;
  }

  const includeType: BaseItemKind = (view.kind === "movies" ? "Movie" : "Series") as BaseItemKind;
  const title = view.kind === "movies" ? "Movies" : "TV Shows";
  return <LibraryGrid title={title} includeType={includeType} onSelect={onSelectItem} />;
}

function LibraryGrid({
  title,
  includeType,
  onSelect,
}: {
  title: string;
  includeType: BaseItemKind;
  onSelect: (item: BaseItemDto) => void;
}) {
  const client = useJellyfin();
  const [items, setItems] = useState<BaseItemDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    client
      .getItems({
        includeItemTypes: [includeType],
        sortBy: ["SortName" as ItemSortBy],
        sortOrder: "Ascending" as SortOrder,
        limit: 500,
        recursive: true,
      })
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [client, includeType]);

  if (error) {
    return (
      <Placeholder title={`Couldn't load ${title.toLowerCase()}`} body={error} />
    );
  }
  if (items === null) {
    return <Placeholder title={`Loading ${title.toLowerCase()}…`} />;
  }
  if (items.length === 0) {
    return <Placeholder title={`No ${title.toLowerCase()} found`} body="Add some content to your Jellyfin library." />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-8 py-5">
        <h1 className="text-xl font-medium text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {items.map((item) => (
            <PosterCard key={item.Id ?? item.Name} item={item} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PosterCard({ item, onSelect }: { item: BaseItemDto; onSelect: (item: BaseItemDto) => void }) {
  const client = useJellyfin();
  const tag = item.ImageTags?.Primary;
  const src = item.Id
    ? client.imageUrl(item.Id, { type: "Primary", maxWidth: 400, tag })
    : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex flex-col gap-2 text-left focus:outline-none"
    >
      <div className="aspect-[2/3] overflow-hidden rounded bg-muted ring-1 ring-border transition group-hover:ring-2 group-hover:ring-foreground/40">
        {src ? (
          <img
            src={src}
            alt={item.Name ?? ""}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="px-0.5">
        <div className="line-clamp-1 text-sm font-medium text-foreground">{item.Name}</div>
        {item.ProductionYear ? (
          <div className="text-xs text-muted-foreground">{item.ProductionYear}</div>
        ) : null}
      </div>
    </button>
  );
}

function ItemDetail({ item, onBack }: { item: BaseItemDto; onBack: () => void }) {
  const client = useJellyfin();
  const tag = item.BackdropImageTags?.[0] ?? item.ImageTags?.Primary;
  const backdrop = item.Id
    ? client.imageUrl(item.Id, {
        type: item.BackdropImageTags?.[0] ? "Backdrop" : "Primary",
        maxWidth: 1600,
        tag,
      })
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </header>
      <div className="relative flex-1 overflow-auto">
        {backdrop ? (
          <div
            className="h-72 w-full bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        ) : null}
        <div className="px-10 py-8">
          <h1 className="text-3xl font-medium text-foreground">{item.Name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[item.Type, item.ProductionYear].filter(Boolean).join(" · ")}
          </p>
          {item.Overview ? (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-foreground/80">
              {item.Overview}
            </p>
          ) : null}
          <p className="mt-10 text-xs text-muted-foreground">
            Detail view + player coming in Phase 4. Item id: <code>{item.Id}</code>
          </p>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-10 text-center">
      <div className="max-w-md">
        <h2 className="mb-2 text-base font-medium text-foreground">{title}</h2>
        {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
      </div>
    </div>
  );
}
