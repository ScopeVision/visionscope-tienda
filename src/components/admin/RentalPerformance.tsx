type BookingItem = {
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  quantity: number;
  days: number;
};

type Booking = {
  status: string;
  start_date: string;
  end_date: string;
  items?: BookingItem[];
};

type Props = { bookings: Booking[] };

export default function RentalPerformance({ bookings }: Props) {
  const productCounts = new Map<string, { name: string; qty: number; days: number }>();
  let totalRentedDays = 0;

  bookings
    .filter((b) => b.status !== "cancelado")
    .forEach((b) => {
      (b.items || []).forEach((it) => {
        const key = it.product_name + (it.variant_id ? `::${it.variant_id}` : "");
        const prev = productCounts.get(key) || { name: it.product_name, qty: 0, days: 0 };
        prev.qty += it.quantity;
        prev.days += it.days * it.quantity;
        productCounts.set(key, prev);
        totalRentedDays += it.days * it.quantity;
      });
    });

  const top = [...productCounts.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);

  return (
    <div className="p-5 rounded-xl bg-surface border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Rendimiento del mes</h3>
        <span className="text-xs text-secondary">
          {totalRentedDays} días-unidad alquilados
        </span>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-secondary py-4 text-center">Sin actividad</p>
      ) : (
        <ul className="space-y-2">
          {top.map((p, i) => {
            const max = top[0].qty || 1;
            const pct = Math.round((p.qty / max) * 100);
            return (
              <li key={i} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="truncate">{p.name}</span>
                  <span className="text-secondary tabular-nums">×{p.qty} · {p.days}d</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
