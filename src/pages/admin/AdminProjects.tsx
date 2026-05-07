import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SiteImageUploader } from "@/components/admin/SiteImageUploader";
import { slugify } from "@/lib/slugify";

type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string;
  gallery: string[];
  category: string;
  client: string;
  year: number | null;
  link_url: string;
  sort_order: number;
  published: boolean;
};

const AdminProjects = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_items" as any).select("*").order("sort_order");
      if (error) throw error;
      return ((data ?? []) as unknown) as Project[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-projects"] });
    qc.invalidateQueries({ queryKey: ["public-projects"] });
  };

  const move = async (p: Project, dir: -1 | 1) => {
    const sorted = [...data].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === p.id);
    const target = sorted[idx + dir];
    if (!target) return;
    await supabase.from("project_items" as any).update({ sort_order: target.sort_order }).eq("id", p.id);
    await supabase.from("project_items" as any).update({ sort_order: p.sort_order }).eq("id", target.id);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar proyecto?")) return;
    const { error } = await supabase.from("project_items" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-medium uppercase tracking-tight">Proyectos</h1>
          <p className="text-sm text-secondary mt-1">Gestiona los proyectos visibles en la página /projects</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
          <Plus className="h-4 w-4" /> Nuevo proyecto
        </Button>
      </div>

      <div className="rounded-md bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Portada</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente / Año</TableHead>
              <TableHead className="w-24 text-center">Estado</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-secondary py-10">Sin proyectos.</TableCell></TableRow>
            ) : (
              data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.cover_image ? <img src={p.cover_image} alt="" className="w-16 h-10 object-cover rounded" /> : "—"}</TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-xs text-secondary">{[p.client, p.year].filter(Boolean).join(" · ")}</TableCell>
                  <TableCell className="text-center">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${p.published ? "bg-accent/15 text-accent" : "bg-muted text-secondary"}`}>
                      {p.published ? "Activo" : "Oculto"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => move(p, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => move(p, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <ProjectDialog
          project={editing}
          nextOrder={data.length}
          existingSlugs={data.map((p) => p.slug)}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { refresh(); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
};

const ProjectDialog = ({ project, nextOrder, existingSlugs, onClose, onSaved }: { project: Project | null; nextOrder: number; existingSlugs: string[]; onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState<Omit<Project, "id">>(project ?? {
    slug: "",
    title: "",
    description: "",
    cover_image: "",
    gallery: [],
    category: "",
    client: "",
    year: null,
    link_url: "",
    sort_order: nextOrder,
    published: true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onTitle = (v: string) => {
    set("title", v);
    if (!project && !form.slug) set("slug", slugify(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) return toast.error("Título y slug obligatorios");
    if (!project && existingSlugs.includes(form.slug)) return toast.error("Slug ya en uso");
    setSaving(true);
    const payload = {
      ...form,
      year: form.year ? Number(form.year) : null,
      sort_order: Number(form.sort_order) || 0,
    };
    const { error } = project
      ? await supabase.from("project_items" as any).update(payload).eq("id", project.id)
      : await supabase.from("project_items" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{project ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Título *</Label>
              <Input value={form.title} onChange={(e) => onTitle(e.target.value)} required />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Slug *</Label>
              <Input value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} required />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Descripción</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Categoría</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Cliente</Label>
              <Input value={form.client} onChange={(e) => set("client", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Año</Label>
              <Input type="number" value={form.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Enlace (interno o externo)</Label>
            <Input value={form.link_url} onChange={(e) => set("link_url", e.target.value)} placeholder="/projects/mi-proyecto o https://…  (vacío = página de detalle interna)" />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Imagen principal</Label>
            <SiteImageUploader
              folder="projects"
              value={form.cover_image}
              onChange={(url) => set("cover_image", url)}
              recommendation="Recomendado: 1600×1200 px (4:3) o 1600×1000 (16:10), máx 8 MB."
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Galería</Label>
            <div className="grid grid-cols-3 gap-3">
              {form.gallery.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set("gallery", form.gallery.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <SiteImageUploader
                folder="projects/gallery"
                value=""
                onChange={(url) => url && set("gallery", [...form.gallery, url])}
                recommendation="Añade imágenes una a una a la galería."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Orden</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
            </div>
            <label className="flex items-center gap-3">
              <Switch checked={form.published} onCheckedChange={(v) => set("published", v)} />
              <span className="text-sm">Visible</span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminProjects;
