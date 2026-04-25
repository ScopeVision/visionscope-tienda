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

const FORMATS = [
  { key: "fullframe", match: ["full frame", "fullframe", "full-frame"] },
  { key: "super35", match: ["super 35", "super35", "s35"] },
  { key: "other", match: [] },
];

const USES = [
  { key: "cinema", match: ["cine", "cinema"] },
  { key: "documentary", match: ["doc", "documental", "documentary"] },
  { key: "advertising", match: ["ad", "publicidad", "advertising"] },
];

const RentalHouse = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const selectedCategory = params.get("category") ?? "";
  const selectedFormat = params.get("format") ?? "";
  const selectedUse = params.get("use") ?? "";

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
        .select("*, category:categories(*), product_tags(tag:tags(*))")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const matchesByTag = (p: any, keys: string[]) => {
    const slugs = (p.product_tags ?? []).map((pt: any) => (pt.tag?.slug ?? "").toLowerCase());
    const names = (p.product_tags ?? []).map((pt: any) =>
      (pt.tag?.name_es ?? pt.tag?.name_en ?? "").toLowerCase()
    );
    const desc = (p.description_es ?? p.description_en ?? "").toLowerCase();
    return keys.some((k) => slugs.includes(k) || names.some((n: string) => n.includes(k)) || desc.includes(k));
  };

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (selectedCategory && p.category?.slug !== selectedCategory) return false;
      if (selectedFormat) {
        const def = FORMATS.find((f) => f.key === selectedFormat);
        if (def && def.match.length > 0 && !matchesByTag(p, def.match)) return false;
      }
      if (selectedUse) {
        const def = USES.find((u) => u.key === selectedUse);
        if (def && !matchesByTag(p, def.match)) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = localized(p, "name", i18n.language).toLowerCase();
        const desc = localized(p, "description", i18n.language).toLowerCase();
        if (!name.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategory, selectedFormat, selectedUse, search, i18n.language]);

  const setParam = (key: string, value: string) => {
    if (value) params.set(key, value);
    else params.delete(key);
    setParams(params);
  };

  const clearFilters = () => {
    setParams(new URLSearchParams());
    setSearch("");
  };

  return (
    <div className="container-page py-20">
      <div className="mb-12">
        <span className="cine-eyebrow">{t("rental.eyebrow")}</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
          {t("rental.title")}
        </h1>
        <p className="text-secondary mt-3 max-w-xl">
          {t("rental.subtitle", { count: filtered.length })}
        </p>
      </div>

      {/* Top filter bar */}
      <div className="mb-10 p-5 rounded-sm bg-surface border border-border space-y-4">
        <div className="grid lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border focus-visible:ring-accent"
            />
          </div>

          <FilterSelect
            label={t("rental.filters.category")}
            value={selectedCategory}
            onChange={(v) => setParam("category", v)}
            options={[
              { value: "", label: t("common.all") },
              ...categories.map((c: any) => ({ value: c.slug, label: localized(c, "name", i18n.language) })),
            ]}
          />
          <FilterSelect
            label={t("rental.filters.format")}
            value={selectedFormat}
            onChange={(v) => setParam("format", v)}
            options={[
              { value: "", label: t("common.all") },
              ...FORMATS.map((f) => ({ value: f.key, label: t(`rental.format.${f.key}`) })),
            ]}
          />
          <FilterSelect
            label={t("rental.filters.use")}
            value={selectedUse}
            onChange={(v) => setParam("use", v)}
            options={[
              { value: "", label: t("common.all") },
              ...USES.map((u) => ({ value: u.key, label: t(`rental.use.${u.key}`) })),
            ]}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="self-end gap-2 text-secondary hover:text-accent uppercase tracking-[0.18em] text-[11px]"
          >
            <X className="h-3 w-3" /> {t("rental.filters.clear")}
          </Button>
        </div>
      </div>

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

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-[10px] uppercase tracking-[0.22em] text-secondary">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 px-3 rounded-md bg-background border border-border text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-background">
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

const RentalCard = ({ product }: { product: any }) => {
  const { i18n, t } = useTranslation();
  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];

  // Build short specs from tags (first 3)
  const specs: string[] = (product.product_tags ?? [])
    .slice(0, 3)
    .map((pt: any) => localized(pt.tag ?? {}, "name", i18n.language))
    .filter(Boolean);

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow"
    >
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
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
              <li key={i} className="relative pl-3 before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-1 before:bg-accent before:rounded-full">
                {s}
              </li>
            ))}
          </ul>
        ) : desc ? (
          <p className="mt-3 text-sm text-secondary line-clamp-2 leading-relaxed">{desc}</p>
        ) : null}

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
          <div>
            <span className="text-base font-medium text-foreground">
              {formatCurrency(Number(product.price_day), i18n.language)}
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-secondary ml-1.5">
              {t("common.perDay")}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-accent group-hover:gap-2.5 transition-all">
            {t("rental.viewGear")} <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default RentalHouse;
