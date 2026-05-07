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
