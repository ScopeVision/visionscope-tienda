import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localized } from "@/i18n";
import { formatCurrency } from "@/lib/rental";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";
import { SmartImage } from "@/components/SmartImage";
import { ImageOff } from "lucide-react";

type Props = {
  product: any;
  view?: "grid" | "list";
};

export const ProductCard = ({ product, view = "grid" }: Props) => {
  const { i18n, t } = useTranslation();
  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];

  if (view === "list") {
    return (
      <Link
        to={`/product/${product.slug}`}
        className="group flex gap-5 p-4 rounded-sm bg-surface border border-border transition-smooth hover-glow"
      >
        <div className="relative shrink-0 w-32 h-32 rounded-sm overflow-hidden bg-muted">
          {img ? (
            <SmartImage src={img} alt={name} loading="lazy" className="opacity-90 group-hover:opacity-100 transition-opacity" />
          ) : (
            <div className="w-full h-full grid place-items-center text-secondary/40">
              <ImageOff className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.28em] text-secondary mb-1.5">{cat}</div>
          <h3 className="font-medium text-base uppercase tracking-[0.06em] text-accent group-hover:text-accent/90 transition-colors">{name}</h3>
          <p className="text-sm text-secondary mt-2 line-clamp-2 leading-relaxed">{desc}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-medium text-foreground">{formatCurrency(Number(product.price_day), i18n.language)}</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mt-0.5">{t("common.perDay")}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow"
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        {img ? (
          <SmartImage
            src={img}
            alt={name}
            loading="lazy"
            className="opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-secondary/40">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />
      </div>
      <div className="p-5">
        <div className="text-[10px] uppercase tracking-[0.28em] text-secondary mb-1.5">{cat}</div>
        <h3 className="font-medium text-base uppercase tracking-[0.06em] text-accent group-hover:text-accent/90 transition-colors">{name}</h3>
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-lg font-medium text-foreground">
                {formatCurrency(Number(product.price_day), i18n.language)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-secondary ml-1.5">{t("common.perDay")}</span>
            </div>
            {product.stock <= 0 && (
              <span className="text-[10px] uppercase tracking-[0.22em] text-destructive">{t("catalog.outOfStock")}</span>
            )}
          </div>
          <WeeklyDiscountBadge priceDay={Number(product.price_day)} variant="pill" />
        </div>
      </div>
    </Link>
  );
};
