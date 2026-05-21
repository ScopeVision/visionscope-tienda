import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/catalog/ProductCard";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategorySlider } from "@/components/home/CategorySlider";

const Home = () => {
  const { t } = useTranslation();

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
      <HeroSlider />
      <CategorySlider />

      <section className="container-page py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
          <div className="max-w-2xl">
            <span className="cine-eyebrow">Featured Gear</span>
            <h2 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-display font-medium tracking-tight uppercase leading-[1.05]">
              {t("home.featuredTitle")}
            </h2>
            <p className="text-secondary mt-4 max-w-xl leading-relaxed">
              {t("home.featuredSubtitle")}
            </p>
          </div>
          <div className="hidden md:block h-px flex-1 bg-border ml-8" aria-hidden />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {featured.map((p: any) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

    </>
  );
};

export default Home;
