import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { localized } from "@/i18n";
import { formatCurrency } from "@/lib/rental";
import { ImageOff } from "lucide-react";

type Props = {
  product: any;
  view?: "grid" | "list";
};

const PLACEHOLDER_BG: Record<string, string> = {
  camaras: "from-stone-200 to-stone-300",
  opticas: "from-amber-100 to-stone-200",
  iluminacion: "from-orange-100 to-stone-200",
  sonido: "from-neutral-100 to-stone-200",
};

export const ProductCard = ({ product, view = "grid" }: Props) => {
  const { i18n, t } = useTranslation();
  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];
  const bgGradient = PLACEHOLDER_BG[product.category?.slug] ?? "from-stone-100 to-stone-200";

  if (view === "list") {
    return (
      <Link
        to={`/product/${product.slug}`}
        className="group flex gap-5 p-4 rounded-xl bg-surface border border-border transition-smooth hover:border-accent hover:shadow-card"
      >
        <div className={`relative shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gradient-to-br ${bgGradient}`}>
          {img ? (
            <img src={img} alt={name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-secondary/50">
              <ImageOff className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-accent mb-1">{cat}</div>
          <h3 className="font-medium text-lg group-hover:text-accent transition-colors">{name}</h3>
          <p className="text-sm text-secondary mt-1 line-clamp-2">{desc}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-medium">{formatCurrency(Number(product.price_day), i18n.language)}</div>
          <div className="text-xs text-secondary">{t("common.perDay")}</div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block rounded-xl bg-surface border border-border overflow-hidden transition-smooth hover:border-accent hover:shadow-card"
    >
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${bgGradient} overflow-hidden`}>
        {img ? (
          <img
            src={img}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-secondary/40">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="text-xs uppercase tracking-wider text-accent mb-1">{cat}</div>
        <h3 className="font-medium text-base group-hover:text-accent transition-colors">{name}</h3>
        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <span className="text-lg font-medium">
              {formatCurrency(Number(product.price_day), i18n.language)}
            </span>
            <span className="text-xs text-secondary ml-1">{t("common.perDay")}</span>
          </div>
          {product.stock <= 0 && (
            <span className="text-xs text-destructive">{t("catalog.outOfStock")}</span>
          )}
        </div>
      </div>
    </Link>
  );
};
