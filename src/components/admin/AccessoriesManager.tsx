import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryAudit, type AccessoryEntry } from "@/hooks/useInventoryAudit";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Unlink } from "lucide-react";
import type { ProductAudit } from "@/lib/inventoryAudit";
import {
  createAccessoryForParent, addAccessoryPieces, UNIT_STATUS_LABEL, UNIT_STATUS_OPTIONS,
} from "@/lib/accessoryCreation";

/** Small inline selector to change the status of one physical unit. */
export function UnitStatusSelect({ unit, onDone }: { unit: any; onDone: () => void }) {
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

export function AddAccessoryDialog({
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

/** Single, shared UI to manage the internal accessories of a parent product. */
export function AccessoriesManager({ parentProductId }: { parentProductId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const { audits, componentsByParent, lang, isLoading } = useInventoryAudit();

  const audit = audits.find((a) => a.product.id === parentProductId) ?? null;
  const accessories = componentsByParent.get(parentProductId) ?? [];

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

  if (isLoading && !audit) {
    return <p className="text-[11px] text-secondary">Cargando accesorios…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-secondary">
          Accesorios internos incluidos
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          disabled={!audit}
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
                      <Fragment key={acc.component_id}>
                        <tr className="border-t border-border/40 align-top">
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
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {audit && (
        <AddAccessoryDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          audit={audit}
          accessories={accessories}
          onDone={refresh}
        />
      )}
    </div>
  );
}

export default AccessoriesManager;
