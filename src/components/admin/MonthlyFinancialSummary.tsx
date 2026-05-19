import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/rental";
import { TrendingUp, CheckCircle2, Percent, Sliders, Plus, ClipboardList, PlayCircle, XCircle, Clock, Users, UserPlus } from "lucide-react";

type Booking = {
  status: string;
  payment_status: string | null;
  subtotal: number;
  total: number;
  subtotal_override: number | null;
  total_override: number | null;
  discount_type: string;
  discount_value: number;
  extra_fees: any;
  customer_id: string | null;
  customer?: { created_at: string } | null;
  items?: { product_name: string; quantity: number; days: number; product_id: string | null; variant_id: string | null }[];
};

type Props = {
  bookings: Booking[];
  monthStartISO: string;
};

const ACTIVE_STATUSES = ["confirmado", "preparacion", "ready_for_pickup", "alquiler"];
const COMPLETED_STATUSES = ["returned", "finalizado"];
const PENDING_STATUSES = ["nuevo", "pending_review", "awaiting_confirmation"];

function Card({ icon: Icon, label, value, hint, tone = "default" }: any) {
  const toneCls =
    tone === "positive" ? "text-emerald-600 dark:text-emerald-400" :
    tone === "negative" ? "text-rose-600 dark:text-rose-400" :
    tone === "accent" ? "text-accent" : "text-foreground";
  return (
    <div className="p-4 rounded-xl bg-surface border border-border">
      <div className="flex items-center justify-between">
        <Icon className={`h-4 w-4 ${toneCls}`} />
        <span className="text-[10px] uppercase tracking-wider text-secondary">{label}</span>
      </div>
      <div className={`mt-2 text-xl font-display font-medium ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-secondary mt-0.5">{hint}</div>}
    </div>
  );
}

export default function MonthlyFinancialSummary({ bookings }: Props) {
  const { i18n } = useTranslation();
  const fmt = (n: number) => formatCurrency(n, i18n.language);

  const estimated = bookings.reduce((s, b) => s + Number(b.total || 0), 0);
  const confirmed = bookings
    .filter((b) => !["cancelado"].includes(b.status))
    .reduce((s, b) => s + Number(b.total || 0), 0);
  const paid = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((s, b) => s + Number(b.total || 0), 0);

  // Discounts: difference between un-discounted subtotal vs effective subtotal
  let discountsTotal = 0;
  let overridesDelta = 0;
  let extraFeesTotal = 0;
  bookings.forEach((b) => {
    const sub = Number(b.subtotal || 0);
    const total = Number(b.total || 0);
    if (b.discount_value && b.discount_type !== "none") {
      if (b.discount_type === "fixed") discountsTotal += Number(b.discount_value);
      else if (b.discount_type === "percent") discountsTotal += (sub * Number(b.discount_value)) / 100;
    }
    if (b.subtotal_override != null) overridesDelta += sub - Number(b.subtotal_override);
    if (b.total_override != null) overridesDelta += Number(b.total_override) - total;
    if (Array.isArray(b.extra_fees)) {
      extraFeesTotal += b.extra_fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0);
    }
  });

  const total = bookings.length;
  const completed = bookings.filter((b) => COMPLETED_STATUSES.includes(b.status)).length;
  const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length;
  const cancelled = bookings.filter((b) => b.status === "cancelado").length;
  const pending = bookings.filter((b) => PENDING_STATUSES.includes(b.status)).length;

  const uniqueCustomers = new Set(bookings.map((b) => b.customer_id).filter(Boolean));
  const customerCounts = new Map<string, number>();
  bookings.forEach((b) => {
    if (!b.customer_id) return;
    customerCounts.set(b.customer_id, (customerCounts.get(b.customer_id) || 0) + 1);
  });
  const recurring = [...customerCounts.values()].filter((n) => n > 1).length;
  const newCustomers = uniqueCustomers.size - recurring;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Ingresos</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card icon={TrendingUp} label="Estimado" value={fmt(estimated)} tone="accent" />
          <Card icon={CheckCircle2} label="Confirmado" value={fmt(confirmed)} tone="positive" />
          <Card icon={CheckCircle2} label="Cobrado" value={fmt(paid)} tone="positive" />
          <Card icon={Percent} label="Descuentos" value={fmt(discountsTotal)} tone="negative" />
          <Card icon={Sliders} label="Overrides" value={fmt(overridesDelta)} hint="δ manual" />
        </div>
        {extraFeesTotal > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card icon={Plus} label="Fees extra" value={fmt(extraFeesTotal)} />
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Pedidos</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card icon={ClipboardList} label="Total" value={total} />
          <Card icon={CheckCircle2} label="Completados" value={completed} tone="positive" />
          <Card icon={PlayCircle} label="Activos" value={active} tone="accent" />
          <Card icon={Clock} label="Pendientes" value={pending} />
          <Card icon={XCircle} label="Cancelados" value={cancelled} tone="negative" />
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-secondary mb-3">Clientes</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card icon={Users} label="Únicos" value={uniqueCustomers.size} />
          <Card icon={UserPlus} label="Nuevos" value={newCustomers} tone="accent" />
          <Card icon={Users} label="Recurrentes" value={recurring} />
        </div>
      </section>
    </div>
  );
}
