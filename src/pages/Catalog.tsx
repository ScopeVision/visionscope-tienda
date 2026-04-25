import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search, LayoutGrid, List, X } from "lucide-react";
import { cn } from "@/lib/utils";

const Catalog = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 600]);
  const selectedCategory = params.get("category") ?? "";
  const selectedTagSlugs = (params.get("tags") ?? "").split(",").filter(Boolean);

  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["catalog-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("slug");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalog-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*))")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (selectedCategory && p.category?.slug !== selectedCategory) return false;
      if (Number(p.price_day) < priceRange[0] || Number(p.price_day) > priceRange[1]) return false;
      if (selectedTagSlugs.length > 0) {
        const productTagSlugs = (p.product_tags ?? []).map((pt: any) => pt.tag?.slug);
        const hasAll = selectedTagSlugs.every((s) => productTagSlugs.includes(s));
        if (!hasAll) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = localized(p, "name", i18n.language).toLowerCase();
        const desc = localized(p, "description", i18n.language).toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategory, selectedTagSlugs, priceRange, search, i18n.language]);

  const toggleTag = (slug: string) => {
    const next = selectedTagSlugs.includes(slug)
      ? selectedTagSlugs.filter((s) => s !== slug)
      : [...selectedTagSlugs, slug];
    if (next.length === 0) params.delete("tags");
    else params.set("tags", next.join(","));
    setParams(params);
  };

  const setCategory = (slug: string) => {
    if (slug) params.set("category", slug);
    else params.delete("category");
    setParams(params);
  };

  const clearFilters = () => {
    setParams(new URLSearchParams());
    setSearch("");
    setPriceRange([0, 600]);
  };

  return (
    <div className="container-page py-12">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight">
          {t("catalog.title")}
        </h1>
        <p className="text-secondary mt-2">
          {t("catalog.subtitle", { count: filtered.length })}
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-10">
        {/* Sidebar filters */}
        <aside className="space-y-7">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
              <Input
                placeholder={t("common.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-secondary mb-3">
              {t("catalog.filters.category")}
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => setCategory("")}
                className={cn(
                  "block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors",
                  !selectedCategory
                    ? "bg-accent-soft text-foreground font-medium"
                    : "text-secondary hover:text-foreground hover:bg-muted"
                )}
              >
                {t("common.all")}
              </button>
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.slug)}
                  className={cn(
                    "block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors",
                    selectedCategory === c.slug
                      ? "bg-accent-soft text-foreground font-medium"
                      : "text-secondary hover:text-foreground hover:bg-muted"
                  )}
                >
                  {localized(c, "name", i18n.language)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-secondary mb-3">
              {t("catalog.filters.tags")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: any) => {
                const active = selectedTagSlugs.includes(tag.slug);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.slug)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                    )}
                  >
                    {localized(tag, "name", i18n.language)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-secondary mb-3">
              {t("catalog.filters.priceRange")}
            </h3>
            <Slider
              value={priceRange}
              onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
              min={0}
              max={600}
              step={10}
              className="mt-4"
            />
            <div className="flex justify-between text-xs text-secondary mt-2">
              <span>{priceRange[0]}€</span>
              <span>{priceRange[1]}€</span>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-secondary">
            <X className="h-3 w-3" /> {t("catalog.filters.clear")}
          </Button>
        </aside>

        <div>
          <div className="flex items-center justify-end mb-5 gap-1">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("grid")}
              aria-label={t("catalog.view.grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              aria-label={t("catalog.view.list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <p className="text-secondary">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-secondary">{t("catalog.empty")}</div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((p: any) => (
                <ProductCard key={p.id} product={p} view="list" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
