import { useState } from "react";
import { ImageOff, Play } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { cn } from "@/lib/utils";

export type ProductVideo = {
  id: string;
  provider: string;
  video_id: string | null;
  url: string;
  title: string | null;
  video_type: string | null;
  thumbnail_url: string | null;
};

export const youtubeThumb = (v: Pick<ProductVideo, "thumbnail_url" | "video_id">) =>
  v.thumbnail_url || (v.video_id ? `https://img.youtube.com/vi/${v.video_id}/hqdefault.jpg` : undefined);

type MediaItem =
  | { kind: "image"; url: string }
  | { kind: "video"; video: ProductVideo };

type Props = {
  images: string[];
  videos?: ProductVideo[];
  name: string;
};

/** Gallery with a main viewer (image or embedded YouTube player) + thumbnail grid. */
export const ProductMediaGallery = ({ images, videos = [], name }: Props) => {
  const [active, setActive] = useState(0);

  const media: MediaItem[] = [
    ...images.map((url) => ({ kind: "image" as const, url })),
    ...videos.filter((v) => !!v.video_id).map((video) => ({ kind: "video" as const, video })),
  ];

  const current = media[Math.min(active, Math.max(media.length - 1, 0))];

  return (
    <>
      <div className="aspect-square rounded-sm bg-surface border border-border overflow-hidden">
        {!current ? (
          <div className="w-full h-full grid place-items-center text-secondary/30">
            <ImageOff className="h-16 w-16" />
          </div>
        ) : current.kind === "image" ? (
          <SmartImage src={current.url} alt={name} priority className="transition-opacity duration-300" />
        ) : (
          <iframe
            key={current.video.id}
            src={`https://www.youtube.com/embed/${current.video.video_id}?autoplay=1&rel=0`}
            title={`${name}${current.video.title ? ` — ${current.video.title}` : ""}`}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {media.map((m, idx) => {
            const isActive = idx === active;
            const thumb = m.kind === "image" ? m.url : youtubeThumb(m.video);
            return (
              <button
                key={m.kind === "image" ? `${m.url}-${idx}` : m.video.id}
                type="button"
                onClick={() => setActive(idx)}
                className={cn(
                  "relative aspect-square rounded-sm overflow-hidden border bg-muted transition-all",
                  isActive
                    ? "border-accent ring-1 ring-accent/40"
                    : "border-border opacity-70 hover:opacity-100 hover:border-accent/40"
                )}
                aria-label={
                  m.kind === "image"
                    ? `${name} - ${idx + 1}`
                    : `${name} - ${m.video.title ?? "vídeo"}`
                }
              >
                <SmartImage src={thumb} alt="" />
                {m.kind === "video" && (
                  <span className="absolute inset-0 grid place-items-center bg-background/30">
                    <span className="grid place-items-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-background/80 border border-border">
                      <Play className="h-3.5 w-3.5 fill-current text-foreground" />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default ProductMediaGallery;
