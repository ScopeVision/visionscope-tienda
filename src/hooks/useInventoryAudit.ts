import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { auditInventory, ProductAudit } from "@/lib/inventoryAudit";

const sb = supabase as any;

export type AccessoryEntry = {
  audit: ProductAudit;
  quantity: number;
  variant_name: string | null;
  component_id: string;
  sort_order: number;
};


export function useInventoryAudit() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const productsQ = useQuery({
    queryKey: ["inv-audit-products"],
    queryFn: async () =>
      (await sb.from("products").select("*, category:categories(*)").order("created_at", { ascending: false })).data ?? [],
  });

  const unitsQ = useQuery({
    queryKey: ["inv-audit-units"],
    queryFn: async () => (await sb.from("inventory_units").select("*")).data ?? [],
  });

  const variantsQ = useQuery({
    queryKey: ["inv-audit-variants"],
    queryFn: async () => (await sb.from("product_variants").select("*")).data ?? [],
  });

  const ownersQ = useQuery({
    queryKey: ["inv-audit-owners"],
    queryFn: async () => (await sb.from("finance_owners").select("id, name, type, active")).data ?? [],
  });

  const categoriesQ = useQuery({
    queryKey: ["inv-audit-categories"],
    queryFn: async () => (await sb.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const componentsQ = useQuery({
    queryKey: ["inv-audit-components"],
    queryFn: async () =>
      (
        await sb
          .from("product_components")
          .select("parent_product_id, child_product_id, quantity, variant_name, sort_order")
          .order("sort_order")
      ).data ?? [],
  });

  const audits: ProductAudit[] = useMemo(
    () =>
      auditInventory({
        products: productsQ.data ?? [],
        units: unitsQ.data ?? [],
        variants: variantsQ.data ?? [],
        owners: ownersQ.data ?? [],
      }),
    [productsQ.data, unitsQ.data, variantsQ.data, ownersQ.data]
  );

  const auditById = useMemo(() => {
    const m = new Map<string, ProductAudit>();
    for (const a of audits) m.set(a.product.id, a);
    return m;
  }, [audits]);

  const componentsByParent = useMemo(() => {
    const m = new Map<string, AccessoryEntry[]>();
    const rows = [...(componentsQ.data ?? [])].sort(
      (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    for (const r of rows) {
      const child = auditById.get(r.child_product_id);
      if (!child) continue;
      const list = m.get(r.parent_product_id) ?? [];
      list.push({
        audit: child,
        quantity: Number(r.quantity ?? 1),
        variant_name: r.variant_name ?? null,
      });
      m.set(r.parent_product_id, list);
    }
    return m;
  }, [componentsQ.data, auditById]);

  const accessoryProductIds = useMemo(
    () => new Set<string>((componentsQ.data ?? []).map((r: any) => r.child_product_id)),
    [componentsQ.data]
  );


  const categoryName = (id?: string | null): string => {
    if (!id) return "—";
    const c = (categoriesQ.data ?? []).find((x: any) => x.id === id);
    return c ? localized(c, "name", lang) : "—";
  };

  return {
    audits,
    componentsByParent,
    accessoryProductIds,
    categories: categoriesQ.data ?? [],
    owners: ownersQ.data ?? [],
    variants: variantsQ.data ?? [],
    units: unitsQ.data ?? [],
    products: productsQ.data ?? [],
    categoryName,
    lang,
    isLoading:
      productsQ.isLoading || unitsQ.isLoading || variantsQ.isLoading || ownersQ.isLoading || categoriesQ.isLoading || componentsQ.isLoading,
  };
}
