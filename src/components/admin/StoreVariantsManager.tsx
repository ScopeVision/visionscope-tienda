import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";

export type StoreVariant = {
  id?: string;
  product_id?: string;
  name: string;
  description: string;
  sku: string | null;
  price: number;
  stock: number;
  sort_order: number;
  _dirty?: boolean;
  _new?: boolean;
};

type Props = {
  productId: string | undefined; // undefined when creating new product
  /** Buffered variants for new products (when no productId yet). */
  draftVariants?: StoreVariant[];
  onDraftChange?: (v: StoreVariant[]) => void;
};

export const StoreVariantsManager = ({ productId, draftVariants, onDraftChange }: Props) => {
  const [variants, setVariants] = useState<StoreVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDraftMode = !productId;

  useEffect(() => {
    if (isDraftMode) {
      setVariants(draftVariants ?? []);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("store_variants")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      setLoading(false);
      if (cancelled) return;
      if (error) return toast.error(error.message);
      setVariants((data ?? []) as StoreVariant[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, isDraftMode, draftVariants]);

  const update = (idx: number, patch: Partial<StoreVariant>) => {
    setVariants((curr) => {
      const next = curr.map((v, i) => (i === idx ? { ...v, ...patch, _dirty: true } : v));
      if (isDraftMode) onDraftChange?.(next);
      return next;
    });
  };

  const add = () => {
    setVariants((curr) => {
      const next = [
        ...curr,
        {
          name: "",
          description: "",
          sku: "",
          price: 0,
          stock: 0,
          sort_order: curr.length,
          _new: true,
          _dirty: true,
        } as StoreVariant,
      ];
      if (isDraftMode) onDraftChange?.(next);
      return next;
    });
  };

  const remove = async (idx: number) => {
    const v = variants[idx];
    if (v.id && !isDraftMode) {
      if (!confirm("¿Eliminar variante?")) return;
      const { error } = await (supabase as any).from("store_variants").delete().eq("id", v.id);
      if (error) return toast.error(error.message);
    }
    setVariants((curr) => {
      const next = curr.filter((_, i) => i !== idx);
      if (isDraftMode) onDraftChange?.(next);
      return next;
    });
  };

  const saveAll = async () => {
    if (isDraftMode || !productId) return;
    setSaving(true);
    for (const v of variants) {
      if (!v._dirty) continue;
      if (!v.name.trim()) {
        toast.error("Toda variante necesita un nombre");
        setSaving(false);
        return;
      }
      const payload = {
        product_id: productId,
        name: v.name.trim(),
        description: v.description ?? "",
        sku: v.sku || null,
        price: Number(v.price ?? 0),
        stock: Number(v.stock ?? 0),
        sort_order: Number(v.sort_order ?? 0),
      };
      const { error } = v.id
        ? await (supabase as any).from("store_variants").update(payload).eq("id", v.id)
        : await (supabase as any).from("store_variants").insert(payload);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast.success("Variantes guardadas");
    // reload
    const { data } = await (supabase as any)
      .from("store_variants")
      .select("*")
      .eq("product_id", productId)
      .order("sort_order");
    setVariants((data ?? []) as StoreVariant[]);
  };

  if (loading) return <p className="text-sm text-secondary">Cargando variantes…</p>;

  return (
    <div className="space-y-3">
      {variants.length === 0 && (
        <p className="text-xs text-secondary">
          Sin variantes. Las variantes permiten ofrecer configuraciones (montura, color, kit…).
        </p>
      )}

      {variants.map((v, idx) => (
        <div
          key={v.id ?? `new-${idx}`}
          className="rounded-md border border-border bg-background/50 p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-secondary/40" />
            <Input
              placeholder="Nombre de la variante"
              value={v.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              className="flex-1 h-8"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => remove(idx)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-secondary">SKU</Label>
              <Input
                value={v.sku ?? ""}
                onChange={(e) => update(idx, { sku: e.target.value })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-secondary">Precio €</Label>
              <Input
                type="number"
                step="0.01"
                value={v.price}
                onChange={(e) => update(idx, { price: Number(e.target.value) })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-secondary">Stock</Label>
              <Input
                type="number"
                value={v.stock}
                onChange={(e) => update(idx, { stock: Number(e.target.value) })}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-secondary">Orden</Label>
              <Input
                type="number"
                value={v.sort_order}
                onChange={(e) => update(idx, { sort_order: Number(e.target.value) })}
                className="h-8"
              />
            </div>
          </div>
          <Textarea
            placeholder="Descripción de la variante (opcional)"
            value={v.description}
            onChange={(e) => update(idx, { description: e.target.value })}
            rows={2}
            className="text-sm"
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Añadir variante
        </Button>
        {!isDraftMode && variants.some((v) => v._dirty) && (
          <Button type="button" size="sm" onClick={saveAll} disabled={saving}>
            {saving ? "Guardando…" : "Guardar variantes"}
          </Button>
        )}
      </div>
    </div>
  );
};
