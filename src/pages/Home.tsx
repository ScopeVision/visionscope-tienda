import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page pt-12 pb-20 lg:pt-20 lg:pb-32 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs uppercase tracking-[0.25em] text-accent mb-5">
              Lillo Rentals
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-balance leading-[1.05]">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-6 text-lg text-secondary max-w-lg leading-relaxed">
              {t("home.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/catalog">
                <Button size="lg" className="bg-foreground text-background hover:bg-foreground/90 gap-2">
                  {t("home.ctaCatalog")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/contact">
                <Button size="lg" variant="outline">
                  {t("home.ctaContact")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-accent-soft rounded-2xl rotate-1" aria-hidden />
            <img
              src={heroImg}
              alt="Cinema camera"
              width={1920}
              height={1080}
              className="relative rounded-xl shadow-elegant w-full h-auto object-cover aspect-[16/10]"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page pb-20">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-medium tracking-tight">
            {t("home.categoriesTitle")}
          </h2>
          <Link to="/catalog" className="text-sm text-secondary hover:text-foreground inline-flex items-center gap-1">
            {t("nav.catalog")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map((c: any) => (
            <Link
              key={c.id}
              to={`/catalog?category=${c.slug}`}
              className="group block relative rounded-xl overflow-hidden bg-muted aspect-[4/5] shadow-soft transition-smooth hover:shadow-card"
            >
              <img
                src={CATEGORY_IMAGES[c.slug] ?? camImg}
                alt={localized(c, "name", i18n.language)}
                width={800}
                height={1000}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h3 className="text-background font-medium text-lg">
                  {localized(c, "name", i18n.language)}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container-page pb-24">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-medium tracking-tight">
            {t("home.featuredTitle")}
          </h2>
          <p className="text-secondary mt-2">{t("home.featuredSubtitle")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((p: any) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
};

export default Home;
