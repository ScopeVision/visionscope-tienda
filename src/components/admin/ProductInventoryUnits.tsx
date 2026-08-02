import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Boxes, Plus, Save, Trash2, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

const sb = supabase as any;

const AGREEMENTS = [
  { value: "company_owned", label: "Company owned (100% empresa)" },
  { value: "split_70_30", label: "Split 70/30 (owner 70%)" },
  { value: "custom_split", label: "Custom split" },
  { value: "concession", label: "Concesión" },
  { value: "external_managed", label: "Gestionado externo" },
];

const STATUSES = [
  { value: "active", label: "Activo" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "retired", label: "Retirado" },
  { value: "lost", label: "Perdido" },
];

type UnitDraft = {
  id?: string;
  serial: string;
  internal_code: string;
  owner_id: string | null;
  agreement_type: string;
  owner_split_pct: number;
  acquisition_value: number;
  target_recovery_value: number;
  status: string;
  notes: string;
  active: boolean;
  variant_id: string | null;
  parent_unit_id?: string | null;
};

const emptyDraft = (): UnitDraft => ({
  serial: "",
  internal_code: "",
  owner_id: null,
  agreement_type: "company_owned",
  owner_split_pct: 0,
  acquisition_value: 0,
  target_recovery_value: 0,
  status: "active",
  notes: "",
  active: true,
  variant_id: null,
  parent_unit_id: null,
});

export function ProductInventoryUnits({ productId }: { productId?: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UnitDraft | null>(null);
  const [savingId, setSavingId] = useState<string | "new" | null>(null);
  const [savedId, setSavedId] = useState<string | "new" | null>(null);

  const { data: owners = [] } = useQuery({
    queryKey: ["inventory-owners-list"],
    queryFn: async () =>
      (await sb.from("finance_owners").select("id, name, type").eq("active", true).order("name")).data || [],
  });

  const { data: variants = [] } = useQuery({
    enabled: !!productId,
    queryKey: ["inventory-unit-variants", productId],
    queryFn: async () =>
      (await sb.from("product_variants").select("id, name").eq("product_id", productId).order("sort_order")).data || [],
  });

  const { data: units = [], isLoading, refetch } = useQuery({
    enabled: !!productId,
    queryKey: ["inventory-units", productId],
    queryFn: async () =>
      (await sb.from("inventory_units").select("*").eq("product_id", productId).order("created_at")).data || [],
  });

  const { data: allUnits = [] } = useQuery({
    queryKey: ["inventory-units-all-mini"],
    queryFn: async () =>
      (
        await sb
          .from("inventory_units")
          .select("id, product_id, serial, internal_code, parent_unit_id, active, product:products(name_es)")
          .eq("active", true)
          .order("created_at")
      ).data || [],
  });

  const { data: templateComponents = [] } = useQuery({
    enabled: !!productId,
    queryKey: ["inventory-unit-template", productId],
    queryFn: async () =>
      (
        await sb
          .from("product_components")
          .select("child_product_id, quantity, child:products!product_components_child_product_id_fkey(name_es)")
          .eq("parent_product_id", productId)
      ).data || [],
  });

  const setParent = async (unitId: string, parentId: string | null) => {
    const { error } = await sb.from("inventory_units").update({ parent_unit_id: parentId }).eq("id", unitId);
    if (error) return toast.error(error.message);
    toast.success(parentId ? "Accesorio atado" : "Accesorio desatado");
    qc.invalidateQueries({ queryKey: ["inventory-units-all-mini"] });
    refetch();
  };

  if (!productId) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-secondary">
        Guarda el producto primero para gestionar unidades de inventario.
      </div>
    );
  }

  const splitFor = (d: UnitDraft) =>
    d.agreement_type === "split_70_30" ? 70
    : d.agreement_type === "company_owned" ? 0
    : Number(d.owner_split_pct || 0);

  const save = async (draft: UnitDraft) => {
    // Coherence: if owner selected but agreement is company_owned, refuse
    if (draft.owner_id && draft.agreement_type === "company_owned") {
      toast.error(
        "Has seleccionado un owner pero el agreement es 'company_owned' (0% para el owner). Cambia el agreement a split/custom/concession/external."
      );
      return;
    }
    if (draft.agreement_type !== "company_owned" && !draft.owner_id) {
      toast.error("Selecciona un owner para este acuerdo");
      return;
    }
    const id = draft.id ?? "new";
    setSavingId(id);
    setSavedId(null);
    try {
      const pct = splitFor(draft);
      const payload: any = {
        product_id: productId,
        serial: draft.serial || null,
        internal_code: draft.internal_code || null,
        owner_id: draft.agreement_type === "company_owned" ? null : draft.owner_id,
        agreement_type: draft.agreement_type,
        owner_split_pct: pct,
        acquisition_value: Number(draft.acquisition_value || 0),
        target_recovery_value: Number(draft.target_recovery_value || 0),
        status: draft.status,
        notes: draft.notes || null,
        active: draft.active,
        variant_id: draft.variant_id || null,
        parent_unit_id: draft.parent_unit_id || null,
      };
      const res = draft.id
        ? await sb.from("inventory_units").update(payload).eq("id", draft.id).select().single()
        : await sb.from("inventory_units").insert(payload).select().single();
      if (res.error) {
        console.error("[inventory_units save] error", res.error, "payload:", payload);
        throw res.error;
      }
      console.info("[inventory_units save] ok", res.data);
      toast.success(
        `${draft.id ? "Unidad actualizada" : "Unidad creada"} · owner: ${
          res.data?.owner_id ? ownerName(res.data.owner_id) : "Empresa"
        }`
      );
      setSavedId(id);
      setEditing(null);
      await refetch();
      qc.invalidateQueries({ queryKey: ["inventory-units"] });
      setTimeout(() => setSavedId(null), 1500);
    } catch (e: any) {
      toast.error(`Error guardando: ${e?.message ?? "desconocido"}${e?.code ? ` (${e.code})` : ""}`);
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta unidad? Los entries históricos permanecerán.")) return;
    const { error } = await sb.from("inventory_units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Unidad eliminada");
    refetch();
  };

  const ownerName = (id?: string | null) =>
    id ? owners.find((o: any) => o.id === id)?.name ?? "—" : "Empresa";

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Boxes className="h-4 w-4 text-accent" />
        <Label className="text-xs uppercase tracking-wider text-secondary">
          Unidades de inventario
        </Label>
        <span className="text-[10px] text-secondary ml-auto">
          ownership por unidad física · NO por catálogo
        </span>
      </div>

      {isLoading ? (
        <div className="text-xs text-secondary flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
        </div>
      ) : units.length === 0 && !editing ? (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-secondary flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div>
            Sin unidades. Mientras no haya unidades, los alquileres pagados se registrarán como
            <strong className="text-foreground"> company-owned (sin payout)</strong> y quedará una advertencia en el audit log.
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {units.map((u: any) => (
            <div key={u.id} className="rounded border border-border bg-background/40 px-3 py-2 text-xs flex flex-wrap items-center gap-3">
              <span className="font-mono text-foreground">{u.serial || u.internal_code || u.id.slice(0, 8)}</span>
              <Badge variant="outline" className="text-[10px]">{u.status}</Badge>
              <span className="text-secondary">{ownerName(u.owner_id)}</span>
              <span className="text-secondary">
                {u.agreement_type} · empresa {100 - Number(u.owner_split_pct)}% / owner {Number(u.owner_split_pct)}%
              </span>
              {u.parent_unit_id && (
                <Badge variant="outline" className="text-[10px]">accesorio de una unidad</Badge>
              )}
              {allUnits.filter((x: any) => x.parent_unit_id === u.id).length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {allUnits.filter((x: any) => x.parent_unit_id === u.id).length} accesorio(s)
                </Badge>
              )}
              <div className="ml-auto flex gap-1">
                {savedId === u.id && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ ...u })}>
                  Editar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(u.id)} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <UnitForm
          draft={editing}
          owners={owners}
          variants={variants}
          allUnits={allUnits}
          templateComponents={templateComponents}
          onSetParent={setParent}
          saving={savingId === (editing.id ?? "new")}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => save(editing)}
        />
      )}

      {!editing && (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(emptyDraft())} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Añadir unidad
        </Button>
      )}
    </div>
  );
}

function UnitForm({
  draft, owners, variants, allUnits, templateComponents, onSetParent, saving, onChange, onCancel, onSave,
}: {
  draft: UnitDraft;
  owners: any[];
  variants: any[];
  allUnits: any[];
  templateComponents: any[];
  onSetParent: (unitId: string, parentId: string | null) => void;
  saving: boolean;
  onChange: (d: UnitDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const showPct = draft.agreement_type !== "company_owned" && draft.agreement_type !== "split_70_30";
  const unitLabel = (u: any) =>
    `${u.product?.name_es ? u.product.name_es + " · " : ""}${u.serial || u.internal_code || u.id.slice(0, 8)}`;
  const children = draft.id ? allUnits.filter((u: any) => u.parent_unit_id === draft.id) : [];
  const templateIds = new Set(templateComponents.map((c: any) => c.child_product_id));
  const suggestions = draft.id
    ? allUnits.filter(
        (u: any) => templateIds.has(u.product_id) && !u.parent_unit_id && u.id !== draft.id
      )
    : [];
  return (
    <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Serial</Label>
          <Input value={draft.serial} onChange={(e) => onChange({ ...draft, serial: e.target.value })} placeholder="ej. NN-001" />
        </div>
        <div>
          <Label className="text-xs">Código interno</Label>
          <Input value={draft.internal_code} onChange={(e) => onChange({ ...draft, internal_code: e.target.value })} />
        </div>
        {variants.length > 0 && (
          <div>
            <Label className="text-xs">Variante</Label>
            <Select
              value={draft.variant_id ?? "__none__"}
              onValueChange={(v) => onChange({ ...draft, variant_id: v === "__none__" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Sin variante" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sin variante —</SelectItem>
                {variants.map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">Owner</Label>
          <Select
            value={draft.owner_id ?? "__none__"}
            onValueChange={(v) => {
              const nextOwner = v === "__none__" ? null : v;
              // Auto-bump agreement so the owner isn't silently stripped on save
              const nextAgreement =
                nextOwner && draft.agreement_type === "company_owned" ? "split_70_30" : draft.agreement_type;
              onChange({ ...draft, owner_id: nextOwner, agreement_type: nextAgreement });
            }}
          >
            <SelectTrigger><SelectValue placeholder="Sin owner (empresa)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sin owner (empresa) —</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name} · {o.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {draft.owner_id && draft.agreement_type === "company_owned" && (
            <p className="text-[11px] text-amber-500 mt-1">
              ⚠ Con owner seleccionado el agreement no puede ser company_owned.
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs">Agreement</Label>
          <Select value={draft.agreement_type} onValueChange={(v) => onChange({ ...draft, agreement_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AGREEMENTS.map((a) => (<SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        {showPct && (
          <div>
            <Label className="text-xs">% Owner</Label>
            <Input type="number" min={0} max={100}
              value={draft.owner_split_pct}
              onChange={(e) => onChange({ ...draft, owner_split_pct: Number(e.target.value) })} />
          </div>
        )}
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={draft.status} onValueChange={(v) => onChange({ ...draft, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Valor adquisición</Label>
          <Input type="number" min={0} value={draft.acquisition_value}
            onChange={(e) => onChange({ ...draft, acquisition_value: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Objetivo recuperación</Label>
          <Input type="number" min={0} value={draft.target_recovery_value}
            onChange={(e) => onChange({ ...draft, target_recovery_value: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Pertenece a la unidad (padre)</Label>
        <Select
          value={draft.parent_unit_id ?? "__none__"}
          onValueChange={(v) => onChange({ ...draft, parent_unit_id: v === "__none__" ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Sin padre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sin padre (unidad independiente) —</SelectItem>
            {allUnits
              .filter((u: any) => u.id !== draft.id && u.parent_unit_id !== draft.id)
              .map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{unitLabel(u)}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-secondary mt-1">
          Si esta unidad es un accesorio, átala a la unidad-padre concreta con la que viaja. Hereda su disponibilidad.
        </p>
      </div>

      {draft.id && (
        <div className="rounded-md border border-border p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-secondary">Accesorios de esta unidad</Label>
          {children.length === 0 ? (
            <p className="text-[11px] text-secondary">Todavía no hay accesorios atados a esta unidad.</p>
          ) : (
            <div className="space-y-1">
              {children.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground">{unitLabel(c)}</span>
                  <Button
                    type="button" size="sm" variant="ghost" className="ml-auto text-destructive"
                    onClick={() => onSetParent(c.id, null)}
                  >
                    Desatar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="pt-2 border-t border-border space-y-1">
              <p className="text-[11px] text-secondary">
                Sugerencias según la plantilla del modelo (accesorios libres):
              </p>
              {suggestions.map((u: any) => (
                <div key={u.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-foreground">{unitLabel(u)}</span>
                  <Button
                    type="button" size="sm" variant="outline" className="ml-auto"
                    onClick={() => onSetParent(u.id, draft.id!)}
                  >
                    Atar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <Label className="text-xs">Notas</Label>
        <Input value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {draft.id ? "Actualizar" : "Crear"} unidad
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
