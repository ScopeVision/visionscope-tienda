import { useMemo, useState } from "react";
import { useInventoryAudit, type AccessoryEntry } from "@/hooks/useInventoryAudit";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown, ChevronRight, FileSpreadsheet, FileDown, AlertTriangle, Loader2, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductAudit, Signal } from "@/lib/inventoryAudit";
import { buildExportRows, exportInventoryCsv, exportInventoryXlsx } from "@/lib/inventoryExport";

const SIGNAL_LABEL: Record<string, string> = {
  stock_mismatch: "Stock ≠ unidades",
  published_zero_units: "Publicado sin unidades",
  orphan_split: "Split sin owner",
  active_status_conflict: "Estado inconsistente",
  zero_or_null_price: "Precio 0/nulo",
  duplicate_or_missing_internal_code: "Cód. interno",
  broken_or_duplicate_slug: "Slug",
  variant_coverage_gap: "Variante sin cubrir",
};

export function SignalBadge({ signal }: { signal: Signal }) {
  const isCritical = signal.severity === "critical";
  return (
    <Badge
      variant={isCritical ? "destructive" : "outline"}
      title={signal.message}
      className={cn(
        "text-[10px] font-medium",
        !isCritical && "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      )}
    >
      {SIGNAL_LABEL[signal.code] ?? signal.code}
    </Badge>
  );
}

export default function InventoryPanel() {
  const {
    audits, categories, owners, categoryName, lang, isLoading,
    componentsByParent, accessoryProductIds,
  } = useInventoryAudit();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [publishedFilter, setPublishedFilter] = useState<string>("__all__");
  const [ownerFilter, setOwnerFilter] = useState<string>("__all__");
  const [onlyErrors, setOnlyErrors] = useState(false);

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      const p = a.product;
      if (accessoryProductIds.has(p.id)) return false;
      if (categoryFilter !== "__all__" && p.category_id !== categoryFilter) return false;
      if (publishedFilter === "published" && !p.published) return false;
      if (publishedFilter === "unpublished" && p.published) return false;
      if (ownerFilter !== "__all__") {
        if (ownerFilter === "__none__") {
          if (a.units.some((u) => u.owner_id)) return false;
        } else if (!a.units.some((u) => u.owner_id === ownerFilter)) {
          return false;
        }
      }
      if (onlyErrors && a.signals.length === 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (localized(p, "name", lang) || "").toLowerCase();
        const code = (p.internal_code ?? "").toLowerCase();
        const slug = (p.slug ?? "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !slug.includes(q)) return false;
      }
      return true;
    });
  }, [audits, accessoryProductIds, categoryFilter, publishedFilter, ownerFilter, onlyErrors, search, lang]);

  const toggleRow = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const doExport = async (fmt: "csv" | "xlsx") => {
    const list: ProductAudit[] = [];
    const parentByChildId = new Map<string, { name: string; internal_code?: string | null }>();
    const seen = new Set<string>();
    for (const a of filtered) {
      if (!seen.has(a.product.id)) {
        seen.add(a.product.id);
        list.push(a);
      }
      for (const acc of componentsByParent.get(a.product.id) ?? []) {
        if (!parentByChildId.has(acc.audit.product.id)) {
          parentByChildId.set(acc.audit.product.id, {
            name: localized(a.product, "name", lang),
            internal_code: a.product.internal_code,
          });
        }
        if (!seen.has(acc.audit.product.id)) {
          seen.add(acc.audit.product.id);
          list.push(acc.audit);
        }
      }
    }
    const rows = buildExportRows(list, categoryName, lang, parentByChildId);
    fmt === "csv" ? exportInventoryCsv(rows) : await exportInventoryXlsx(rows);
  };

  const totalErrors = filtered.reduce((n, a) => n + a.signals.length, 0);
  const criticalErrors = filtered.reduce(
    (n, a) => n + a.signals.filter((s) => s.severity === "critical").length,
    0
  );


  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-md bg-surface border border-border p-3 grid gap-3 sm:grid-cols-[1fr_180px_160px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
          <Input
            placeholder="Buscar producto, código, slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las categorías</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{localized(c, "name", lang)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={publishedFilter} onValueChange={setPublishedFilter}>
          <SelectTrigger><SelectValue placeholder="Publicación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="unpublished">No publicados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los owners</SelectItem>
            <SelectItem value="__none__">Sin owner (empresa)</SelectItem>
            {owners.map((o: any) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background">
          <Switch checked={onlyErrors} onCheckedChange={setOnlyErrors} />
          <span className="text-xs text-secondary uppercase tracking-wider">Solo con errores</span>
        </div>
      </div>

      {/* Summary + export */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-secondary">
          {filtered.length} productos · {totalErrors} alertas
          {criticalErrors > 0 && (
            <span className="text-destructive font-medium"> · {criticalErrors} críticas</span>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => doExport("csv")} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => doExport("xlsx")} className="gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Cód. interno</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">Publicado</TableHead>
              <TableHead className="text-right">€/día</TableHead>
              <TableHead className="text-right">Stock decl.</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Variantes</TableHead>
              <TableHead>Owner(s)</TableHead>
              <TableHead>Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-secondary py-10">
                  <Loader2 className="h-4 w-4 animate-spin inline" /> Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-secondary py-10">—</TableCell></TableRow>
            ) : (
              filtered.map((a) => <PanelRow key={a.product.id} audit={a} expanded={expanded.has(a.product.id)} onToggle={() => toggleRow(a.product.id)} categoryName={categoryName} lang={lang} owners={owners} accessories={componentsByParent.get(a.product.id) ?? []} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PanelRow({
  audit, expanded, onToggle, categoryName, lang, owners, accessories,
}: {
  audit: ProductAudit;
  expanded: boolean;
  onToggle: () => void;
  categoryName: (id?: string | null) => string;
  lang: string;
  owners: any[];
  accessories: AccessoryEntry[];
}) {
  const p = audit.product;
  const name = localized(p, "name", lang);
  const ownerNames = audit.owners.map((o) => o.name).join(", ") || "Empresa";
  const stockMismatch = audit.signals.some((s) => s.code === "stock_mismatch");
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/30" onClick={onToggle}>
        <TableCell>
          {expanded ? <ChevronDown className="h-4 w-4 text-secondary" /> : <ChevronRight className="h-4 w-4 text-secondary" />}
        </TableCell>
        <TableCell className="text-secondary text-xs">{categoryName(p.category_id)}</TableCell>
        <TableCell className="font-mono text-xs">{p.internal_code ?? "—"}</TableCell>
        <TableCell className="font-medium">
          {name}
          <div className="text-[10px] font-mono text-secondary mt-0.5">{p.slug}</div>
        </TableCell>
        <TableCell className="text-center">
          {p.published ? (
            <Badge variant="outline" className="text-[10px]">Sí</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-secondary">No</Badge>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums">{Number(p.price_day ?? 0).toFixed(2)}</TableCell>
        <TableCell className="text-right tabular-nums">{p.stock ?? 0}</TableCell>
        <TableCell className="text-right tabular-nums">
          <span className={cn(stockMismatch && "text-amber-500 font-medium")}>
            {audit.real_units_in_service}
          </span>
          <span className="text-secondary"> / {audit.real_units_total}</span>
        </TableCell>
        <TableCell className="text-right tabular-nums">{audit.variants.length}</TableCell>
        <TableCell className="text-xs text-secondary">{ownerNames}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {audit.signals.length === 0 ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">OK</span>
            ) : (
              audit.signals.map((s) => <SignalBadge key={s.code} signal={s} />)
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={11} className="p-4">
            <ExpandedDetail audit={audit} owners={owners} accessories={accessories} lang={lang} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function UnitStatusSelect({ unit, onDone }: { unit: any; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <Select
      value={unit.status ?? "active"}
      onValueChange={async (v) => {
        setSaving(true);
        const { error } = await (supabase as any)
          .from("inventory_units")
          .update({ status: v })
          .eq("id", unit.id);
        setSaving(false);
        if (error) return toast.error("No se pudo cambiar el estado: " + error.message);
        toast.success("Estado actualizado");
        onDone();
      }}
    >
      <SelectTrigger className="h-7 w-[140px] text-[11px]" disabled={saving}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {UNIT_STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">{UNIT_STATUS_LABEL[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddAccessoryDialog({
  open, onOpenChange, audit, accessories, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  audit: ProductAudit;
  accessories: AccessoryEntry[];
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState("__none__");
  const [parentUnit, setParentUnit] = useState("__auto__");
  const [saving, setSaving] = useState(false);

  const variantNames = Array.from(
    new Set(accessories.map((a) => a.variant_name).filter(Boolean) as string[])
  );
  const parentUnits = audit.units.filter((u) => u.active !== false);

  const submit = async () => {
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!quantity || quantity < 1) return toast.error("La cantidad debe ser al menos 1");
    const parentCode = audit.product.internal_code;
    if (!parentCode) return toast.error("El producto padre no tiene código interno");
    let unitId: string | null = null;
    if (parentUnits.length === 1) unitId = parentUnits[0].id;
    else if (parentUnits.length > 1 && parentUnit !== "__auto__") unitId = parentUnit;
    setSaving(true);
    try {
      await createAccessoryForParent({
        parentProductId: audit.product.id,
        parentInternalCode: parentCode,
        name: name.trim(),
        quantity,
        variantName: variant === "__none__" ? null : variant,
        parentUnitId: unitId,
        existingAccessoryCodes: accessories.map((a) => a.audit.product.internal_code),
        nextSortOrder: accessories.reduce((m, a) => Math.max(m, a.sort_order), 0) + 1,
      });
      toast.success("Accesorio creado");
      setName(""); setQuantity(1); setVariant("__none__"); setParentUnit("__auto__");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error("No se pudo crear el accesorio: " + (e?.message ?? "error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Añadir accesorio</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre del accesorio</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Motor, Cargador NP…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad de piezas</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          {variantNames.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Variante</Label>
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin variante</SelectItem>
                  {variantNames.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {parentUnits.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Unidad padre</Label>
              <Select value={parentUnit} onValueChange={setParentUnit}>
                <SelectTrigger><SelectValue placeholder="Elige una unidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Sin atar por ahora</SelectItem>
                  {parentUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.internal_code ?? u.serial ?? u.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {parentUnits.length === 0 && (
            <p className="text-[11px] text-secondary">
              Este producto aún no tiene unidades numeradas; podrás atarlo cuando las crees.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Crear accesorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpandedDetail({
  audit, owners, accessories, lang,
}: {
  audit: ProductAudit;
  owners: any[];
  accessories: AccessoryEntry[];
  lang: string;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({
      predicate: (q) => {
        const k = String(q.queryKey?.[0] ?? "");
        return k.startsWith("inv-audit") || k.startsWith("admin-products") || k.startsWith("product-form-units") || k.startsWith("product-units");
      },
    });
  };

  const groups = new Map<string, AccessoryEntry[]>();
  for (const acc of accessories) {
    const key = acc.variant_name ?? "__none__";
    const list = groups.get(key) ?? [];
    list.push(acc);
    groups.set(key, list);
  }

  const changeQuantity = async (acc: AccessoryEntry, next: number) => {
    if (!next || next < 1 || next === acc.quantity) return;
    const { error } = await (supabase as any)
      .from("product_components")
      .update({ quantity: next })
      .eq("id", acc.component_id);
    if (error) return toast.error("No se pudo actualizar: " + error.message);
    if (next > acc.quantity) {
      try {
        const parentUnitId = acc.audit.units.find((u) => u.parent_unit_id)?.parent_unit_id ?? null;
        await addAccessoryPieces(
          acc.audit.product.id,
          acc.audit.product.internal_code ?? "",
          acc.audit.units,
          next - acc.quantity,
          parentUnitId
        );
        toast.success("Cantidad actualizada y piezas creadas");
      } catch (e: any) {
        toast.error("Cantidad actualizada, pero fallaron las piezas: " + (e?.message ?? ""));
      }
    } else {
      toast.warning(
        `Cantidad reducida. Sobran ${acc.audit.units.length - next} piezas físicas: gestiónalas manualmente.`
      );
    }
    refresh();
  };

  const unhook = async (acc: AccessoryEntry) => {
    if (!confirm("¿Desenganchar este accesorio del producto? No se borra el producto ni sus piezas.")) return;
    const { error } = await (supabase as any)
      .from("product_components")
      .delete()
      .eq("id", acc.component_id);
    if (error) return toast.error("No se pudo desenganchar: " + error.message);
    toast.success("Accesorio desenganchado");
    refresh();
  };

  return (
    <div className="space-y-4">
      {audit.units.length === 0 ? (
        <div className="text-xs text-secondary flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Este producto no tiene unidades físicas registradas.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-secondary uppercase tracking-wider">
              <tr>
                <th className="text-left font-medium py-1 pr-3">Cód. interno</th>
                <th className="text-left font-medium py-1 pr-3">Variante</th>
                <th className="text-left font-medium py-1 pr-3">Owner</th>
                <th className="text-right font-medium py-1 pr-3">% Split</th>
                <th className="text-left font-medium py-1 pr-3">Estado</th>
                <th className="text-left font-medium py-1 pr-3">Serial</th>
              </tr>
            </thead>
            <tbody>
              {audit.units.map((u) => {
                const variant = audit.variants.find((v) => v.id === u.variant_id);
                const owner = owners.find((o: any) => o.id === u.owner_id);
                return (
                  <tr key={u.id} className="border-t border-border/40">
                    <td className="py-1.5 pr-3 font-mono">{u.internal_code ?? "—"}</td>
                    <td className="py-1.5 pr-3">{variant?.name ?? "—"}</td>
                    <td className="py-1.5 pr-3">{owner?.name ?? (u.owner_id ? u.owner_id : "Empresa")}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{Number(u.owner_split_pct ?? 0)}%</td>
                    <td className="py-1.5 pr-3" onClick={(e) => e.stopPropagation()}>
                      <UnitStatusSelect unit={u} onDone={refresh} />
                      {u.active === false && <span className="text-secondary ml-1">(inactivo)</span>}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-secondary">{u.serial ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-wider text-secondary">
            Accesorios internos incluidos
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" /> Añadir accesorio
          </Button>
        </div>

        {accessories.length === 0 ? (
          <p className="text-[11px] text-secondary">Este producto no tiene accesorios internos.</p>
        ) : (
          Array.from(groups.entries()).map(([key, list]) => (
            <div key={key} className="space-y-1">
              {key !== "__none__" && (
                <div className="text-[11px] font-medium text-foreground">{key}</div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-secondary uppercase tracking-wider">
                    <tr>
                      <th className="text-left font-medium py-1 pr-3">Cód. interno</th>
                      <th className="text-left font-medium py-1 pr-3">Accesorio</th>
                      <th className="text-right font-medium py-1 pr-3">Cantidad</th>
                      <th className="text-left font-medium py-1 pr-3">Piezas físicas</th>
                      <th className="text-right font-medium py-1 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((acc) => {
                      const units = acc.audit.units;
                      const notActive = units.filter((u) => (u.status ?? "active") !== "active");
                      return (
                        <>
                          <tr key={acc.component_id} className="border-t border-border/40 align-top">
                            <td className="py-1.5 pr-3 font-mono text-[11px]">
                              {acc.audit.product.internal_code ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3">{localized(acc.audit.product, "name", lang)}</td>
                            <td className="py-1.5 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                min={1}
                                defaultValue={acc.quantity}
                                className="h-7 w-16 text-xs text-right ml-auto"
                                onBlur={(e) => changeQuantity(acc, parseInt(e.target.value) || acc.quantity)}
                              />
                            </td>
                            <td className="py-1.5 pr-3">
                              {units.length} piezas
                              {notActive.length > 0 && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {" · "}
                                  {notActive.length} {UNIT_STATUS_LABEL[notActive[0].status ?? "active"]?.toLowerCase()}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                                onClick={() => unhook(acc)}>
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                          {units.map((u) => (
                            <tr key={u.id} className="border-t border-border/20">
                              <td className="py-1 pr-3 pl-4 font-mono text-[10px] text-secondary">
                                {u.internal_code ?? u.id.slice(0, 8)}
                              </td>
                              <td className="py-1 pr-3 text-secondary text-[11px]">pieza</td>
                              <td></td>
                              <td className="py-1 pr-3" colSpan={2} onClick={(e) => e.stopPropagation()}>
                                <UnitStatusSelect unit={u} onDone={refresh} />
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <AddAccessoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        audit={audit}
        accessories={accessories}
        onDone={refresh}
      />
    </div>
  );
}

