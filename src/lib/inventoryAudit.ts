// Centralized inventory audit logic. Do not duplicate this in components.

export type SignalSeverity = "critical" | "warning";

export type SignalCode =
  | "stock_mismatch"
  | "published_zero_units"
  | "orphan_split"
  | "active_status_conflict"
  | "zero_or_null_price"
  | "duplicate_or_missing_internal_code"
  | "broken_or_duplicate_slug"
  | "variant_coverage_gap";

export type Signal = {
  code: SignalCode;
  severity: SignalSeverity;
  message: string;
};

export type ProductAudit = {
  product: any;
  units: any[];
  variants: any[];
  real_units_total: number;
  real_units_in_service: number;
  owners: { id: string; name: string; split_pct: number }[];
  signals: Signal[];
};

export type AuditInput = {
  products: any[];
  units: any[];
  variants: any[];
  owners: any[];
};

const num = (v: any): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function auditInventory({ products, units, variants, owners }: AuditInput): ProductAudit[] {
  const unitsByProduct = new Map<string, any[]>();
  for (const u of units) {
    const list = unitsByProduct.get(u.product_id) ?? [];
    list.push(u);
    unitsByProduct.set(u.product_id, list);
  }

  const variantsByProduct = new Map<string, any[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const ownerById = new Map<string, any>();
  for (const o of owners) ownerById.set(o.id, o);

  // Global duplicate maps
  const codeCount = new Map<string, number>();
  const slugCount = new Map<string, number>();
  for (const p of products) {
    if (p.internal_code) {
      const k = String(p.internal_code).trim().toUpperCase();
      codeCount.set(k, (codeCount.get(k) ?? 0) + 1);
    }
    if (p.slug) {
      const k = String(p.slug).trim().toLowerCase();
      slugCount.set(k, (slugCount.get(k) ?? 0) + 1);
    }
  }

  return products.map((p): ProductAudit => {
    const pUnits = unitsByProduct.get(p.id) ?? [];
    const pVariants = variantsByProduct.get(p.id) ?? [];
    const real_units_total = pUnits.length;
    const real_units_in_service = pUnits.filter(
      (u) => u.active === true && (u.status === "active" || u.status === "maintenance")
    ).length;

    // Owner aggregation for display
    const ownerAgg = new Map<string, { id: string; name: string; split_pct: number }>();
    for (const u of pUnits) {
      if (u.owner_id) {
        const o = ownerById.get(u.owner_id);
        const key = u.owner_id;
        if (!ownerAgg.has(key)) {
          ownerAgg.set(key, {
            id: u.owner_id,
            name: o?.name ?? "—",
            split_pct: num(u.owner_split_pct),
          });
        }
      }
    }

    const signals: Signal[] = [];

    // 1. stock_mismatch
    if (num(p.stock) !== real_units_in_service) {
      signals.push({
        code: "stock_mismatch",
        severity: "warning",
        message: `Stock declarado ${num(p.stock)} ≠ unidades en servicio ${real_units_in_service}`,
      });
    }

    // 2. published_zero_units
    if (p.published === true && real_units_in_service === 0) {
      signals.push({
        code: "published_zero_units",
        severity: "critical",
        message: "Publicado sin unidades en servicio",
      });
    }

    // 3. orphan_split
    if (pUnits.some((u) => num(u.owner_split_pct) > 0 && u.owner_id == null)) {
      signals.push({
        code: "orphan_split",
        severity: "critical",
        message: "Unidad con % split sin owner asignado",
      });
    }

    // 4. active_status_conflict
    if (
      pUnits.some(
        (u) =>
          (u.active === false && u.status === "active") ||
          (u.active === true && (u.status === "retired" || u.status === "lost"))
      )
    ) {
      signals.push({
        code: "active_status_conflict",
        severity: "warning",
        message: "Conflicto entre flag active y status en alguna unidad",
      });
    }

    // 5. zero_or_null_price
    if (p.published === true && (p.price_day == null || num(p.price_day) === 0)) {
      signals.push({
        code: "zero_or_null_price",
        severity: "critical",
        message: "Publicado con precio/día 0 o nulo",
      });
    }

    // 6. duplicate_or_missing_internal_code
    const codeTrim = p.internal_code ? String(p.internal_code).trim() : "";
    const codeDup = codeTrim && (codeCount.get(codeTrim.toUpperCase()) ?? 0) > 1;
    if ((p.published && !codeTrim) || codeDup) {
      signals.push({
        code: "duplicate_or_missing_internal_code",
        severity: "warning",
        message: codeDup
          ? `Código interno duplicado (${codeTrim})`
          : "Publicado sin código interno",
      });
    }

    // 7. broken_or_duplicate_slug
    const slugTrim = p.slug ? String(p.slug).trim() : "";
    const slugDup = slugTrim && (slugCount.get(slugTrim.toLowerCase()) ?? 0) > 1;
    if (!slugTrim || slugDup) {
      signals.push({
        code: "broken_or_duplicate_slug",
        severity: "critical",
        message: !slugTrim ? "Slug vacío" : `Slug duplicado (${slugTrim})`,
      });
    }

    // 8. variant_coverage_gap
    if (pVariants.length >= 1 && pUnits.some((u) => u.variant_id == null)) {
      signals.push({
        code: "variant_coverage_gap",
        severity: "warning",
        message: "El producto tiene variantes, pero hay unidades sin variante asignada",
      });
    }

    return {
      product: p,
      units: pUnits,
      variants: pVariants,
      real_units_total,
      real_units_in_service,
      owners: Array.from(ownerAgg.values()),
      signals,
    };
  });
}
