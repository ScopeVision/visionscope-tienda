import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, ImageOff, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { localized } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calcItemPrice, daysBetween, formatCurrency } from "@/lib/rental";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const cart = useCart();
  const [start, setStart] = useState<Date | undefined>(
    cart.startDate ? new Date(cart.startDate) : undefined
  );
  const [end, setEnd] = useState<Date | undefined>(
    cart.endDate ? new Date(cart.endDate) : undefined
  );

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

  const days = useMemo(() => (start && end ? daysBetween(start, end) : 1), [start, end]);
  const calc = useMemo(() => {
    if (!product) return { subtotal: 0, weeklyApplied: false };
    return calcItemPrice({
      priceDay: Number(product.price_day),
      priceWeek: product.price_week ? Number(product.price_week) : null,
      days,
      quantity: 1,
    });
  }, [product, days]);

  if (isLoading) {
    return <div className="container-page py-20 text-secondary">{t("common.loading")}</div>;
  }
  if (!product) {
    return (
      <div className="container-page py-20">
        <p className="text-secondary">404</p>
        <Link to="/catalog" className="text-accent hover:underline">
          {t("product.back")}
        </Link>
      </div>
    );
  }

  const name = localized(product, "name", i18n.language);
  const desc = localized(product, "description", i18n.language);
  const cat = product.category ? localized(product.category, "name", i18n.language) : "";
  const img: string | undefined = product.images?.[0];

  const handleAdd = () => {
    if (start && end) {
      cart.setDates(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    }
    cart.add({
      productId: product.id,
      slug: product.slug,
      name,
      image: img,
      priceDay: Number(product.price_day),
      priceWeek: product.price_week ? Number(product.price_week) : null,
      deposit: Number(product.deposit),
      quantity: 1,
    });
    toast.success(t("product.added"));
  };

  return (
    <div className="container-page py-10">
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 text-sm text-secondary hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> {t("product.back")}
      </Link>

      <div className="grid lg:grid-cols-2 gap-12">
        <div className="aspect-square rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 overflow-hidden shadow-soft">
          {img ? (
            <img src={img} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-secondary/40">
              <ImageOff className="h-16 w-16" />
            </div>
          )}
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-accent mb-2">{cat}</div>
          <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight">{name}</h1>
          <p className="mt-4 text-secondary leading-relaxed whitespace-pre-line">{desc}</p>

          {product.product_tags?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {product.product_tags.map((pt: any) => (
                <Badge key={pt.tag.id} variant="secondary" className="bg-muted text-foreground font-normal">
                  {localized(pt.tag, "name", i18n.language)}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-8 p-6 rounded-xl bg-surface border border-border">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-medium">
                  {formatCurrency(Number(product.price_day), i18n.language)}
                </span>
                <span className="text-sm text-secondary ml-1">{t("common.perDay")}</span>
              </div>
              {product.price_week && (
                <div className="text-right">
                  <div className="text-sm text-secondary">{t("common.perWeek")}</div>
                  <div className="font-medium">
                    {formatCurrency(Number(product.price_week), i18n.language)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 text-sm text-secondary flex items-center justify-between">
              <span>{t("product.deposit")}</span>
              <span className="text-foreground font-medium">
                {formatCurrency(Number(product.deposit), i18n.language)}
              </span>
            </div>
            <div className="mt-1 text-sm text-secondary flex items-center justify-between">
              <span>{t("product.stock")}</span>
              <span className="text-foreground">{product.stock}</span>
            </div>

            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-secondary mb-3">
                {t("product.selectDates")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePopover label={t("common.from")} date={start} onChange={setStart} />
                <DatePopover label={t("common.to")} date={end} onChange={setEnd} fromDate={start} />
              </div>
            </div>

            {start && end && (
              <div className="mt-5 p-4 rounded-lg bg-accent-soft">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">
                    {days} {days === 1 ? t("common.day") : t("common.days")}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(calc.subtotal, i18n.language)}
                  </span>
                </div>
                {calc.weeklyApplied && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-accent-foreground/70">
                    <Check className="h-3 w-3" /> {t("product.weeklyDiscount")}
                  </div>
                )}
                <p className="mt-2 text-xs text-secondary">{t("product.depositInfo")}</p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full mt-6 bg-foreground text-background hover:bg-foreground/90"
              onClick={handleAdd}
              disabled={product.stock <= 0}
            >
              {product.stock <= 0 ? t("catalog.outOfStock") : t("product.addToCart")}
            </Button>
          </div>
        </div>
      </div>
    </div>
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
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || (fromDate ? d < fromDate : false)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  </div>
);

export default ProductDetail;
