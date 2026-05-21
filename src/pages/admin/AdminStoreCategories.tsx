import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SiteImageUploader } from "@/components/admin/SiteImageUploader";
import { slugify } from "@/lib/slugify";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";

type StoreCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  sort_order: number;
  published: boolean;
  created_at: string;
};

const empty = (): Partial<StoreCategory> => ({
  name: "",
  slug: "",
  description: "",
  image_url: "",
  sort_order: 0,
  published: true,
});

const AdminStoreCategories = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<StoreCategory> | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["admin-store-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreCategory[];
    },
  });

  const isNew = editing && !editing.id;

  useEffect(() => {
    if (editing && isNew && editing.name && !editing.slug) {
      setEditing({ ...editing, slug: slugify(editing.name) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.name]);

  const save = async () => {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    const slug = ((editing.slug ?? "") || slugify(name)).trim();
    if (!name) return toast.error("El nombre es obligatorio");
    if (!slug) return toast.error("El slug es obligatorio");

    setSaving(true);
    const payload = {
      name,
      slug,
      description: editing.description ?? "",
      image_url: editing.image_url ?? "",
      sort_order: Number(editing.sort_order ?? 0),
      published: editing.published ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("store_categories").update(payload).eq("id", editing.id)
      : await (supabase as any).from("store_categories").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Categoría actualizada" : "Categoría creada");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-store-categories"] });
    qc.invalidateQueries({ queryKey: ["store-categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar categoría?")) return;
    const { error } = await (supabase as any).from("store_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    qc.invalidateQueries({ queryKey: ["admin-store-categories"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-medium tracking-tight">
            Super Store · Categorías
          </h1>
          <p className="text-sm text-secondary mt-1">
            Categorías independientes del Rental.
          </p>
        </div>
        <Button onClick={() => setEditing(empty())} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      {isLoading ? (
        <p className="text-secondary">Cargando…</p>
      ) : cats.length === 0 ? (
        <div className="text-center py-20 text-secondary border border-dashed border-border rounded-md">
          Aún no hay categorías.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map((c) => (
            <div
              key={c.id}
              className="rounded-md border border-border bg-surface overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/9] bg-muted relative">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-secondary/40">
                    <FolderTree className="h-8 w-8" />
                  </div>
                )}
                {!c.published && (
                  <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-background/80 text-secondary px-2 py-0.5 rounded-sm border border-border">
                    Oculta
                  </span>
                )}
              </div>
              <div className="p-4 flex-1">
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-secondary mt-0.5">/{c.slug}</div>
                {c.description && (
                  <p className="text-xs text-secondary mt-2 line-clamp-2">{c.description}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(c.id)}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nueva categoría" : "Editar categoría"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug ?? ""}
                    onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea
                  rows={3}
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Imagen</Label>
                <SiteImageUploader
                  folder="store-categories"
                  value={editing.image_url ?? ""}
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <Label>Publicada</Label>
                    <div className="h-10 flex items-center">
                      <Switch
                        checked={editing.published ?? true}
                        onCheckedChange={(v) => setEditing({ ...editing, published: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStoreCategories;
