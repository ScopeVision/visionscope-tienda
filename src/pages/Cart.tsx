import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, ArrowRight, CalendarIcon } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { calcItemPrice, formatCurrency, MAX_AUTO_DAYS } from "@/lib/rental";
import { useSiteContact } from "@/hooks/useSiteContact";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";
import { cn } from "@/lib/utils";

const Cart = () => {
  const { t, i18n } = useTranslation();
  const cart = useCart();
  const { data: siteContact } = useSiteContact();
  const navigate = useNavigate();
  const contactRequired = cart.days > MAX_AUTO_DAYS;
  const [start, setStart] = useState<Date | undefined>(
    cart.startDate ? new Date(cart.startDate) : undefined
  );
  const [end, setEnd] = useState<Date | undefined>(
    cart.endDate ? new Date(cart.endDate) : undefined
  );

  const updateDates = (s?: Date, e?: Date) => {
    setStart(s);
    setEnd(e);
    cart.setDates(s ? s.toISOString().slice(0, 10) : null, e ? e.toISOString().slice(0, 10) : null);
  };

  if (cart.items.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl font-display font-medium">{t("cart.title")}</h1>
        <p className="text-secondary mt-3">{t("cart.empty")}</p>
        <Link to="/catalog">
          <Button className="mt-6 bg-foreground text-background hover:bg-foreground/90">
            {t("cart.emptyAction")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight mb-8">
        {t("cart.title")}
      </h1>
      <div className="grid lg:grid-cols-[1fr_360px] gap-10">
        <div className="space-y-3">
          {cart.items.map((item) => {
            const calc = calcItemPrice({
              priceDay: item.priceDay,
              priceWeek: item.priceWeek,
              days: cart.days,
              quantity: item.quantity,
            });
            return (
              <div
                key={item.productId}
                className="flex gap-4 p-4 rounded-xl bg-surface border border-border"
              >
                <div className="w-20 h-20 rounded-lg bg-muted shrink-0 overflow-hidden">
                  {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/product/${item.slug}`} className="font-medium hover:text-accent">
                    {item.name}
                  </Link>
                  <div className="text-xs text-secondary mt-1">
                    {formatCurrency(item.priceDay, i18n.language)} {t("common.perDay")} · {t("common.deposit")}{" "}
                    {formatCurrency(item.deposit, i18n.language)}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="text-xs text-secondary">×</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={item.quantity}
                      onChange={(e) => cart.updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                      className="w-16 h-8 px-2 rounded-md border border-border bg-background text-sm"
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCurrency(calc.subtotal, i18n.language)}</div>
                  <WeeklyDiscountBadge priceDay={item.priceDay} variant="pill" className="mt-1" />
                  <button
                    onClick={() => cart.remove(item.productId)}
                    className="mt-2 text-secondary hover:text-destructive"
                    aria-label={t("cart.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="h-fit p-6 rounded-xl bg-surface border border-border sticky top-24">
          <h2 className="text-lg font-medium mb-4">{t("cart.summary")}</h2>

          <div className="space-y-3 mb-5">
            <div>
              <div className="text-xs text-secondary mb-1">{t("common.from")}</div>
              <DatePopover date={start} onChange={(d) => updateDates(d, end)} />
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">{t("common.to")}</div>
              <DatePopover date={end} onChange={(d) => updateDates(start, d)} fromDate={start} />
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">
                {t("cart.subtotal")} ({cart.days} {cart.days === 1 ? t("common.day") : t("common.days")})
              </span>
              <span className="font-medium">{formatCurrency(cart.subtotal, i18n.language)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t("cart.deposit")}</span>
              <span className="font-medium">{formatCurrency(cart.depositTotal, i18n.language)}</span>
            </div>
          </div>

          <div className="my-4 border-t border-border" />
          <div className="flex justify-between items-baseline">
            <span className="text-secondary">{t("cart.total")}</span>
            <div className="text-right">
              <div className="text-2xl font-medium">{formatCurrency(cart.total, i18n.language)}</div>
              <div className="text-xs text-secondary">{t("cart.depositNote")}</div>
            </div>
          </div>

          {contactRequired && (
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

          <Button
            size="lg"
            className="w-full mt-6 bg-foreground text-background hover:bg-foreground/90 gap-2"
            disabled={!start || !end || contactRequired}
            onClick={() => navigate("/checkout")}
          >
            {t("cart.checkout")} <ArrowRight className="h-4 w-4" />
          </Button>
        </aside>
      </div>
    </div>
  );
};

const DatePopover = ({
  date,
  onChange,
  fromDate,
}: {
  date?: Date;
  onChange: (d: Date | undefined) => void;
  fromDate?: Date;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn("w-full justify-start text-left font-normal", !date && "text-secondary")}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "PP") : "—"}
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
);

export default Cart;
