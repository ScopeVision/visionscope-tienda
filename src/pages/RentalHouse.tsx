import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/rental";
import { Search, X, ImageOff, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SmartImage } from "@/components/SmartImage";
import { cn } from "@/lib/utils";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";
import { useRentalCatalog, SortOption } from "@/hooks/useRentalCatalog";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "Recomendados" },
  { value: "popular", label: "Más alquilados" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "newest", label: "Novedades" },
  { value: "az", label: "A-Z" },
];

const RentalHouse = () => {
  const { t, i18n } = useTranslation();
  const [filterOpen, setFilterOpen] = useState(false);

  const {
    filtered,
    isLoading,
    dynFilters,
    activeCount,
    activeChips,
    searchTerm,
    priceRange,
    facets,
    selectedCategory,
    sort,
    categoryCounts,
    totalPublished,
    setSearch,
    setPriceRange,
    setCategory,
    removeChip,
    clearFilters,
    setSort,
    toggleDynValue,
  } = useRentalCatalog();

  // Local state for immediate input feedback; URL updated with 250ms debounce via setSearch
  const [localSearch, setLocalSearch] = useState(searchTerm);
  useEffect(() => { setLocalSearch(searchTerm); }, [searchTerm]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    setSearch(value);
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["rental-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["rental-collections-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_collections")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasPriceSlider = priceRange.min < priceRange.max;

  const FilterPanel = ({ onDone }: { onDone?: () => void }) => (
    <>
      {/* Category pills */}
      <div className="mb-5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-2">Categoría</div>
        <div className="flex flex-wrap gap-2">
          <CategoryPill
            active={!selectedCategory}
            label={t("common.all")}
            count={totalPublished}
            onClick={() => { setCategory(""); onDone?.(); }}
          />
          {(categories as any[])
            .filter((c: any) => (categoryCounts.get(c.slug) ?? 0) > 0)
            .map((c: any) => (
              <CategoryPill
                key={c.id}
                active={selectedCategory === c.slug}
                label={localized(c, "name", i18n.language)}
                count={categoryCounts.get(c.slug) ?? 0}
                onClick={() => { setCategory(c.slug); onDone?.(); }}
              />
            ))}
        </div>
      </div>

      {/* Dynamic facets */}
      {facets.length > 0 && (
        <div className="space-y-4 mb-5">
          {facets.map((facet) => {
            const active = dynFilters[facet.key] ?? [];
            if (facet.kind === "boolean") {
              return (
                <div key={facet.key}>
                  <button
                    type="button"
                    onClick={() => toggleDynValue(facet.key, "1")}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors uppercase tracking-[0.12em]",
                      active.length > 0
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                    )}
                  >
                    {t(facet.labelKey)}
                  </button>
                </div>
              );
            }
            if (facet.options.length === 0) return null;
            return (
              <div key={facet.key}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-2">{t(facet.labelKey)}</div>
                <div className="flex flex-wrap gap-2">
                  {facet.options.map((opt) => {
                    const isActive = active.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => !opt.disabled && toggleDynValue(facet.key, opt.value)}
                        disabled={opt.disabled && !isActive}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-full border transition-colors uppercase tracking-[0.12em]",
                          isActive
                            ? "bg-accent text-accent-foreground border-accent"
                            : opt.disabled
                            ? "bg-background text-secondary/40 border-border/40 cursor-not-allowed"
                            : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                        )}
                      >
                        {opt.label} ({opt.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Price range slider */}
      {hasPriceSlider && (
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-3">
            Precio/día: <span className="text-foreground">€{priceRange.low} – €{priceRange.high}</span>
          </div>
          <Slider
            min={priceRange.min}
            max={priceRange.max}
            step={1}
            value={[priceRange.low, priceRange.high]}
            onValueChange={([low, high]) => setPriceRange(low, high)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-secondary mt-1">
            <span>€{priceRange.min}</span>
            <span>€{priceRange.max}</span>
          </div>
        </div>
      )}
    </>
  );

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

      {collections.length > 0 && (
        <div className="mb-10 flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
          {(collections as any[]).map((col) => (
            <Link
              key={col.id}
              to={col.target_url ?? "/rental"}
              className="snap-start shrink-0 flex items-center gap-0 rounded-sm bg-surface border border-border overflow-hidden hover:border-accent transition-colors w-72 sm:w-80"
            >
              {col.image_url && (
                <div className="w-24 h-20 shrink-0 overflow-hidden">
                  <img src={col.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0 p-4">
                <div className="font-medium text-sm uppercase tracking-[0.08em] truncate">
                  {localized(col, "title", i18n.language) || col.title_es}
                </div>
                {col.subtitle_es && (
                  <div className="text-xs text-secondary mt-1 line-clamp-2">{col.subtitle_es}</div>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-secondary shrink-0 mr-4" />
            </Link>
          ))}
        </div>
      )}

      {/* Mobile: sticky bar with filter sheet + search */}
      <div className="flex md:hidden items-center gap-2 mb-4 sticky top-16 z-20 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4">
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-10 border-border shrink-0">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeCount > 0 && (
                <span className="bg-accent text-accent-foreground text-[10px] font-medium rounded-full h-4 w-4 grid place-items-center leading-none">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-xl">
            <SheetHeader className="mb-5">
              <SheetTitle className="text-left text-[11px] uppercase tracking-[0.28em]">Filtros</SheetTitle>
            </SheetHeader>
            <FilterPanel onDone={() => setFilterOpen(false)} />
            {activeCount > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { clearFilters(); setFilterOpen(false); }}
                className="gap-2 text-secondary hover:text-accent uppercase tracking-[0.18em] text-[11px] mb-3 w-full justify-start"
              >
                <X className="h-3 w-3" /> Limpiar filtros
              </Button>
            )}
            <Button
              className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-[0.2em] text-xs rounded-sm"
              onClick={() => setFilterOpen(false)}
            >
              Ver {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </Button>
          </SheetContent>
        </Sheet>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
          <Input
            placeholder={t("rental.searchPlaceholder")}
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-surface border-border h-10 focus-visible:ring-accent"
          />
        </div>
      </div>

      {/* Desktop: search + filters */}
      <div className="hidden md:block">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            placeholder={t("rental.searchPlaceholder")}
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-surface border-border focus-visible:ring-accent h-11"
          />
        </div>
        <FilterPanel />
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}-${chip.value}`}
              type="button"
              onClick={() => removeChip(chip.key, chip.value)}
              className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-foreground uppercase tracking-[0.12em] hover:bg-accent/20 transition-colors"
            >
              {chip.label} <X className="h-2.5 w-2.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] text-secondary hover:text-accent uppercase tracking-[0.18em] ml-1 transition-colors"
          >
            {t("rental.filters.clear")}
          </button>
        </div>
      )}

      {/* Results header: count + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="text-xs text-secondary uppercase tracking-[0.18em]">
              {t("rental.activeFilters", { count: activeCount })}
            </span>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="h-9 px-3 rounded-md bg-surface border border-border text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-secondary">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-secondary border border-dashed border-border rounded-sm">
          {t("rental.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(filtered as any[]).map((p: any) => (
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
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
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
    {label}{count !== undefined ? ` (${count})` : ""}
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
  const minVariantPrice = hasVariants ? Math.min(...variants.map((v) => Number(v.price_day))) : Number(product.price_day);
  const structured: string[] = [product.brand, product.mount, product.sensor_type, product.lens_type].filter(Boolean).slice(0, 3);
  const specs: string[] = structured.length > 0
    ? structured
    : (product.product_tags ?? []).slice(0, 3).map((pt: any) => localized(pt.tag ?? {}, "name", i18n.language)).filter(Boolean);

  return (
    <Link to={`/rental/${product.slug}`} className="group block rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow">
      <div className="relative aspect-square overflow-hidden">
        {img ? (
          <SmartImage src={img} alt={name} loading="lazy" className="object-contain opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full grid place-items-center text-secondary/40"><ImageOff className="h-10 w-10" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        {cat && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.24em] text-accent bg-background/70 backdrop-blur px-2.5 py-1 rounded-sm border border-accent/30">{cat}</span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-medium text-lg uppercase tracking-[0.06em] text-accent group-hover:text-accent/90 transition-colors">{name}</h3>
        {specs.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-secondary">
            {specs.map((s, i) => (
              <li key={i} className="relative pl-3 before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-1 before:bg-accent before:rounded-full">{s}</li>
            ))}
          </ul>
        ) : desc ? (
          <p className="mt-3 text-sm text-secondary line-clamp-2 leading-relaxed">{desc}</p>
        ) : null}
        <div className="mt-5 pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div>
              {hasVariants && <span className="text-[10px] uppercase tracking-[0.22em] text-secondary mr-1.5">{t("rental.from")}</span>}
              <span className="text-base font-medium text-foreground">{formatCurrency(minVariantPrice, i18n.language)}</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-secondary ml-1.5">{t("common.perDay")}</span>
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
