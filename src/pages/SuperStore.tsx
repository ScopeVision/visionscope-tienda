import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Package, ShoppingBag, ArrowRight } from "lucide-react";

type StoreItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  comingSoon?: boolean;
};

// Placeholder catalog — to be replaced by DB-backed products with `type='store'` later.
const ITEMS: StoreItem[] = [
  { id: "1", name: "VisionScope Cap", category: "Merch", price: 28 },
  { id: "2", name: "Crew T-Shirt — Black", category: "Merch", price: 35 },
  { id: "3", name: "Lens Cleaning Kit Pro", category: "Accessories", price: 24 },
  { id: "4", name: "SmallRig Cage Plate", category: "Accessories", price: 89 },
  { id: "5", name: "Gaffer Tape — Matte Black 50m", category: "Consumables", price: 18 },
  { id: "6", name: "Color Calibration Card", category: "Accessories", price: 42 },
  { id: "7", name: "ND Filter Set 4-pack", category: "Accessories", price: 240 },
  { id: "8", name: "Production Notebook", category: "Merch", price: 16 },
];

const SuperStore = () => {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.NumberFormat(i18n.language, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

  return (
    <div className="container-page py-20">
      <div className="mb-12 flex items-end justify-between flex-wrap gap-6">
        <div>
          <span className="cine-eyebrow">{t("store.eyebrow")}</span>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
            {t("store.title")}
          </h1>
          <p className="text-secondary mt-3 max-w-xl">{t("store.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-accent border border-accent/40 rounded-sm px-3 py-1.5">
          <Package className="h-3.5 w-3.5" /> {t("store.comingSoon")}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ITEMS.map((item) => (
          <article
            key={item.id}
            className="group rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow"
          >
            <div className="relative aspect-square bg-muted overflow-hidden grid place-items-center">
              <ShoppingBag className="h-16 w-16 text-foreground/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-accent/20" />
              <span className="absolute top-3 left-3 text-[9px] uppercase tracking-[0.24em] text-secondary">
                {item.category}
              </span>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors line-clamp-1">
                {item.name}
              </h3>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-base font-medium text-foreground">{fmt.format(item.price)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  className="text-[10px] uppercase tracking-[0.2em] text-accent hover:text-accent hover:bg-accent/10 px-2 h-8 disabled:opacity-60"
                >
                  {t("store.buy")} <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-16 p-8 rounded-sm border border-dashed border-border bg-surface/40 text-center">
        <p className="text-sm text-secondary max-w-md mx-auto">{t("store.comingSoonText")}</p>
      </div>
    </div>
  );
};

export default SuperStore;
