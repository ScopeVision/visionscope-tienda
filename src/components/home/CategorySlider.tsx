import { useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import camImg from "@/assets/cat-cameras.jpg";
import lensImg from "@/assets/cat-lenses.jpg";
import lightImg from "@/assets/cat-lighting.jpg";
import soundImg from "@/assets/cat-sound.jpg";
import { SmartImage } from "@/components/SmartImage";

const FALLBACK_IMAGES: Record<string, string> = {
  camaras: camImg,
  opticas: lensImg,
  iluminacion: lightImg,
  sonido: soundImg,
};

export const CategorySlider = () => {
  const { t, i18n } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["home-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const scroll = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  // Drag-to-scroll
  const startDrag = (e: React.MouseEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    const startX = e.pageX - el.offsetLeft;
    const startScroll = el.scrollLeft;
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      moved = true;
      el.scrollLeft = startScroll - (ev.pageX - el.offsetLeft - startX);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (moved) el.style.pointerEvents = "auto";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <section className="container-page py-24">
      <div className="flex flex-col items-center text-center mb-14">
        <span className="cine-eyebrow">Rental House</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-display font-medium tracking-tight uppercase">
          {t("home.categoriesTitle")}
        </h2>
        <div className="mt-5 h-px w-16 bg-accent/60" />
        <Link
          to="/rental"
          className="mt-6 text-[11px] uppercase tracking-[0.22em] text-accent hover:text-accent/80 inline-flex items-center gap-2"
        >
          {t("nav.rental")} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Anterior"
          className="hidden md:grid place-items-center absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-10 h-10 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm border border-border transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Siguiente"
          className="hidden md:grid place-items-center absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-10 h-10 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm border border-border transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={scrollerRef}
          onMouseDown={startDrag}
          className="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 select-none cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: "none" }}
        >
          {categories.map((c: any, idx: number) => {
            const href = c.link_url || `/rental?category=${c.slug}`;
            const img = c.image_url || FALLBACK_IMAGES[c.slug] || camImg;
            const isExternal = /^https?:/.test(href);
            const inner = (
              <div className="group block relative rounded-sm overflow-hidden bg-surface aspect-[4/3] w-full border border-border transition-smooth hover:border-accent/60">
                <img
                  src={img}
                  alt={localized(c, "name", i18n.language)}
                  loading="lazy"
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover opacity-60 transition-all duration-700 group-hover:opacity-90 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
                <div className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.3em] text-accent/80 font-medium tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
                  <div>
                    <h3 className="text-foreground font-medium text-base md:text-lg uppercase tracking-[0.14em] group-hover:text-accent transition-colors">
                      {localized(c, "name", i18n.language)}
                    </h3>
                    <div className="mt-2 h-px w-8 bg-accent/70 transition-all duration-500 group-hover:w-20" />
                  </div>
                </div>
              </div>
            );
            return (
              <div
                key={c.id}
                className="snap-start shrink-0 w-[80%] sm:w-[45%] md:w-[32%] lg:w-[24%]"
              >
                {isExternal ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
                ) : (
                  <Link to={href}>{inner}</Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
