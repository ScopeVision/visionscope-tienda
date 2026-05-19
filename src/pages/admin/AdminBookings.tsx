import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/rental";
import { Download, Eye, Search } from "lucide-react";

import BookingEditor, {
  BOOKING_STATUSES,
  STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_LABELS,
} from "@/components/admin/BookingEditor";
import MonthNavigator from "@/components/admin/MonthNavigator";
import MonthlyFinancialSummary from "@/components/admin/MonthlyFinancialSummary";
import RentalPerformance from "@/components/admin/RentalPerformance";
import MonthlyAuditFeed from "@/components/admin/MonthlyAuditFeed";
import { currentMonthKey, getMonthRange, parseMonthKey } from "@/lib/monthRange";

const AdminBookings = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const [monthVal, setMonthVal] = useState<string>(currentMonthKey());
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [paymentFilter, setPaymentFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { year, month } = parseMonthKey(monthVal);
  const range = useMemo(() => getMonthRange(year, month, i18n.language), [year, month, i18n.language]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-bookings-month", range.startISO, range.endISO],
    queryFn: async () => {
      // Overlap: booking active any day during the month
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), items:booking_items(*)")
        .lte("start_date", range.endISO)
        .gte("end_date", range.startISO)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return bookings.filter((b: any) => {
      if (statusFilter !== "__all__" && b.status !== statusFilter) return false;
      if (paymentFilter !== "__all__" && (b.payment_status || "unpaid") !== paymentFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          b.reference,
          b.customer?.full_name,
          b.customer?.email,
          b.customer?.company,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, paymentFilter, search]);

  const exportCsv = () => {
    const rows = filtered.map((b: any) => ({
      reference: b.reference,
      status: b.status,
      payment_status: b.payment_status,
      start_date: b.start_date,
      end_date: b.end_date,
      customer_name: b.customer?.full_name ?? "",
      customer_email: b.customer?.email ?? "",
      subtotal: b.subtotal,
      deposit_total: b.deposit_total,
      total: b.total,
      items: (b.items ?? []).map((i: any) => `${i.product_name} x${i.quantity} (${i.days}d)`).join(" | "),
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lillo-bookings-${range.startISO.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-medium">{t("admin.bookings")}</h1>
          <p className="text-sm text-secondary mt-1">{range.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNavigator value={monthVal} onChange={setMonthVal} />
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> {t("admin.export")}
          </Button>
        </div>
      </div>

      <MonthlyFinancialSummary bookings={bookings as any} monthStartISO={range.startISO} />

      <div className="grid lg:grid-cols-2 gap-4">
        <RentalPerformance bookings={bookings as any} />
        <MonthlyAuditFeed startISO={range.startISO} endISO={range.endISO} />
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-lg font-medium mr-auto">Pedidos del mes</h2>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ref, cliente, email…"
              className="pl-8 h-9 w-[220px]"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los estados</SelectItem>
              {BOOKING_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los pagos</SelectItem>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{PAYMENT_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-secondary">{t("common.loading")}</p>
          ) : filtered.length === 0 ? (
            <p className="text-secondary py-10 text-center">Sin pedidos en este periodo</p>
          ) : (
            filtered.map((b: any) => (
              <div key={b.id} className="p-5 rounded-xl bg-surface border border-border">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium">{b.reference}</span>
                      <Badge variant="secondary">{STATUS_LABELS[b.status] ?? b.status}</Badge>
                      <Badge variant="outline">{PAYMENT_LABELS[b.payment_status] ?? "Unpaid"}</Badge>
                      {(b.subtotal_override != null || b.total_override != null) && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20">
                          Override
                        </Badge>
                      )}
                      {b.discount_value > 0 && b.discount_type !== "none" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20">
                          Descuento
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="font-medium">{b.customer?.full_name}</span>
                      <span className="text-secondary"> · {b.customer?.email}</span>
                    </div>
                    <div className="text-xs text-secondary mt-1">
                      {b.start_date} → {b.end_date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium">
                      {formatCurrency(Number(b.total), i18n.language)}
                    </div>
                    <div className="text-xs text-secondary">
                      + {formatCurrency(Number(b.deposit_total), i18n.language)} {t("common.deposit")}
                    </div>
                  </div>
                </div>
                {b.items?.length > 0 && (
                  <ul className="mt-3 text-sm text-secondary space-y-0.5">
                    {b.items.map((it: any) => (
                      <li key={it.id}>
                        · {it.product_name} ×{it.quantity} ({it.days}d) — {formatCurrency(Number(it.subtotal), i18n.language)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setEditingId(b.id)}
                  >
                    <Eye className="h-4 w-4" /> Editar pedido
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BookingEditor
        bookingId={editingId}
        onClose={() => {
          setEditingId(null);
          qc.invalidateQueries({ queryKey: ["admin-bookings-month"] });
          qc.invalidateQueries({ queryKey: ["admin-audit-month"] });
        }}
      />
    </div>
  );
};

export default AdminBookings;
