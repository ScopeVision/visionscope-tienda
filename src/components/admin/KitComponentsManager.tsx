import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, ArrowUp, ArrowDown, Search, ImageOff, Loader2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  parentProductId: string | null;
  /** Restrict picker to a category slug (e.g. "lenses"). */
  pickerCategorySlug?: string;
  /** Group components by variant_name (Basic Kit / Pro Kit ...). */
  useVariants?: boolean;
};

const DEFAULT_VARIANT = "default";

export const KitComponentsManager = ({
  parentProductId,
  pickerCategorySlug,
  useVariants = false,
}: Props) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<string>(DEFAULT_VARIANT);
  const [newVariantName, setNewVariantName] = useState("");
  const [renamingVariant, setRenamingVariant] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["kit-components", parentProductId],
    enabled: !!parentProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_components")
        .select(
          "*, child:products!product_components_child_product_id_fkey(id, slug, name_es, name_ca, name_en, name_fr, images, price_day, kit_mode)"
        )
        .eq("parent_product_id", parentProductId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Variants present in the current dataset (only when useVariants).
  const variants = useMemo(() => {
    if (!useVariants) return [DEFAULT_VARIANT];
    const set = new Set<string>();
    components.forEach((c: any) => set.add(c.variant_name ?? DEFAULT_VARIANT));
    if (set.size === 0) set.add("Basic Kit");
    return Array.from(set);
  }, [components, useVariants]);

  // Keep activeVariant valid when variant list changes.
  useEffect(() => {
    if (useVariants && !variants.includes(activeVariant)) {
      setActiveVariant(variants[0]);
    }
  }, [variants, activeVariant, useVariants]);

  const visibleComponents = useMemo(() => {
    if (!useVariants) return components;
    return components.filter(
      (c: any) => (c.variant_name ?? DEFAULT_VARIANT) === activeVariant
    );
  }, [components, activeVariant, useVariants]);

  const { data: catData } = useQuery({
    queryKey: ["picker-cat", pickerCategorySlug],
    enabled: !!pickerCategorySlug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", pickerCategorySlug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["picker-products", catData?.id, parentProductId, pickerCategorySlug],
    enabled: pickerOpen,
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, slug, name_es, name_ca, name_en, name_fr, images, price_day, kit_mode")
        .eq("kit_mode", "individual")
        .order("name_es");
      if (catData?.id) q = q.eq("category_id", catData.id);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data ?? []).filter((p: any) => p.id !== parentProductId);
    },
  });

  // Already-used ids inside the *current variant* (allow same product across variants).
  const usedIds = useMemo(
    () => new Set(visibleComponents.map((c: any) => c.child_product_id)),
    [visibleComponents]
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

  const refresh = () => qc.invalidateQueries({ queryKey: ["kit-components", parentProductId] });

  const addComponent = async (childId: string) => {
    if (!parentProductId) {
      toast.error(t("admin.kit.saveProductFirst"));
      return;
    }
    setSavingId(childId);
    const variantName = useVariants ? activeVariant : null;
    const nextOrder = visibleComponents.length;
    const { error } = await supabase.from("product_components").insert({
      parent_product_id: parentProductId,
      child_product_id: childId,
      variant_name: variantName,
      sort_order: nextOrder,
      quantity: 1,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    setSearch("");
  };

  const removeComponent = async (id: string) => {
    const { error } = await supabase.from("product_components").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const updateOverride = async (id: string, value: string) => {
    const num = value === "" ? null : Number(value);
    const { error } = await supabase
      .from("product_components")
      .update({ price_day_override: num })
      .eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= visibleComponents.length) return;
    const a = visibleComponents[idx];
    const b = visibleComponents[target];
    const { error: e1 } = await supabase
      .from("product_components")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id);
    const { error: e2 } = await supabase
      .from("product_components")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id);
    if (e1 || e2) return toast.error((e1 ?? e2)!.message);
    refresh();
  };

  const addVariant = () => {
    const name = newVariantName.trim();
    if (!name) return;
    if (variants.includes(name)) {
      toast.error(t("admin.kit.variantExists"));
      return;
    }
    setActiveVariant(name);
    setNewVariantName("");
    // Variant becomes "real" once a component is added to it.
  };

  const renameVariant = async () => {
    const newName = renameValue.trim();
    if (!renamingVariant || !newName || newName === renamingVariant) {
      setRenamingVariant(null);
      return;
    }
    if (variants.includes(newName)) {
      toast.error(t("admin.kit.variantExists"));
      return;
    }
    const { error } = await supabase
      .from("product_components")
      .update({ variant_name: newName })
      .eq("parent_product_id", parentProductId!)
      .eq("variant_name", renamingVariant);
    if (error) return toast.error(error.message);
    setActiveVariant(newName);
    setRenamingVariant(null);
    refresh();
  };

  const deleteVariant = async (name: string) => {
    if (!confirm(t("admin.kit.confirmDeleteVariant", { name }))) return;
    const { error } = await supabase
      .from("product_components")
      .delete()
      .eq("parent_product_id", parentProductId!)
      .eq("variant_name", name);
    if (error) return toast.error(error.message);
    refresh();
  };

  if (!parentProductId) {
    return (
      <p className="text-sm text-secondary border border-dashed border-border rounded-md p-4">
        {t("admin.kit.saveProductFirst")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Variant tabs */}
      {useVariants && (
        <div>
          <Label className="text-xs uppercase tracking-wider text-secondary mb-2 block">
            {t("admin.kit.variants")}
          </Label>
          <div className="flex flex-wrap gap-2 items-center">
            {variants.map((v) => {
              const active = v === activeVariant;
              const isRenaming = renamingVariant === v;
              return (
                <div key={v} className="flex items-center">
                  {isRenaming ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            renameVariant();
                          }
                          if (e.key === "Escape") setRenamingVariant(null);
                        }}
                        className="h-8 w-32 text-xs"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={renameVariant}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveVariant(v)}
                      className={cn(
                        "px-3 py-1.5 rounded-l-md border text-xs uppercase tracking-wider transition-colors",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                      )}
                    >
                      {v}
                    </button>
                  )}
                  {!isRenaming && active && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingVariant(v);
                          setRenameValue(v);
                        }}
                        className="px-2 py-1.5 border border-l-0 border-border bg-background hover:bg-muted"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVariant(v)}
                        className="px-2 py-1.5 border border-l-0 border-border bg-background rounded-r-md hover:bg-destructive/10 text-destructive"
                        title={t("common.delete")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-1 ml-2">
              <Input
                placeholder={t("admin.kit.newVariantPlaceholder")}
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addVariant();
                  }
                }}
                className="h-8 w-40 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addVariant}
                disabled={!newVariantName.trim()}
                className="h-8 gap-1"
              >
                <Plus className="h-3 w-3" /> {t("admin.kit.addVariant")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs uppercase tracking-wider text-secondary">
            {useVariants
              ? t("admin.kit.componentsTitleVariant", { name: activeVariant })
              : t("admin.kit.componentsTitle")}
          </Label>
          <p className="text-xs text-secondary mt-1">{t("admin.kit.componentsHint")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPickerOpen((v) => !v)}
          className="gap-1"
        >
          <Plus className="h-3 w-3" /> {t("admin.kit.addItem")}
        </Button>
      </div>

      {pickerOpen && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
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
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredCandidates.length === 0 ? (
              <p className="text-xs text-secondary text-center py-4">{t("admin.kit.noResults")}</p>
            ) : (
              filteredCandidates.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addComponent(p.id)}
                  disabled={savingId === p.id}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-background border border-transparent hover:border-border text-left transition-colors disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-sm bg-muted overflow-hidden grid place-items-center shrink-0">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-secondary/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {localized(p, "name", i18n.language)}
                    </div>
                    <div className="text-[10px] font-mono text-secondary">{p.slug}</div>
                  </div>
                  <div className="text-xs text-secondary shrink-0">
                    €{Number(p.price_day).toFixed(0)}/d
                  </div>
                  {savingId === p.id && <Loader2 className="h-3 w-3 animate-spin" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-xs text-secondary text-center py-4">{t("common.loading")}</p>
        ) : visibleComponents.length === 0 ? (
          <p className="text-xs text-secondary text-center py-6 border border-dashed border-border rounded-md">
            {t("admin.kit.empty")}
          </p>
        ) : (
          visibleComponents.map((c: any, idx: number) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border bg-background"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className={cn(
                    "p-0.5 rounded hover:bg-muted",
                    idx === 0 && "opacity-30 cursor-not-allowed"
                  )}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === visibleComponents.length - 1}
                  className={cn(
                    "p-0.5 rounded hover:bg-muted",
                    idx === visibleComponents.length - 1 && "opacity-30 cursor-not-allowed"
                  )}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <div className="w-10 h-10 rounded-sm bg-muted overflow-hidden grid place-items-center shrink-0">
                {c.child?.images?.[0] ? (
                  <img src={c.child.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="h-4 w-4 text-secondary/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {c.child ? localized(c.child, "name", i18n.language) : "—"}
                </div>
                <div className="text-[10px] font-mono text-secondary">
                  €{Number(c.child?.price_day ?? 0).toFixed(0)}/d {t("admin.kit.basePrice")}
                </div>
              </div>
              <div className="w-32 shrink-0">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={c.price_day_override ?? ""}
                  placeholder={t("admin.kit.overridePlaceholder")}
                  onBlur={(e) => updateOverride(c.id, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeComponent(c.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
