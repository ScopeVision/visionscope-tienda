import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/rental";
import { Search, X, ImageOff, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Super Store — public catalog (independent module).
 *
 * Initially inherits the visual structure of Rental House to ship fast,
 * but is conceptually independent: no cart / checkout / booking logic here.
 * Filters/categories are kept simple (category + free-text search) and can be
 * extended later with store-specific taxonomies.
 */
const SuperStore = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const selectedCategory = params.get("category") ?? "";

  const { data: categories = [] } = useQuery({
    queryKey: ["store-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["store-products"],
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
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [
          localized(p, "name", i18n.language),
          localized(p, "description", i18n.language),
          p.brand ?? "",
          p.model ?? "",
          p.slug ?? "",
          ...(p.product_tags ?? []).map((pt: any) =>
            localized(pt.tag ?? {}, "name", i18n.language)
          ),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategory, search, i18n.language]);

  const setCategory = (slug: string) => {
    const next = new URLSearchParams();
    if (slug) next.set("category", slug);
    setParams(next);
  };

  const clearFilters = () => {
    setParams(new URLSearchParams());
    setSearch("");
  };

  const activeCount = (selectedCategory ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <div className="container-page py-20">
      <header className="mb-10">
        <span className="cine-eyebrow">{t("nav.store")}</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
          Super Store
        </h1>
        <p className="text-secondary mt-3 max-w-xl">
          {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
        </p>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
        <Input
          placeholder={t("rental.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-surface border-border focus-visible:ring-accent h-11"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <CategoryPill
          active={!selectedCategory}
          label={t("common.all")}
          onClick={() => setCategory("")}
        />
        {categories.map((c: any) => (
          <CategoryPill
            key={c.id}
            active={selectedCategory === c.slug}
            label={localized(c, "name", i18n.language)}
            onClick={() => setCategory(c.slug)}
          />
        ))}
      </div>

      {activeCount > 0 && (
        <div className="mb-6 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-2 text-secondary hover:text-accent uppercase tracking-[0.18em] text-[11px]"
          >
            <X className="h-3 w-3" /> {t("rental.filters.clear")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-secondary">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-secondary border border-dashed border-border rounded-sm">
          {t("rental.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p: any) => (
            <StoreCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
};

const CategoryPill = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "text-[11px] px-4 py-2 rounded-sm border transition-colors uppercase tracking-[0.22em]",
      active
        ? "bg-accent text-accent-foreground border-accent"
        : "bg-surface text-secondary border-border hover:border-accent hover:text-foreground"
    )}
  >
    {label}
  </button>
);

const StoreCard = ({ product }: { product: any }) => {
  const { i18n } = useTranslation();
  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];
  const price = Number(product.price_day);

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow"
    >
      <div className="relative aspect-square overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={name}
            loading="lazy"
            className="w-full h-full object-contain opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-secondary/40">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        {cat && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.24em] text-accent bg-background/70 backdrop-blur px-2.5 py-1 rounded-sm border border-accent/30">
            {cat}
          </span>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-medium text-lg uppercase tracking-[0.06em] text-accent group-hover:text-accent/90 transition-colors">
          {name}
        </h3>
        {desc && (
          <p className="mt-3 text-sm text-secondary line-clamp-2 leading-relaxed">{desc}</p>
        )}
        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
          {price > 0 ? (
            <span className="text-base font-medium text-foreground">
              {formatCurrency(price, i18n.language)}
            </span>
          ) : <span />}
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-accent group-hover:gap-2.5 transition-all">
            Ver <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default SuperStore;
