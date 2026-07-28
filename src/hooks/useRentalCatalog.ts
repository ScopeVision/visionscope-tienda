import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { CATEGORY_FILTERS } from "@/lib/rentalFilters";

export type SortOption = "recommended" | "popular" | "price_asc" | "price_desc" | "newest" | "az";

export function useRentalCatalog(search: string) {
  const { i18n } = useTranslation();
  const [params] = useSearchParams();

  const selectedCategory = params.get("category") ?? "";
  const sort = (params.get("sort") ?? "recommended") as SortOption;

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

  const filtered = useMemo(() => {
    let list = (products as any[]).filter((p: any) => {
      if (selectedCategory && p.category?.slug !== selectedCategory) return false;

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

    list = [...list].sort((a: any, b: any) => {
      const popA = popularityMap.get(a.id) ?? { rentals_12m: 0, rentals_total: 0 };
      const popB = popularityMap.get(b.id) ?? { rentals_12m: 0, rentals_total: 0 };
      const nameA = localized(a, "name", i18n.language).toLowerCase();
      const nameB = localized(b, "name", i18n.language).toLowerCase();
      const priceA = Math.min(Number(a.price_day), ...(a.variants ?? []).map((v: any) => Number(v.price_day)));
      const priceB = Math.min(Number(b.price_day), ...(b.variants ?? []).map((v: any) => Number(v.price_day)));

      switch (sort) {
        case "recommended":
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          if (popB.rentals_12m !== popA.rentals_12m) return popB.rentals_12m - popA.rentals_12m;
          return nameA.localeCompare(nameB);
        case "popular":
          if (popB.rentals_12m !== popA.rentals_12m) return popB.rentals_12m - popA.rentals_12m;
          return nameA.localeCompare(nameB);
        case "price_asc":
          return priceA - priceB;
        case "price_desc":
          return priceB - priceA;
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "az":
          return nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });

    return list;
  }, [products, popularityMap, selectedCategory, dynFilters, search, sort, i18n.language]);

  const activeCount =
    Object.values(dynFilters).reduce((sum, arr) => sum + arr.length, 0) +
    (selectedCategory ? 1 : 0) +
    (search.trim() ? 1 : 0);

  return { filtered, isLoading, popularityMap, dynFilters, selectedCategory, sort, activeCount };
}
