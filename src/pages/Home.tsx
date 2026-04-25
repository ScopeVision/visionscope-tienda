import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { ProductCard } from "@/components/catalog/ProductCard";
import heroImg from "@/assets/hero-camera.jpg";
import camImg from "@/assets/cat-cameras.jpg";
import lensImg from "@/assets/cat-lenses.jpg";
import lightImg from "@/assets/cat-lighting.jpg";
import soundImg from "@/assets/cat-sound.jpg";

const CATEGORY_IMAGES: Record<string, string> = {
  camaras: camImg,
  opticas: lensImg,
  iluminacion: lightImg,
  sonido: soundImg,
};

const Home = () => {
  const { t, i18n } = useTranslation();

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

  const { data: featured = [] } = useQuery({
    queryKey: ["home-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*))")
        .eq("published", true)
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <>
      {/* Hero — fullscreen cinematic */}
      <section className="relative -mt-16 h-[100vh] min-h-[640px] w-full overflow-hidden grain">
        <img
          src={heroImg}
          alt="Cinema camera on set"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Cinematic overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(0 0% 4% / 0.55) 0%, hsl(0 0% 4% / 0.35) 35%, hsl(0 0% 4% / 0.85) 100%)",
          }}
          aria-hidden
        />
        {/* Letterbox bars for cinema feel */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-0" aria-hidden />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" aria-hidden />

        <div className="relative z-10 h-full container-page flex flex-col justify-center pt-16">
          <span className="cine-eyebrow mb-5">VisionScope · Cinematic Rental House</span>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-medium text-balance leading-[0.95] uppercase tracking-tight">
            <span className="text-foreground">Capture Stories.</span>
            <br />
            <span className="text-accent">Craft Vision.</span>
          </h1>
          <p className="mt-7 text-base md:text-lg text-secondary max-w-xl leading-relaxed">
            {t("home.heroSubtitle")}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/rental">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm"
              >
                {t("home.ctaCatalog")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-foreground/30 text-foreground hover:bg-foreground hover:text-background gap-2 uppercase tracking-[0.2em] text-xs h-12 px-7 rounded-sm bg-transparent"
              >
                <Play className="h-3.5 w-3.5" />
                {t("home.ctaContact")}
              </Button>
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-secondary">
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-accent to-transparent" />
          </div>
        </div>
      </section>

      {/* Categories — Rental House */}
      <section className="container-page py-24">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="cine-eyebrow">Rental House</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-display font-medium tracking-tight uppercase">
              {t("home.categoriesTitle")}
            </h2>
          </div>
          <Link
            to="/rental"
            className="text-[11px] uppercase tracking-[0.22em] text-accent hover:text-accent/80 inline-flex items-center gap-2"
          >
            {t("nav.rental")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c: any) => (
            <Link
              key={c.id}
              to={`/catalog?category=${c.slug}`}
              className="group block relative rounded-sm overflow-hidden bg-surface aspect-[4/5] border border-border transition-smooth hover:border-accent/60"
            >
              <img
                src={CATEGORY_IMAGES[c.slug] ?? camImg}
                alt={localized(c, "name", i18n.language)}
                width={800}
                height={1000}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-70 transition-all duration-500 group-hover:opacity-90 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.3em] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                Explore
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-foreground font-medium text-base uppercase tracking-[0.12em] group-hover:text-accent transition-colors">
                  {localized(c, "name", i18n.language)}
                </h3>
                <div className="mt-2 h-px w-8 bg-accent transition-all duration-300 group-hover:w-16" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container-page pb-28">
        <div className="mb-10">
          <span className="cine-eyebrow">Featured Gear</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-display font-medium tracking-tight uppercase">
            {t("home.featuredTitle")}
          </h2>
          <p className="text-secondary mt-3 max-w-xl">{t("home.featuredSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((p: any) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
};

export default Home;
