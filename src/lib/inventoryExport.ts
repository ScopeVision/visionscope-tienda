import Papa from "papaparse";
import { localized } from "@/i18n";
import type { ProductAudit } from "./inventoryAudit";

export type ExportRow = Record<string, string | number>;

const yesNo = (v: any) => (v ? "sí" : "no");

export function buildExportRows(
  audits: ProductAudit[],
  categoryName: (id?: string | null) => string,
  lang: string,
  parentByChildId?: Map<string, { name: string; internal_code?: string | null }>
): ExportRow[] {
  const rows: ExportRow[] = [];

  for (const a of audits) {
    const p = a.product;
    const productName = localized(p, "name", lang);
    const cat = categoryName(p.category_id);
    const variantesCount = a.variants.length;
    const alertas = a.signals.map((s) => `${s.severity}:${s.code}`).join(" | ");
    const parent = parentByChildId?.get(p.id);

    const base = {
      categoria: cat,
      codigo_interno_producto: p.internal_code ?? "",
      producto: productName,
      pertenece_a: parent ? `${parent.name}${parent.internal_code ? ` (${parent.internal_code})` : ""}` : "",
      publicado: yesNo(p.published),
      precio_dia: Number(p.price_day ?? 0),
      stock_declarado: Number(p.stock ?? 0),
      unidades_en_servicio: a.real_units_in_service,
      unidades_total: a.real_units_total,
      variantes: variantesCount,
      alertas,
    };


    if (a.units.length === 0) {
      rows.push({
        ...base,
        unidad_codigo_interno: "",
        unidad_variante: "",
        unidad_owner: "",
        unidad_split_pct: "",
        unidad_estado: "",
        unidad_serial: "",
      });
      continue;
    }

    for (const u of a.units) {
      const variant = a.variants.find((v) => v.id === u.variant_id);
      const owner = a.owners.find((o) => o.id === u.owner_id);
      rows.push({
        ...base,
        unidad_codigo_interno: u.internal_code ?? "",
        unidad_variante: variant?.name ?? "",
        unidad_owner: owner?.name ?? (u.owner_id ? u.owner_id : "Empresa"),
        unidad_split_pct: Number(u.owner_split_pct ?? 0),
        unidad_estado: `${u.status ?? ""}${u.active === false ? " (inactivo)" : ""}`.trim(),
        unidad_serial: u.serial ?? "",
      });
    }
  }

  return rows;
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const stamp = () => new Date().toISOString().slice(0, 10);

export function exportInventoryCsv(rows: ExportRow[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `inventario_${stamp()}.csv`);
}

export async function exportInventoryXlsx(rows: ExportRow[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `inventario_${stamp()}.xlsx`);
}
