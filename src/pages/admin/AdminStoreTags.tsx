import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { slugify } from "@/lib/slugify";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

type StoreTag = { id: string; slug: string; name: string };

const AdminStoreTags = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<StoreTag> | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["admin-store-tags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StoreTag[];
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
    if (!name || !slug) return toast.error("Nombre y slug obligatorios");
    setSaving(true);
    const payload = { name, slug };
    const { error } = editing.id
      ? await (supabase as any).from("store_tags").update(payload).eq("id", editing.id)
      : await (supabase as any).from("store_tags").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Guardado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-store-tags"] });
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar tag?")) return;
    const { error } = await (supabase as any).from("store_tags").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-store-tags"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-medium tracking-tight">
            Super Store · Tags
          </h1>
          <p className="text-sm text-secondary mt-1">Tags independientes del Rental.</p>
        </div>
        <Button onClick={() => setEditing({ name: "", slug: "" })} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo tag
        </Button>
      </div>

      {isLoading ? (
        <p className="text-secondary">Cargando…</p>
      ) : (
        <div className="flex flex-wrap gap-2 p-6 rounded-xl bg-surface border border-border">
          {tags.length === 0 ? (
            <p className="text-secondary text-sm">Aún no hay tags.</p>
          ) : (
            tags.map((t) => (
              <Badge
                key={t.id}
                variant="secondary"
                className="bg-muted text-foreground font-normal gap-2 pr-1"
              >
                <button onClick={() => setEditing(t)} className="hover:underline">
                  {t.name}
                </button>
                <button
                  onClick={() => remove(t.id)}
                  className="opacity-50 hover:opacity-100 hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo tag" : "Editar tag"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
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

export default AdminStoreTags;
