import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SiteImageUploader } from "@/components/admin/SiteImageUploader";

type Slide = {
  id: string;
  image_url: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
  sort_order: number;
  published: boolean;
};

const empty = (sort: number): Omit<Slide, "id"> => ({
  image_url: "",
  title: "",
  subtitle: "",
  cta_label: "",
  cta_url: "",
  sort_order: sort,
  published: true,
});

const AdminHero = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Slide | null>(null);
  const [creating, setCreating] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["admin-hero-slides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hero_slides" as any).select("*").order("sort_order");
      if (error) throw error;
      return ((data ?? []) as unknown) as Slide[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-hero-slides"] });
    qc.invalidateQueries({ queryKey: ["hero-slides"] });
  };

  const move = async (slide: Slide, dir: -1 | 1) => {
    const sorted = [...data].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.id === slide.id);
    const target = sorted[idx + dir];
    if (!target) return;
    await supabase.from("hero_slides" as any).update({ sort_order: target.sort_order }).eq("id", slide.id);
    await supabase.from("hero_slides" as any).update({ sort_order: slide.sort_order }).eq("id", target.id);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar slide?")) return;
    const { error } = await supabase.from("hero_slides" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-medium uppercase tracking-tight">Hero (Inicio)</h1>
          <p className="text-sm text-secondary mt-1">Slides del banner principal de la home</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
          <Plus className="h-4 w-4" /> Nuevo slide
        </Button>
      </div>

      <div className="rounded-md bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Imagen</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>CTA</TableHead>
              <TableHead className="w-24 text-center">Estado</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-secondary py-10">Sin slides — añade el primero.</TableCell>
              </TableRow>
            ) : (
              data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {s.image_url ? <img src={s.image_url} alt="" className="w-16 h-10 object-cover rounded" /> : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{s.title || "—"}</TableCell>
                  <TableCell className="text-xs text-secondary">{s.cta_label}{s.cta_url && ` → ${s.cta_url}`}</TableCell>
                  <TableCell className="text-center">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${s.published ? "bg-accent/15 text-accent" : "bg-muted text-secondary"}`}>
                      {s.published ? "Activo" : "Oculto"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => move(s, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => move(s, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <SlideDialog
          slide={editing}
          nextOrder={data.length}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { refresh(); setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
};

const SlideDialog = ({ slide, nextOrder, onClose, onSaved }: { slide: Slide | null; nextOrder: number; onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState(slide ?? { id: "", ...empty(nextOrder) });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image_url) { toast.error("Sube una imagen"); return; }
    setSaving(true);
    const payload = {
      image_url: form.image_url,
      title: form.title,
      subtitle: form.subtitle,
      cta_label: form.cta_label,
      cta_url: form.cta_url,
      sort_order: Number(form.sort_order) || 0,
      published: form.published,
    };
    const { error } = slide
      ? await supabase.from("hero_slides" as any).update(payload).eq("id", slide.id)
      : await supabase.from("hero_slides" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slide ? "Editar slide" : "Nuevo slide"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Imagen</Label>
            <SiteImageUploader
              folder="hero"
              value={form.image_url}
              onChange={(url) => set("image_url", url)}
              recommendation="Recomendado: 2400×1350 px (16:9), formato horizontal cinemático, máx 8 MB."
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Título</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Capture Stories." />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Texto / Subtítulo</Label>
            <Textarea rows={3} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Texto del botón</Label>
              <Input value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} placeholder="Ver catálogo" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Enlace del botón</Label>
              <Input value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} placeholder="/rental o https://…" />
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

export default AdminHero;
