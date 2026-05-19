import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Props = { startISO: string; endISO: string };

const HUMAN: Record<string, string> = {
  status: "Estado",
  payment_status: "Pago",
  total: "Total",
  items_count: "Productos",
};

export default function MonthlyAuditFeed({ startISO, endISO }: Props) {
  const { data: log = [] } = useQuery({
    queryKey: ["admin-audit-month", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_audit_log")
        .select("*, booking:bookings(reference)")
        .gte("created_at", `${startISO}T00:00:00`)
        .lte("created_at", `${endISO}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-5 rounded-xl bg-surface border border-border">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium">Histórico de modificaciones</h3>
      </div>
      {log.length === 0 ? (
        <p className="text-sm text-secondary py-4 text-center">Sin cambios registrados</p>
      ) : (
        <ul className="space-y-3 max-h-[360px] overflow-y-auto">
          {log.map((entry: any) => {
            const changes = entry.changes || {};
            const keys = Object.keys(changes);
            return (
              <li key={entry.id} className="text-sm border-l-2 border-border pl-3">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs">{entry.booking?.reference ?? entry.booking_id.slice(0, 8)}</span>
                  <span className="text-xs text-secondary">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {keys.map((k) => {
                    const [before, after] = changes[k] || [];
                    return (
                      <div key={k} className="text-xs text-secondary">
                        <span className="font-medium text-foreground">{HUMAN[k] ?? k}:</span>{" "}
                        <span className="line-through opacity-60">{String(before)}</span>{" → "}
                        <span className="text-foreground">{String(after)}</span>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
