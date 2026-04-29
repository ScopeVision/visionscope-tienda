import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Search,
  ImageOff,
  Loader2,
  Pencil,
  Check,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  parentProductId: string | null;
};

/**
 * Variant-driven price manager.
 *
 * Each product owns N variants. Each variant carries its own price (price_day,
 * price_week, deposit) and an optional list of included components.
 * The product's "base" price column is no longer shown to customers when at
 * least one variant exists — variants are the source of truth.
 */
export const ProductVariantsManager = ({ parentProductId }: Props) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["product-variants", parentProductId],
    enabled: !!parentProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", parentProductId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Auto-select first variant
  useEffect(() => {
    if (variants.length > 0 && (!activeId || !variants.find((v: any) => v.id === activeId))) {
      setActiveId(variants[0].id);
    }
    if (variants.length === 0) setActiveId(null);
  }, [variants, activeId]);

  const { data: components = [] } = useQuery({
    queryKey: ["variant-components", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_components")
        .select(
          "*, child:products!product_components_child_product_id_fkey(id, slug, name_es, name_ca, name_en, name_fr, images, price_day)"
        )
        .eq("variant_id", activeId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["variant-picker-products", parentProductId],
    enabled: pickerOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name_es, name_ca, name_en, name_fr, images, price_day")
        .eq("kit_mode", "individual")
        .order("name_es")
        .limit(200);
      if (error) throw error;
      return (data ?? []).filter((p: any) => p.id !== parentProductId);
    },
  });

  const usedIds = useMemo(
    () => new Set(components.map((c: any) => c.child_product_id)),
    [components]
  );

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((p: any) => {
      if (usedIds.has(p.id)) return false;
      if (!q) return true;
      return (
        (p.name_es ?? "").toLowerCase().includes(q) ||
        (p.slug ?? "").toLowerCase().includes(q)
      );
    });
  }, [candidates, search, usedIds]);

  const refreshVariants = () =>
    qc.invalidateQueries({ queryKey: ["product-variants", parentProductId] });
  const refreshComponents = () =>
    qc.invalidateQueries({ queryKey: ["variant-components", activeId] });

  // ----- Variant CRUD -----
  const addVariant = async () => {
    if (!parentProductId) {
      toast.error(t("admin.kit.saveProductFirst"));
      return;
    }
    const name = `Variant ${variants.length + 1}`;
    const { data, error } = await supabase
      .from("product_variants")
      .insert({
        product_id: parentProductId,
        name,
        price_day: 0,
        deposit: 0,
        sort_order: variants.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    refreshVariants();
    setActiveId(data.id);
  };

  const updateVariant = async (id: string, patch: Partial<{ name: string; price_day: number; price_week: number | null; deposit: number; sort_order: number }>) => {
    const { error } = await supabase.from("product_variants").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else refreshVariants();
  };

  const deleteVariant = async (id: string) => {
    if (!confirm(t("admin.variants.confirmDelete"))) return;
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refreshVariants();
  };

  const moveVariant = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= variants.length) return;
    const a = variants[idx];
    const b = variants[target];
    await supabase.from("product_variants").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("product_variants").update({ sort_order: a.sort_order }).eq("id", b.id);
    refreshVariants();
  };

  // ----- Component CRUD (per active variant) -----
  const addComponent = async (childId: string) => {
    if (!activeId || !parentProductId) return;
    setSavingId(childId);
    const { error } = await supabase.from("product_components").insert({
      parent_product_id: parentProductId,
      child_product_id: childId,
      variant_id: activeId,
      sort_order: components.length,
      quantity: 1,
    });
    setSavingId(null);
    if (error) return toast.error(error.message);
    refreshComponents();
    setSearch("");
  };

  const removeComponent = async (id: string) => {
    const { error } = await supabase.from("product_components").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refreshComponents();
  };

  if (!parentProductId) {
    return (
      <p className="text-sm text-secondary border border-dashed border-border rounded-md p-4">
        {t("admin.kit.saveProductFirst")}
      </p>
    );
  }

  const activeVariant = variants.find((v: any) => v.id === activeId);

  return (
    <div className="space-y-5">
      {/* Variant tabs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-wider text-secondary">
            {t("admin.variants.title")}
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addVariant}
            className="h-8 gap-1"
          >
            <Plus className="h-3 w-3" /> {t("admin.variants.add")}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-xs text-secondary">{t("common.loading")}</p>
        ) : variants.length === 0 ? (
          <p className="text-xs text-secondary text-center py-6 border border-dashed border-border rounded-md">
            {t("admin.variants.empty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {variants.map((v: any, idx: number) => {
              const active = v.id === activeId;
              const isRenaming = renamingId === v.id;
              return (
                <div key={v.id} className="flex items-center">
                  {isRenaming ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            updateVariant(v.id, { name: renameValue.trim() || v.name });
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="h-8 w-32 text-xs"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          updateVariant(v.id, { name: renameValue.trim() || v.name });
                          setRenamingId(null);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveId(v.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-l-md border text-xs uppercase tracking-wider transition-colors",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                      )}
                    >
                      {v.name}
                    </button>
                  )}
                  {!isRenaming && active && (
                    <>
                      <button
                        type="button"
                        onClick={() => moveVariant(idx, -1)}
                        disabled={idx === 0}
                        className="px-1.5 py-1.5 border border-l-0 border-border bg-background hover:bg-muted disabled:opacity-30"
                        title="Up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVariant(idx, 1)}
                        disabled={idx === variants.length - 1}
                        className="px-1.5 py-1.5 border border-l-0 border-border bg-background hover:bg-muted disabled:opacity-30"
                        title="Down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(v.id);
                          setRenameValue(v.name);
                        }}
                        className="px-2 py-1.5 border border-l-0 border-border bg-background hover:bg-muted"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVariant(v.id)}
                        className="px-2 py-1.5 border border-l-0 border-border bg-background rounded-r-md hover:bg-destructive/10 text-destructive"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active variant editor */}
      {activeVariant && (
        <div className="rounded-md border border-border p-4 space-y-5 bg-surface/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
                {t("admin.variants.priceDay")} *
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                defaultValue={activeVariant.price_day ?? 0}
                onBlur={(e) =>
                  updateVariant(activeVariant.id, { price_day: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
                {t("admin.variants.priceWeek")}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                defaultValue={activeVariant.price_week ?? ""}
                onBlur={(e) =>
                  updateVariant(activeVariant.id, {
                    price_week: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
                {t("admin.variants.deposit")}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                defaultValue={activeVariant.deposit ?? 0}
                onBlur={(e) =>
                  updateVariant(activeVariant.id, { deposit: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          {/* Included components for this variant */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider text-secondary">
                {t("admin.variants.includes")}
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setPickerOpen((v) => !v)}
                className="gap-1 h-8"
              >
                <Plus className="h-3 w-3" /> {t("admin.kit.addItem")}
              </Button>
            </div>

            {pickerOpen && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3 mb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                  <Input
                    autoFocus
                    placeholder={t("common.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {filteredCandidates.length === 0 ? (
                    <p className="text-xs text-secondary text-center py-3">
                      {t("admin.kit.noResults")}
                    </p>
                  ) : (
                    filteredCandidates.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addComponent(p.id)}
                        disabled={savingId === p.id}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-background border border-transparent hover:border-border text-left transition-colors disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-sm bg-muted overflow-hidden grid place-items-center shrink-0">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageOff className="h-3 w-3 text-secondary/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {localized(p, "name", i18n.language)}
                          </div>
                        </div>
                        {savingId === p.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {components.length === 0 ? (
              <p className="text-xs text-secondary text-center py-4 border border-dashed border-border rounded-md">
                {t("admin.variants.noIncludes")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {components.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-2 rounded-md border border-border bg-background"
                  >
                    <div className="w-8 h-8 rounded-sm bg-muted overflow-hidden grid place-items-center shrink-0">
                      {c.child?.images?.[0] ? (
                        <img src={c.child.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff className="h-3 w-3 text-secondary/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-sm truncate">
                      {c.child ? localized(c.child, "name", i18n.language) : "—"}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeComponent(c.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
