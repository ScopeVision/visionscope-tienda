import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import MonthNavigator from "@/components/admin/MonthNavigator";
import { currentMonthKey, getMonthRange, parseMonthKey } from "@/lib/monthRange";
import { formatCurrency } from "@/lib/rental";
import {
  TrendingUp, Wallet, Users, Package, Receipt, ArrowDownToLine, PiggyBank, Plus,
} from "lucide-react";

// ---------------- helpers ----------------
const fmt = (n: number | null | undefined) => formatCurrency(Number(n || 0), "es");

function Card({ icon: Icon, label, value, tone = "default", hint }: any) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    accent: "text-accent",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
  };
  return (
    <div className="p-4 rounded-xl bg-surface border border-border">
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${tones[tone]}`} />
        <span className="text-[10px] uppercase tracking-wider text-secondary">{label}</span>
      </div>
      <div className={`mt-2 text-xl font-display font-medium ${tones[tone]}`}>{value}</div>
      {hint && <div className="text-[11px] text-secondary mt-0.5">{hint}</div>}
    </div>
  );
}

// ---------------- Dashboard tab ----------------
function DashboardTab() {
  const [monthVal, setMonthVal] = useState(currentMonthKey());
  const { year, month } = parseMonthKey(monthVal);
  const range = useMemo(() => getMonthRange(year, month), [year, month]);

  const { data: summary } = useQuery({
    queryKey: ["finance-summary", range.startISO],
    queryFn: async () => {
      const start = `${range.startISO}T00:00:00Z`;
      const end = new Date(Date.UTC(year, month + 1, 1)).toISOString();
      const { data, error } = await supabase.rpc("finance_summary" as any, {
        _start: start,
        _end: end,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["finance-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finance_partners" as any)
        .select("*")
        .order("sort_order");
      return (data || []) as any[];
    },
  });

  const { data: transitionAssets = [] } = useQuery({
    queryKey: ["finance-assets-transition"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finance_assets" as any)
        .select("*")
        .neq("transition_status", "transferred")
        .neq("origin_type", "company");
      return (data || []) as any[];
    },
  });

  const distributable = Number(summary?.distributable || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{range.label}</h2>
        <MonthNavigator value={monthVal} onChange={setMonthVal} />
      </div>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Ingresos empresa</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card icon={TrendingUp} label="Rental" value={fmt(summary?.rental_income)} tone="accent" />
          <Card icon={TrendingUp} label="Super Store" value={fmt(summary?.store_income)} tone="accent" />
          <Card icon={TrendingUp} label="Services" value={fmt(summary?.services_income)} tone="accent" />
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Flujo</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={ArrowDownToLine} label="Payouts pagados" value={fmt(summary?.payouts_paid)} tone="negative" />
          <Card icon={ArrowDownToLine} label="Payouts pendientes" value={fmt(summary?.payouts_pending)} hint="histórico" />
          <Card icon={Receipt} label="Gastos" value={fmt(summary?.expenses_total)} tone="negative" />
          <Card icon={ArrowDownToLine} label="Deuda devuelta" value={fmt(summary?.debt_repaid)} tone="negative" />
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Caja & beneficio</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card icon={Wallet} label="Caja real" value={fmt(summary?.cash_balance)} tone="positive" />
          <Card icon={PiggyBank} label="Reserva objetivo" value={fmt(summary?.cash_reserve_target)} />
          <Card icon={TrendingUp} label="Distribuible" value={fmt(distributable)} tone={distributable >= 0 ? "positive" : "negative"} />
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Reparto sugerido a socios</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {partners.map((p) => {
            const share = (distributable * Number(p.profit_share_pct)) / 100;
            return (
              <div key={p.id} className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-secondary">{p.profit_share_pct}% · deuda inicial {fmt(p.initial_debt)}</div>
                <div className={`mt-2 text-xl font-display ${share >= 0 ? "" : "text-rose-500"}`}>{fmt(share)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {transitionAssets.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Activos en transición</h3>
          <div className="rounded-xl bg-surface border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitionAssets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.owner_label || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.revenue_model}</Badge></TableCell>
                    <TableCell><Badge>{a.transition_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------- Assets tab ----------------
function AssetsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: assets = [] } = useQuery({
    queryKey: ["finance-assets"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_assets" as any).select("*").order("name");
      return (data || []) as any[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["finance-products-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name_es").order("name_es");
      return data || [];
    },
  });

  const blank = {
    name: "",
    origin_type: "company",
    owner_label: "",
    revenue_model: "company_100",
    custom_company_pct: 100,
    acquisition_value: 0,
    transition_status: "normal",
    product_id: null,
    notes: "",
    active: true,
  };

  const onEdit = (a: any | null) => {
    setEditing(a ? { ...a } : { ...blank });
    setOpen(true);
  };

  const save = async () => {
    if (!editing.name?.trim()) return toast.error("Nombre obligatorio");
    const payload = { ...editing };
    if (payload.product_id === "__none__") payload.product_id = null;
    if (payload.revenue_model !== "custom") payload.custom_company_pct = null;
    const res = editing.id
      ? await supabase.from("finance_assets" as any).update(payload).eq("id", editing.id)
      : await supabase.from("finance_assets" as any).insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Activo guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["finance-assets"] });
    qc.invalidateQueries({ queryKey: ["finance-assets-transition"] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar activo?")) return;
    const { error } = await supabase.from("finance_assets" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["finance-assets"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Activos financieros</h2>
        <Button size="sm" onClick={() => onEdit(null)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo activo
        </Button>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Transición</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell><Badge variant="outline">{a.origin_type}</Badge></TableCell>
                <TableCell>{a.owner_label || "—"}</TableCell>
                <TableCell>
                  {a.revenue_model === "custom"
                    ? `custom (${a.custom_company_pct}%)`
                    : a.revenue_model}
                </TableCell>
                <TableCell>{fmt(a.acquisition_value)}</TableCell>
                <TableCell><Badge>{a.transition_status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-secondary py-8">
                  Sin activos. Crea uno para enchufar el split automático.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar activo" : "Nuevo activo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Origen</Label>
                  <Select value={editing.origin_type} onValueChange={(v) => setEditing({ ...editing, origin_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="socio">Socio</SelectItem>
                      <SelectItem value="concession">Concesión</SelectItem>
                      <SelectItem value="external">Externo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Propietario (etiqueta)</Label>
                  <Input value={editing.owner_label || ""} onChange={(e) => setEditing({ ...editing, owner_label: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Modelo de revenue</Label>
                  <Select value={editing.revenue_model} onValueChange={(v) => setEditing({ ...editing, revenue_model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company_100">100% empresa</SelectItem>
                      <SelectItem value="split_70_30">70/30 (30% empresa)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing.revenue_model === "custom" && (
                  <div>
                    <Label>% empresa</Label>
                    <Input type="number" min={0} max={100}
                      value={editing.custom_company_pct ?? 100}
                      onChange={(e) => setEditing({ ...editing, custom_company_pct: Number(e.target.value) })} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor de adquisición (€)</Label>
                  <Input type="number" value={editing.acquisition_value || 0}
                    onChange={(e) => setEditing({ ...editing, acquisition_value: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Estado de transición</Label>
                  <Select value={editing.transition_status} onValueChange={(v) => setEditing({ ...editing, transition_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="in_transition">En transición</SelectItem>
                      <SelectItem value="transferred">Transferido a empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Producto del catálogo (rental)</Label>
                <Select
                  value={editing.product_id || "__none__"}
                  onValueChange={(v) => setEditing({ ...editing, product_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sin enlazar —</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name_es}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Payouts tab ----------------
function PayoutsTab() {
  const qc = useQueryClient();
  const { data: payouts = [] } = useQuery({
    queryKey: ["finance-payouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finance_payouts" as any)
        .select("*, asset:finance_assets(name, owner_label)")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const markPaid = async (id: string) => {
    const { error } = await supabase
      .from("finance_payouts" as any)
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payout marcado como pagado");
    qc.invalidateQueries({ queryKey: ["finance-payouts"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Payouts</h2>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.asset?.name || "—"}</TableCell>
                <TableCell>{p.owner_label || p.asset?.owner_label || "—"}</TableCell>
                <TableCell className="font-medium">{fmt(p.amount)}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "paid" ? "outline" : p.status === "cancelled" ? "secondary" : "default"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-secondary">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  {p.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>Marcar pagado</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {payouts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-secondary py-8">
                  Sin payouts. Se generan automáticamente cuando un booking con activo 70/30 pasa a "paid".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------- Partners & debt tab ----------------
function PartnersTab() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<Record<string, string>>({});

  const { data: partners = [] } = useQuery({
    queryKey: ["finance-partners-full"],
    queryFn: async () => {
      const { data: ps } = await supabase.from("finance_partners" as any).select("*").order("sort_order");
      const { data: rs } = await supabase.from("finance_debt_repayments" as any).select("*");
      return (ps || []).map((p: any) => {
        const repaid = (rs || []).filter((r: any) => r.partner_id === p.id).reduce((s: number, r: any) => s + Number(r.amount), 0);
        return { ...p, repaid, remaining: Number(p.initial_debt) - repaid };
      });
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["finance-debt-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finance_debt_repayments" as any)
        .select("*, partner:finance_partners(name)")
        .order("paid_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
  });

  const register = async (partnerId: string) => {
    const v = Number(amount[partnerId] || 0);
    if (!v || v <= 0) return toast.error("Importe inválido");
    const { error } = await supabase.from("finance_debt_repayments" as any).insert({
      partner_id: partnerId,
      amount: v,
    });
    if (error) return toast.error(error.message);
    toast.success("Devolución registrada");
    setAmount({ ...amount, [partnerId]: "" });
    qc.invalidateQueries({ queryKey: ["finance-partners-full"] });
    qc.invalidateQueries({ queryKey: ["finance-debt-history"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Socios & deuda interna</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {partners.map((p: any) => (
          <div key={p.id} className="p-4 rounded-xl bg-surface border border-border space-y-3">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-secondary">Reparto {p.profit_share_pct}%</div>
            </div>
            <div className="text-sm">
              <div>Deuda inicial: <span className="font-medium">{fmt(p.initial_debt)}</span></div>
              <div>Devuelto: <span className="font-medium">{fmt(p.repaid)}</span></div>
              <div className={p.remaining > 0 ? "text-rose-500" : "text-emerald-500"}>
                Restante: <span className="font-medium">{fmt(p.remaining)}</span>
              </div>
            </div>
            {p.remaining > 0 && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Importe €"
                  value={amount[p.id] || ""}
                  onChange={(e) => setAmount({ ...amount, [p.id]: e.target.value })}
                />
                <Button size="sm" onClick={() => register(p.id)}>Registrar</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Historial</h3>
        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Socio</TableHead>
                <TableHead>Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs">{new Date(h.paid_at).toLocaleDateString()}</TableCell>
                  <TableCell>{h.partner?.name}</TableCell>
                  <TableCell className="font-medium">{fmt(h.amount)}</TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-secondary py-6">Sin movimientos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

// ---------------- Expenses tab ----------------
function ExpensesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: "general", description: "", amount: "" });

  const { data: expenses = [] } = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("finance_expenses" as any)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
  });

  const add = async () => {
    const v = Number(form.amount);
    if (!v || v <= 0) return toast.error("Importe inválido");
    const { error } = await supabase.from("finance_expenses" as any).insert({
      category: form.category || "general",
      description: form.description,
      amount: v,
    });
    if (error) return toast.error(error.message);
    setForm({ category: "general", description: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["finance-expenses"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar gasto?")) return;
    await supabase.from("finance_expenses" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["finance-expenses"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Gastos</h2>
      <div className="p-4 rounded-xl bg-surface border border-border grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] gap-2 items-end">
        <div>
          <Label className="text-xs text-secondary">Categoría</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs text-secondary">Descripción</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs text-secondary">Importe €</Label>
          <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" />Añadir</Button>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{new Date(e.occurred_at).toLocaleDateString()}</TableCell>
                <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                <TableCell>{e.description || "—"}</TableCell>
                <TableCell className="font-medium">{fmt(e.amount)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove(e.id)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-secondary py-6">Sin gastos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------- Cash tab ----------------
function CashTab() {
  const qc = useQueryClient();
  const { data: reserve } = useQuery({
    queryKey: ["finance-cash-reserve"],
    queryFn: async () => {
      const { data } = await supabase.from("finance_cash_reserve" as any).select("*").maybeSingle();
      return data as any;
    },
  });
  const [target, setTarget] = useState<string>("");

  const save = async () => {
    const v = Number(target);
    if (isNaN(v) || v < 0) return toast.error("Valor inválido");
    const { error } = await supabase
      .from("finance_cash_reserve" as any)
      .update({ target_amount: v, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Reserva actualizada");
    qc.invalidateQueries({ queryKey: ["finance-cash-reserve"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-medium">Caja de empresa</h2>
      <div className="p-5 rounded-xl bg-surface border border-border space-y-3">
        <div>
          <div className="text-xs text-secondary">Reserva objetivo actual</div>
          <div className="text-2xl font-display">{fmt(reserve?.target_amount)}</div>
        </div>
        <div>
          <Label>Nuevo objetivo de reserva (€)</Label>
          <Input
            type="number"
            placeholder={String(reserve?.target_amount ?? 0)}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <Button onClick={save}>Guardar reserva</Button>
        <p className="text-xs text-secondary">
          La reserva objetivo se descuenta del beneficio distribuible para mantener liquidez operativa.
        </p>
      </div>
    </div>
  );
}

// ---------------- Entries tab ----------------
function EntriesTab() {
  const [origin, setOrigin] = useState<string>("__all__");
  const { data: entries = [] } = useQuery({
    queryKey: ["finance-entries", origin],
    queryFn: async () => {
      let q = supabase.from("finance_entries" as any).select("*").order("occurred_at", { ascending: false }).limit(200);
      if (origin !== "__all__") q = q.eq("origin_system", origin);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Movimientos</h2>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los orígenes</SelectItem>
            <SelectItem value="rental">Rental</SelectItem>
            <SelectItem value="store">Super Store</SelectItem>
            <SelectItem value="services">Services</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{new Date(e.occurred_at).toLocaleDateString()}</TableCell>
                <TableCell><Badge variant="outline">{e.origin_system}</Badge></TableCell>
                <TableCell><Badge>{e.source_type}</Badge></TableCell>
                <TableCell>{fmt(e.gross_amount)}</TableCell>
                <TableCell className="font-medium">{fmt(e.company_amount)}</TableCell>
                <TableCell>{fmt(e.payout_amount)}</TableCell>
                <TableCell className="text-xs text-secondary max-w-[300px] truncate">{e.notes}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-secondary py-6">Sin movimientos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------- root page ----------------
export default function AdminFinance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-medium">Finanzas</h1>
        <p className="text-sm text-secondary mt-1">Cerebro financiero operativo · ingresos confirmados, splits, payouts y deuda interna.</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard"><TrendingUp className="h-4 w-4 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="entries"><Receipt className="h-4 w-4 mr-1.5" />Movimientos</TabsTrigger>
          <TabsTrigger value="assets"><Package className="h-4 w-4 mr-1.5" />Activos</TabsTrigger>
          <TabsTrigger value="payouts"><ArrowDownToLine className="h-4 w-4 mr-1.5" />Payouts</TabsTrigger>
          <TabsTrigger value="partners"><Users className="h-4 w-4 mr-1.5" />Socios & deuda</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="h-4 w-4 mr-1.5" />Gastos</TabsTrigger>
          <TabsTrigger value="cash"><Wallet className="h-4 w-4 mr-1.5" />Caja</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="entries"><EntriesTab /></TabsContent>
          <TabsContent value="assets"><AssetsTab /></TabsContent>
          <TabsContent value="payouts"><PayoutsTab /></TabsContent>
          <TabsContent value="partners"><PartnersTab /></TabsContent>
          <TabsContent value="expenses"><ExpensesTab /></TabsContent>
          <TabsContent value="cash"><CashTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
