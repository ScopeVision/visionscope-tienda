import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/rental";
import { Search, X, ImageOff, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SmartImage } from "@/components/SmartImage";
import { cn } from "@/lib/utils";
import { CATEGORY_FILTERS } from "@/lib/rentalFilters";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";

const RentalHouse = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const selectedCategory = params.get("category") ?? "";

  const { data: categories = [] } = useQuery({
    queryKey: ["rental-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["rental-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*)), variants:product_variants(id, price_day)")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Active dynamic filters as map { paramKey: string[] }
  const dynFilters = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!selectedCategory) return out;
    const specs = CATEGORY_FILTERS[selectedCategory] ?? [];
    for (const spec of specs) {
      const raw = params.get(spec.key);
      out[spec.key] = raw ? raw.split(",").filter(Boolean) : [];
    }
    return out;
  }, [params, selectedCategory]);

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      // Category (single-select)
      if (selectedCategory && p.category?.slug !== selectedCategory) return false;

      // Dynamic per-category filters (intersection)
      const specs = CATEGORY_FILTERS[selectedCategory] ?? [];
      for (const spec of specs) {
        const active = dynFilters[spec.key] ?? [];
        if (active.length === 0) continue;
        if (spec.kind === "boolean") {
          if ((p as any)[spec.column] !== true) return false;
          continue;
        }
        const value = (p as any)[spec.column];
        if (!value || !active.includes(value)) return false;
      }

      // Global search (name, description, brand, model, tags)
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
  }, [products, selectedCategory, dynFilters, search, i18n.language]);

  const setCategory = (slug: string) => {
    const next = new URLSearchParams();
    if (slug) next.set("category", slug);
    setParams(next);
  };

  const toggleDynValue = (key: string, value: string) => {
    const current = dynFilters[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    const newParams = new URLSearchParams(params);
    if (next.length === 0) newParams.delete(key);
    else newParams.set(key, next.join(","));
    setParams(newParams);
  };

  const clearFilters = () => {
    setParams(new URLSearchParams());
    setSearch("");
  };

  const activeCount =
    Object.values(dynFilters).reduce((sum, arr) => sum + arr.length, 0) +
    (selectedCategory ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const dynamicSpecs = selectedCategory ? CATEGORY_FILTERS[selectedCategory] ?? [] : [];

  return (
    <div className="container-page py-20">
      <header className="mb-10">
        <span className="cine-eyebrow">{t("rental.eyebrow")}</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
          {t("rental.title")}
        </h1>
        <p className="text-secondary mt-3 max-w-xl">
          {t("rental.subtitle", { count: filtered.length })}
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
        <Input
          placeholder={t("rental.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-surface border-border focus-visible:ring-accent h-11"
        />
      </div>

      {/* Category pills (always visible, single-select) */}
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

      {/* Dynamic subfilters */}
      {dynamicSpecs.length > 0 && (
        <div className="mb-6 p-5 rounded-sm bg-surface border border-border space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          {dynamicSpecs.map((spec) => {
            const active = dynFilters[spec.key] ?? [];
            if (spec.kind === "boolean") {
              const isActive = active.length > 0;
              return (
                <div key={spec.key} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDynValue(spec.key, "1")}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors uppercase tracking-[0.12em]",
                      isActive
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                    )}
                  >
                    {t(spec.labelKey)}
                  </button>
                </div>
              );
            }
            return (
              <div key={spec.key}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-2">
                  {t(spec.labelKey)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {spec.options.map((opt) => {
                    const isActive = active.includes(opt.value);
                    // labelKey may be a translation key or a literal label
                    const label = opt.labelKey.includes(".")
                      ? t(opt.labelKey)
                      : opt.labelKey;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleDynValue(spec.key, opt.value)}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-full border transition-colors uppercase tracking-[0.12em]",
                          isActive
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active filter summary / clear */}
      {activeCount > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="text-xs text-secondary uppercase tracking-[0.18em]">
            {t("rental.activeFilters", { count: activeCount })}
          </span>
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
            <RentalCard key={p.id} product={p} />
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

const RentalCard = ({ product }: { product: any }) => {
  const { i18n, t } = useTranslation();
  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];

  const variants: any[] = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const minVariantPrice = hasVariants
    ? Math.min(...variants.map((v) => Number(v.price_day)))
    : Number(product.price_day);

  // Build short specs from structured fields first, then fallback to tags
  const structured: string[] = [product.brand, product.mount, product.sensor_type, product.lens_type]
    .filter(Boolean)
    .slice(0, 3);
  const specs: string[] =
    structured.length > 0
      ? structured
      : (product.product_tags ?? [])
          .slice(0, 3)
          .map((pt: any) => localized(pt.tag ?? {}, "name", i18n.language))
          .filter(Boolean);

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow"
    >
      <div className="relative aspect-square overflow-hidden">
        {img ? (
          <SmartImage
            src={img}
            alt={name}
            loading="lazy"
            className="object-contain opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
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

        {specs.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-secondary">
            {specs.map((s, i) => (
              <li
                key={i}
                className="relative pl-3 before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-1 before:bg-accent before:rounded-full"
              >
                {s}
              </li>
            ))}
          </ul>
        ) : desc ? (
          <p className="mt-3 text-sm text-secondary line-clamp-2 leading-relaxed">{desc}</p>
        ) : null}

        <div className="mt-5 pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div>
              {hasVariants && (
                <span className="text-[10px] uppercase tracking-[0.22em] text-secondary mr-1.5">
                  {t("rental.from")}
                </span>
              )}
              <span className="text-base font-medium text-foreground">
                {formatCurrency(minVariantPrice, i18n.language)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-secondary ml-1.5">
                {t("common.perDay")}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-accent group-hover:gap-2.5 transition-all">
              {t("rental.viewGear")} <ArrowRight className="h-3 w-3" />
            </span>
          </div>
          <WeeklyDiscountBadge priceDay={minVariantPrice} variant="pill" />
        </div>
      </div>
    </Link>
  );
};

export default RentalHouse;
