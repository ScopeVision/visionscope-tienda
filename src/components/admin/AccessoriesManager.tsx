import { Fragment, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryAudit, type AccessoryEntry } from "@/hooks/useInventoryAudit";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2, Plus, Unlink } from "lucide-react";
import type { ProductAudit } from "@/lib/inventoryAudit";
import {
  createAccessoryForParent, addAccessoryPieces, UNIT_STATUS_LABEL, UNIT_STATUS_OPTIONS,
} from "@/lib/accessoryCreation";

/** Enter inside these inputs must never submit the surrounding product form. */
const stopEnter = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault();
    (e.target as HTMLElement).blur();
  }
};

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
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Añadir accesorio</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre del accesorio</Label>
            <Input value={name} onKeyDown={stopEnter} onChange={(e) => setName(e.target.value)} placeholder="Motor, Cargador NP…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cantidad de piezas</Label>
            <Input type="number" min={1} value={quantity} onKeyDown={stopEnter} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Crear accesorio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline editable detail fields for one physical piece. */
function UnitDetailFields({ unit, onSaved }: { unit: any; onSaved: () => void }) {
  const save = async (field: string, raw: string) => {
    let value: any = raw.trim() === "" ? null : raw.trim();
    if (field === "acquisition_value") {
      value = raw.trim() === "" ? null : Number(raw.replace(",", "."));
      if (value !== null && Number.isNaN(value)) return toast.error("Valor no válido");
    }
    const current = unit[field] ?? null;
    if (String(current ?? "") === String(value ?? "")) return;
    const { error } = await (supabase as any)
      .from("inventory_units")
      .update({ [field]: value })
      .eq("id", unit.id);
    if (error) return toast.error("No se pudo guardar: " + error.message);
    toast.success("Guardado");
    onSaved();
  };

  return (
    <div className="grid gap-2 sm:grid-cols-3 py-2 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1">
        <Label className="text-[11px]">Serial</Label>
        <Input
          className="h-7 text-xs"
          defaultValue={unit.serial ?? ""}
          onKeyDown={stopEnter}
          onBlur={(e) => save("serial", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Notas</Label>
        <Input
          className="h-7 text-xs"
          defaultValue={unit.notes ?? ""}
          onKeyDown={stopEnter}
          onBlur={(e) => save("notes", e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Valor de reposición (€)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          className="h-7 text-xs"
          defaultValue={unit.acquisition_value ?? ""}
          onKeyDown={stopEnter}
          onBlur={(e) => save("acquisition_value", e.target.value)}
        />
        <p className="text-[10px] text-secondary">
          Lo que cuesta reponer esta pieza. Se usa para cobrar daños y para el seguro.
        </p>
      </div>
    </div>
  );
}

/** Inline editable detail fields for the accessory product itself. */
function AccessoryDetailFields({ product, onSaved }: { product: any; onSaved: () => void }) {
  const save = async (field: string, raw: string) => {
    const value = raw.trim() === "" ? null : raw.trim();
    if (String(product[field] ?? "") === String(value ?? "")) return;
    const { error } = await (supabase as any)
      .from("products")
      .update({ [field]: value })
      .eq("id", product.id);
    if (error) return toast.error("No se pudo guardar: " + error.message);
    toast.success("Guardado");
    onSaved();
  };

  return (
    <div className="space-y-2 py-2 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Marca</Label>
          <Input
            className="h-7 text-xs"
            defaultValue={product.brand ?? ""}
            onKeyDown={stopEnter}
            onBlur={(e) => save("brand", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Modelo</Label>
          <Input
            className="h-7 text-xs"
            defaultValue={product.model ?? ""}
            onKeyDown={stopEnter}
            onBlur={(e) => save("model", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Descripción</Label>
        <Textarea
          rows={3}
          className="text-xs"
          defaultValue={product.description_es ?? ""}
          onKeyDown={stopEnter}
          onBlur={(e) => save("description_es", e.target.value)}
        />
        <p className="text-[10px] text-secondary">
          Medidas, compatibilidad o particularidades de esta pieza.
        </p>
      </div>
    </div>
  );
}

/** Single, shared UI to manage the internal accessories of a parent product. */
export function AccessoriesManager({ parentProductId }: { parentProductId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState<Record<string, boolean>>({});
  const [openUnit, setOpenUnit] = useState<Record<string, boolean>>({});
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
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium uppercase tracking-wider text-secondary">
            Accesorios internos incluidos
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            disabled={!audit}
            onClick={(e) => { e.stopPropagation(); setAddOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" /> Añadir accesorio
          </Button>
        </div>
        <p className="text-[11px] text-secondary">
          Piezas que viajan con este producto y no se alquilan por separado. Al crear una, se genera sola su código y sus piezas físicas.
        </p>
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
                    const accOpen = !!openAcc[acc.component_id];
                    return (
                      <Fragment key={acc.component_id}>
                        <tr className="border-t border-border/40 align-top">
                          <td className="py-1.5 pr-3 font-mono text-[11px]">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenAcc((s) => ({ ...s, [acc.component_id]: !s[acc.component_id] }));
                              }}
                            >
                              {accOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {acc.audit.product.internal_code ?? "—"}
                            </button>
                          </td>
                          <td className="py-1.5 pr-3">{localized(acc.audit.product, "name", lang)}</td>
                          <td className="py-1.5 pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              min={1}
                              defaultValue={acc.quantity}
                              className="h-7 w-16 text-xs text-right ml-auto"
                              onKeyDown={stopEnter}
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
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                              onClick={() => unhook(acc)}>
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                        {accOpen && (
                          <tr className="border-t border-border/20 bg-muted/20">
                            <td colSpan={5}>
                              <AccessoryDetailFields product={acc.audit.product} onSaved={refresh} />
                            </td>
                          </tr>
                        )}
                        {units.map((u) => {
                          const uOpen = !!openUnit[u.id];
                          return (
                            <Fragment key={u.id}>
                              <tr className="border-t border-border/20">
                                <td className="py-1 pr-3 pl-4 font-mono text-[10px] text-secondary">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenUnit((s) => ({ ...s, [u.id]: !s[u.id] }));
                                    }}
                                  >
                                    {uOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    {u.internal_code ?? u.id.slice(0, 8)}
                                    {u.serial && <span className="opacity-70">· {u.serial}</span>}
                                  </button>
                                </td>
                                <td className="py-1 pr-3 text-secondary text-[11px]">pieza</td>
                                <td></td>
                                <td className="py-1 pr-3" colSpan={2} onClick={(e) => e.stopPropagation()}>
                                  <UnitStatusSelect unit={u} onDone={refresh} />
                                </td>
                              </tr>
                              {uOpen && (
                                <tr className="border-t border-border/10 bg-muted/10">
                                  <td colSpan={5}>
                                    <UnitDetailFields unit={u} onSaved={refresh} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
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
