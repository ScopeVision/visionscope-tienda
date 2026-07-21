import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/rental";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Wallet, TrendingUp, CircleDollarSign } from "lucide-react";

const fmt = (n: number | null | undefined) => formatCurrency(Number(n || 0), "es");
const sb = supabase as any;

function KpiCard({ icon: Icon, label, value, tone = "default" }: any) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    warning: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="p-4 rounded-xl bg-surface border border-border">
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${tones[tone]}`} />
        <span className="text-[10px] uppercase tracking-wider text-secondary">{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-display font-medium ${tones[tone]}`}>{value}</div>
    </div>
  );
}

const METHOD_OPTIONS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "efectivo", label: "Efectivo" },
  { value: "otro", label: "Otro" },
];

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function PaymentDialog({
  ownerId, open, onOpenChange, editing, onSaved,
}: {
  ownerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>(() => ({
    amount: "",
    paid_at: todayISO(),
    method: "transferencia",
    reference: "",
    notes: "",
  }));

  // Sync when editing changes
  useMemo(() => {
    if (editing) {
      setForm({
        amount: String(editing.amount ?? ""),
        paid_at: editing.paid_at ? String(editing.paid_at).slice(0, 10) : todayISO(),
        method: editing.method || "transferencia",
        reference: editing.reference || "",
        notes: editing.notes || "",
      });
    } else if (open) {
      setForm({ amount: "", paid_at: todayISO(), method: "transferencia", reference: "", notes: "" });
    }
  }, [editing, open]);

  const save = async () => {
    const v = Number(form.amount);
    if (!v || v <= 0) return toast.error("El importe debe ser mayor que 0");
    const { data: userRes } = await sb.auth.getUser();
    const uid = userRes?.user?.id || null;
    const payload: any = {
      owner_id: ownerId,
      amount: v,
      currency: "EUR",
      paid_at: new Date(form.paid_at).toISOString(),
      method: form.method || null,
      reference: form.reference || null,
      notes: form.notes || null,
    };
    let res;
    if (editing?.id) {
      res = await sb.from("finance_owner_payments").update(payload).eq("id", editing.id);
    } else {
      res = await sb.from("finance_owner_payments").insert({ ...payload, created_by: uid });
    }
    if (res.error) return toast.error(res.error.message);
    toast.success(editing?.id ? "Pago actualizado" : "Pago registrado");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Editar pago" : "Registrar pago"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Importe €</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.paid_at}
                onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Método</Label>
            <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Referencia</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="ID de transferencia, concepto…"
            />
          </div>
          <div>
            <Label>Nota</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>{editing?.id ? "Guardar" : "Registrar pago"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthRow({ ownerId, row }: { ownerId: string; row: any }) {
  const [open, setOpen] = useState(false);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["owner-period-detail", ownerId, row.period_month],
    enabled: open,
    queryFn: async () => (await sb
      .from("finance_period_v")
      .select("booking_id, booking_reference, period_date, period_month, gross_amount, payout_amount, owner_split_pct_snapshot, agreement_type_snapshot")
      .eq("owner_id", ownerId)
      .eq("period_month", row.period_month)
      .order("period_date", { ascending: false })).data || [],
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(!open)}>
          <TableCell className="w-8">
            <CollapsibleTrigger asChild>
              <button type="button" className="text-secondary">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className="font-medium">{row.period_month}</TableCell>
          <TableCell>{row.bookings_count}</TableCell>
          <TableCell className="text-right font-medium">{fmt(row.generated_payout)}</TableCell>
        </TableRow>
        <CollapsibleContent asChild>
          <TableRow>
            <TableCell colSpan={4} className="bg-background/40 p-0">
              <div className="p-3">
                {isLoading ? (
                  <div className="text-xs text-secondary py-2">Cargando…</div>
                ) : entries.length === 0 ? (
                  <div className="text-xs text-secondary py-2">Sin reservas en este mes.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Referencia</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>% split</TableHead>
                        <TableHead>Acuerdo</TableHead>
                        <TableHead className="text-right">Bruto</TableHead>
                        <TableHead className="text-right">Owner</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e: any, i: number) => (
                        <TableRow key={`${e.booking_id}-${i}`}>
                          <TableCell className="font-mono text-xs">{e.booking_reference || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {e.period_date ? new Date(e.period_date).toLocaleDateString("es-ES") : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {e.owner_split_pct_snapshot != null ? `${Number(e.owner_split_pct_snapshot)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline">{e.agreement_type_snapshot || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">{fmt(e.gross_amount)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(e.payout_amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
}

export default function AdminOwnerProfile() {
  const { id } = useParams<{ id: string }>();
  const ownerId = id!;
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  const { data: owner } = useQuery({
    queryKey: ["owner-profile", ownerId],
    enabled: !!ownerId,
    queryFn: async () => (await sb.from("finance_owners").select("*").eq("id", ownerId).maybeSingle()).data,
  });

  const { data: balance } = useQuery({
    queryKey: ["owner-balance", ownerId],
    enabled: !!ownerId,
    queryFn: async () => (await sb.from("finance_owner_balances").select("*").eq("owner_id", ownerId).maybeSingle()).data,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["owner-units", ownerId],
    enabled: !!ownerId,
    queryFn: async () => (await sb.from("inventory_units")
      .select("id, serial, internal_code, agreement_type, owner_split_pct, status, product:products(name_es)")
      .eq("owner_id", ownerId)
      .eq("active", true)).data || [],
  });

  const { data: monthly = [] } = useQuery({
    queryKey: ["owner-monthly", ownerId],
    enabled: !!ownerId,
    queryFn: async () => (await sb.from("finance_owner_monthly")
      .select("*")
      .eq("owner_id", ownerId)
      .order("period_month", { ascending: false })).data || [],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["owner-payments", ownerId],
    enabled: !!ownerId,
    queryFn: async () => (await sb.from("finance_owner_payments")
      .select("*")
      .eq("owner_id", ownerId)
      .order("paid_at", { ascending: false })).data || [],
  });

  const remaining = Number(balance?.remaining_unpaid || 0);
  const remainingTone = remaining > 0.01 ? "negative" : remaining < -0.01 ? "warning" : "positive";
  const remainingLabel = remaining > 0.01 ? "Se le debe" : remaining < -0.01 ? "Sobrepago (crédito)" : "Al día";

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["owner-payments", ownerId] });
    qc.invalidateQueries({ queryKey: ["owner-balance", ownerId] });
    qc.invalidateQueries({ queryKey: ["finance-owner-balances"] });
  };

  const deletePayment = async (pid: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    const { error } = await sb.from("finance_owner_payments").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    toast.success("Pago eliminado");
    onSaved();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/finance" className="text-xs text-secondary hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Volver a Finance
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-display font-medium">{owner?.name || "Cargando…"}</h1>
            {owner?.type && <Badge variant="outline">{owner.type}</Badge>}
            {owner && !owner.active && <Badge variant="secondary">inactivo</Badge>}
          </div>
          <div className="text-sm text-secondary">
            {owner?.contact_email || "—"}
            {owner?.contact_phone && <> · {owner.contact_phone}</>}
          </div>
          {owner?.notes && (
            <div className="text-xs text-secondary max-w-xl whitespace-pre-line">{owner.notes}</div>
          )}
        </div>
        <Button onClick={() => { setEditingPayment(null); setPayOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Registrar pago
        </Button>
      </div>

      {units.length > 0 && (
        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-secondary">
            Unidades de inventario asignadas ({units.length})
          </div>
          <div className="space-y-1">
            {units.map((u: any) => (
              <div key={u.id} className="text-xs flex items-center justify-between gap-2">
                <span className="font-mono">{u.serial || u.internal_code || u.id.slice(0, 8)}</span>
                <span className="text-secondary text-right">
                  {u.product?.name_es || "—"} · {u.agreement_type} · owner {Number(u.owner_split_pct)}% · {u.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={TrendingUp} label="Generado total" value={fmt(balance?.total_owed)} />
        <KpiCard icon={Wallet} label="Pagado" value={fmt(balance?.total_paid)} tone="positive" />
        <KpiCard icon={CircleDollarSign} label={remainingLabel} value={fmt(Math.abs(remaining))} tone={remainingTone} />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Generado mes a mes</h2>
        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Reservas</TableHead>
                <TableHead className="text-right">Generado (owner)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((m: any) => (
                <MonthRow key={m.period_month} ownerId={ownerId} row={m} />
              ))}
              {monthly.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-secondary py-8">
                    Sin actividad registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Pagos registrados</h2>
          <Button size="sm" variant="outline" onClick={() => { setEditingPayment(null); setPayOpen(true); }} className="gap-2">
            <Plus className="h-3 w-3" /> Añadir pago
          </Button>
        </div>
        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("es-ES") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.amount)}</TableCell>
                  <TableCell className="text-xs capitalize">{p.method || "—"}</TableCell>
                  <TableCell className="text-xs">{p.reference || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate" title={p.notes || ""}>{p.notes || "—"}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingPayment(p); setPayOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => deletePayment(p.id)}>×</Button>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-secondary py-8">
                    Sin pagos registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-secondary">Saldo pendiente</div>
          <div className="text-xs text-secondary">{remainingLabel}</div>
        </div>
        <div className={`text-3xl font-display font-medium ${
          remaining > 0.01 ? "text-rose-600 dark:text-rose-400"
          : remaining < -0.01 ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400"
        }`}>
          {fmt(Math.abs(remaining))}
        </div>
      </div>

      <PaymentDialog
        ownerId={ownerId}
        open={payOpen}
        onOpenChange={setPayOpen}
        editing={editingPayment}
        onSaved={onSaved}
      />
    </div>
  );
}
