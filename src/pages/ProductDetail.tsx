import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, ImageOff, Check, Sparkles } from "lucide-react";
import { SmartImage } from "@/components/SmartImage";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calcItemPrice, calcPricingTable, daysBetween, formatCurrency, MAX_AUTO_DAYS, type PricingModel } from "@/lib/rental";
import { useCart } from "@/contexts/CartContext";
import { useSiteContact } from "@/hooks/useSiteContact";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const cart = useCart();
  const { data: siteContact } = useSiteContact();
  const [start, setStart] = useState<Date | undefined>(
    cart.startDate ? new Date(cart.startDate) : undefined
  );
  const [end, setEnd] = useState<Date | undefined>(
    cart.endDate ? new Date(cart.endDate) : undefined
  );

  const [mode, setMode] = useState<"kit" | "individual">("kit");
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set());
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:categories(*), product_tags(tag:tags(*))")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const isKit = product && (product as any).kit_mode && (product as any).kit_mode !== "individual";

  // NEW: priced variants from product_variants table.
  const { data: pricedVariants = [] } = useQuery({
    queryKey: ["product-priced-variants", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product!.id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasPricedVariants = pricedVariants.length > 0;

  useEffect(() => {
    if (hasPricedVariants && (!activeVariantId || !pricedVariants.find((v: any) => v.id === activeVariantId))) {
      setActiveVariantId(pricedVariants[0].id);
    }
  }, [hasPricedVariants, pricedVariants, activeVariantId]);

  const activePricedVariant = useMemo(
    () => pricedVariants.find((v: any) => v.id === activeVariantId) ?? null,
    [pricedVariants, activeVariantId]
  );

  // Effective pricing — variant overrides product when present.
  const effectivePriceDay = activePricedVariant
    ? Number(activePricedVariant.price_day)
    : Number(product?.price_day ?? 0);
  const effectivePriceWeek = activePricedVariant
    ? activePricedVariant.price_week != null
      ? Number(activePricedVariant.price_week)
      : null
    : product?.price_week
      ? Number(product.price_week)
      : null;
  const effectiveDeposit = activePricedVariant
    ? Number(activePricedVariant.deposit)
    : Number(product?.deposit ?? 0);

  // Includes for the active priced variant
  const { data: variantIncludes = [] } = useQuery({
    queryKey: ["variant-includes-public", activeVariantId],
    enabled: !!activeVariantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_components")
        .select("*, child:products!product_components_child_product_id_fkey(id, slug, name_es, name_ca, name_en, name_fr, images, price_day, price_week, deposit, stock)")
        .eq("variant_id", activeVariantId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: components = [] } = useQuery({
    queryKey: ["product-components", product?.id],
    enabled: !!product?.id && !!isKit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_components")
        .select("*, child:products!product_components_child_product_id_fkey(id, slug, name_es, name_ca, name_en, name_fr, images, price_day, price_week, deposit, stock)")
        .eq("parent_product_id", product!.id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Detect legacy variants (camera_kit) — group components by variant_name.
  const variantNames = useMemo(() => {
    const set = new Set<string>();
    components.forEach((c: any) => {
      if (c.variant_name) set.add(c.variant_name);
    });
    return Array.from(set);
  }, [components]);

  const hasVariants = variantNames.length > 0;

  useEffect(() => {
    if (hasVariants && !activeVariant) setActiveVariant(variantNames[0]);
  }, [hasVariants, activeVariant, variantNames]);

  // Reset selection when variant changes.
  useEffect(() => {
    setSelectedComponents(new Set());
  }, [activeVariant]);

  // Components shown for the currently active legacy variant (or all if no variants).
  const visibleComponents = useMemo(() => {
    if (!hasVariants) return components;
    return components.filter((c: any) => c.variant_name === activeVariant);
  }, [components, hasVariants, activeVariant]);

  // Availability check per date range — fetches available_stock for visible items.
  const availabilityKey = visibleComponents.map((c: any) => c.child_product_id).join(",");
  const { data: availability = {} } = useQuery({
    queryKey: ["availability", availabilityKey, start?.toISOString(), end?.toISOString(), product?.id],
    enabled: !!start && !!end && (visibleComponents.length > 0 || (!!product && !isKit)),
    queryFn: async () => {
      const ids: string[] = isKit
        ? visibleComponents.map((c: any) => c.child_product_id)
        : product
          ? [product.id]
          : [];
      const result: Record<string, number> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { data, error } = await supabase.rpc("available_stock", {
            _product_id: id,
            _start: start!.toISOString().slice(0, 10),
            _end: end!.toISOString().slice(0, 10),
          });
          if (!error) result[id] = (data as number) ?? 0;
        })
      );
      return result;
    },
  });

  const days = useMemo(() => (start && end ? daysBetween(start, end) : 1), [start, end]);

  const productModel = ((product as any)?.pricing_model ?? "premium") as PricingModel;
  const productMultipliers = (product as any)?.pricing_multipliers ?? null;

  const kitCalc = useMemo(() => {
    if (!product) return { subtotal: 0, weeklyApplied: false, contactRequired: false, avgPerDay: 0 };
    return calcItemPrice({
      priceDay: effectivePriceDay,
      priceWeek: effectivePriceWeek,
      days,
      quantity: 1,
      model: productModel,
      customMultipliers: productMultipliers,
    });
  }, [product, days, effectivePriceDay, effectivePriceWeek, productModel, productMultipliers]);

  const individualCalc = useMemo(() => {
    let total = 0;
    let any = false;
    let contact = false;
    let avgSum = 0;
    let count = 0;
    visibleComponents.forEach((c: any) => {
      if (!selectedComponents.has(c.child_product_id)) return;
      const priceDay = c.price_day_override ?? Number(c.child?.price_day ?? 0);
      const childModel = (c.child?.pricing_model ?? "premium") as PricingModel;
      const childMults = c.child?.pricing_multipliers ?? null;
      const r = calcItemPrice({
        priceDay,
        priceWeek: c.child?.price_week ? Number(c.child.price_week) : null,
        days,
        quantity: c.quantity ?? 1,
        model: childModel,
        customMultipliers: childMults,
      });
      total += r.subtotal;
      any = any || r.weeklyApplied;
      contact = contact || r.contactRequired;
      avgSum += r.avgPerDay;
      count += 1;
    });
    return {
      subtotal: total,
      weeklyApplied: any,
      contactRequired: contact,
      avgPerDay: count > 0 ? avgSum / count : 0,
    };
  }, [visibleComponents, selectedComponents, days]);

  const pricingTable = useMemo(() => calcPricingTable({
    priceDay: effectivePriceDay,
    priceWeek: effectivePriceWeek,
    model: productModel,
    customMultipliers: productMultipliers,
  }), [effectivePriceDay, effectivePriceWeek, productModel, productMultipliers]);

  const allSelected =
    visibleComponents.length > 0 &&
    visibleComponents.every((c: any) => selectedComponents.has(c.child_product_id));
  const showCostHint =
    mode === "individual" && allSelected && individualCalc.subtotal > kitCalc.subtotal;

  const toggleComponent = (id: string, available: boolean) => {
    if (!available) return;
    setSelectedComponents((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="container-page py-20 text-secondary">{t("common.loading")}</div>;
  }
  if (!product) {
    return (
      <div className="container-page py-20">
        <p className="text-secondary">404</p>
        <Link to="/rental" className="text-accent hover:underline">
          {t("product.back")}
        </Link>
      </div>
    );
  }

  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const images: string[] = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const img: string | undefined = images[0];

  const handleAdd = () => {
    if (start && end) {
      cart.setDates(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    }
    if (isKit && mode === "individual") {
      const picked = visibleComponents.filter((c: any) =>
        selectedComponents.has(c.child_product_id)
      );
      if (picked.length === 0) {
        toast.error(t("product.kit.selectAtLeastOne"));
        return;
      }
      picked.forEach((c: any) => {
        const child = c.child;
        if (!child) return;
        const priceDay = c.price_day_override ?? Number(child.price_day ?? 0);
        cart.add({
          productId: child.id,
          slug: child.slug,
          name: localized(child, "name", i18n.language),
          image: child.images?.[0],
          priceDay,
          priceWeek: child.price_week ? Number(child.price_week) : null,
          deposit: Number(child.deposit ?? 0),
          quantity: c.quantity ?? 1,
          pricingModel: (child.pricing_model ?? "premium") as PricingModel,
          customMultipliers: child.pricing_multipliers ?? null,
        });
      });
      toast.success(t("product.added"));
      return;
    }

    // Full kit OR individual product
    if (isKit) {
      // Expand active variant components into the cart for shared inventory
      const variantSuffix = hasVariants && activeVariant ? ` · ${activeVariant}` : "";
      visibleComponents.forEach((c: any) => {
        const child = c.child;
        if (!child) return;
        const priceDay = c.price_day_override ?? Number(child.price_day ?? 0);
        cart.add({
          productId: child.id,
          slug: child.slug,
          name: `${localized(child, "name", i18n.language)} · ${name}${variantSuffix}`,
          image: child.images?.[0],
          priceDay,
          priceWeek: child.price_week ? Number(child.price_week) : null,
          deposit: Number(child.deposit ?? 0),
          quantity: c.quantity ?? 1,
          pricingModel: (child.pricing_model ?? "premium") as PricingModel,
          customMultipliers: child.pricing_multipliers ?? null,
        });
      });
      toast.success(t("product.added"));
      return;
    }

    cart.add({
      productId: product.id,
      slug: product.slug,
      name: activePricedVariant ? `${name} · ${activePricedVariant.name}` : name,
      image: img,
      priceDay: effectivePriceDay,
      priceWeek: effectivePriceWeek,
      deposit: effectiveDeposit,
      quantity: 1,
      pricingModel: productModel,
      customMultipliers: productMultipliers,
    });
    toast.success(t("product.added"));
  };

  const currentCalc = mode === "individual" ? individualCalc : kitCalc;
  const canAdd =
    mode === "individual"
      ? selectedComponents.size > 0
      : isKit
        ? visibleComponents.length > 0
        : product.stock > 0;

  const canonicalUrl = `https://thevisionscope.lovable.app/rental/${product.slug}`;
  const metaDesc = (desc ? desc.replace(/\s+/g, " ").trim().slice(0, 155) : `${name} en alquiler en VisionScope — rental house de cine profesional.`);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: metaDesc,
    image: images,
    sku: product.id,
    category: cat || undefined,
    brand: { "@type": "Brand", name: "VisionScope" },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: effectivePriceDay,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonicalUrl,
    },
  };

  return (
    <article className="container-page py-10">
      <Helmet>
        <title>{`${name} — VisionScope Rental`}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={`${name} — VisionScope Rental`} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={canonicalUrl} />
        {img && <meta property="og:image" content={img} />}
        <script type="application/ld+json">{JSON.stringify(productJsonLd)}</script>
      </Helmet>
      <Link
        to="/rental"
        className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> {t("product.back")}
      </Link>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="aspect-square rounded-sm bg-surface border border-border overflow-hidden">
            {images.length > 0 ? (
              <SmartImage
                src={images[Math.min(activeImageIdx, images.length - 1)]}
                alt={name}
                priority
                className="transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-secondary/30">
                <ImageOff className="h-16 w-16" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((url, idx) => (
                <button
                  key={url + idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={cn(
                    "aspect-square rounded-sm overflow-hidden border bg-muted transition-all",
                    idx === activeImageIdx
                      ? "border-accent ring-1 ring-accent/40"
                      : "border-border opacity-70 hover:opacity-100 hover:border-accent/40"
                  )}
                  aria-label={`${name} - ${idx + 1}`}
                >
                  <SmartImage src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>


        <div>
          {cat && (
            <div className="text-[10px] uppercase tracking-[0.28em] text-accent mb-3">{cat}</div>
          )}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-medium tracking-tight uppercase leading-[1.05]">
            {name}
          </h1>
          {desc && (
            <p className="mt-5 text-secondary leading-relaxed whitespace-pre-line max-w-prose">{desc}</p>
          )}

          {product.product_tags?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {product.product_tags.map((pt: any) => (
                <Badge
                  key={pt.tag.id}
                  variant="secondary"
                  className="bg-muted text-foreground font-normal text-[10px] uppercase tracking-[0.18em] px-2.5 py-1"
                >
                  {localized(pt.tag, "name", i18n.language)}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-8 p-6 rounded-sm bg-surface border border-border">

            {/* Priced variants selector (Basic Kit / Pro Kit ...) */}
            {hasPricedVariants && (
              <div className="mb-5">
                <div className="text-xs uppercase tracking-wider text-secondary mb-2">
                  {t("product.kit.chooseVariant")}
                </div>
                <div
                  className="grid gap-2 p-1 bg-muted rounded-md"
                  style={{ gridTemplateColumns: `repeat(${pricedVariants.length}, minmax(0,1fr))` }}
                >
                  {pricedVariants.map((v: any) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActiveVariantId(v.id)}
                      className={cn(
                        "py-2 px-3 rounded-md text-xs uppercase tracking-wider transition-colors",
                        activeVariantId === v.id
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-secondary hover:text-foreground"
                      )}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy variant selector (camera kits via product_components.variant_name) */}
            {!hasPricedVariants && hasVariants && (
              <div className="mb-5">
                <div className="text-xs uppercase tracking-wider text-secondary mb-2">
                  {t("product.kit.chooseVariant")}
                </div>
                <div
                  className="grid gap-2 p-1 bg-muted rounded-md"
                  style={{ gridTemplateColumns: `repeat(${variantNames.length}, minmax(0,1fr))` }}
                >
                  {variantNames.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setActiveVariant(v)}
                      className={cn(
                        "py-2 px-3 rounded-md text-xs uppercase tracking-wider transition-colors",
                        activeVariant === v
                          ? "bg-accent text-accent-foreground shadow-sm"
                          : "text-secondary hover:text-foreground"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode selector for kits (legacy path) */}
            {!hasPricedVariants && isKit && visibleComponents.length > 0 && (
              <div className="mb-5">
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-md">
                  <button
                    type="button"
                    onClick={() => setMode("kit")}
                    className={cn(
                      "py-2 px-3 rounded-md text-xs uppercase tracking-wider transition-colors",
                      mode === "kit"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-secondary hover:text-foreground"
                    )}
                  >
                    {t("product.kit.fullKit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("individual")}
                    className={cn(
                      "py-2 px-3 rounded-md text-xs uppercase tracking-wider transition-colors",
                      mode === "individual"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-secondary hover:text-foreground"
                    )}
                  >
                    {t("product.kit.individualSelection")}
                  </button>
                </div>
              </div>
            )}

            {/* Pricing block — variant-driven when present */}
            {(mode === "kit" || hasPricedVariants) && (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-medium">
                      {formatCurrency(effectivePriceDay, i18n.language)}
                    </span>
                    <span className="text-sm text-secondary ml-1">{t("common.perDay")}</span>
                  </div>
                  {effectivePriceWeek && (
                    <div className="text-right">
                      <div className="text-sm text-secondary">{t("common.perWeek")}</div>
                      <div className="font-medium">
                        {formatCurrency(effectivePriceWeek, i18n.language)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 rounded-md border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-muted text-[10px] uppercase tracking-[0.18em] text-secondary flex items-center justify-between">
                    <span>Pricing</span>
                    <span className="text-accent">{productModel}</span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {pricingTable.map((row) => (
                        <tr key={row.day} className={cn("border-t border-border", row.isWeek && "bg-accent-soft/40")}>
                          <td className="px-3 py-1.5 text-secondary">{row.day} {t(row.day === 1 ? "common.day" : "common.days")}</td>
                          <td className="px-3 py-1.5 text-right text-secondary">×{row.multiplier.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(row.price, i18n.language)}</td>
                          <td className="px-3 py-1.5 text-right text-accent">{row.savings > 0 ? `−${Math.round(row.savingsPct*100)}%` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Includes list for the active priced variant */}
            {hasPricedVariants && variantIncludes.length > 0 && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-wider text-secondary mb-2">
                  {t("product.kit.includes")}
                </div>
                <ul className="space-y-1.5">
                  {variantIncludes.map((c: any) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="truncate">
                        {c.child ? localized(c.child, "name", i18n.language) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Individual components list */}
            {mode === "individual" && (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-secondary mb-2">
                  {t("product.kit.pickItems")}
                </div>
                {visibleComponents.map((c: any) => {
                  const child = c.child;
                  if (!child) return null;
                  const priceDay = c.price_day_override ?? Number(child.price_day ?? 0);
                  const dateAware = start && end;
                  const stockForRange = dateAware
                    ? (availability[c.child_product_id] ?? child.stock ?? 0)
                    : (child.stock ?? 0);
                  const available = stockForRange > 0;
                  const checked = selectedComponents.has(c.child_product_id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleComponent(c.child_product_id, available)}
                      disabled={!available}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors",
                        checked
                          ? "border-accent bg-accent-soft"
                          : "border-border bg-background hover:border-accent/60",
                        !available && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded border flex items-center justify-center shrink-0",
                          checked ? "bg-accent border-accent" : "border-border"
                        )}
                      >
                        {checked && <Check className="h-3 w-3 text-accent-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {localized(child, "name", i18n.language)}
                        </div>
                        {!available && (
                          <div className="text-[10px] text-destructive uppercase tracking-wider">
                            {t("catalog.outOfStock")}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-medium shrink-0">
                        {formatCurrency(priceDay, i18n.language)}
                        <span className="text-xs text-secondary ml-1">{t("common.perDay")}</span>
                      </div>
                    </button>
                  );
                })}

                {showCostHint && (
                  <div className="mt-3 p-3 rounded-md border border-accent bg-accent-soft flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <div className="font-medium">{t("product.kit.costHintTitle")}</div>
                      <div className="text-secondary mt-0.5">
                        {t("product.kit.costHintBody", {
                          diff: formatCurrency(
                            individualCalc.subtotal - kitCalc.subtotal,
                            i18n.language
                          ),
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isKit && (
              <>
                <div className="mt-4 text-sm text-secondary flex items-center justify-between">
                  <span>{t("product.deposit")}</span>
                  <span className="text-foreground font-medium">
                    {formatCurrency(effectiveDeposit, i18n.language)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-secondary flex items-center justify-between">
                  <span>{t("product.stock")}</span>
                  <span className="text-foreground">{product.stock}</span>
                </div>
              </>
            )}

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-secondary mb-3">
                {t("product.selectDates")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePopover label={t("common.from")} date={start} onChange={setStart} />
                <DatePopover label={t("common.to")} date={end} onChange={setEnd} fromDate={start} />
              </div>
            </div>

            {start && end && currentCalc.contactRequired && (
              <div className="mt-5 p-4 rounded-lg border border-accent bg-accent-soft">
                <p className="text-sm font-medium">
                  For rentals of 8 days or more, please contact us.
                </p>
                {siteContact?.whatsapp_url && (
                  <a
                    href={siteContact.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center justify-center w-full h-10 rounded-md bg-[#25D366] text-white font-medium hover:bg-[#1ebe5d] transition-colors"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            )}

            {start && end && !currentCalc.contactRequired && currentCalc.subtotal > 0 && (
              <div className="mt-5 p-4 rounded-lg bg-accent-soft">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">
                    {days} {days === 1 ? t("common.day") : t("common.days")}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(currentCalc.subtotal, i18n.language)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-secondary">
                  <span>Avg / day</span>
                  <span>{formatCurrency(currentCalc.avgPerDay, i18n.language)}</span>
                </div>
                <p className="mt-2 text-xs text-secondary">{t("product.depositInfo")}</p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full mt-6 bg-foreground text-background hover:bg-foreground/90"
              onClick={handleAdd}
              disabled={!canAdd || (!!start && !!end && currentCalc.contactRequired)}
            >
              {!canAdd && !isKit
                ? t("catalog.outOfStock")
                : mode === "individual"
                  ? t("product.kit.addSelection")
                  : t("product.addToCart")}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};

const DatePopover = ({
  label,
  date,
  onChange,
  fromDate,
}: {
  label: string;
  date?: Date;
  onChange: (d: Date | undefined) => void;
  fromDate?: Date;
}) => (
  <div>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-11",
            !date && "text-secondary"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PP") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          disabled={(d) =>
            d < new Date(new Date().setHours(0, 0, 0, 0)) || (fromDate ? d < fromDate : false)
          }
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  </div>
);

export default ProductDetail;
