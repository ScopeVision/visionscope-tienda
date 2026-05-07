import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight, Play } from "lucide-react";
import heroImg from "@/assets/hero-camera.jpg";
import { useTranslation } from "react-i18next";

type Slide = {
  id: string;
  image_url: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
};

const FALLBACK: Slide[] = [
  {
    id: "fallback",
    image_url: heroImg,
    title: "Capture Stories.",
    subtitle: "Cinematic gear rental for filmmakers, agencies, and storytellers.",
    cta_label: "",
    cta_url: "",
  },
];

export const HeroSlider = () => {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const { data } = useQuery({
    queryKey: ["hero-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_slides" as any)
        .select("*")
        .eq("published", true)
        .order("sort_order");
      if (error) throw error;
      return ((data ?? []) as unknown) as Slide[];
    },
  });

  const slides = data && data.length > 0 ? data : FALLBACK;
  const current = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIndex((i) => (i + 1) % slides.length);

  return (
    <section className="relative -mt-16 h-[100vh] min-h-[640px] w-full overflow-hidden grain">
      {slides.map((s, i) => (
        <img
          key={s.id}
          src={s.image_url}
          alt={s.title || "Hero"}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(0 0% 4% / 0.55) 0%, hsl(0 0% 4% / 0.35) 35%, hsl(0 0% 4% / 0.85) 100%)",
        }}
        aria-hidden
      />
      <div className="absolute top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-0" aria-hidden />
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" aria-hidden />

      <div className="relative z-10 h-full container-page flex flex-col justify-center pt-16">
        <span className="cine-eyebrow mb-5">VisionScope · Cinematic Rental House</span>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-medium text-balance leading-[0.95] uppercase tracking-tight text-foreground">
          {current.title || t("home.heroTitle", { defaultValue: "Capture Stories." })}
        </h1>
        {current.subtitle && (
          <p className="mt-7 text-base md:text-lg text-secondary max-w-xl leading-relaxed">
            {current.subtitle}
          </p>
        )}
        <div className="mt-10 flex flex-wrap gap-3">
          {current.cta_label && current.cta_url ? (
            current.cta_url.startsWith("http") ? (
              <a href={current.cta_url} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm">
                  {current.cta_label} <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            ) : (
              <Link to={current.cta_url}>
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm">
                  {current.cta_label} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )
          ) : (
            <>
              <Link to="/rental">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm">
                  {t("home.ctaCatalog")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline" className="border-foreground/30 text-foreground hover:bg-foreground hover:text-background gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm bg-transparent">
                  <Play className="h-3.5 w-3.5" />
                  {t("home.ctaContact")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 rounded-full bg-background/40 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm border border-foreground/10 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Siguiente"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 rounded-full bg-background/40 hover:bg-accent hover:text-accent-foreground backdrop-blur-sm border border-foreground/10 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-accent" : "w-4 bg-foreground/30"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
