import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Flag, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

type InitiativeCategory = "growth" | "rnd" | "operations" | "finance";
type MilestoneType = "launch" | "deadline" | "review" | "other";

type Initiative = {
  id: string;
  title: string;
  category: InitiativeCategory;
  target_date: string | null;
};
type Task = {
  id: string;
  initiative_id: string | null;
  title: string;
  assigned_to: string | null;
  priority: "low" | "medium" | "high";
  due_date: string | null;
};
type Partner = { id: string; name: string };
type Milestone = {
  id: string;
  title: string;
  milestone_date: string;
  type: MilestoneType;
  initiative_id: string | null;
  notes: string | null;
};

const CATEGORY_LABELS: Record<InitiativeCategory, string> = {
  growth: "Growth",
  rnd: "R&D",
  operations: "Operaciones",
  finance: "Finanzas",
};
const CATEGORY_DOT: Record<InitiativeCategory, string> = {
  growth: "bg-emerald-500",
  rnd: "bg-violet-500",
  operations: "bg-amber-500",
  finance: "bg-sky-500",
};
const CATEGORY_BADGE: Record<InitiativeCategory, string> = {
  growth: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rnd: "bg-violet-100 text-violet-800 border-violet-200",
  operations: "bg-amber-100 text-amber-800 border-amber-200",
  finance: "bg-sky-100 text-sky-800 border-sky-200",
};
const NEUTRAL_DOT = "bg-slate-400";
const MILESTONE_LABELS: Record<MilestoneType, string> = {
  launch: "Lanzamiento",
  deadline: "Deadline",
  review: "Review",
  other: "Otro",
};
const PRIORITY_LABELS = { low: "Baja", medium: "Media", high: "Alta" } as const;

type EventItem =
  | { kind: "task"; date: string; id: string; title: string; category: InitiativeCategory | null; task: Task }
  | { kind: "initiative"; date: string; id: string; title: string; category: InitiativeCategory; initiative: Initiative }
  | { kind: "milestone"; date: string; id: string; title: string; mtype: MilestoneType; milestone: Milestone };

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function startOfWeek(d: Date) {
  // Monday-based
  const day = (d.getDay() + 6) % 7;
  const r = new Date(d);
  r.setDate(d.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function OperationsCalendar({
  initiatives,
  tasks,
  partnersById,
  onOpenTask,
  onOpenInitiative,
}: {
  initiatives: Initiative[];
  tasks: Task[];
  partnersById: Record<string, Partner>;
  onOpenTask: (id: string) => void;
  onOpenInitiative: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [view, setView] = useState<"month" | "week">("month");
  const [weekAnchor, setWeekAnchor] = useState<Date>(startOfWeek(new Date()));
  const [showTasks, setShowTasks] = useState(true);
  const [showInitiatives, setShowInitiatives] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [milestoneDialog, setMilestoneDialog] = useState<{ open: boolean; editing?: Milestone | null; defaultDate?: string }>({ open: false });

  const initiativesById = useMemo(
    () => Object.fromEntries(initiatives.map((i) => [i.id, i])) as Record<string, Initiative>,
    [initiatives],
  );

  const { data: milestones = [] } = useQuery<Milestone[]>({
    queryKey: ["op_milestones"],
    queryFn: async () =>
      (await sb.from("op_milestones").select("*").order("milestone_date", { ascending: true })).data || [],
  });

  const events: EventItem[] = useMemo(() => {
    const out: EventItem[] = [];
    if (showTasks) {
      for (const t of tasks) {
        if (!t.due_date) continue;
        const init = t.initiative_id ? initiativesById[t.initiative_id] : null;
        out.push({ kind: "task", date: t.due_date, id: t.id, title: t.title, category: init?.category ?? null, task: t });
      }
    }
    if (showInitiatives) {
      for (const i of initiatives) {
        if (!i.target_date) continue;
        out.push({ kind: "initiative", date: i.target_date, id: i.id, title: i.title, category: i.category, initiative: i });
      }
    }
    if (showMilestones) {
      for (const m of milestones) {
        out.push({ kind: "milestone", date: m.milestone_date, id: m.id, title: m.title, mtype: m.type, milestone: m });
      }
    }
    return out;
  }, [tasks, initiatives, milestones, initiativesById, showTasks, showInitiatives, showMilestones]);

  const eventsByDay = useMemo(() => {
    const m: Record<string, EventItem[]> = {};
    for (const e of events) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  const goToday = () => {
    const now = new Date();
    setCursor(startOfMonth(now));
    setWeekAnchor(startOfWeek(now));
  };

  const openDayInWeek = (d: Date) => {
    setWeekAnchor(startOfWeek(d));
    setView("week");
  };

  const removeMilestone = async (id: string) => {
    if (!confirm("¿Eliminar este hito?")) return;
    const { error } = await sb.from("op_milestones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Hito eliminado");
    qc.invalidateQueries({ queryKey: ["op_milestones"] });
  };

  const monthLabel = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(cursor);
  const weekEnd = addDays(weekAnchor, 6);
  const weekLabel = `${new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(weekAnchor)} — ${new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(weekEnd)}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showTasks} onCheckedChange={setShowTasks} id="f-tasks" />
            <label htmlFor="f-tasks" className="text-sm">Tareas</label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showInitiatives} onCheckedChange={setShowInitiatives} id="f-init" />
            <label htmlFor="f-init" className="text-sm">Iniciativas</label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showMilestones} onCheckedChange={setShowMilestones} id="f-ms" />
            <label htmlFor="f-ms" className="text-sm">Hitos</label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>Hoy</Button>
            <Button size="sm" onClick={() => setMilestoneDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo hito
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === "month" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MonthGrid
              cursor={cursor}
              eventsByDay={eventsByDay}
              onDayClick={openDayInWeek}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setView("month")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Mes
              </Button>
              <CardTitle className="text-base">{weekLabel}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <WeekView
              anchor={weekAnchor}
              eventsByDay={eventsByDay}
              partnersById={partnersById}
              initiativesById={initiativesById}
              onOpenTask={onOpenTask}
              onOpenInitiative={onOpenInitiative}
              onEditMilestone={(m) => setMilestoneDialog({ open: true, editing: m })}
              onDeleteMilestone={removeMilestone}
            />
          </CardContent>
        </Card>
      )}

      <MilestoneDialog
        open={milestoneDialog.open}
        editing={milestoneDialog.editing || null}
        defaultDate={milestoneDialog.defaultDate}
        initiatives={initiatives}
        onClose={() => setMilestoneDialog({ open: false })}
        onSaved={() => {
          setMilestoneDialog({ open: false });
          qc.invalidateQueries({ queryKey: ["op_milestones"] });
        }}
      />
    </div>
  );
}

/* --------------------------- Month Grid --------------------------- */

function MonthGrid({
  cursor,
  eventsByDay,
  onDayClick,
}: {
  cursor: Date;
  eventsByDay: Record<string, EventItem[]>;
  onDayClick: (d: Date) => void;
}) {
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  const today = new Date();
  const weekdayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-secondary">
        {weekdayLabels.map((w) => (
          <div key={w} className="px-2 py-1 font-medium">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, idx) => {
          const iso = toISO(d);
          const evs = eventsByDay[iso] || [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const visible = evs.slice(0, 3);
          const overflow = evs.length - visible.length;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDayClick(d)}
              className={cn(
                "text-left min-h-[92px] rounded-md border p-2 hover:border-foreground/40 transition-colors",
                inMonth ? "bg-surface border-border" : "bg-muted/30 border-transparent text-secondary",
                isToday && "ring-1 ring-foreground",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-xs font-medium", isToday && "text-foreground")}>{d.getDate()}</span>
                {evs.length > 0 && <span className="text-[10px] text-secondary">{evs.length}</span>}
              </div>
              <div className="space-y-1">
                {visible.map((e, i) => (
                  <EventDot key={i} ev={e} />
                ))}
                {overflow > 0 && <div className="text-[10px] text-secondary">+{overflow}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventDot({ ev }: { ev: EventItem }) {
  if (ev.kind === "milestone") {
    return (
      <div className="flex items-center gap-1 text-[11px] truncate">
        <Flag className="h-3 w-3 shrink-0 text-rose-600" />
        <span className="truncate">{ev.title}</span>
      </div>
    );
  }
  const dot = ev.category ? CATEGORY_DOT[ev.category] : NEUTRAL_DOT;
  return (
    <div className="flex items-center gap-1 text-[11px] truncate">
      <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", dot)} />
      <span className="truncate">{ev.title}</span>
    </div>
  );
}

/* --------------------------- Week View --------------------------- */

function WeekView({
  anchor,
  eventsByDay,
  partnersById,
  initiativesById,
  onOpenTask,
  onOpenInitiative,
  onEditMilestone,
  onDeleteMilestone,
}: {
  anchor: Date;
  eventsByDay: Record<string, EventItem[]>;
  partnersById: Record<string, Partner>;
  initiativesById: Record<string, Initiative>;
  onOpenTask: (id: string) => void;
  onOpenInitiative: (id: string) => void;
  onEditMilestone: (m: Milestone) => void;
  onDeleteMilestone: (id: string) => void;
}) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(anchor, i));
  const today = new Date();
  const dayFmt = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="space-y-3">
      {days.map((d) => {
        const iso = toISO(d);
        const evs = eventsByDay[iso] || [];
        const isToday = sameDay(d, today);
        return (
          <div key={iso} className={cn("border rounded-md p-3", isToday ? "border-foreground/40 bg-muted/30" : "border-border")}>
            <div className="text-sm font-medium capitalize mb-2">{dayFmt.format(d)}</div>
            {evs.length === 0 ? (
              <div className="text-xs text-secondary">Sin eventos.</div>
            ) : (
              <div className="space-y-1.5">
                {evs.map((e, i) => (
                  <WeekEventRow
                    key={i}
                    ev={e}
                    partnersById={partnersById}
                    initiativesById={initiativesById}
                    onOpenTask={onOpenTask}
                    onOpenInitiative={onOpenInitiative}
                    onEditMilestone={onEditMilestone}
                    onDeleteMilestone={onDeleteMilestone}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekEventRow({
  ev,
  partnersById,
  initiativesById,
  onOpenTask,
  onOpenInitiative,
  onEditMilestone,
  onDeleteMilestone,
}: {
  ev: EventItem;
  partnersById: Record<string, Partner>;
  initiativesById: Record<string, Initiative>;
  onOpenTask: (id: string) => void;
  onOpenInitiative: (id: string) => void;
  onEditMilestone: (m: Milestone) => void;
  onDeleteMilestone: (id: string) => void;
}) {
  if (ev.kind === "task") {
    const t = ev.task;
    const assigned = t.assigned_to ? partnersById[t.assigned_to] : null;
    const init = t.initiative_id ? initiativesById[t.initiative_id] : null;
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-border bg-surface p-2 cursor-pointer hover:border-foreground/30"
        onClick={() => onOpenTask(t.id)}
      >
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", init ? CATEGORY_DOT[init.category] : NEUTRAL_DOT)} />
        <Badge variant="outline" className="text-[10px]">Tarea</Badge>
        <span className="text-sm truncate flex-1">{t.title}</span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded",
            t.priority === "high" && "bg-red-100 text-red-700",
            t.priority === "medium" && "bg-amber-100 text-amber-700",
            t.priority === "low" && "bg-slate-100 text-slate-700",
          )}
        >
          {PRIORITY_LABELS[t.priority]}
        </span>
        {assigned && <span className="text-xs text-secondary">{assigned.name}</span>}
      </div>
    );
  }
  if (ev.kind === "initiative") {
    const i = ev.initiative;
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-border bg-surface p-2 cursor-pointer hover:border-foreground/30"
        onClick={() => onOpenInitiative(i.id)}
      >
        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", CATEGORY_DOT[i.category])} />
        <Badge variant="outline" className={cn("text-[10px] border", CATEGORY_BADGE[i.category])}>
          Iniciativa · {CATEGORY_LABELS[i.category]}
        </Badge>
        <span className="text-sm truncate flex-1">{i.title}</span>
      </div>
    );
  }
  const m = ev.milestone;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-2">
      <Flag className="h-4 w-4 text-rose-600 shrink-0" />
      <Badge variant="outline" className="text-[10px]">Hito · {MILESTONE_LABELS[m.type]}</Badge>
      <span className="text-sm truncate flex-1">{m.title}</span>
      <Button variant="ghost" size="sm" onClick={() => onEditMilestone(m)}>Editar</Button>
      <Button variant="ghost" size="icon" onClick={() => onDeleteMilestone(m.id)}>
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  );
}

/* --------------------------- Milestone Dialog --------------------------- */

function MilestoneDialog({
  open,
  editing,
  defaultDate,
  initiatives,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Milestone | null;
  defaultDate?: string;
  initiatives: Initiative[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<MilestoneType>("other");
  const [initiativeId, setInitiativeId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDate(editing.milestone_date);
      setType(editing.type);
      setInitiativeId(editing.initiative_id || "none");
      setNotes(editing.notes || "");
    } else {
      setTitle("");
      setDate(defaultDate || toISO(new Date()));
      setType("other");
      setInitiativeId("none");
      setNotes("");
    }
  }, [open, editing, defaultDate]);

  const save = async () => {
    if (!title.trim() || !date) {
      toast.error("Título y fecha son obligatorios");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      milestone_date: date,
      type,
      initiative_id: initiativeId === "none" ? null : initiativeId,
      notes: notes.trim() || null,
    };
    const { error } = editing
      ? await sb.from("op_milestones").update(payload).eq("id", editing.id)
      : await sb.from("op_milestones").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Hito actualizado" : "Hito creado");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar hito" : "Nuevo hito"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secondary">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary">Fecha</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-secondary">Tipo</label>
              <Select value={type} onValueChange={(v) => setType(v as MilestoneType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MILESTONE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-secondary">Iniciativa asociada (opcional)</label>
            <Select value={initiativeId} onValueChange={setInitiativeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sin iniciativa —</SelectItem>
                {initiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-secondary">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
