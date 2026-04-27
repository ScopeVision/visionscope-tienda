import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUploader } from "./ImageUploader";
import { slugify } from "@/lib/slugify";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { CATEGORY_FILTERS } from "@/lib/rentalFilters";

const optStr = z.string().trim().max(80).optional().or(z.literal("")).nullable();

const schema = z.object({
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  category_id: z.string().uuid().nullable().optional(),
  name_es: z.string().trim().min(1).max(200),
  name_ca: z.string().trim().max(200).optional().or(z.literal("")),
  name_en: z.string().trim().max(200).optional().or(z.literal("")),
  name_fr: z.string().trim().max(200).optional().or(z.literal("")),
  description_es: z.string().max(4000).optional().or(z.literal("")),
  description_ca: z.string().max(4000).optional().or(z.literal("")),
  description_en: z.string().max(4000).optional().or(z.literal("")),
  description_fr: z.string().max(4000).optional().or(z.literal("")),
  price_day: z.coerce.number().min(0),
  price_week: z.union([z.coerce.number().min(0), z.literal("").transform(() => null)]).nullable().optional(),
  deposit: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  published: z.boolean(),
  images: z.array(z.string().url()),
  tag_ids: z.array(z.string().uuid()),
  // structured fields
  brand: optStr,
  model: optStr,
  mount: optStr,
  sensor_type: optStr,
  lens_type: optStr,
  format: optStr,
  lighting_type: optStr,
  grip_type: optStr,
  accessory_type: optStr,
  kit_type: optStr,
});

export type ProductFormValues = z.infer<typeof schema>;

type Props = {
  product?: any | null; // existing product row (with product_tags) when editing
  onSaved: () => void;
  onCancel: () => void;
};

export const ProductForm = ({ product, onSaved, onCancel }: Props) => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [tempId] = useState(() => crypto.randomUUID());
  const [newTagInput, setNewTagInput] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["form-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["form-tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name_es");
      if (error) throw error;
      return data ?? [];
    },
  });

  const defaults: ProductFormValues = useMemo(
    () => ({
      slug: product?.slug ?? "",
      category_id: product?.category_id ?? null,
      name_es: product?.name_es ?? "",
      name_ca: product?.name_ca ?? "",
      name_en: product?.name_en ?? "",
      name_fr: product?.name_fr ?? "",
      description_es: product?.description_es ?? "",
      description_ca: product?.description_ca ?? "",
      description_en: product?.description_en ?? "",
      description_fr: product?.description_fr ?? "",
      price_day: product?.price_day ?? 0,
      price_week: product?.price_week ?? null,
      deposit: product?.deposit ?? 0,
      stock: product?.stock ?? 1,
      published: product?.published ?? true,
      images: product?.images ?? [],
      tag_ids: (product?.product_tags ?? []).map((pt: any) => pt.tag_id),
      brand: product?.brand ?? "",
      model: product?.model ?? "",
      mount: product?.mount ?? "",
      sensor_type: product?.sensor_type ?? "",
      lens_type: product?.lens_type ?? "",
      format: product?.format ?? "",
      lighting_type: product?.lighting_type ?? "",
      grip_type: product?.grip_type ?? "",
      accessory_type: product?.accessory_type ?? "",
      kit_type: product?.kit_type ?? "",
    }),
    [product]
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaults,
  });

  // Reset when product changes (e.g. switching from create to edit)
  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  // Auto-generate slug from name_es when creating (not editing)
  const nameEs = form.watch("name_es");
  useEffect(() => {
    if (!product && nameEs && !form.getValues("slug")) {
      form.setValue("slug", slugify(nameEs));
    }
  }, [nameEs, product, form]);

  const tagIds = form.watch("tag_ids");
  const images = form.watch("images");
  const selectedCategoryId = form.watch("category_id");
  const selectedCategorySlug = useMemo(
    () => categories.find((c: any) => c.id === selectedCategoryId)?.slug ?? "",
    [categories, selectedCategoryId]
  );
  const dynamicSpecs = CATEGORY_FILTERS[selectedCategorySlug] ?? [];

  const toggleTag = (id: string) => {
    const next = tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id];
    form.setValue("tag_ids", next, { shouldDirty: true });
  };

  const createTagOnTheFly = async () => {
    const name = newTagInput.trim();
    if (!name) return;
    const slug = slugify(name);
    const { data, error } = await supabase
      .from("tags")
      .insert({ slug, name_es: name })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["form-tags"] });
    qc.invalidateQueries({ queryKey: ["catalog-tags"] });
    form.setValue("tag_ids", [...tagIds, data.id], { shouldDirty: true });
    setNewTagInput("");
  };

  const onSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        slug: values.slug,
        category_id: values.category_id || null,
        name_es: values.name_es,
        name_ca: values.name_ca || null,
        name_en: values.name_en || null,
        name_fr: values.name_fr || null,
        description_es: values.description_es || null,
        description_ca: values.description_ca || null,
        description_en: values.description_en || null,
        description_fr: values.description_fr || null,
        price_day: Number(values.price_day),
        price_week: values.price_week == null || (values.price_week as any) === "" ? null : Number(values.price_week),
        deposit: Number(values.deposit),
        stock: Number(values.stock),
        published: values.published,
        images: values.images,
        brand: values.brand || null,
        model: values.model || null,
        mount: values.mount || null,
        sensor_type: values.sensor_type || null,
        lens_type: values.lens_type || null,
        format: values.format || null,
        lighting_type: values.lighting_type || null,
        grip_type: values.grip_type || null,
        accessory_type: values.accessory_type || null,
        kit_type: values.kit_type || null,
      };

      let productId: string;

      if (product?.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
        productId = product.id;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
      }

      // Sync tags: delete existing, insert new selection
      await supabase.from("product_tags").delete().eq("product_id", productId);
      if (values.tag_ids.length > 0) {
        const rows = values.tag_ids.map((tag_id) => ({ product_id: productId, tag_id }));
        const { error } = await supabase.from("product_tags").insert(rows);
        if (error) throw error;
      }

      toast.success(t("admin.products.toast.saved"));
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["rental-products"] });
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      qc.invalidateQueries({ queryKey: ["home-featured"] });
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? t("checkout.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
      <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-muted shrink-0">
          <TabsTrigger value="general">{t("admin.products.tabs.general")}</TabsTrigger>
          <TabsTrigger value="specs">{t("admin.products.tabs.specs")}</TabsTrigger>
          <TabsTrigger value="content">{t("admin.products.tabs.content")}</TabsTrigger>
          <TabsTrigger value="images">{t("admin.products.tabs.images")}</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto pr-1 mt-5 space-y-6">
          {/* GENERAL */}
          <TabsContent value="general" className="space-y-5 mt-0">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("admin.products.fields.slug") + " *"} error={form.formState.errors.slug?.message}>
                <Input {...form.register("slug")} placeholder="sony-fx6" />
              </Field>
              <Field label={t("admin.products.fields.category")}>
                <select
                  {...form.register("category_id")}
                  className="h-10 w-full px-3 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">—</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name_es}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label={t("admin.products.fields.priceDay") + " *"} error={form.formState.errors.price_day?.message}>
                <Input type="number" step="0.01" min="0" {...form.register("price_day")} />
              </Field>
              <Field label={t("admin.products.fields.priceWeek")}>
                <Input type="number" step="0.01" min="0" {...form.register("price_week" as any)} />
              </Field>
              <Field label={t("admin.products.fields.deposit") + " *"} error={form.formState.errors.deposit?.message}>
                <Input type="number" step="0.01" min="0" {...form.register("deposit")} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("admin.products.fields.stock") + " *"} error={form.formState.errors.stock?.message}>
                <Input type="number" step="1" min="0" {...form.register("stock")} />
              </Field>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-3 h-10 px-3 rounded-md border border-input bg-background w-full">
                  <Switch
                    checked={form.watch("published")}
                    onCheckedChange={(v) => form.setValue("published", v, { shouldDirty: true })}
                  />
                  <span className="text-sm">
                    {form.watch("published") ? t("admin.published") : t("admin.hidden")}
                  </span>
                </div>
              </div>
            </div>

            {/* Tags multi-select */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-secondary mb-2 block">
                {t("admin.products.fields.tags")}
              </Label>
              <div className="flex flex-wrap gap-2 p-3 rounded-md border border-input bg-background min-h-[60px]">
                {tags.length === 0 && (
                  <span className="text-xs text-secondary">{t("admin.products.noTags")}</span>
                )}
                {tags.map((tag: any) => {
                  const active = tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "text-xs px-3 py-1 rounded-full border transition-colors",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-secondary border-border hover:border-accent hover:text-foreground"
                      )}
                    >
                      {tag.name_es}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder={t("admin.products.newTagPlaceholder")}
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createTagOnTheFly();
                    }
                  }}
                  className="h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={createTagOnTheFly}
                  disabled={!newTagInput.trim()}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" /> {t("admin.newTag")}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* SPECS — structured fields based on category */}
          <TabsContent value="specs" className="space-y-5 mt-0">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("admin.products.fields.brand")}>
                <Input {...form.register("brand")} placeholder="Sony, ARRI…" />
              </Field>
              <Field label={t("admin.products.fields.model")}>
                <Input {...form.register("model")} placeholder="FX6, ALEXA Mini LF…" />
              </Field>
            </div>

            {!selectedCategorySlug ? (
              <p className="text-sm text-secondary border border-dashed border-border rounded-md p-4">
                {t("admin.products.specsHint")}
              </p>
            ) : dynamicSpecs.length === 0 ? (
              <p className="text-sm text-secondary border border-dashed border-border rounded-md p-4">
                {t("admin.products.specsNone")}
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {dynamicSpecs.map((spec) => (
                  <Field key={spec.key} label={t(spec.labelKey)}>
                    <select
                      {...form.register(spec.column as any)}
                      className="h-10 w-full px-3 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">—</option>
                      {spec.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.labelKey.includes(".") ? t(opt.labelKey) : opt.labelKey}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CONTENT */}
          <TabsContent value="content" className="space-y-6 mt-0">
            {(["es", "ca", "en", "fr"] as const).map((lang) => (
              <div key={lang} className="border border-border rounded-md p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-accent mb-3">
                  {lang.toUpperCase()}
                </div>
                <div className="space-y-3">
                  <Field
                    label={t("admin.products.fields.name") + (lang === "es" ? " *" : "")}
                    error={lang === "es" ? form.formState.errors.name_es?.message : undefined}
                  >
                    <Input {...form.register(`name_${lang}` as any)} />
                  </Field>
                  <Field label={t("admin.products.fields.description")}>
                    <Textarea rows={3} {...form.register(`description_${lang}` as any)} />
                  </Field>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* IMAGES */}
          <TabsContent value="images" className="mt-0">
            <ImageUploader
              ownerId={product?.id ?? tempId}
              value={images ?? []}
              onChange={(urls) => form.setValue("images", urls, { shouldDirty: true })}
            />
          </TabsContent>
        </div>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border shrink-0">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 uppercase tracking-[0.18em] text-xs"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
};

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-secondary mb-1.5 block">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);
