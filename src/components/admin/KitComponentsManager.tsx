import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, ArrowUp, ArrowDown, Search, ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Component = {
  id?: string; // db id when persisted
  child_product_id: string;
  child?: any;
  price_day_override: number | null;
  sort_order: number;
  quantity: number;
  _local?: boolean;
};

type Props = {
  parentProductId: string | null; // null when product not yet saved
  /** restrict picker to a category slug (e.g. "lenses") */
  pickerCategorySlug?: string;
};

export const KitComponentsManager = ({ parentProductId, pickerCategorySlug }: Props) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["kit-components", parentProductId],
    enabled: !!parentProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_components")
        .select("*, child:products!product_components_child_product_id_fkey(id, slug, name_es, name_ca, name_en, name_fr, images, price_day, kit_mode)")
        .eq("parent_product_id", parentProductId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: catData } = useQuery({
    queryKey: ["picker-cat", pickerCategorySlug],
    enabled: !!pickerCategorySlug,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id").eq("slug", pickerCategorySlug!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["picker-products", catData?.id, parentProductId],
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

  const usedIds = useMemo(() => new Set(components.map((c: any) => c.child_product_id)), [components]);

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
    const nextOrder = components.length;
    const { error } = await supabase.from("product_components").insert({
      parent_product_id: parentProductId,
      child_product_id: childId,
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
    if (error) {
      toast.error(error.message);
      return;
    }
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
    if (target < 0 || target >= components.length) return;
    const a = components[idx];
    const b = components[target];
    const { error: e1 } = await supabase
      .from("product_components")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id);
    const { error: e2 } = await supabase
      .from("product_components")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id);
    if (e1 || e2) {
      toast.error((e1 ?? e2)!.message);
      return;
    }
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
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs uppercase tracking-wider text-secondary">
            {t("admin.kit.componentsTitle")}
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
        ) : components.length === 0 ? (
          <p className="text-xs text-secondary text-center py-6 border border-dashed border-border rounded-md">
            {t("admin.kit.empty")}
          </p>
        ) : (
          components.map((c: any, idx: number) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border bg-background"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className={cn("p-0.5 rounded hover:bg-muted", idx === 0 && "opacity-30 cursor-not-allowed")}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === components.length - 1}
                  className={cn(
                    "p-0.5 rounded hover:bg-muted",
                    idx === components.length - 1 && "opacity-30 cursor-not-allowed"
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
