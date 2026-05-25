import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
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
  UserCircle, Settings as SettingsIcon, AlertTriangle,
} from "lucide-react";

const fmt = (n: number | null | undefined) => formatCurrency(Number(n || 0), "es");
const sb = supabase as any;

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

// ============== DASHBOARD ==============
function DashboardTab() {
  const [monthVal, setMonthVal] = useState(currentMonthKey());
  const { year, month } = parseMonthKey(monthVal);
  const range = useMemo(() => getMonthRange(year, month), [year, month]);

  const { data: summary } = useQuery({
    queryKey: ["finance-summary", range.startISO],
    queryFn: async () => {
      const start = `${range.startISO}T00:00:00Z`;
      const end = new Date(Date.UTC(year, month + 1, 1)).toISOString();
      const { data, error } = await sb.rpc("finance_summary", { _start: start, _end: end });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
  });

  // Partners query removed: no suggested distribution. Real payouts only.

  const { data: transitionAssets = [] } = useQuery({
    queryKey: ["finance-assets-transition"],
    queryFn: async () => {
      const { data: kpis } = await sb.from("finance_asset_kpis").select("*");
      const { data: assets } = await sb.from("finance_assets")
        .select("id, owner_label, revenue_model, origin_type, owner:finance_owners(name)")
        .neq("transition_status", "transferred").neq("origin_type", "company");
      const byId = new Map((kpis || []).map((k: any) => [k.asset_id, k]));
      return (assets || [])
        .map((a: any) => {
          const k: any = byId.get(a.id) || {};
          const target = Number(k.target_recovery_value || 0);
          const recovered = Number(k.recovered_value || 0);
          return {
            ...a, ...k, target, recovered,
            progress: target > 0 ? Math.min(100, (recovered / target) * 100) : 0,
            target_reached: !!k.target_reached,
          };
        })
        .filter((a: any) => a.target > 0);
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
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Liabilities owners (no es dinero empresa)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card icon={ArrowDownToLine} label="Pagado a owners" value={fmt(summary?.payouts_paid)} tone="positive" hint="histórico" />
          <Card icon={AlertTriangle} label="Liability abierto" value={fmt(summary?.owner_liability_open)} tone="negative" hint="debido a owners" />
          <Card icon={Receipt} label="Gastos del mes" value={fmt(summary?.expenses_total)} tone="negative" />
          <Card icon={ArrowDownToLine} label="Deuda devuelta" value={fmt(summary?.debt_repaid)} tone="negative" />
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Caja & beneficio empresa</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card icon={Wallet} label="Caja real" value={fmt(summary?.cash_balance)} tone="positive" hint="comisión − gastos − deuda" />
          <Card icon={PiggyBank} label="Reserva objetivo" value={fmt(summary?.cash_reserve_target)} />
          <Card icon={TrendingUp} label="Distribuible" value={fmt(distributable)} tone={distributable >= 0 ? "positive" : "negative"} hint="solo comisión empresa" />
        </div>
      </section>

      {/* Reparto sugerido eliminado: el sistema solo refleja datos reales registrados, no estimaciones. */}

      {transitionAssets.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Activos en transición</h3>
          <div className="space-y-2">
            {transitionAssets.map((a: any) => (
              <div key={a.id} className="p-4 rounded-xl bg-surface border border-border">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-secondary">
                      {a.owner?.name || a.owner_label || "—"} · {a.revenue_model}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{fmt(a.recovered)} / {fmt(a.target)}</div>
                    <div className="text-[10px] text-secondary">recuperado = empresa + owner</div>
                    <Badge variant={a.target_reached ? "default" : "outline"} className={a.target_reached ? "bg-emerald-500" : ""}>
                      {a.target_reached ? "objetivo alcanzado · sugerir transferir" : `${a.progress.toFixed(0)}%`}
                    </Badge>
                  </div>
                </div>
                <Progress value={a.progress} className="mt-3 h-2" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============== OWNERS ==============
function OwnersTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: owners = [] } = useQuery({
    queryKey: ["finance-owners"],
    queryFn: async () => (await sb.from("finance_owners").select("*, assets:finance_assets(id, name)").order("sort_order")).data || [],
  });

  const blank = { name: "", type: "external", default_company_pct: 30, contact_email: "", contact_phone: "", notes: "", active: true, sort_order: 0 };

  const save = async () => {
    if (!editing.name?.trim()) return toast.error("Nombre obligatorio");
    const { id, assets, ...payload } = editing;
    const res = id
      ? await sb.from("finance_owners").update(payload).eq("id", id)
      : await sb.from("finance_owners").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Owner guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["finance-owners"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Owner Registry</h2>
        <Button size="sm" onClick={() => { setEditing({ ...blank }); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo owner
        </Button>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>% empresa default</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Activos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {owners.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell><Badge variant="outline">{o.type}</Badge></TableCell>
                <TableCell>{o.default_company_pct}%</TableCell>
                <TableCell className="text-xs text-secondary">{o.contact_email || o.contact_phone || "—"}</TableCell>
                <TableCell className="text-xs">{(o.assets || []).length}</TableCell>
                <TableCell>{o.active ? <Badge>activo</Badge> : <Badge variant="secondary">inactivo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...o }); setOpen(true); }}>Editar</Button>
                </TableCell>
              </TableRow>
            ))}
            {owners.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-secondary py-8">Sin owners</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar owner" : "Nuevo owner"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="socio">Socio</SelectItem>
                      <SelectItem value="external">External owner</SelectItem>
                      <SelectItem value="concession">Concession</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>% empresa por defecto</Label>
                  <Input type="number" min={0} max={100} value={editing.default_company_pct}
                    onChange={(e) => setEditing({ ...editing, default_company_pct: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email contacto</Label><Input value={editing.contact_email || ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} /></div>
                <div><Label>Teléfono</Label><Input value={editing.contact_phone || ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} /></div>
              </div>
              <div><Label>Notas internas</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Owner activo
              </label>
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

// ============== ASSETS ==============
function AssetsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: assets = [] } = useQuery({
    queryKey: ["finance-assets"],
    queryFn: async () => (await sb.from("finance_assets").select("*, owner:finance_owners(id, name)").order("name")).data || [],
  });
  const { data: owners = [] } = useQuery({
    queryKey: ["finance-owners-lookup"],
    queryFn: async () => (await sb.from("finance_owners").select("id, name, type, default_company_pct").eq("active", true).order("name")).data || [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["finance-products-lookup"],
    queryFn: async () => (await supabase.from("products").select("id, name_es").order("name_es")).data || [],
  });

  const blank = {
    name: "", origin_type: "company", owner_id: null, owner_label: "",
    revenue_model: "company_100", custom_company_pct: 100,
    acquisition_value: 0, target_recovery_value: 0,
    transition_status: "normal", product_id: null,
    concession_rules: {}, notes: "", active: true,
  };

  const save = async () => {
    if (!editing.name?.trim()) return toast.error("Nombre obligatorio");
    const { id, owner, ...rest } = editing;
    const payload: any = { ...rest };
    if (payload.product_id === "__none__") payload.product_id = null;
    if (payload.owner_id === "__none__") payload.owner_id = null;
    if (payload.revenue_model !== "custom") payload.custom_company_pct = null;
    if (typeof payload.concession_rules === "string") {
      try { payload.concession_rules = JSON.parse(payload.concession_rules || "{}"); }
      catch { return toast.error("JSON de concesión inválido"); }
    }
    const res = id
      ? await sb.from("finance_assets").update(payload).eq("id", id)
      : await sb.from("finance_assets").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success("Activo guardado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["finance-assets"] });
    qc.invalidateQueries({ queryKey: ["finance-assets-transition"] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar activo?")) return;
    const { error } = await sb.from("finance_assets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["finance-assets"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">Activos</h2>
        <Button size="sm" onClick={() => { setEditing({ ...blank }); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo activo
        </Button>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Adquisición</TableHead>
              <TableHead>Objetivo</TableHead>
              <TableHead>Transición</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell><Badge variant="outline">{a.origin_type}</Badge></TableCell>
                <TableCell>{a.owner?.name || a.owner_label || "—"}</TableCell>
                <TableCell>{a.revenue_model === "custom" ? `custom (${a.custom_company_pct}%)` : a.revenue_model}</TableCell>
                <TableCell>{fmt(a.acquisition_value)}</TableCell>
                <TableCell>{fmt(a.target_recovery_value)}</TableCell>
                <TableCell><Badge>{a.transition_status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...a, concession_rules: JSON.stringify(a.concession_rules || {}, null, 2) }); setOpen(true); }}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
            {assets.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-secondary py-8">Sin activos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar activo" : "Nuevo activo"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nombre</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
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
                  <Label>Owner (registry)</Label>
                  <Select value={editing.owner_id || "__none__"} onValueChange={(v) => setEditing({ ...editing, owner_id: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin owner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— sin asignar —</SelectItem>
                      {owners.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>{o.name} ({o.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Input type="number" min={0} max={100} value={editing.custom_company_pct ?? 100}
                      onChange={(e) => setEditing({ ...editing, custom_company_pct: Number(e.target.value) })} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor adquisición (€)</Label>
                  <Input type="number" value={editing.acquisition_value || 0}
                    onChange={(e) => setEditing({ ...editing, acquisition_value: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Objetivo recuperación (€)</Label>
                  <Input type="number" value={editing.target_recovery_value || 0}
                    onChange={(e) => setEditing({ ...editing, target_recovery_value: Number(e.target.value) })} />
                </div>
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
              <div>
                <Label>Producto del catálogo</Label>
                <Select value={editing.product_id || "__none__"} onValueChange={(v) => setEditing({ ...editing, product_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— sin enlazar —</SelectItem>
                    {products.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name_es}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {editing.origin_type === "concession" && (
                <div>
                  <Label>Reglas de concesión (JSON libre)</Label>
                  <Textarea rows={4} className="font-mono text-xs"
                    value={typeof editing.concession_rules === "string" ? editing.concession_rules : JSON.stringify(editing.concession_rules || {}, null, 2)}
                    onChange={(e) => setEditing({ ...editing, concession_rules: e.target.value })} />
                </div>
              )}
              <div><Label>Notas</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
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

// ============== ENTRIES (Ledger) ==============
function EntriesTab() {
  const qc = useQueryClient();
  const [origin, setOrigin] = useState<string>("__all__");
  const [ownerFilter, setOwnerFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: owners = [] } = useQuery({
    queryKey: ["finance-owners-lookup"],
    queryFn: async () => (await sb.from("finance_owners").select("id, name").order("name")).data || [],
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["finance-entries", origin, ownerFilter, statusFilter],
    queryFn: async () => {
      let q = sb.from("finance_entries").select("*, owner:finance_owners(name), asset:finance_assets(name), booking:bookings(reference, customer:customers(full_name)), item:booking_items(product_name)")
        .order("occurred_at", { ascending: false }).limit(300);
      if (origin !== "__all__") q = q.eq("origin_system", origin);
      if (ownerFilter !== "__all__") q = q.eq("owner_id", ownerFilter);
      if (statusFilter !== "__all__") q = q.eq("status", statusFilter);
      const { data } = await q;
      return (data || []) as any[];
    },
  });

  const save = async () => {
    const { id, owner, asset, booking, item, ...rest } = editing;
    rest.is_manual_override = true;
    const { error } = await sb.from("finance_entries").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Entry actualizada (override registrado)");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["finance-entries"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-medium">Ledger operativo</h2>
        <div className="flex gap-2 flex-wrap">
          <Select value={origin} onValueChange={setOrigin}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos orígenes</SelectItem>
              <SelectItem value="rental">Rental</SelectItem>
              <SelectItem value="store">Super Store</SelectItem>
              <SelectItem value="services">Services</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos owners</SelectItem>
              {owners.map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos estados</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="reversed">Revertido</SelectItem>
              <SelectItem value="void">Anulado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead>Split</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e: any) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => setEditing({ ...e })}>
                <TableCell className="text-xs">{new Date(e.occurred_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-xs">{e.booking?.reference || "—"}</TableCell>
                <TableCell className="text-xs">{e.booking?.customer?.full_name || "—"}</TableCell>
                <TableCell className="text-xs">{e.item?.product_name || "—"}</TableCell>
                <TableCell><Badge variant="outline">{e.origin_system}</Badge></TableCell>
                <TableCell className="text-xs">{e.owner?.name || "—"}</TableCell>
                <TableCell>{fmt(e.gross_amount)}</TableCell>
                <TableCell className="font-medium">{fmt(e.company_amount)}</TableCell>
                <TableCell>{fmt(e.payout_amount)}</TableCell>
                <TableCell className="text-xs">{e.applied_company_pct != null ? `${e.applied_company_pct}%` : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status || (e.is_reversed ? "reversed" : "active")}</Badge>
                    {e.is_manual_override && <Badge variant="outline" className="text-amber-500"><AlertTriangle className="h-3 w-3" /></Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs text-secondary">editar</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-secondary py-6">Sin movimientos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Editar entry · override manual</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-xs text-secondary">
                {editing.booking?.reference} · {editing.item?.product_name}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Owner</Label>
                  <Select value={editing.owner_id || "__none__"} onValueChange={(v) => setEditing({ ...editing, owner_id: v === "__none__" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— sin owner —</SelectItem>
                      {owners.map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Estado</Label>
                  <Select value={editing.status || "active"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="reversed">Revertido</SelectItem>
                      <SelectItem value="void">Anulado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Bruto</Label><Input type="number" value={editing.gross_amount} onChange={(e) => setEditing({ ...editing, gross_amount: Number(e.target.value) })} /></div>
                <div><Label>Empresa</Label><Input type="number" value={editing.company_amount} onChange={(e) => setEditing({ ...editing, company_amount: Number(e.target.value) })} /></div>
                <div><Label>Payout</Label><Input type="number" value={editing.payout_amount} onChange={(e) => setEditing({ ...editing, payout_amount: Number(e.target.value) })} /></div>
              </div>
              <div><Label>% empresa aplicado</Label><Input type="number" min={0} max={100} value={editing.applied_company_pct ?? ""} onChange={(e) => setEditing({ ...editing, applied_company_pct: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div><Label>Razón del override</Label><Textarea value={editing.override_reason || ""} onChange={(e) => setEditing({ ...editing, override_reason: e.target.value })} placeholder="Por qué cambias estos valores" /></div>
              <div><Label>Notas</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============== PAYOUTS (with partial payments) ==============
function PayoutsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [paying, setPaying] = useState<any | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "", notes: "" });
  const [statusFilter, setStatusFilter] = useState<string>("__open__");
  const [ownerFilter, setOwnerFilter] = useState<string>("__all__");

  const { data: owners = [] } = useQuery({
    queryKey: ["finance-owners-lookup"],
    queryFn: async () => (await sb.from("finance_owners").select("id, name").order("name")).data || [],
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["finance-payouts", statusFilter, ownerFilter],
    queryFn: async () => {
      let q = sb.from("finance_payouts")
        .select("*, asset:finance_assets(name), owner:finance_owners(name)")
        .order("created_at", { ascending: false }).limit(500);
      if (statusFilter === "__open__") q = q.in("status", ["unpaid", "partially_paid", "pending"]);
      else if (statusFilter !== "__all__") q = q.eq("status", statusFilter);
      if (ownerFilter !== "__all__") q = q.eq("owner_id", ownerFilter);
      return (await q).data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["finance-payout-payments", paying?.id],
    enabled: !!paying,
    queryFn: async () => (await sb.from("finance_payout_payments").select("*").eq("payout_id", paying.id).order("paid_at", { ascending: false })).data || [],
  });

  const registerPayment = async () => {
    const v = Number(payForm.amount);
    if (!v || v <= 0) return toast.error("Importe inválido");
    const remaining = Number(paying.amount) - Number(paying.paid_amount || 0);
    if (v > remaining + 0.01) return toast.error(`Máximo posible: ${fmt(remaining)}`);
    const { error } = await sb.from("finance_payout_payments").insert({
      payout_id: paying.id, amount: v,
      method: payForm.method || null, notes: payForm.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pago registrado");
    setPayForm({ amount: "", method: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["finance-payouts"] });
    qc.invalidateQueries({ queryKey: ["finance-payout-payments"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
    qc.invalidateQueries({ queryKey: ["finance-owner-balances"] });
    // reload payout for header values
    const { data: fresh } = await sb.from("finance_payouts").select("*").eq("id", paying.id).maybeSingle();
    if (fresh) setPaying(fresh);
  };

  const deletePayment = async (id: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    const { error } = await sb.from("finance_payout_payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["finance-payouts"] });
    qc.invalidateQueries({ queryKey: ["finance-payout-payments"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
    const { data: fresh } = await sb.from("finance_payouts").select("*").eq("id", paying.id).maybeSingle();
    if (fresh) setPaying(fresh);
  };

  const save = async () => {
    const { id, asset, owner, paid_amount, ...rest } = editing;
    rest.is_manual_override = true;
    const { error } = await sb.from("finance_payouts").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payout actualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["finance-payouts"] });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      unpaid: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
      partially_paid: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
      paid: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
      cancelled: "bg-secondary text-secondary-foreground",
      pending: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
    };
    return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-medium">Payouts (liabilities a owners)</h2>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__open__">Abiertos (unpaid + parcial)</SelectItem>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="unpaid">Sin pagar</SelectItem>
              <SelectItem value="partially_paid">Parcial</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos owners</SelectItem>
              {owners.map((o: any) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Debido</TableHead>
              <TableHead>Pagado</TableHead>
              <TableHead>Restante</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((p: any) => {
              const paid = Number(p.paid_amount || 0);
              const remaining = Number(p.amount) - paid;
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.asset?.name || "—"}</TableCell>
                  <TableCell>{p.owner?.name || p.owner_label || "—"}</TableCell>
                  <TableCell className="font-medium">{fmt(p.amount)}</TableCell>
                  <TableCell className="text-emerald-600">{fmt(paid)}</TableCell>
                  <TableCell className={remaining > 0.01 ? "text-rose-500 font-medium" : "text-secondary"}>{fmt(remaining)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {statusBadge(p.status)}
                      {p.is_manual_override && <Badge variant="outline" className="text-amber-500"><AlertTriangle className="h-3 w-3" /></Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-secondary">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    {p.status !== "cancelled" && p.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => { setPaying(p); setPayForm({ amount: String(remaining.toFixed(2)), method: "", notes: "" }); }}>Pagar</Button>
                    )}
                    {p.status === "paid" && (
                      <Button size="sm" variant="ghost" onClick={() => { setPaying(p); setPayForm({ amount: "", method: "", notes: "" }); }}>Historial</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...p })}>Editar</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {payouts.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-secondary py-8">Sin payouts</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Payment registration dialog */}
      <Dialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Registrar pago · {paying?.owner?.name || paying?.owner_label}</DialogTitle></DialogHeader>
          {paying && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-3 rounded-md bg-muted"><div className="text-[10px] text-secondary">Debido</div><div className="font-medium">{fmt(paying.amount)}</div></div>
                <div className="p-3 rounded-md bg-muted"><div className="text-[10px] text-secondary">Pagado</div><div className="font-medium text-emerald-600">{fmt(paying.paid_amount)}</div></div>
                <div className="p-3 rounded-md bg-muted"><div className="text-[10px] text-secondary">Restante</div><div className="font-medium text-rose-500">{fmt(Number(paying.amount) - Number(paying.paid_amount || 0))}</div></div>
              </div>

              {paying.status !== "paid" && paying.status !== "cancelled" && (
                <div className="space-y-2 border border-border rounded-lg p-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-secondary">Nuevo pago</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Importe €</Label><Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                    <div><Label className="text-xs">Método</Label><Input placeholder="transferencia, efectivo…" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} /></div>
                  </div>
                  <div><Label className="text-xs">Notas</Label><Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
                  <Button size="sm" onClick={registerPayment}>Registrar pago</Button>
                </div>
              )}

              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-secondary mb-2">Historial de pagos</div>
                <div className="rounded-md border border-border max-h-60 overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Importe</TableHead><TableHead>Método</TableHead><TableHead>Notas</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {payments.map((pm: any) => (
                        <TableRow key={pm.id}>
                          <TableCell className="text-xs">{new Date(pm.paid_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{fmt(pm.amount)}</TableCell>
                          <TableCell className="text-xs">{pm.method || "—"}</TableCell>
                          <TableCell className="text-xs">{pm.notes || "—"}</TableCell>
                          <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => deletePayment(pm.id)}>×</Button></TableCell>
                        </TableRow>
                      ))}
                      {payments.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-secondary py-4 text-xs">Sin pagos</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setPaying(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar payout (override manual)</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Importe debido</Label><Input type="number" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></div>
                <div><Label>% aplicado</Label><Input type="number" value={editing.applied_pct ?? ""} onChange={(e) => setEditing({ ...editing, applied_pct: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              </div>
              <div><Label>Estado</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Sin pagar</SelectItem>
                    <SelectItem value="partially_paid">Parcial</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notas</Label><Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============== OWNER BALANCES ==============
function OwnerBalancesTab() {
  const { data: balances = [] } = useQuery({
    queryKey: ["finance-owner-balances"],
    queryFn: async () => (await sb.from("finance_owner_balances").select("*").order("remaining_unpaid", { ascending: false })).data || [],
  });
  const { data: assetKpis = [] } = useQuery({
    queryKey: ["finance-asset-kpis"],
    queryFn: async () => (await sb.from("finance_asset_kpis").select("*")).data || [],
  });

  const kpisByOwner = useMemo(() => {
    const m = new Map<string, any[]>();
    (assetKpis as any[]).forEach((k) => {
      if (!k.owner_id) return;
      if (!m.has(k.owner_id)) m.set(k.owner_id, []);
      m.get(k.owner_id)!.push(k);
    });
    return m;
  }, [assetKpis]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Balances por owner</h2>
        <p className="text-xs text-secondary">Total generado, debido, pagado y pendiente. El "Restante" es la liability real.</p>
      </div>
      <div className="space-y-3">
        {balances.map((b: any) => {
          const assets = kpisByOwner.get(b.owner_id) || [];
          return (
            <div key={b.owner_id} className="p-4 rounded-xl bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-secondary">{b.type} {!b.active && "· inactivo"}</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="text-right"><div className="text-[10px] text-secondary">Generado bruto</div><div className="font-medium">{fmt(b.total_generated_gross)}</div></div>
                  <div className="text-right"><div className="text-[10px] text-secondary">Debido</div><div className="font-medium">{fmt(b.total_owed)}</div></div>
                  <div className="text-right"><div className="text-[10px] text-secondary">Pagado</div><div className="font-medium text-emerald-600">{fmt(b.total_paid)}</div></div>
                  <div className="text-right"><div className="text-[10px] text-secondary">Restante</div><div className={`font-medium ${Number(b.remaining_unpaid) > 0.01 ? "text-rose-500" : ""}`}>{fmt(b.remaining_unpaid)}</div></div>
                </div>
              </div>
              {assets.length > 0 && (
                <div className="border-t border-border pt-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-secondary">Activos del owner</div>
                  {assets.map((a: any) => (
                    <div key={a.asset_id} className="text-xs flex items-center justify-between">
                      <span>{a.name}</span>
                      <span className="text-secondary">
                        bruto {fmt(a.gross_revenue)} · empresa {fmt(a.company_revenue)} · recuperado {fmt(a.recovered_value)}
                        {Number(a.target_recovery_value) > 0 && ` / ${fmt(a.target_recovery_value)} (${a.recovery_pct}%)`}
                        {a.target_reached && <Badge className="ml-2 bg-emerald-500">target</Badge>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {balances.length === 0 && (
          <div className="text-center text-secondary py-8">Sin owners registrados</div>
        )}
      </div>
    </div>
  );
}


// ============== PARTNERS & DEBT ==============
function PartnersTab() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<Record<string, string>>({});
  const [shareDraft, setShareDraft] = useState<Record<string, string>>({});

  const { data: partners = [] } = useQuery({
    queryKey: ["finance-partners-full"],
    queryFn: async () => {
      const { data: ps } = await sb.from("finance_partners").select("*").order("sort_order");
      const { data: rs } = await sb.from("finance_debt_repayments").select("*");
      return (ps || []).map((p: any) => {
        const repaid = (rs || []).filter((r: any) => r.partner_id === p.id).reduce((s: number, r: any) => s + Number(r.amount), 0);
        return { ...p, repaid, remaining: Number(p.initial_debt) - repaid };
      });
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["finance-debt-history"],
    queryFn: async () => (await sb.from("finance_debt_repayments").select("*, partner:finance_partners(name)").order("paid_at", { ascending: false }).limit(30)).data || [],
  });

  const { data: shareHistory = [] } = useQuery({
    queryKey: ["finance-partner-share-history"],
    queryFn: async () => (await sb.from("finance_partner_share_history").select("*, partner:finance_partners(name)").order("effective_from", { ascending: false }).limit(30)).data || [],
  });

  const register = async (partnerId: string) => {
    const v = Number(amount[partnerId] || 0);
    if (!v || v <= 0) return toast.error("Importe inválido");
    const { error } = await sb.from("finance_debt_repayments").insert({ partner_id: partnerId, amount: v });
    if (error) return toast.error(error.message);
    toast.success("Devolución registrada");
    setAmount({ ...amount, [partnerId]: "" });
    qc.invalidateQueries({ queryKey: ["finance-partners-full"] });
    qc.invalidateQueries({ queryKey: ["finance-debt-history"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const saveShare = async (partnerId: string) => {
    const v = Number(shareDraft[partnerId]);
    if (isNaN(v) || v < 0 || v > 100) return toast.error("Porcentaje inválido");
    const { error } = await sb.from("finance_partners").update({ profit_share_pct: v }).eq("id", partnerId);
    if (error) return toast.error(error.message);
    toast.success("Porcentaje actualizado (historial guardado)");
    setShareDraft({ ...shareDraft, [partnerId]: "" });
    qc.invalidateQueries({ queryKey: ["finance-partners-full"] });
    qc.invalidateQueries({ queryKey: ["finance-partner-share-history"] });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Socios & deuda interna</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {partners.map((p: any) => (
          <div key={p.id} className="p-4 rounded-xl bg-surface border border-border space-y-3">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-secondary">Reparto actual {p.profit_share_pct}%</div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Nuevo %</Label>
                <Input type="number" min={0} max={100} value={shareDraft[p.id] ?? ""} placeholder={String(p.profit_share_pct)}
                  onChange={(e) => setShareDraft({ ...shareDraft, [p.id]: e.target.value })} />
              </div>
              <Button size="sm" variant="outline" onClick={() => saveShare(p.id)}>Aplicar</Button>
            </div>
            <div className="text-sm border-t border-border pt-2">
              <div>Deuda inicial: <span className="font-medium">{fmt(p.initial_debt)}</span></div>
              <div>Devuelto: <span className="font-medium">{fmt(p.repaid)}</span></div>
              <div className={p.remaining > 0 ? "text-rose-500" : "text-emerald-500"}>
                Restante: <span className="font-medium">{fmt(p.remaining)}</span>
              </div>
            </div>
            {p.remaining > 0 && (
              <div className="flex gap-2">
                <Input type="number" placeholder="Importe €" value={amount[p.id] || ""}
                  onChange={(e) => setAmount({ ...amount, [p.id]: e.target.value })} />
                <Button size="sm" onClick={() => register(p.id)}>Registrar</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Historial devoluciones</h3>
        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Socio</TableHead><TableHead>Importe</TableHead></TableRow></TableHeader>
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

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Historial cambios de reparto %</h3>
        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Desde</TableHead><TableHead>Hasta</TableHead><TableHead>Socio</TableHead><TableHead>%</TableHead></TableRow></TableHeader>
            <TableBody>
              {shareHistory.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs">{new Date(h.effective_from).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">{h.effective_to ? new Date(h.effective_to).toLocaleDateString() : "actual"}</TableCell>
                  <TableCell>{h.partner?.name}</TableCell>
                  <TableCell className="font-medium">{h.pct}%</TableCell>
                </TableRow>
              ))}
              {shareHistory.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-secondary py-6">Sin historial</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

// ============== EXPENSES ==============
function ExpensesTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: "general", description: "", amount: "" });

  const { data: expenses = [] } = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async () => (await sb.from("finance_expenses").select("*").order("occurred_at", { ascending: false }).limit(100)).data || [],
  });

  const add = async () => {
    const v = Number(form.amount);
    if (!v || v <= 0) return toast.error("Importe inválido");
    const { error } = await sb.from("finance_expenses").insert({ category: form.category || "general", description: form.description, amount: v });
    if (error) return toast.error(error.message);
    setForm({ category: "general", description: "", amount: "" });
    qc.invalidateQueries({ queryKey: ["finance-expenses"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar gasto?")) return;
    await sb.from("finance_expenses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["finance-expenses"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Gastos</h2>
      <div className="p-4 rounded-xl bg-surface border border-border grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] gap-2 items-end">
        <div><Label className="text-xs text-secondary">Categoría</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div><Label className="text-xs text-secondary">Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label className="text-xs text-secondary">Importe €</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <Button onClick={add} className="gap-2"><Plus className="h-4 w-4" />Añadir</Button>
      </div>
      <div className="rounded-xl bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead><TableHead>Importe</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{new Date(e.occurred_at).toLocaleDateString()}</TableCell>
                <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                <TableCell>{e.description || "—"}</TableCell>
                <TableCell className="font-medium">{fmt(e.amount)}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => remove(e.id)}>Eliminar</Button></TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-secondary py-6">Sin gastos</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============== CASH ==============
function CashTab() {
  const qc = useQueryClient();
  const { data: reserve } = useQuery({
    queryKey: ["finance-cash-reserve"],
    queryFn: async () => (await sb.from("finance_cash_reserve").select("*").maybeSingle()).data,
  });
  const [target, setTarget] = useState<string>("");

  const save = async () => {
    const v = Number(target);
    if (isNaN(v) || v < 0) return toast.error("Valor inválido");
    const { error } = await sb.from("finance_cash_reserve").update({ target_amount: v, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Reserva actualizada");
    qc.invalidateQueries({ queryKey: ["finance-cash-reserve"] });
    qc.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-medium">Caja de empresa</h2>
      <div className="p-5 rounded-xl bg-surface border border-border space-y-3">
        <div><div className="text-xs text-secondary">Reserva objetivo actual</div><div className="text-2xl font-display">{fmt((reserve as any)?.target_amount)}</div></div>
        <div><Label>Nuevo objetivo de reserva (€)</Label><Input type="number" placeholder={String((reserve as any)?.target_amount ?? 0)} value={target} onChange={(e) => setTarget(e.target.value)} /></div>
        <Button onClick={save}>Guardar reserva</Button>
        <p className="text-xs text-secondary">Se descuenta del beneficio distribuible para mantener liquidez.</p>
      </div>
    </div>
  );
}

// ============== SETTINGS ==============
function SettingsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["finance-settings"],
    queryFn: async () => (await sb.from("finance_settings").select("*").maybeSingle()).data,
  });
  const [pct, setPct] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const save = async () => {
    const payload: any = { updated_at: new Date().toISOString() };
    if (pct !== "") {
      const v = Number(pct);
      if (isNaN(v) || v < 0 || v > 100) return toast.error("% inválido");
      payload.default_split_company_pct = v;
    }
    if (notes) payload.notes = notes;
    const { error } = await sb.from("finance_settings").update(payload).eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Settings actualizados");
    setPct(""); setNotes("");
    qc.invalidateQueries({ queryKey: ["finance-settings"] });
  };

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-medium">Settings financieros</h2>
      <div className="p-5 rounded-xl bg-surface border border-border space-y-3">
        <div><div className="text-xs text-secondary">% empresa por defecto (si producto no tiene asset)</div><div className="text-2xl font-display">{(settings as any)?.default_split_company_pct ?? 30}%</div></div>
        <div><Label>Nuevo % default</Label><Input type="number" min={0} max={100} value={pct} placeholder={String((settings as any)?.default_split_company_pct ?? 30)} onChange={(e) => setPct(e.target.value)} /></div>
        <div><Label>Notas internas</Label><Textarea value={notes} placeholder={(settings as any)?.notes || ""} onChange={(e) => setNotes(e.target.value)} /></div>
        <Button onClick={save}>Guardar</Button>
        <p className="text-xs text-secondary">Moneda: {(settings as any)?.default_currency || "EUR"}</p>
      </div>
    </div>
  );
}

// ============== ROOT ==============
export default function AdminFinance() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-medium">Finanzas</h1>
        <p className="text-sm text-secondary mt-1">Cerebro financiero operativo · ledger por línea, owners, splits editables, overrides manuales.</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard"><TrendingUp className="h-4 w-4 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="entries"><Receipt className="h-4 w-4 mr-1.5" />Ledger</TabsTrigger>
          <TabsTrigger value="owners"><UserCircle className="h-4 w-4 mr-1.5" />Owners</TabsTrigger>
          <TabsTrigger value="assets"><Package className="h-4 w-4 mr-1.5" />Activos</TabsTrigger>
          <TabsTrigger value="payouts"><ArrowDownToLine className="h-4 w-4 mr-1.5" />Payouts</TabsTrigger>
          <TabsTrigger value="balances"><Users className="h-4 w-4 mr-1.5" />Balances</TabsTrigger>
          <TabsTrigger value="partners"><Users className="h-4 w-4 mr-1.5" />Socios & deuda</TabsTrigger>
          <TabsTrigger value="expenses"><Receipt className="h-4 w-4 mr-1.5" />Gastos</TabsTrigger>
          <TabsTrigger value="cash"><Wallet className="h-4 w-4 mr-1.5" />Caja</TabsTrigger>
          <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 mr-1.5" />Settings</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="entries"><EntriesTab /></TabsContent>
          <TabsContent value="owners"><OwnersTab /></TabsContent>
          <TabsContent value="assets"><AssetsTab /></TabsContent>
          <TabsContent value="payouts"><PayoutsTab /></TabsContent>
          <TabsContent value="balances"><OwnerBalancesTab /></TabsContent>
          <TabsContent value="partners"><PartnersTab /></TabsContent>
          <TabsContent value="expenses"><ExpensesTab /></TabsContent>
          <TabsContent value="cash"><CashTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
