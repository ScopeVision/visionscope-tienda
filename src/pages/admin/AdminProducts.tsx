import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { formatCurrency } from "@/lib/rental";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import InventoryPanel from "@/components/admin/InventoryPanel";
import { Plus, Pencil, Trash2, Search, ImageOff, Copy, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useInventoryAudit } from "@/hooks/useInventoryAudit";
import { buildExportRows, exportInventoryXlsx } from "@/lib/inventoryExport";

const AdminProducts = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const { audits, categoryName } = useInventoryAudit();

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = localized(p, "name", i18n.language).toLowerCase();
        if (!name.includes(q) && !p.slug.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, categoryFilter, search, i18n.language]);

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

  const exportListToXlsx = async () => {
    const filteredIds = new Set(filtered.map((p: any) => p.id));
    const rows = buildExportRows(
      audits.filter((a) => filteredIds.has(a.product.id)),
      categoryName,
      i18n.language
    );
    if (rows.length === 0) {
      toast.error("Nada que exportar");
      return;
    }
    await exportInventoryXlsx(rows);
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

      <Tabs defaultValue="list">
        <TabsList className="bg-muted">
          <TabsTrigger value="list">Listado</TabsTrigger>
          <TabsTrigger value="inventory">Inventario</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-5">
          {/* Filter bar */}
          <div className="grid sm:grid-cols-[1fr_240px_auto] gap-3 mb-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
              <Input
                placeholder={t("common.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 px-3 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">{t("common.all")}</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {localized(c, "name", i18n.language)}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={exportListToXlsx} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Exportar a Excel
            </Button>
          </div>

          <div className="rounded-md bg-surface border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("admin.categories")}</TableHead>
                  <TableHead className="text-right">{t("common.perDay")}</TableHead>
                  <TableHead className="text-right">{t("common.deposit")}</TableHead>
                  <TableHead className="text-right">{t("admin.stock")}</TableHead>
                  <TableHead className="text-right w-20">Orden</TableHead>
                  <TableHead className="text-center w-28">Destacado</TableHead>
                  <TableHead className="text-right w-24">Alquileres</TableHead>
                  <TableHead className="text-center">{t("admin.published")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-secondary py-10">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-secondary py-10">
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>
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
                        <div className="text-[10px] font-mono text-secondary mt-0.5">{p.slug}</div>
                      </TableCell>
                      <TableCell className="text-secondary">
                        {p.category ? localized(p.category, "name", i18n.language) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(p.price_day), i18n.language)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(p.deposit), i18n.language)}
                      </TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          defaultValue={p.sort_order ?? 0}
                          className="w-16 h-7 text-right text-xs px-1"
                          onBlur={(e) => updateSortOrder(p.id, Number(e.target.value))}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />
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
                      <TableCell className="text-right text-xs text-secondary tabular-nums">
                        {(() => {
                          const pop = popularityMap.get(p.id);
                          if (!pop) return "—";
                          return `${pop.rentals_12m} / ${pop.rentals_total}`;
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.published}
                          onCheckedChange={() => togglePublished(p)}
                        />
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-5">
          <InventoryPanel />
        </TabsContent>
      </Tabs>

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
