// Creation of internal accessories from a parent product (admin only).
// Only INSERT/UPDATE on products, inventory_units and product_components.
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slugify";

const sb = supabase as any;

export const ACCESSORY_CATEGORY_SLUG = "accesorios-internos";

export const UNIT_STATUS_LABEL: Record<string, string> = {
  active: "En servicio",
  maintenance: "En reparación",
  retired: "Retirada",
  lost: "Perdida",
};

export const UNIT_STATUS_OPTIONS = ["active", "maintenance", "retired", "lost"] as const;

/** Find (or create) the internal accessories category. */
async function resolveAccessoryCategoryId(): Promise<string> {
  const { data } = await sb
    .from("categories")
    .select("id")
    .eq("slug", ACCESSORY_CATEGORY_SLUG)
    .maybeSingle();
  if (data?.id) return data.id;
  const { data: created, error } = await sb
    .from("categories")
    .insert({ slug: ACCESSORY_CATEGORY_SLUG, name_es: "Accesorios internos", sort_order: 999 })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

/** Next free ACnn code for a parent (+ optional variant block). */
export function nextAccessoryCode(
  parentCode: string,
  variantName: string | null,
  existingCodes: (string | null | undefined)[]
): string {
  const base = variantName ? `${parentCode}-${variantName.toUpperCase()}` : parentCode;
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-AC(\\d+)$`, "i");
  let max = 0;
  for (const c of existingCodes) {
    const m = c ? re.exec(c) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${base}-AC${String(max + 1).padStart(2, "0")}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || `accesorio-${Date.now()}`;
  for (let i = 2; i < 50; i++) {
    const { data } = await sb.from("products").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export type CreateAccessoryInput = {
  parentProductId: string;
  parentInternalCode: string;
  name: string;
  quantity: number;
  variantName: string | null;
  parentUnitId: string | null;
  /** internal_code of accessories already hooked to this parent */
  existingAccessoryCodes: (string | null | undefined)[];
  nextSortOrder: number;
};

export async function createAccessoryForParent(input: CreateAccessoryInput) {
  const code = nextAccessoryCode(input.parentInternalCode, input.variantName, input.existingAccessoryCodes);
  const categoryId = await resolveAccessoryCategoryId();
  const slug = await uniqueSlug(slugify(code));

  let productId: string | null = null;
  const unitIds: string[] = [];
  try {
    const { data: prod, error: prodErr } = await sb
      .from("products")
      .insert({
        slug,
        name_es: input.name,
        name_ca: input.name,
        name_en: input.name,
        name_fr: input.name,
        category_id: categoryId,
        internal_code: code,
        kit_mode: "individual",
        published: false,
        standalone_rentable: false,
        price_day: 0,
        deposit: 0,
        stock: input.quantity,
        images: [],
      })
      .select("id, internal_code")
      .single();
    if (prodErr) throw prodErr;
    productId = prod.id;

    const rows = Array.from({ length: input.quantity }, (_, i) => ({
      product_id: productId,
      internal_code: `${code}-${i + 1}`,
      status: "active",
      owner_id: null,
      parent_unit_id: input.parentUnitId,
      active: true,
    }));
    const { data: units, error: unitErr } = await sb.from("inventory_units").insert(rows).select("id");
    if (unitErr) throw unitErr;
    for (const u of units ?? []) unitIds.push(u.id);

    const { error: compErr } = await sb.from("product_components").insert({
      parent_product_id: input.parentProductId,
      child_product_id: productId,
      quantity: input.quantity,
      variant_name: input.variantName,
      sort_order: input.nextSortOrder,
    });
    if (compErr) throw compErr;

    return { productId: productId as string, internal_code: code };
  } catch (e) {
    // best-effort rollback
    try {
      if (unitIds.length) await sb.from("inventory_units").delete().in("id", unitIds);
      if (productId) await sb.from("products").delete().eq("id", productId);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** Add missing physical pieces when the quantity of an accessory grows. */
export async function addAccessoryPieces(
  accessoryProductId: string,
  accessoryCode: string,
  existingUnits: any[],
  toAdd: number,
  parentUnitId: string | null
) {
  const re = new RegExp(`-(\\d+)$`);
  let max = 0;
  for (const u of existingUnits) {
    const m = u.internal_code ? re.exec(u.internal_code) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const rows = Array.from({ length: toAdd }, (_, i) => ({
    product_id: accessoryProductId,
    internal_code: `${accessoryCode}-${max + i + 1}`,
    status: "active",
    owner_id: null,
    parent_unit_id: parentUnitId,
    active: true,
  }));
  const { error } = await sb.from("inventory_units").insert(rows);
  if (error) throw error;
}
