import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/rental";
import { Download, Eye } from "lucide-react";

import BookingEditor, {
  BOOKING_STATUSES,
  STATUS_LABELS,
  PAYMENT_LABELS,
} from "@/components/admin/BookingEditor";

const AdminBookings = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("nuevo");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-bookings", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), items:booking_items(*)")
        .eq("status", tab as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportCsv = () => {
    const rows = bookings.map((b: any) => ({
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
    a.download = `lillo-bookings-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-medium">{t("admin.bookings")}</h1>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
          <Download className="h-4 w-4" /> {t("admin.export")}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted flex-wrap h-auto">
          {BOOKING_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {STATUS_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-secondary">{t("common.loading")}</p>
        ) : bookings.length === 0 ? (
          <p className="text-secondary py-10 text-center">—</p>
        ) : (
          bookings.map((b: any) => (
            <div key={b.id} className="p-5 rounded-xl bg-surface border border-border">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">{b.reference}</span>
                    <Badge variant="secondary">{STATUS_LABELS[b.status] ?? b.status}</Badge>
                    <Badge variant="outline">{PAYMENT_LABELS[b.payment_status] ?? "Unpaid"}</Badge>
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

      <BookingEditor
        bookingId={editingId}
        onClose={() => {
          setEditingId(null);
          qc.invalidateQueries({ queryKey: ["admin-bookings"] });
        }}
      />
    </div>
  );
};

export default AdminBookings;
