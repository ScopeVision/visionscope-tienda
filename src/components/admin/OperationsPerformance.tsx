import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type Granularity = "month" | "week";

type PartnerRow = {
  period_start: string;
  period_closed: boolean;
  partner_id: string;
  partner_name: string;
  committed: number;
  completed_on_time: number;
  completed_late: number;
  rescued_away: number;
  open_overdue: number;
  open_pending: number;
  cancelled: number;
  delivered_on_time: number;
  commitment_rate: number | null;
  rescues: number;
  throughput: number;
  avg_cycle_days: number | null;
};

type CompanyRow = {
  period_start: string;
  period_closed: boolean;
  committed: number;
  delivered_on_time: number;
  delivery_rate: number | null;
  own_rate: number | null;
  rescues_total: number;
  completed_late: number;
  open_overdue: number;
  cancelled: number;
  throughput: number;
  avg_cycle_days: number | null;
};

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatPeriod(iso: string, granularity: Granularity) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (granularity === "month") return `${MONTHS[m - 1]} ${y}`;
  return `Semana del ${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

function pct(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(0)}%`;
}

function rateClass(v: number | null) {
  if (v === null || v === undefined) return "text-secondary";
  if (v >= 80) return "text-emerald-700";
  if (v >= 50) return "text-amber-700";
  return "text-red-700";
}

export default function OperationsPerformance() {
  const [granularity, setGranularity] = useState<Granularity>("month");

  const { data: partnerRows = [], isLoading: loadingPartners } = useQuery<PartnerRow[]>({
    queryKey: ["op_partner_performance", granularity],
    queryFn: async () => {
      const { data, error } = await sb.rpc("op_partner_performance", {
        p_granularity: granularity,
        p_from: null,
        p_to: null,
      });
      if (error) throw error;
      return (data || []) as PartnerRow[];
    },
  });

  const { data: companyRows = [] } = useQuery<CompanyRow[]>({
    queryKey: ["op_company_performance", granularity],
    queryFn: async () => {
      const { data, error } = await sb.rpc("op_company_performance", {
        p_granularity: granularity,
        p_from: null,
        p_to: null,
      });
      if (error) throw error;
      return (data || []) as CompanyRow[];
    },
  });

  const latestCompany = useMemo(() => {
    if (!companyRows.length) return null;
    return [...companyRows].sort((a, b) => b.period_start.localeCompare(a.period_start))[0];
  }, [companyRows]);

  const groups = useMemo(() => {
    const map = new Map<string, PartnerRow[]>();
    for (const r of partnerRows) {
      const arr = map.get(r.period_start) || [];
      arr.push(r);
      map.set(r.period_start, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [partnerRows]);

  const showProvisional = latestCompany ? latestCompany.period_closed === false : groups[0]?.[1]?.[0]?.period_closed === false;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-4 flex gap-2 flex-wrap items-center">
            <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Por mes</SelectItem>
                <SelectItem value="week">Por semana</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {showProvisional && (
          <Alert>
            <AlertDescription>
              Periodo en curso: el porcentaje es provisional porque incluye tareas que aún están dentro de plazo.
            </AlertDescription>
          </Alert>
        )}

        {latestCompany && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-secondary">Entregado a tiempo</CardTitle></CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-semibold", rateClass(latestCompany.delivery_rate))}>
                  {pct(latestCompany.delivery_rate)}
                </div>
                <div className="text-xs text-secondary mt-1">
                  {latestCompany.delivered_on_time} de {latestCompany.committed}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-secondary">Por quien tocaba</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{pct(latestCompany.own_rate)}</div>
                <div className="text-xs text-secondary mt-1">
                  la diferencia con la anterior es el coste de las reasignaciones
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-secondary">Rescates</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{latestCompany.rescues_total}</div>
                <div className="text-xs text-secondary mt-1">tareas que tuvo que hacer otra persona</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-secondary">Vencidas abiertas</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{latestCompany.open_overdue}</div>
                <div className="text-xs text-secondary mt-1">sin cerrar y fuera de plazo</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Rendimiento por persona</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {groups.length === 0 ? (
              <div className="text-sm text-secondary py-8 text-center">
                {loadingPartners ? "Cargando…" : "No hay datos de rendimiento todavía."}
              </div>
            ) : (
              groups.map(([period, rows]) => (
                <div key={period} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{formatPeriod(period, granularity)}</div>
                    {rows[0]?.period_closed === false && (
                      <Badge variant="outline" className="border bg-sky-100 text-sky-800 border-sky-200 text-[10px]">
                        En curso
                      </Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Comprometidas</TableHead>
                        <TableHead>En plazo</TableHead>
                        <TableHead>Tarde</TableHead>
                        <TableHead>Las hizo otro</TableHead>
                        <TableHead>Vencidas</TableHead>
                        <TableHead>Efectividad</TableHead>
                        <TableHead>Rescates</TableHead>
                        <TableHead>Total cerradas</TableHead>
                        <TableHead>Días medios</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.period_start}-${r.partner_id}`} className={cn(!r.period_closed && "bg-muted/30")}>
                          <TableCell className="font-medium">{r.partner_name}</TableCell>
                          <TableCell>{r.committed}</TableCell>
                          <TableCell>{r.completed_on_time}</TableCell>
                          <TableCell>{r.completed_late}</TableCell>
                          <TableCell>
                            {r.rescued_away > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="border bg-amber-100 text-amber-800 border-amber-200">
                                    {r.rescued_away}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Tareas asignadas a esta persona que tuvo que cerrar otra.</TooltipContent>
                              </Tooltip>
                            ) : (
                              0
                            )}
                          </TableCell>
                          <TableCell>{r.open_overdue}</TableCell>
                          <TableCell className={cn("font-bold", rateClass(r.commitment_rate))}>
                            {pct(r.commitment_rate)}
                          </TableCell>
                          <TableCell>
                            {r.rescues > 0 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="border bg-emerald-100 text-emerald-800 border-emerald-200">
                                    {r.rescues}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>Tareas de otras personas que cerró esta persona.</TooltipContent>
                              </Tooltip>
                            ) : (
                              0
                            )}
                          </TableCell>
                          <TableCell>{r.throughput}</TableCell>
                          <TableCell>
                            {r.avg_cycle_days === null || r.avg_cycle_days === undefined
                              ? "—"
                              : Number(r.avg_cycle_days).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
