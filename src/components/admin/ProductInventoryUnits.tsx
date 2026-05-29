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

  const { data: units = [], isLoading, refetch } = useQuery({
    enabled: !!productId,
    queryKey: ["inventory-units", productId],
    queryFn: async () =>
      (await sb.from("inventory_units").select("*").eq("product_id", productId).order("created_at")).data || [],
  });

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
      };
      const res = draft.id
        ? await sb.from("inventory_units").update(payload).eq("id", draft.id)
        : await sb.from("inventory_units").insert(payload);
      if (res.error) throw res.error;
      toast.success(draft.id ? "Unidad actualizada" : "Unidad creada");
      setSavedId(id);
      setEditing(null);
      await refetch();
      qc.invalidateQueries({ queryKey: ["inventory-units"] });
      setTimeout(() => setSavedId(null), 1500);
    } catch (e: any) {
      toast.error(e?.message ?? "Error guardando la unidad");
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
  draft, owners, saving, onChange, onCancel, onSave,
}: {
  draft: UnitDraft;
  owners: any[];
  saving: boolean;
  onChange: (d: UnitDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const showPct = draft.agreement_type !== "company_owned" && draft.agreement_type !== "split_70_30";
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
        <div>
          <Label className="text-xs">Owner</Label>
          <Select
            value={draft.owner_id ?? "__none__"}
            onValueChange={(v) => onChange({ ...draft, owner_id: v === "__none__" ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="Sin owner (empresa)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sin owner (empresa) —</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name} · {o.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
