import { useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { CATEGORY_FILTERS, getLabelKey } from "@/lib/rentalFilters";

export type SortOption = "recommended" | "popular" | "price_asc" | "price_desc" | "newest" | "az";

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  disabled: boolean;
};

export type FacetGroup = {
  key: string;
  column: string;
  labelKey: string;
  kind: "multi" | "boolean";
  options: FacetOption[];
};

export type PriceRange = {
  min: number;
  max: number;
  low: number;
  high: number;
};

export type ActiveChip = {
  key: string;
  value: string;
  label: string;
};

export function useRentalCatalog() {
  const { i18n, t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCategory = params.get("category") ?? "";
  const sort = (params.get("sort") ?? "recommended") as SortOption;
  const searchTerm = params.get("q") ?? "";
  const priceParam = params.get("price") ?? "";

  const priceFilter = useMemo(() => {
    if (!priceParam) return null;
    const parts = priceParam.split("-");
    if (parts.length !== 2) return null;
    const low = Number(parts[0]);
    const high = Number(parts[1]);
    return isNaN(low) || isNaN(high) ? null : { low, high };
  }, [priceParam]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["rental-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*)), variants:product_variants(id, price_day)")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: popularity = [] } = useQuery({
    queryKey: ["product-popularity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_popularity")
        .select("product_id, rentals_12m, rentals_total");
      if (error) throw error;
      return data ?? [];
    },
  });

  const popularityMap = useMemo(() => {
    const m = new Map<string, { rentals_12m: number; rentals_total: number }>();
    for (const row of popularity as any[]) {
      m.set(row.product_id, {
        rentals_12m: Number(row.rentals_12m),
        rentals_total: Number(row.rentals_total),
      });
    }
    return m;
  }, [popularity]);

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

  const effectivePrice = useCallback((p: any): number => {
    const variants: any[] = p.variants ?? [];
    if (variants.length > 0) return Math.min(...variants.map((v: any) => Number(v.price_day)));
    return Number(p.price_day) || 0;
  }, []);

  // Products matching category + text search only (base for price range + facet universe)
  const categoryFiltered = useMemo(() => {
    return (products as any[]).filter((p: any) => {
      if (selectedCategory && p.category?.slug !== selectedCategory) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const haystack = [
          localized(p, "name", i18n.language),
          localized(p, "description", i18n.language),
          p.brand ?? "",
          p.model ?? "",
          p.slug ?? "",
          ...(p.product_tags ?? []).map((pt: any) => localized(pt.tag ?? {}, "name", i18n.language)),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedCategory, searchTerm, i18n.language]);

  // Price range derived from categoryFiltered
  const priceRange = useMemo((): PriceRange => {
    if (categoryFiltered.length === 0) return { min: 0, max: 0, low: 0, high: 0 };
    const prices = categoryFiltered.map(effectivePrice);
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return {
      min,
      max,
      low: priceFilter?.low ?? min,
      high: priceFilter?.high ?? max,
    };
  }, [categoryFiltered, effectivePrice, priceFilter]);

  // Final filtered list: category + search + dynFilters + price
  const filtered = useMemo(() => {
    let list = categoryFiltered.filter((p: any) => {
      const specs = CATEGORY_FILTERS[selectedCategory] ?? [];
      for (const spec of specs) {
        const active = dynFilters[spec.key] ?? [];
        if (active.length === 0) continue;
        if (spec.kind === "boolean") {
          if (p[spec.column] !== true) return false;
          continue;
        }
        const value = p[spec.column];
        if (!value || !active.includes(value)) return false;
      }
      if (priceFilter) {
        const price = effectivePrice(p);
        if (price < priceFilter.low || price > priceFilter.high) return false;
      }
      return true;
    });

    list = [...list].sort((a: any, b: any) => {
      const popA = popularityMap.get(a.id) ?? { rentals_12m: 0, rentals_total: 0 };
      const popB = popularityMap.get(b.id) ?? { rentals_12m: 0, rentals_total: 0 };
      const nameA = localized(a, "name", i18n.language).toLowerCase();
      const nameB = localized(b, "name", i18n.language).toLowerCase();
      const priceA = effectivePrice(a);
      const priceB = effectivePrice(b);
      switch (sort) {
        case "recommended":
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          if (popB.rentals_12m !== popA.rentals_12m) return popB.rentals_12m - popA.rentals_12m;
          return nameA.localeCompare(nameB);
        case "popular":
          if (popB.rentals_12m !== popA.rentals_12m) return popB.rentals_12m - popA.rentals_12m;
          return nameA.localeCompare(nameB);
        case "price_asc": return priceA - priceB;
        case "price_desc": return priceB - priceA;
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "az": return nameA.localeCompare(nameB);
        default: return 0;
      }
    });
    return list;
  }, [categoryFiltered, selectedCategory, dynFilters, priceFilter, effectivePrice, popularityMap, sort, i18n.language]);

  // Count of published products per category slug
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products as any[]) {
      const slug = p.category?.slug;
      if (slug) m.set(slug, (m.get(slug) ?? 0) + 1);
    }
    return m;
  }, [products]);

  const totalPublished = (products as any[]).length;

  // Dynamic facets with cross-filtering counts
  const facets = useMemo((): FacetGroup[] => {
    if (!selectedCategory) return [];
    const specs = CATEGORY_FILTERS[selectedCategory] ?? [];

    return specs.map((spec): FacetGroup => {
      if (spec.kind === "boolean") {
        return { key: spec.key, column: spec.column, labelKey: spec.labelKey, kind: "boolean", options: [] };
      }

      // Universe: all values present in categoryFiltered for this column
      const universe = new Map<string, number>();
      for (const p of categoryFiltered) {
        const val = p[spec.column];
        if (val) universe.set(val, 0);
      }

      // Cross-filter: products matching everything EXCEPT this spec's filter
      const otherFiltered = categoryFiltered.filter((p: any) => {
        for (const s of specs) {
          if (s.key === spec.key) continue;
          const active = dynFilters[s.key] ?? [];
          if (active.length === 0) continue;
          if (s.kind === "boolean") {
            if (p[s.column] !== true) return false;
            continue;
          }
          const val = p[s.column];
          if (!val || !active.includes(val)) return false;
        }
        if (priceFilter) {
          const price = effectivePrice(p);
          if (price < priceFilter.low || price > priceFilter.high) return false;
        }
        return true;
      });

      // Count from otherFiltered
      for (const p of otherFiltered) {
        const val = p[spec.column];
        if (val && universe.has(val)) universe.set(val, (universe.get(val) ?? 0) + 1);
      }

      const labelMap = spec.labelMap ?? {};
      const activeValues = dynFilters[spec.key] ?? [];

      const options: FacetOption[] = Array.from(universe.entries()).map(([value, count]) => {
        const rawLabel = getLabelKey(labelMap, value);
        const label = rawLabel.includes(".") ? t(rawLabel) : rawLabel;
        return { value, label, count, disabled: count === 0 };
      }).sort((a, b) => {
        const aActive = activeValues.includes(a.value);
        const bActive = activeValues.includes(b.value);
        if (aActive !== bActive) return aActive ? -1 : 1;
        if (a.disabled !== b.disabled) return a.disabled ? 1 : -1;
        return a.label.localeCompare(b.label);
      });

      return { key: spec.key, column: spec.column, labelKey: spec.labelKey, kind: "multi", options };
    });
  }, [selectedCategory, categoryFiltered, dynFilters, priceFilter, effectivePrice, t]);

  // Active chips for individual dismissal
  const activeChips = useMemo((): ActiveChip[] => {
    const chips: ActiveChip[] = [];
    const specs = CATEGORY_FILTERS[selectedCategory] ?? [];
    for (const spec of specs) {
      const active = dynFilters[spec.key] ?? [];
      if (spec.kind === "boolean") {
        if (active.length > 0) chips.push({ key: spec.key, value: "1", label: t(spec.labelKey) });
      } else {
        const labelMap = spec.labelMap ?? {};
        for (const value of active) {
          const rawLabel = getLabelKey(labelMap, value);
          const label = rawLabel.includes(".") ? t(rawLabel) : rawLabel;
          chips.push({ key: spec.key, value, label });
        }
      }
    }
    if (searchTerm.trim()) {
      chips.push({ key: "q", value: searchTerm, label: `"${searchTerm}"` });
    }
    if (priceFilter && (priceFilter.low !== priceRange.min || priceFilter.high !== priceRange.max)) {
      chips.push({ key: "price", value: priceParam, label: `€${priceFilter.low}–€${priceFilter.high}/día` });
    }
    return chips;
  }, [selectedCategory, dynFilters, searchTerm, priceFilter, priceRange.min, priceRange.max, priceParam, t]);

  const activeCount = activeChips.length + (selectedCategory ? 1 : 0);

  // Debounced search → URL param `q`
  const setSearch = useCallback((value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) next.set("q", value.trim());
        else next.delete("q");
        return next;
      });
    }, 250);
  }, [setParams]);

  const setPriceRange = useCallback((low: number, high: number) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (low <= priceRange.min && high >= priceRange.max) next.delete("price");
      else next.set("price", `${low}-${high}`);
      return next;
    });
  }, [setParams, priceRange.min, priceRange.max]);

  // Changing category preserves q, sort, price; clears only category-specific sub-filters
  const setCategory = useCallback((slug: string) => {
    setParams((prev) => {
      const next = new URLSearchParams();
      if (prev.get("q")) next.set("q", prev.get("q")!);
      if (prev.get("sort")) next.set("sort", prev.get("sort")!);
      if (prev.get("price")) next.set("price", prev.get("price")!);
      if (slug) next.set("category", slug);
      return next;
    });
  }, [setParams]);

  const removeChip = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === "q") {
        next.delete("q");
      } else if (key === "price") {
        next.delete("price");
      } else {
        const current = (next.get(key) ?? "").split(",").filter(Boolean);
        const updated = current.filter((v) => v !== value);
        if (updated.length === 0) next.delete(key);
        else next.set(key, updated.join(","));
      }
      return next;
    });
  }, [setParams]);

  const clearFilters = useCallback(() => {
    setParams(new URLSearchParams());
  }, [setParams]);

  const setSort = useCallback((value: SortOption) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "recommended") next.delete("sort");
      else next.set("sort", value);
      return next;
    });
  }, [setParams]);

  const toggleDynValue = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const current = (next.get(key) ?? "").split(",").filter(Boolean);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (updated.length === 0) next.delete(key);
      else next.set(key, updated.join(","));
      return next;
    });
  }, [setParams]);

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  return {
    filtered,
    isLoading,
    popularityMap,
    dynFilters,
    selectedCategory,
    sort,
    activeCount,
    searchTerm,
    priceRange,
    facets,
    activeChips,
    categoryCounts,
    totalPublished,
    // Actions
    setSearch,
    setPriceRange,
    setCategory,
    removeChip,
    clearFilters,
    setSort,
    toggleDynValue,
  };
}
