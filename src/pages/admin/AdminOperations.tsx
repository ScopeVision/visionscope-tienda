import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import OperationsCalendar from "@/components/admin/OperationsCalendar";

const sb = supabase as any;

type Partner = { id: string; name: string; active: boolean };
type InitiativeCategory = "growth" | "rnd" | "operations" | "finance";
type InitiativeStatus = "planning" | "active" | "paused" | "done";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high";

type Initiative = {
  id: string;
  title: string;
  description: string | null;
  category: InitiativeCategory;
  status: InitiativeStatus;
  owner_partner_id: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  initiative_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type Update = {
  id: string;
  entity_type: string;
  entity_id: string;
  author_partner_id: string | null;
  content: string;
  created_at: string;
};

const CATEGORY_LABELS: Record<InitiativeCategory, string> = {
  growth: "Growth",
  rnd: "R&D",
  operations: "Operaciones",
  finance: "Finanzas",
};

const CATEGORY_COLORS: Record<InitiativeCategory, string> = {
  growth: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rnd: "bg-violet-100 text-violet-800 border-violet-200",
  operations: "bg-amber-100 text-amber-800 border-amber-200",
  finance: "bg-sky-100 text-sky-800 border-sky-200",
};

const STATUS_LABELS: Record<InitiativeStatus, string> = {
  planning: "Planificación",
  active: "Activa",
  paused: "Pausada",
  done: "Completada",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

export default function AdminOperations() {
  const qc = useQueryClient();

  const { data: partners = [] } = useQuery<Partner[]>({
    queryKey: ["op_partners"],
    queryFn: async () => (await sb.from("op_partners").select("*").order("name")).data || [],
  });
  const { data: initiatives = [] } = useQuery<Initiative[]>({
    queryKey: ["op_initiatives"],
    queryFn: async () =>
      (await sb.from("op_initiatives").select("*").order("created_at", { ascending: false })).data || [],
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["op_tasks"],
    queryFn: async () =>
      (await sb.from("op_tasks").select("*").order("created_at", { ascending: false })).data || [],
  });

  const partnersById = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p])), [partners]);
  const initiativesById = useMemo(() => Object.fromEntries(initiatives.map((i) => [i.id, i])), [initiatives]);

  const [initiativeDialog, setInitiativeDialog] = useState<{ open: boolean; editing?: Initiative | null }>({ open: false });
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; editing?: Task | null; defaultInitiative?: string | null }>({ open: false });
  const [openInitiative, setOpenInitiative] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["op_partners"] });
    qc.invalidateQueries({ queryKey: ["op_initiatives"] });
    qc.invalidateQueries({ queryKey: ["op_tasks"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Productividad</h1>
          <p className="text-sm text-secondary mt-1">Iniciativas, tareas y equipo interno.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setInitiativeDialog({ open: true })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva iniciativa
          </Button>
          <Button onClick={() => setTaskDialog({ open: true })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva tarea
          </Button>
        </div>
      </div>

      <Tabs defaultValue="initiatives">
        <TabsList>
          <TabsTrigger value="initiatives">Iniciativas</TabsTrigger>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="team">Equipo</TabsTrigger>
        </TabsList>

        <TabsContent value="initiatives" className="mt-4">
          <InitiativesTab
            initiatives={initiatives}
            partnersById={partnersById}
            tasks={tasks}
            onOpen={(id) => setOpenInitiative(id)}
            onEdit={(i) => setInitiativeDialog({ open: true, editing: i })}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab
            tasks={tasks}
            initiativesById={initiativesById}
            partners={partners}
            partnersById={partnersById}
            onOpen={(id) => setOpenTask(id)}
            onNewTask={(initId) => setTaskDialog({ open: true, defaultInitiative: initId })}
          />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamTab partners={partners} onChanged={refreshAll} />
        </TabsContent>
      </Tabs>

      <InitiativeDialog
        open={initiativeDialog.open}
        editing={initiativeDialog.editing || null}
        partners={partners}
        onClose={() => setInitiativeDialog({ open: false })}
        onSaved={() => {
          setInitiativeDialog({ open: false });
          refreshAll();
        }}
      />
      <TaskDialog
        open={taskDialog.open}
        editing={taskDialog.editing || null}
        defaultInitiative={taskDialog.defaultInitiative || null}
        initiatives={initiatives}
        partners={partners}
        onClose={() => setTaskDialog({ open: false })}
        onSaved={() => {
          setTaskDialog({ open: false });
          refreshAll();
        }}
      />
      <InitiativeDetailDialog
        initiativeId={openInitiative}
        initiativesById={initiativesById}
        partnersById={partnersById}
        partners={partners}
        tasks={tasks}
        onClose={() => setOpenInitiative(null)}
        onOpenTask={(id) => setOpenTask(id)}
        onNewTask={(initId) => setTaskDialog({ open: true, defaultInitiative: initId })}
        onEdit={(i) => setInitiativeDialog({ open: true, editing: i })}
      />
      <TaskDetailDialog
        taskId={openTask}
        tasks={tasks}
        initiativesById={initiativesById}
        partnersById={partnersById}
        partners={partners}
        onClose={() => setOpenTask(null)}
        onEdit={(t) => setTaskDialog({ open: true, editing: t })}
        onChanged={refreshAll}
      />
    </div>
  );
}

/* --------------------------- Initiatives Tab --------------------------- */

function InitiativesTab({
  initiatives,
  partnersById,
  tasks,
  onOpen,
  onEdit,
}: {
  initiatives: Initiative[];
  partnersById: Record<string, Partner>;
  tasks: Task[];
  onOpen: (id: string) => void;
  onEdit: (i: Initiative) => void;
}) {
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = initiatives.filter(
    (i) => (category === "all" || i.category === category) && (status === "all" || i.status === status),
  );

  const taskCountByInit = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!t.initiative_id) continue;
      const e = (m[t.initiative_id] ||= { total: 0, done: 0 });
      e.total++;
      if (t.status === "done") e.done++;
    }
    return m;
  }, [tasks]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
        <CardTitle className="text-base">Iniciativas ({filtered.length})</CardTitle>
        <div className="flex gap-2 ml-auto">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-sm text-secondary py-8 text-center">No hay iniciativas.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Objetivo</TableHead>
                <TableHead>Tareas</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const tc = taskCountByInit[i.id] || { total: 0, done: 0 };
                return (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => onOpen(i.id)}>
                    <TableCell className="font-medium">{i.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border", CATEGORY_COLORS[i.category])}>
                        {CATEGORY_LABELS[i.category]}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{STATUS_LABELS[i.status]}</Badge></TableCell>
                    <TableCell>{i.owner_partner_id ? partnersById[i.owner_partner_id]?.name || "—" : "—"}</TableCell>
                    <TableCell>{i.target_date || "—"}</TableCell>
                    <TableCell className="text-sm text-secondary">{tc.done}/{tc.total}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(i)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------- Tasks (Kanban) Tab --------------------------- */

function TasksTab({
  tasks,
  initiativesById,
  partners,
  partnersById,
  onOpen,
  onNewTask,
}: {
  tasks: Task[];
  initiativesById: Record<string, Initiative>;
  partners: Partner[];
  partnersById: Record<string, Partner>;
  onOpen: (id: string) => void;
  onNewTask: (initId: string | null) => void;
}) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [dragging, setDragging] = useState<string | null>(null);

  const filtered = tasks.filter((t) => {
    if (assignee !== "all" && t.assigned_to !== assignee) return false;
    if (category !== "all") {
      const init = t.initiative_id ? initiativesById[t.initiative_id] : null;
      if (!init || init.category !== category) return false;
    }
    return true;
  });

  const byStatus: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], blocked: [], done: [] };
  for (const t of filtered) byStatus[t.status].push(t);

  const moveTask = async (id: string, status: TaskStatus) => {
    const { error } = await sb.from("op_tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["op_tasks"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex gap-2 flex-wrap">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Partner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los partners</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => onNewTask(null)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva tarea
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASK_STATUSES.map((st) => (
          <div
            key={st}
            className="bg-muted/40 rounded-lg p-3 min-h-[200px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging) {
                moveTask(dragging, st);
                setDragging(null);
              }
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-sm">{TASK_STATUS_LABELS[st]}</div>
              <Badge variant="secondary">{byStatus[st].length}</Badge>
            </div>
            <div className="space-y-2">
              {byStatus[st].map((t) => {
                const init = t.initiative_id ? initiativesById[t.initiative_id] : null;
                const cat = init?.category;
                const assignedPartner = t.assigned_to ? partnersById[t.assigned_to] : null;
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => onOpen(t.id)}
                    className="bg-surface border border-border rounded-md p-3 cursor-pointer hover:border-foreground/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {cat ? (
                        <Badge variant="outline" className={cn("border text-[10px]", CATEGORY_COLORS[cat])}>
                          {CATEGORY_LABELS[cat]}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Sin iniciativa</Badge>
                      )}
                      {assignedPartner && (
                        <div
                          className="h-6 w-6 rounded-full bg-foreground text-background text-[10px] font-semibold flex items-center justify-center"
                          title={assignedPartner.name}
                        >
                          {initials(assignedPartner.name)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium mb-1">{t.title}</div>
                    <div className="flex items-center justify-between text-xs text-secondary">
                      <span>{t.due_date || "—"}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded",
                        t.priority === "high" && "bg-red-100 text-red-700",
                        t.priority === "medium" && "bg-amber-100 text-amber-700",
                        t.priority === "low" && "bg-slate-100 text-slate-700",
                      )}>
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {TASK_STATUSES.filter((s) => s !== st).map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); moveTask(t.id, s); }}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-secondary hover:bg-muted"
                        >
                          → {TASK_STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Team Tab --------------------------- */

function TeamTab({ partners, onChanged }: { partners: Partner[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await sb.from("op_partners").insert({ name: trimmed, active: true });
    if (error) return toast.error(error.message);
    setName("");
    onChanged();
  };

  const saveName = async (id: string) => {
    const value = editing[id]?.trim();
    if (!value) return;
    const { error } = await sb.from("op_partners").update({ name: value }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditing((s) => { const c = { ...s }; delete c[id]; return c; });
    onChanged();
  };

  const toggleActive = async (p: Partner) => {
    const { error } = await sb.from("op_partners").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Equipo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Nombre del partner" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Añadir</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-32">Activo</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((p) => {
              const isEditing = editing[p.id] !== undefined;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {isEditing ? (
                      <Input value={editing[p.id]} onChange={(e) => setEditing((s) => ({ ...s, [p.id]: e.target.value }))} />
                    ) : (
                      <span className="font-medium">{p.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => saveName(p.id)}>Guardar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing((s) => { const c = { ...s }; delete c[p.id]; return c; })}>Cancelar</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setEditing((s) => ({ ...s, [p.id]: p.name }))}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Initiative Dialog (create/edit) --------------------------- */

function InitiativeDialog({
  open, editing, partners, onClose, onSaved,
}: {
  open: boolean; editing: Initiative | null; partners: Partner[];
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<InitiativeCategory>("growth");
  const [status, setStatus] = useState<InitiativeStatus>("planning");
  const [owner, setOwner] = useState<string>("none");
  const [targetDate, setTargetDate] = useState<string>("");

  useMemo(() => {
    if (open) {
      setTitle(editing?.title || "");
      setDescription(editing?.description || "");
      setCategory(editing?.category || "growth");
      setStatus(editing?.status || "planning");
      setOwner(editing?.owner_partner_id || "none");
      setTargetDate(editing?.target_date || "");
    }
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast.error("El título es obligatorio");
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      status,
      owner_partner_id: owner === "none" ? null : owner,
      target_date: targetDate || null,
    };
    const res = editing
      ? await sb.from("op_initiatives").update(payload).eq("id", editing.id)
      : await sb.from("op_initiatives").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Iniciativa actualizada" : "Iniciativa creada");
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("¿Eliminar iniciativa? Las tareas asociadas quedarán sin iniciativa.")) return;
    const { error } = await sb.from("op_initiatives").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Iniciativa eliminada");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar iniciativa" : "Nueva iniciativa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secondary">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-secondary">Descripción</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary">Categoría</label>
              <Select value={category} onValueChange={(v) => setCategory(v as InitiativeCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-secondary">Estado</label>
              <Select value={status} onValueChange={(v) => setStatus(v as InitiativeStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-secondary">Owner</label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-secondary">Fecha objetivo</label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {editing && (
            <Button variant="ghost" onClick={remove} className="mr-auto text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Task Dialog (create/edit) --------------------------- */

function TaskDialog({
  open, editing, defaultInitiative, initiatives, partners, onClose, onSaved,
}: {
  open: boolean; editing: Task | null; defaultInitiative: string | null;
  initiatives: Initiative[]; partners: Partner[];
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [initiative, setInitiative] = useState<string>("none");
  const [assignee, setAssignee] = useState<string>("none");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string>("");

  useMemo(() => {
    if (open) {
      setTitle(editing?.title || "");
      setDescription(editing?.description || "");
      setInitiative(editing?.initiative_id || defaultInitiative || "none");
      setAssignee(editing?.assigned_to || "none");
      setStatus(editing?.status || "todo");
      setPriority(editing?.priority || "medium");
      setDueDate(editing?.due_date || "");
    }
  }, [open, editing, defaultInitiative]);

  const save = async () => {
    if (!title.trim()) return toast.error("El título es obligatorio");
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      initiative_id: initiative === "none" ? null : initiative,
      assigned_to: assignee === "none" ? null : assignee,
      status,
      priority,
      due_date: dueDate || null,
    };
    const res = editing
      ? await sb.from("op_tasks").update(payload).eq("id", editing.id)
      : await sb.from("op_tasks").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Tarea actualizada" : "Tarea creada");
    onSaved();
  };

  const remove = async () => {
    if (!editing) return;
    if (!confirm("¿Eliminar tarea?")) return;
    const { error } = await sb.from("op_tasks").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Tarea eliminada");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-secondary">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-secondary">Descripción</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-secondary">Iniciativa</label>
              <Select value={initiative} onValueChange={setInitiative}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin iniciativa</SelectItem>
                  {initiatives.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-secondary">Asignada a</label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-secondary">Estado</label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-secondary">Prioridad</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-secondary">Fecha límite</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {editing && (
            <Button variant="ghost" onClick={remove} className="mr-auto text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Updates Thread --------------------------- */

function UpdatesThread({
  entityType, entityId, partners, partnersById,
}: {
  entityType: "initiative" | "task"; entityId: string;
  partners: Partner[]; partnersById: Record<string, Partner>;
}) {
  const qc = useQueryClient();
  const key = ["op_updates", entityType, entityId];
  const { data: updates = [] } = useQuery<Update[]>({
    queryKey: key,
    queryFn: async () =>
      (await sb.from("op_updates")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })).data || [],
  });

  const [content, setContent] = useState("");
  const [author, setAuthor] = useState<string>("none");

  const post = async () => {
    if (!content.trim()) return;
    const { error } = await sb.from("op_updates").insert({
      entity_type: entityType,
      entity_id: entityId,
      author_partner_id: author === "none" ? null : author,
      content: content.trim(),
    });
    if (error) return toast.error(error.message);
    setContent("");
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Notas</div>
      <div className="space-y-2 rounded-md border border-border p-3 bg-muted/20">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Añadir nota..." />
        <div className="flex gap-2">
          <Select value={author} onValueChange={setAuthor}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Autor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Anónimo</SelectItem>
              {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={post} className="ml-auto">Publicar</Button>
        </div>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {updates.length === 0 && <div className="text-xs text-secondary">Sin notas aún.</div>}
        {updates.map((u) => (
          <div key={u.id} className="rounded-md border border-border p-2 text-sm">
            <div className="flex items-center justify-between text-xs text-secondary mb-1">
              <span className="font-medium text-foreground">
                {u.author_partner_id ? partnersById[u.author_partner_id]?.name || "—" : "Anónimo"}
              </span>
              <span>{new Date(u.created_at).toLocaleString()}</span>
            </div>
            <div className="whitespace-pre-wrap">{u.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Initiative Detail Dialog --------------------------- */

function InitiativeDetailDialog({
  initiativeId, initiativesById, partnersById, partners, tasks, onClose, onOpenTask, onNewTask, onEdit,
}: {
  initiativeId: string | null;
  initiativesById: Record<string, Initiative>;
  partnersById: Record<string, Partner>;
  partners: Partner[];
  tasks: Task[];
  onClose: () => void;
  onOpenTask: (id: string) => void;
  onNewTask: (initId: string) => void;
  onEdit: (i: Initiative) => void;
}) {
  const initiative = initiativeId ? initiativesById[initiativeId] : null;
  const initTasks = initiative ? tasks.filter((t) => t.initiative_id === initiative.id) : [];

  return (
    <Dialog open={!!initiative} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {initiative && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge variant="outline" className={cn("border", CATEGORY_COLORS[initiative.category])}>
                  {CATEGORY_LABELS[initiative.category]}
                </Badge>
                {initiative.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-secondary">Estado</div>
                  <div>{STATUS_LABELS[initiative.status]}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary">Owner</div>
                  <div>{initiative.owner_partner_id ? partnersById[initiative.owner_partner_id]?.name || "—" : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary">Objetivo</div>
                  <div>{initiative.target_date || "—"}</div>
                </div>
              </div>
              {initiative.description && (
                <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-3">{initiative.description}</div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onEdit(initiative)}>Editar</Button>
                <Button size="sm" onClick={() => onNewTask(initiative.id)}>
                  <Plus className="h-4 w-4 mr-1" /> Añadir tarea
                </Button>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Tareas ({initTasks.length})</div>
                {initTasks.length === 0 ? (
                  <div className="text-xs text-secondary">Sin tareas.</div>
                ) : (
                  <div className="space-y-1">
                    {initTasks.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onOpenTask(t.id)}
                        className="w-full text-left border border-border rounded-md px-3 py-2 hover:bg-muted flex items-center justify-between gap-2"
                      >
                        <span className="text-sm">{t.title}</span>
                        <div className="flex items-center gap-2 text-xs text-secondary">
                          <Badge variant="secondary" className="text-[10px]">{TASK_STATUS_LABELS[t.status]}</Badge>
                          <span>{t.due_date || ""}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <UpdatesThread
                entityType="initiative"
                entityId={initiative.id}
                partners={partners}
                partnersById={partnersById}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- Task Detail Dialog --------------------------- */

function TaskDetailDialog({
  taskId, tasks, initiativesById, partnersById, partners, onClose, onEdit, onChanged,
}: {
  taskId: string | null;
  tasks: Task[];
  initiativesById: Record<string, Initiative>;
  partnersById: Record<string, Partner>;
  partners: Partner[];
  onClose: () => void;
  onEdit: (t: Task) => void;
  onChanged: () => void;
}) {
  const task = taskId ? tasks.find((t) => t.id === taskId) || null : null;
  const init = task?.initiative_id ? initiativesById[task.initiative_id] : null;

  const setStatus = async (status: TaskStatus) => {
    if (!task) return;
    const { error } = await sb.from("op_tasks").update({ status }).eq("id", task.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {init && (
                  <Badge variant="outline" className={cn("border", CATEGORY_COLORS[init.category])}>
                    {CATEGORY_LABELS[init.category]}
                  </Badge>
                )}
                {task.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-secondary">Estado</div>
                  <Select value={task.status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-secondary">Asignada a</div>
                  <div>{task.assigned_to ? partnersById[task.assigned_to]?.name || "—" : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary">Fecha límite</div>
                  <div>{task.due_date || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary">Prioridad</div>
                  <div>{PRIORITY_LABELS[task.priority]}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-secondary">Iniciativa</div>
                  <div>{init?.title || "—"}</div>
                </div>
              </div>
              {task.description && (
                <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-3">{task.description}</div>
              )}
              <div>
                <Button size="sm" variant="outline" onClick={() => onEdit(task)}>Editar tarea</Button>
              </div>
              <UpdatesThread
                entityType="task"
                entityId={task.id}
                partners={partners}
                partnersById={partnersById}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
