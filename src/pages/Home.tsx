import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/catalog/ProductCard";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategorySlider } from "@/components/home/CategorySlider";

const Home = () => {
  const { t } = useTranslation();

  const { data: featured = [] } = useQuery({
    queryKey: ["home-featured"],
    queryFn: async () => {
      const { data: featuredData, error: e1 } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*))")
        .eq("published", true)
        .eq("is_featured", true)
        .order("featured_rank", { ascending: true, nullsFirst: false });
      if (e1) throw e1;

      const featuredList: any[] = featuredData ?? [];
      if (featuredList.length >= 6) return featuredList.slice(0, 6);

      const { data: popularityData } = await supabase
        .from("product_popularity")
        .select("product_id, rentals_12m")
        .order("rentals_12m", { ascending: false })
        .limit(20);

      const featuredIds = new Set(featuredList.map((p: any) => p.id));
      const topPopularIds = ((popularityData ?? []) as any[])
        .map((r: any) => r.product_id)
        .filter((id: string) => !featuredIds.has(id))
        .slice(0, 6 - featuredList.length);

      if (topPopularIds.length === 0) return featuredList;

      const { data: popularProducts, error: e2 } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*))")
        .eq("published", true)
        .in("id", topPopularIds)
        .order("name_es", { ascending: true });
      if (e2) throw e2;

      return [...featuredList, ...(popularProducts ?? [])].slice(0, 6);
    },
  });

  return (
    <>
      <Helmet>
        <title>VisionScope — Cinematic Rental House</title>
        <meta name="description" content="Rental house de cine profesional: cámaras, ópticas, iluminación y sonido. Equipo para producciones de alto nivel con servicio premium." />
        <link rel="canonical" href="https://thevisionscope.lovable.app/" />
        <meta property="og:title" content="VisionScope — Cinematic Rental House" />
        <meta property="og:description" content="Capture Stories. Craft Vision. Equipo cinematográfico profesional para tu próximo rodaje." />
        <meta property="og:url" content="https://thevisionscope.lovable.app/" />
        <meta property="og:type" content="website" />
      </Helmet>
      <HeroSlider />
      <CategorySlider />

      <section className="container-page py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
          <div className="max-w-2xl">
            <span className="cine-eyebrow">Featured Gear</span>
            <h2 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-display font-medium tracking-tight uppercase leading-[1.05]">
              {t("home.featuredTitle")}
            </h2>
            <p className="text-secondary mt-4 max-w-xl leading-relaxed">{t("home.featuredSubtitle")}</p>
          </div>
          <div className="hidden md:block h-px flex-1 bg-border ml-8" aria-hidden />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {(featured as any[]).map((p: any) => (
            <ProductCard key={p.id} product={p} basePath="/rental" />
          ))}
        </div>
      </section>
    </>
  );
};

export default Home;
