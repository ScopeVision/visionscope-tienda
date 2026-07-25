import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Pencil, Wrench } from "lucide-react";
import CustomerPicker from "@/components/admin/CustomerPicker";
import { formatCurrency } from "@/lib/rental";

const sb = supabase as any;
const fmt = (n: number | null | undefined) => formatCurrency(Number(n || 0), "es");

const SERVICE_TYPES = ["Retrofit", "Reparación", "Mantenimiento", "Adaptación de lente", "Otro"];

const STATUS_LABEL: Record<string, string> = {
  completed: "Completado",
  invoiced: "Facturado",
  pending_payment: "Pendiente de pago",
};

const STATUS_CLASS: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  invoiced: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  pending_payment: "bg-amber-100 text-amber-700 hover:bg-amber-100",
};

type FormState = {
  id?: string;
  service_date: string;
  customer_id: string | null;
  customer_name_freeform: string;
  service_type: string;
  description: string;
  equipment_source: "client_owned" | "tvs_inventory";
  equipment_reference: string;
  amount_charged: string;
  cost_materials: string;
  status: "completed" | "invoiced" | "pending_payment";
  notes: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const blankForm = (): FormState => ({
  service_date: todayISO(),
  customer_id: null,
  customer_name_freeform: "",
  service_type: "Retrofit",
  description: "",
  equipment_source: "client_owned",
  equipment_reference: "",
  amount_charged: "",
  cost_materials: "0",
  status: "completed",
  notes: "",
});

export default function AdminServices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = sb
        .from("services")
        .select("*, customers(id, full_name, email)")
        .order("service_date", { ascending: false });
      if (statusFilter !== "__all__") q = q.eq("status", statusFilter);
      if (dateFrom) q = q.gte("service_date", dateFrom);
      if (dateTo) q = q.lte("service_date", dateTo);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const totalIncome = useMemo(
    () => services.reduce((s: number, r: any) => s + Number(r.amount_charged || 0), 0),
    [services]
  );

  const openNew = () => {
    setForm(blankForm());
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      service_date: r.service_date,
      customer_id: r.customer_id,
      customer_name_freeform: r.customer_name_freeform ?? "",
      service_type: r.service_type,
      description: r.description,
      equipment_source: r.equipment_source,
      equipment_reference: r.equipment_reference ?? "",
      amount_charged: String(r.amount_charged ?? ""),
      cost_materials: String(r.cost_materials ?? "0"),
      status: r.status,
      notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.description.trim()) return toast.error("La descripción es obligatoria");
    if (!form.amount_charged || isNaN(Number(form.amount_charged))) {
      return toast.error("Monto cobrado inválido");
    }
    if (!form.customer_id && !form.customer_name_freeform.trim()) {
      return toast.error("Indica un cliente registrado o un nombre libre");
    }

    setSaving(true);
    try {
      const payload = {
        service_date: form.service_date,
        customer_id: form.customer_id || null,
        customer_name_freeform: form.customer_id ? null : (form.customer_name_freeform.trim() || null),
        service_type: form.service_type,
        description: form.description.trim(),
        equipment_source: form.equipment_source,
        equipment_reference: form.equipment_reference.trim() || null,
        amount_charged: Number(form.amount_charged),
        cost_materials: Number(form.cost_materials) || 0,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      const shouldHaveEntry = ["completed", "invoiced"].includes(form.status);
      const entryPayload = {
        origin_system: "services",
        source_type: "service_payment",
        gross_amount: Number(form.amount_charged),
        company_amount: Number(form.amount_charged),
        payout_amount: 0,
        currency: "EUR",
        occurred_at: new Date(form.service_date).toISOString(),
        notes: `Servicio: ${form.service_type} — ${form.description.slice(0, 80)}`,
      };

      if (form.id) {
        const { error: upErr } = await sb.from("services").update(payload).eq("id", form.id);
        if (upErr) throw upErr;

        const { data: existingEntry } = await sb
          .from("finance_entries")
          .select("id")
          .eq("service_id", form.id)
          .maybeSingle();

        if (shouldHaveEntry && !existingEntry) {
          const { error } = await sb.from("finance_entries").insert({
            ...entryPayload,
            service_id: form.id,
          });
          if (error) throw error;
        } else if (shouldHaveEntry && existingEntry) {
          const { error } = await sb.from("finance_entries").update({
            gross_amount: entryPayload.gross_amount,
            company_amount: entryPayload.company_amount,
            occurred_at: entryPayload.occurred_at,
            notes: entryPayload.notes,
            status: "active",
          }).eq("id", existingEntry.id);
          if (error) throw error;
        } else if (!shouldHaveEntry && existingEntry) {
          const { error } = await sb.from("finance_entries").update({ status: "void" }).eq("id", existingEntry.id);
          if (error) throw error;
        }
      } else {
        const { data: svc, error: svcErr } = await sb
          .from("services")
          .insert({ ...payload, created_by: user?.email || null })
          .select()
          .single();
        if (svcErr) throw svcErr;

        if (shouldHaveEntry) {
          const { error } = await sb.from("finance_entries").insert({
            ...entryPayload,
            service_id: svc.id,
          });
          if (error) throw error;
        }
      }

      toast.success("Servicio guardado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["finance_entries"] });
      qc.invalidateQueries({ queryKey: ["finance-entries"] });
      qc.invalidateQueries({ queryKey: ["finance-summary"] });
      qc.invalidateQueries({ queryKey: ["finance-billing-period"] });
    } catch (e: any) {
      toast.error(e.message || "Error al guardar el servicio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Servicios
          </h1>
          <p className="text-sm text-secondary mt-1">
            Retrofits, reparaciones, mantenimientos y adaptaciones.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo servicio
        </Button>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="invoiced">Facturado</SelectItem>
                <SelectItem value="pending_payment">Pendiente de pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="text-sm text-secondary">
          Total ingresos del período: <span className="font-medium text-foreground">{fmt(totalIncome)}</span>
          <span className="ml-2">· {services.length} servicio{services.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Margen bruto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-secondary py-6">Cargando…</TableCell></TableRow>
            ) : services.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-secondary py-6">Sin servicios</TableCell></TableRow>
            ) : services.map((s: any) => {
              const margin = Number(s.amount_charged || 0) - Number(s.cost_materials || 0);
              const customerName = s.customers?.full_name || s.customer_name_freeform || "—";
              return (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => openEdit(s)}>
                  <TableCell className="whitespace-nowrap">{s.service_date}</TableCell>
                  <TableCell>{customerName}</TableCell>
                  <TableCell>{s.service_type}</TableCell>
                  <TableCell className="max-w-[320px] truncate" title={s.description}>{s.description}</TableCell>
                  <TableCell className="text-right">{fmt(s.amount_charged)}</TableCell>
                  <TableCell className="text-right">{fmt(margin)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CLASS[s.status] ?? ""} variant="secondary">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                  <TableCell><Pencil className="h-4 w-4 text-secondary" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Fecha del servicio</Label>
              <Input
                type="date"
                value={form.service_date}
                onChange={(e) => setForm({ ...form, service_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <CustomerPicker
                value={form.customer_id}
                onChange={(c) => setForm({ ...form, customer_id: c?.id ?? null })}
              />
              {!form.customer_id && (
                <div>
                  <Label className="text-xs">Nombre del cliente (si no está registrado)</Label>
                  <Input
                    value={form.customer_name_freeform}
                    onChange={(e) => setForm({ ...form, customer_name_freeform: e.target.value })}
                    placeholder="Nombre libre para el histórico"
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Tipo de servicio</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descripción <span className="text-destructive">*</span></Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalle del trabajo realizado"
              />
            </div>

            <div>
              <Label>Origen del equipo</Label>
              <RadioGroup
                value={form.equipment_source}
                onValueChange={(v: any) => setForm({ ...form, equipment_source: v })}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="client_owned" id="src-client" />
                  <Label htmlFor="src-client" className="font-normal cursor-pointer">Equipo del cliente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="tvs_inventory" id="src-tvs" />
                  <Label htmlFor="src-tvs" className="font-normal cursor-pointer">Inventario TVS</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Referencia del equipo</Label>
              <Input
                value={form.equipment_reference}
                onChange={(e) => setForm({ ...form, equipment_reference: e.target.value })}
                placeholder="Ej. Canon 514XL S/N 1234"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monto cobrado (€) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount_charged}
                  onChange={(e) => setForm({ ...form, amount_charged: e.target.value })}
                />
              </div>
              <div>
                <Label>Coste de materiales (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost_materials}
                  onChange={(e) => setForm({ ...form, cost_materials: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="invoiced">Facturado</SelectItem>
                  <SelectItem value="pending_payment">Pendiente de pago</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-secondary mt-1">
                Solo "Completado" y "Facturado" generan entrada en el ledger financiero.
              </p>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar servicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
