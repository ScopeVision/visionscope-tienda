import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { slugify } from "@/lib/slugify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SiteImageUploader } from "@/components/admin/SiteImageUploader";

type Category = {
  id: string;
  slug: string;
  sort_order: number;
  name_es: string;
  name_ca?: string | null;
  name_en?: string | null;
  name_fr?: string | null;
  image_url?: string | null;
  link_url?: string | null;
};

const AdminCategories = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const open = creating || editing !== null;
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
    qc.invalidateQueries({ queryKey: ["admin-categories-filter"] });
    qc.invalidateQueries({ queryKey: ["form-categories"] });
    qc.invalidateQueries({ queryKey: ["rental-categories"] });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("categories").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.categoryDeleted"));
    refresh();
    setDeleting(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-display font-medium uppercase tracking-tight">
          {t("admin.categories")}
        </h1>
        <Button
          onClick={() => setCreating(true)}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.18em] text-xs"
        >
          <Plus className="h-4 w-4" /> {t("admin.newCategory")}
        </Button>
      </div>

      <div className="rounded-md bg-surface border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead className="w-20 text-right">{t("admin.order")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-secondary py-10">
                  —
                </TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-secondary">{c.slug}</TableCell>
                  <TableCell className="font-medium">
                    {localized(c, "name", i18n.language)}
                  </TableCell>
                  <TableCell className="text-right text-secondary">{c.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(c)}
                        aria-label={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleting(c)}
                        aria-label={t("common.delete")}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
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
        <CategoryDialog
          category={editing}
          existingSlugs={data.map((c) => c.slug)}
          nextSortOrder={data.length}
          onClose={close}
          onSaved={() => {
            refresh();
            close();
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteCategoryTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.deleteCategoryConfirm", {
                name: deleting ? localized(deleting, "name", i18n.language) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CategoryDialog = ({
  category,
  existingSlugs,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  category: Category | null;
  existingSlugs: string[];
  nextSortOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    slug: category?.slug ?? "",
    name_es: category?.name_es ?? "",
    name_ca: category?.name_ca ?? "",
    name_en: category?.name_en ?? "",
    name_fr: category?.name_fr ?? "",
    sort_order: category?.sort_order ?? nextSortOrder,
    image_url: category?.image_url ?? "",
    link_url: category?.link_url ?? "",
  });

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((s) => ({ ...s, [k]: v }));

  const onName = (v: string) => {
    set("name_es", v);
    if (!category && !form.slug) set("slug", slugify(v));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_es.trim() || !form.slug.trim()) {
      toast.error(t("admin.categoryRequired"));
      return;
    }
    if (!category && existingSlugs.includes(form.slug)) {
      toast.error(t("admin.categorySlugTaken"));
      return;
    }
    setSubmitting(true);
    const payload = {
      slug: form.slug,
      name_es: form.name_es,
      name_ca: form.name_ca || null,
      name_en: form.name_en || null,
      name_fr: form.name_fr || null,
      sort_order: Number(form.sort_order) || 0,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
    };
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.categorySaved"));
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">
            {category ? t("admin.editCategory") : t("admin.newCategory")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
              {t("common.name")} (ES) *
            </Label>
            <Input value={form.name_es} onChange={(e) => onName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["ca", "en", "fr"] as const).map((lang) => (
              <div key={lang}>
                <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
                  {lang.toUpperCase()}
                </Label>
                <Input
                  value={(form as any)[`name_${lang}`]}
                  onChange={(e) => set(`name_${lang}` as any, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
                Slug *
              </Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
                required
                pattern="[a-z0-9-]+"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">
                {t("admin.order")}
              </Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCategories;
