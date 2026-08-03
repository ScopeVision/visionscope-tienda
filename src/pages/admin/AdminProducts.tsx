import { useState, useMemo, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { formatCurrency } from "@/lib/rental";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductForm } from "@/components/admin/ProductForm";
import { Badge } from "@/components/ui/badge";
import { ExpandedDetail, SignalBadge } from "@/components/admin/InventoryPanel";
import {
  Plus, Pencil, Trash2, Search, ImageOff, Copy, FileSpreadsheet, FileDown,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useInventoryAudit } from "@/hooks/useInventoryAudit";
import { buildExportRows, exportInventoryCsv, exportInventoryXlsx } from "@/lib/inventoryExport";
import type { ProductAudit } from "@/lib/inventoryAudit";
import { cn } from "@/lib/utils";

const AdminProducts = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [publishedFilter, setPublishedFilter] = useState<string>("__all__");
  const [ownerFilter, setOwnerFilter] = useState<string>("__all__");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag_id, tag:tags(*))")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: popularity = [] } = useQuery({
    queryKey: ["admin-product-popularity"],
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
      m.set(row.product_id, { rentals_12m: Number(row.rentals_12m), rentals_total: Number(row.rentals_total) });
    }
    return m;
  }, [popularity]);

  const {
    audits, categories, owners, categoryName, lang,
    componentsByParent, accessoryProductIds, isLoading: auditLoading,
  } = useInventoryAudit();

  const auditByProductId = useMemo(() => {
    const m = new Map<string, ProductAudit>();
    for (const a of audits) m.set(a.product.id, a);
    return m;
  }, [audits]);

  /** Filas de primer nivel: solo productos padre (sin accesorios internos). */
  const filtered = useMemo(() => {
    return (products as any[]).filter((p: any) => {
      if (accessoryProductIds.has(p.id)) return false;
      const a = auditByProductId.get(p.id);
      if (categoryFilter !== "__all__" && p.category_id !== categoryFilter) return false;
      if (publishedFilter === "published" && !p.published) return false;
      if (publishedFilter === "unpublished" && p.published) return false;
      if (ownerFilter !== "__all__") {
        const units = a?.units ?? [];
        if (ownerFilter === "__none__") {
          if (units.some((u: any) => u.owner_id)) return false;
        } else if (!units.some((u: any) => u.owner_id === ownerFilter)) {
          return false;
        }
      }
      if (onlyErrors && (a?.signals.length ?? 0) === 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (localized(p, "name", i18n.language) || "").toLowerCase();
        const code = (p.internal_code ?? "").toLowerCase();
        const slug = (p.slug ?? "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !slug.includes(q)) return false;
      }
      return true;
    });
  }, [products, accessoryProductIds, auditByProductId, categoryFilter, publishedFilter, ownerFilter, onlyErrors, search, i18n.language]);

  const totalErrors = filtered.reduce((n, p: any) => n + (auditByProductId.get(p.id)?.signals.length ?? 0), 0);
  const criticalErrors = filtered.reduce(
    (n, p: any) =>
      n + (auditByProductId.get(p.id)?.signals.filter((s) => s.severity === "critical").length ?? 0),
    0
  );

  const toggleRow = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const togglePublished = async (p: any) => {
    const { error } = await supabase
      .from("products")
      .update({ published: !p.published })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["rental-products"] });
    qc.invalidateQueries({ queryKey: ["home-featured"] });
  };

  const duplicateProduct = (p: any) => {
    const suggestedSlug = (p.slug ? `${p.slug}-copia` : "");
    const draft: any = {
      ...p,
      id: undefined,
      internal_code: "",
      slug: suggestedSlug,
      name_es: `${p.name_es ?? ""} (copia)`.trim(),
      published: false,
      images: [],
      product_tags: p.product_tags ?? [],
      created_at: undefined,
      updated_at: undefined,
    };
    setEditing(draft);
  };

  const updateSortOrder = async (id: string, value: number) => {
    const { error } = await supabase.from("products").update({ sort_order: value }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const toggleFeatured = async (p: any) => {
    const newVal = !p.is_featured;
    const patch: any = { is_featured: newVal };
    if (!newVal) patch.featured_rank = null;
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["home-featured"] });
    }
  };

  const updateFeaturedRank = async (id: string, value: number | null) => {
    const { error } = await supabase.from("products").update({ featured_rank: value }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  /** Export: padres visibles + sus accesorios internos justo detrás (sin perder filas). */
  const doExport = async (fmt: "csv" | "xlsx") => {
    const list: ProductAudit[] = [];
    const parentByChildId = new Map<string, { name: string; internal_code?: string | null }>();
    const seen = new Set<string>();
    for (const p of filtered as any[]) {
      const a = auditByProductId.get(p.id);
      if (!a) continue;
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
    if (rows.length === 0) {
      toast.error("Nada que exportar");
      return;
    }
    fmt === "csv" ? exportInventoryCsv(rows) : await exportInventoryXlsx(rows);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("products").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.products.toast.deleted"));
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["rental-products"] });
    qc.invalidateQueries({ queryKey: ["home-featured"] });
    setDeleting(null);
  };

  const openDialog = creating || editing !== null;
  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const COLS = 11;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-display font-medium uppercase tracking-tight">
          {t("admin.products.label")}
        </h1>
        <Button
          onClick={() => setCreating(true)}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.18em] text-xs"
        >
          <Plus className="h-4 w-4" /> {t("admin.newProduct")}
        </Button>
      </div>

      {/* Filtros unificados */}
      <div className="rounded-md bg-surface border border-border p-3 grid gap-3 sm:grid-cols-[1fr_180px_160px_180px_auto] mb-4">
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

      {/* Resumen + export */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
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

      <div className="rounded-md bg-surface border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-16"></TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("admin.categories")}</TableHead>
              <TableHead className="text-right">{t("common.perDay")}</TableHead>
              <TableHead className="text-right">{t("admin.stock")}</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-center w-28">Destacado</TableHead>
              <TableHead className="text-center">{t("admin.published")}</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || auditLoading ? (
              <TableRow>
                <TableCell colSpan={COLS} className="text-center text-secondary py-10">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLS} className="text-center text-secondary py-10">—</TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => {
                const audit = auditByProductId.get(p.id);
                const isOpen = expanded.has(p.id);
                const stockMismatch = audit?.signals.some((s) => s.code === "stock_mismatch");
                const pop = popularityMap.get(p.id);
                return (
                  <Fragment key={p.id}>
                    <TableRow>
                      <TableCell className="cursor-pointer" onClick={() => toggleRow(p.id)}>
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-secondary" />
                          : <ChevronRight className="h-4 w-4 text-secondary" />}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => toggleRow(p.id)}>
                        <div className="w-12 h-12 rounded-sm bg-muted overflow-hidden grid place-items-center">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-secondary/40" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {localized(p, "name", i18n.language)}
                        <div className="text-[10px] font-mono text-secondary mt-0.5">
                          {p.internal_code ?? "—"} · {p.slug}
                        </div>
                      </TableCell>
                      <TableCell className="text-secondary text-xs">
                        {p.category ? localized(p.category, "name", i18n.language) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(p.price_day), i18n.language)}
                        <div className="text-[10px] text-secondary">
                          Fianza {formatCurrency(Number(p.deposit), i18n.language)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.stock}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={cn(stockMismatch && "text-amber-500 font-medium")}>
                          {audit?.real_units_in_service ?? 0}
                        </span>
                        <span className="text-secondary"> / {audit?.real_units_total ?? 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Switch
                            checked={p.is_featured ?? false}
                            onCheckedChange={() => toggleFeatured(p)}
                          />
                          {p.is_featured && (
                            <Input
                              type="number"
                              placeholder="#"
                              defaultValue={p.featured_rank ?? ""}
                              className="w-12 h-7 text-center text-xs px-1"
                              onBlur={(e) => updateFeaturedRank(p.id, e.target.value === "" ? null : Number(e.target.value))}
                              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.published}
                          onCheckedChange={() => togglePublished(p)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {!audit || audit.signals.length === 0 ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">OK</span>
                          ) : (
                            audit.signals.map((s) => <SignalBadge key={s.code} signal={s} />)
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => duplicateProduct(p)}
                            aria-label="Duplicar"
                            title="Duplicar producto"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(p)}
                            aria-label={t("common.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleting(p)}
                            aria-label={t("common.delete")}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={COLS} className="p-4">
                          <div className="flex flex-wrap gap-6 text-xs text-secondary mb-4">
                            <div className="flex items-center gap-2">
                              <span className="uppercase tracking-wider">Orden</span>
                              <Input
                                type="number"
                                defaultValue={p.sort_order ?? 0}
                                className="w-20 h-7 text-right text-xs px-1"
                                onBlur={(e) => updateSortOrder(p.id, Number(e.target.value))}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              />
                            </div>
                            <div>
                              <span className="uppercase tracking-wider">Alquileres (12m / total)</span>{" "}
                              <span className="tabular-nums text-foreground">
                                {pop ? `${pop.rentals_12m} / ${pop.rentals_total}` : "—"}
                              </span>
                            </div>
                          </div>
                          {audit && (
                            <ExpandedDetail
                              audit={audit}
                              owners={owners}
                              accessories={componentsByParent.get(p.id) ?? []}
                              lang={lang}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={openDialog} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-3xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
            <DialogTitle className="uppercase tracking-tight">
              {editing?.id ? t("admin.products.editTitle") : t("admin.products.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
            {openDialog && (
              <ProductForm
                product={editing}
                onSaved={closeDialog}
                onCancel={closeDialog}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.products.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.products.deleteConfirm", {
                name: deleting ? localized(deleting, "name", i18n.language) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProducts;
