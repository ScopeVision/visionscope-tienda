import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, ImageOff, ArrowRight } from "lucide-react";

/**
 * Super Store — public catalog (independent module).
 *
 * Reads from the dedicated `store_products` table. NOT linked to Rental.
 */
type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  published: boolean;
};

const SuperStore = () => {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["store-products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_products")
        .select("*")
        .eq("published", true)
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StoreProduct[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.description, p.slug].join(" ").toLowerCase().includes(q),
    );
  }, [products, search]);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || "es", {
        style: "currency",
        currency: "EUR",
      }),
    [i18n.language],
  );

  return (
    <div className="container-page py-20">
      <header className="mb-10">
        <span className="cine-eyebrow">{t("nav.store")}</span>
        <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
          Super Store
        </h1>
        <p className="text-secondary mt-3 max-w-xl">
          {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
        </p>
      </header>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
        <Input
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-surface border-border focus-visible:ring-accent h-11"
        />
      </div>

      {isLoading ? (
        <p className="text-secondary">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-secondary border border-dashed border-border rounded-sm">
          Aún no hay productos disponibles.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <article
              key={p.id}
              className="group block rounded-sm bg-surface border border-border overflow-hidden transition-smooth hover-glow"
            >
              <div className="relative aspect-square overflow-hidden">
                {p.images?.[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    loading="lazy"
                    className="w-full h-full object-contain opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-secondary/40">
                    <ImageOff className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              </div>

              <div className="p-5">
                <h3 className="font-medium text-lg uppercase tracking-[0.06em] text-accent">
                  {p.name}
                </h3>
                {p.description && (
                  <p className="mt-3 text-sm text-secondary line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                )}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                  {Number(p.price) > 0 ? (
                    <span className="text-base font-medium text-foreground">
                      {fmt.format(Number(p.price))}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-accent">
                    Próximamente <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuperStore;
