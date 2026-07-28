import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { SiteImageUploader } from "@/components/admin/SiteImageUploader";

type Collection = {
  id: string;
  title_es: string;
  title_ca?: string | null;
  title_en?: string | null;
  title_fr?: string | null;
  subtitle_es?: string | null;
  image_url?: string | null;
  target_url?: string | null;
  sort_order: number;
  published: boolean;
};

const AdminCollections = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Collection | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["admin-collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_collections")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Collection[];
    },
  });

  const open = creating || editing !== null;
  const close = () => { setCreating(false); setEditing(null); };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-collections"] });
    qc.invalidateQueries({ queryKey: ["rental-collections-public"] });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("rental_collections").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Colección eliminada");
    refresh();
    setDeleting(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-display font-medium uppercase tracking-tight">Colecciones</h1>
        <Button onClick={() => setCreating(true)}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.18em] text-xs">
          <Plus className="h-4 w-4" /> Nueva colección
        </Button>
      </div>
      <p className="text-sm text-secondary mb-5">
        Las colecciones aparecen como tarjetas horizontales encima del catálogo en /rental cuando están publicadas.
      </p>

      <div className="rounded-md bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Imagen</TableHead>
              <TableHead>Título (ES)</TableHead>
              <TableHead className="w-20 text-right">Sort</TableHead>
              <TableHead className="w-24 text-center">Publicada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-secondary py-10">—</TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="w-12 h-10 rounded-sm bg-muted overflow-hidden grid place-items-center">
                      {c.image_url ? (
                        <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff className="h-4 w-4 text-secondary/40" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{c.title_es}</TableCell>
                  <TableCell className="text-right text-secondary">{c.sort_order}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={c.published}
                      onCheckedChange={async (val) => {
                        const { error } = await supabase.from("rental_collections").update({ published: val }).eq("id", c.id);
                        if (error) toast.error(error.message);
                        else refresh();
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(c)} aria-label="Eliminar"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {open && (
        <CollectionDialog
          collection={editing}
          nextSortOrder={data.length}
          onClose={close}
          onSaved={() => { refresh(); close(); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar colección?</AlertDialogTitle>
            <AlertDialogDescription>
              Eliminarás "{deleting?.title_es}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CollectionDialog = ({ collection, nextSortOrder, onClose, onSaved }: {
  collection: Collection | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title_es: collection?.title_es ?? "",
    title_ca: collection?.title_ca ?? "",
    title_en: collection?.title_en ?? "",
    title_fr: collection?.title_fr ?? "",
    subtitle_es: collection?.subtitle_es ?? "",
    image_url: collection?.image_url ?? "",
    target_url: collection?.target_url ?? "",
    sort_order: collection?.sort_order ?? nextSortOrder,
    published: collection?.published ?? false,
  });

  const set = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title_es.trim()) { toast.error("El título en español es obligatorio"); return; }
    setSubmitting(true);
    const payload = {
      title_es: form.title_es,
      title_ca: form.title_ca || null,
      title_en: form.title_en || null,
      title_fr: form.title_fr || null,
      subtitle_es: form.subtitle_es || null,
      image_url: form.image_url || null,
      target_url: form.target_url || null,
      sort_order: Number(form.sort_order) || 0,
      published: form.published,
    };
    const { error } = collection
      ? await supabase.from("rental_collections").update(payload).eq("id", collection.id)
      : await supabase.from("rental_collections").insert(payload);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Colección guardada");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">
            {collection ? "Editar colección" : "Nueva colección"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Título (ES) *</Label>
            <Input value={form.title_es} onChange={(e) => set("title_es", e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["ca", "en", "fr"] as const).map((lang) => (
              <div key={lang}>
                <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">{lang.toUpperCase()}</Label>
                <Input value={(form as any)[`title_${lang}`]} onChange={(e) => set(`title_${lang}` as any, e.target.value)} />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Subtítulo (ES)</Label>
            <Input value={form.subtitle_es} onChange={(e) => set("subtitle_es", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Imagen</Label>
            <SiteImageUploader
              folder="collections"
              value={form.image_url}
              onChange={(url) => set("image_url", url)}
              recommendation="Recomendado: 480×320 px (3:2), máx 4 MB."
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">URL destino</Label>
            <Input value={form.target_url} onChange={(e) => set("target_url", e.target.value)} placeholder="/rental?category=cameras" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs uppercase tracking-wider text-secondary">Publicada</Label>
              <div className="flex items-center h-10">
                <Switch checked={form.published} onCheckedChange={(val) => set("published", val)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCollections;
