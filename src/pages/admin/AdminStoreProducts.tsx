import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { StoreVariantsManager, StoreVariant } from "@/components/admin/StoreVariantsManager";
import { slugify } from "@/lib/slugify";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ImageOff } from "lucide-react";

type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  short_description: string;
  images: string[];
  price: number;
  stock: number;
  sku: string | null;
  category_id: string | null;
  published: boolean;
  sort_order: number;
};

type StoreCategory = { id: string; name: string };
type StoreTag = { id: string; name: string };

const empty = (): Partial<StoreProduct> => ({
  name: "",
  slug: "",
  description: "",
  short_description: "",
  images: [],
  price: 0,
  stock: 0,
  sku: "",
  category_id: null,
  published: true,
  sort_order: 0,
});

const AdminStoreProducts = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<StoreProduct> | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [draftVariants, setDraftVariants] = useState<StoreVariant[]>([]);
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

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-store-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreCategory[];
    },
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["admin-store-tags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_tags")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreTag[];
    },
  });

  const isNew = editing && !editing.id;
  const tempId = useMemo(
    () => editing?.id ?? `new-${Math.random().toString(36).slice(2, 10)}`,
    [editing?.id],
  );

  useEffect(() => {
    if (editing && isNew && editing.name && !editing.slug) {
      setEditing({ ...editing, slug: slugify(editing.name) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.name]);

  // Load tags for the editing product
  useEffect(() => {
    if (!editing?.id) {
      setEditingTags([]);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("store_product_tags")
        .select("tag_id")
        .eq("product_id", editing.id);
      setEditingTags(((data ?? []) as { tag_id: string }[]).map((r) => r.tag_id));
    })();
  }, [editing?.id]);

  const toggleTag = (tagId: string) => {
    setEditingTags((curr) =>
      curr.includes(tagId) ? curr.filter((t) => t !== tagId) : [...curr, tagId],
    );
  };

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
      short_description: editing.short_description ?? "",
      images: editing.images ?? [],
      price: Number(editing.price ?? 0),
      stock: Number(editing.stock ?? 0),
      sku: editing.sku || null,
      category_id: editing.category_id || null,
      published: editing.published ?? true,
      sort_order: Number(editing.sort_order ?? 0),
    };

    let productId = editing.id;
    if (editing.id) {
      const { error } = await (supabase as any)
        .from("store_products")
        .update(payload)
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    } else {
      const { data, error } = await (supabase as any)
        .from("store_products")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      productId = data.id;
      // Insert buffered draft variants
      if (draftVariants.length > 0) {
        const rows = draftVariants.map((v) => ({
          product_id: productId,
          name: v.name.trim() || "Variante",
          description: v.description ?? "",
          sku: v.sku || null,
          price: Number(v.price ?? 0),
          stock: Number(v.stock ?? 0),
          sort_order: Number(v.sort_order ?? 0),
        }));
        await (supabase as any).from("store_variants").insert(rows);
      }
    }

    // Sync tags
    if (productId) {
      await (supabase as any).from("store_product_tags").delete().eq("product_id", productId);
      if (editingTags.length > 0) {
        await (supabase as any).from("store_product_tags").insert(
          editingTags.map((tag_id) => ({ product_id: productId, tag_id })),
        );
      }
    }

    setSaving(false);
    toast.success(editing.id ? "Producto actualizado" : "Producto creado");
    setEditing(null);
    setDraftVariants([]);
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

  const catName = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.name ?? "—" : "—";

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
        <Button
          onClick={() => {
            setDraftVariants([]);
            setEditing(empty());
          }}
          className="gap-2"
        >
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
                <div className="text-[11px] text-secondary mt-1">{catName(p.category_id)}</div>
                <div className="text-sm mt-2">{Number(p.price).toFixed(2)} €</div>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraftVariants([]);
                      setEditing(p);
                    }}
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

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setDraftVariants([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Nuevo producto" : "Editar producto"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-5">
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
                    onChange={(e) =>
                      setEditing({ ...editing, slug: slugify(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Categoría</Label>
                  <Select
                    value={editing.category_id ?? "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, category_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={editing.sku ?? ""}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Descripción corta</Label>
                <Input
                  value={editing.short_description ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, short_description: e.target.value })
                  }
                />
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label>Precio (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing.price ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, price: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={editing.stock ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, stock: Number(e.target.value) })
                    }
                  />
                </div>
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
                <div>
                  <Label>Publicado</Label>
                  <div className="h-10 flex items-center">
                    <Switch
                      checked={editing.published ?? true}
                      onCheckedChange={(v) => setEditing({ ...editing, published: v })}
                    />
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

              {allTags.length > 0 && (
                <div>
                  <Label className="mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((t) => {
                      const active = editingTags.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleTag(t.id)}
                          className="focus:outline-none"
                        >
                          <Badge
                            variant={active ? "default" : "secondary"}
                            className={
                              active
                                ? ""
                                : "bg-muted text-secondary font-normal hover:text-foreground"
                            }
                          >
                            {t.name}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <Label className="mb-2 block">Variantes</Label>
                <StoreVariantsManager
                  productId={editing.id}
                  draftVariants={draftVariants}
                  onDraftChange={setDraftVariants}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setDraftVariants([]);
              }}
            >
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
              Esta acción no se puede deshacer. Sus variantes también se eliminarán.
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
