import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/rental";
import { Download, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["nuevo", "confirmado", "preparacion", "alquiler", "finalizado", "cancelado"] as const;
type Status = (typeof STATUSES)[number];

const NEXT_ACTION: Record<Status, { label: string; next: Status } | null> = {
  nuevo: { label: "actions.confirm", next: "confirmado" },
  confirmado: { label: "actions.prepare", next: "preparacion" },
  preparacion: { label: "actions.deliver", next: "alquiler" },
  alquiler: { label: "actions.return", next: "finalizado" },
  finalizado: null,
  cancelado: null,
};

const AdminBookings = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("nuevo");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [statusDraft, setStatusDraft] = useState<Status>("nuevo");
  const [savingDetail, setSavingDetail] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin-bookings", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), items:booking_items(*)")
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const advance = async (id: string, next: Status) => {
    const { error } = await supabase.from("bookings").update({ status: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("OK");
    qc.invalidateQueries({ queryKey: ["admin-bookings"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const exportCsv = () => {
    const rows = bookings.map((b: any) => ({
      reference: b.reference,
      status: b.status,
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList className="bg-muted">
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {t(`bookings.tabs.${s}`)}
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
          bookings.map((b: any) => {
            const action = NEXT_ACTION[b.status as Status];
            return (
              <div key={b.id} className="p-5 rounded-xl bg-surface border border-border">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{b.reference}</span>
                      <Badge variant="secondary" className="bg-accent-soft text-accent-foreground">
                        {t(`bookings.tabs.${b.status}`)}
                      </Badge>
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
                {action && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      className="bg-foreground text-background hover:bg-foreground/90 gap-2"
                      onClick={() => advance(b.id, action.next)}
                    >
                      {t(`bookings.${action.label}`)} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminBookings;
