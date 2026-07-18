import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localized } from "@/i18n";
import { formatCurrency } from "@/lib/rental";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";
import { SmartImage } from "@/components/SmartImage";
import { ArrowUpRight, ImageOff } from "lucide-react";

type Props = {
  product: any;
  view?: "grid" | "list";
  basePath?: string;
};

const ProductCardComponent = ({ product, view = "grid", basePath = "/product" }: Props) => {
  const { i18n, t } = useTranslation();
  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];
  const outOfStock = product.stock <= 0;

  if (view === "list") {
    return (
      <Link
        to={`/product/${product.slug}`}
        className="group flex gap-5 p-4 rounded-sm bg-surface border border-border hover:border-accent/40 transition-smooth"
      >
        <div className="relative shrink-0 w-32 h-32 rounded-sm overflow-hidden bg-muted">
          {img ? (
            <SmartImage
              src={img}
              alt={name}
              loading="lazy"
              className="opacity-90 group-hover:opacity-100 transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-secondary/40">
              <ImageOff className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {cat && (
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary mb-1.5">{cat}</div>
          )}
          <h3 className="font-medium text-base uppercase tracking-[0.06em] text-foreground group-hover:text-accent transition-colors">
            {name}
          </h3>
          <p className="text-sm text-secondary mt-2 line-clamp-2 leading-relaxed">{desc}</p>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end justify-between">
          <div>
            <div className="text-lg font-medium text-foreground tabular-nums">
              {formatCurrency(Number(product.price_day), i18n.language)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mt-0.5">
              {t("common.perDay")}
            </div>
          </div>
          <WeeklyDiscountBadge priceDay={Number(product.price_day)} variant="pill" />
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block bg-surface border border-border hover:border-accent/40 overflow-hidden transition-all duration-300 rounded-sm"
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted overflow-hidden">
        {img ? (
          <SmartImage
            src={img}
            alt={name}
            loading="lazy"
            className="opacity-95 transition-all duration-700 group-hover:opacity-100 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-secondary/40">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        {/* Subtle cinematic vignette */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent opacity-70 group-hover:opacity-40 transition-opacity duration-500" />

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[10px] uppercase tracking-[0.22em] bg-background/85 backdrop-blur-sm text-destructive px-2.5 py-1 rounded-sm border border-destructive/30">
              {t("catalog.outOfStock")}
            </span>
          </div>
        )}

        {/* Hover arrow */}
        <div className="absolute top-3 right-3 z-10 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
          <div className="grid place-items-center w-9 h-9 rounded-full bg-accent text-accent-foreground shadow-lg">
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>

        {/* Category eyebrow pinned bottom-left */}
        {cat && (
          <div className="absolute bottom-3 left-4 z-10">
            <span className="text-[10px] uppercase tracking-[0.28em] text-accent/90 font-medium">
              {cat}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5">
        <h3 className="font-medium text-[15px] md:text-base uppercase tracking-[0.06em] text-foreground group-hover:text-accent transition-colors leading-snug line-clamp-2 min-h-[2.6em]">
          {name}
        </h3>

        <div className="mt-4 pt-4 border-t border-border/70 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-medium text-foreground tabular-nums">
                {formatCurrency(Number(product.price_day), i18n.language)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-secondary">
                / {t("common.perDay")}
              </span>
            </div>
            <div className="mt-1.5">
              <WeeklyDiscountBadge priceDay={Number(product.price_day)} variant="pill" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export const ProductCard = memo(ProductCardComponent, (a, b) => {
  return a.view === b.view && a.product?.id === b.product?.id && a.product?.updated_at === b.product?.updated_at;
});
