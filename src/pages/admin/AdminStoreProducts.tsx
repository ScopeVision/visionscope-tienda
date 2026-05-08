import { useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { slugify } from "@/lib/slugify";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImageOff } from "lucide-react";

type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const empty = (): Partial<StoreProduct> => ({
  name: "",
  slug: "",
  description: "",
  images: [],
  price: 0,
  published: true,
  sort_order: 0,
});

const AdminStoreProducts = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<StoreProduct> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-store-products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_products")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreProduct[];
    },
  });

  const isNew = editing && !editing.id;
  const tempId = useMemo(
    () => (editing?.id ?? `new-${Math.random().toString(36).slice(2, 10)}`),
    [editing?.id],
  );

  // Auto-fill slug from name when creating
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
      images: editing.images ?? [],
      price: Number(editing.price ?? 0),
      published: editing.published ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };

    const { error } = editing.id
      ? await (supabase as any).from("store_products").update(payload).eq("id", editing.id)
      : await (supabase as any).from("store_products").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing.id ? "Producto actualizado" : "Producto creado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-store-products"] });
    qc.invalidateQueries({ queryKey: ["store-products"] });
  };

  const remove = async () => {
    if (!deletingId) return;
    const { error } = await (supabase as any)
      .from("store_products")
      .delete()
      .eq("id", deletingId);
    if (error) return toast.error(error.message);
    toast.success("Producto eliminado");
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: ["admin-store-products"] });
    qc.invalidateQueries({ queryKey: ["store-products"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-medium tracking-tight">
            Super Store · Productos
          </h1>
          <p className="text-sm text-secondary mt-1">
            Catálogo independiente del Rental.
          </p>
        </div>
        <Button onClick={() => setEditing(empty())} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      {isLoading ? (
        <p className="text-secondary">Cargando…</p>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-secondary border border-dashed border-border rounded-md">
          Aún no hay productos en Super Store.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-md border border-border bg-surface overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-muted relative">
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-secondary/40">
                    <ImageOff className="h-8 w-8" />
                  </div>
                )}
                {!p.published && (
                  <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-background/80 text-secondary px-2 py-0.5 rounded-sm border border-border">
                    Borrador
                  </span>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-secondary mt-0.5">/{p.slug}</div>
                <div className="text-sm mt-2">{Number(p.price).toFixed(2)} €</div>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(p)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingId(p.id)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Nuevo producto" : "Editar producto"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nombre</Label>
                  <Input
                    value={editing.name ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={editing.slug ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, slug: slugify(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Descripción</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Precio (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing.price ?? 0}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        price: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Orden</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        sort_order: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label>Publicado</Label>
                    <div className="h-10 flex items-center">
                      <Switch
                        checked={editing.published ?? true}
                        onCheckedChange={(v) =>
                          setEditing({ ...editing, published: v })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Imágenes</Label>
                <ImageUploader
                  ownerId={tempId}
                  value={editing.images ?? []}
                  onChange={(urls) => setEditing({ ...editing, images: urls })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminStoreProducts;
