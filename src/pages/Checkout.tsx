import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { calcItemPrice, formatCurrency } from "@/lib/rental";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(4).max(40).optional().or(z.literal("")),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  tax_id: z.string().trim().max(40).optional().or(z.literal("")),
  address_line1: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const Checkout = () => {
  const { t, i18n } = useTranslation();
  const cart = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      company: "",
      tax_id: "",
      address_line1: "",
      city: "",
      postal_code: "",
      country: "",
      notes: "",
    },
  });

  if (cart.items.length === 0 && !success) {
    navigate("/catalog");
    return null;
  }
  if (!cart.startDate || !cart.endDate) {
    if (!success) {
      navigate("/cart");
      return null;
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // 1. Create customer
      const { data: customer, error: cErr } = await supabase
        .from("customers")
        .insert({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || null,
          company: values.company || null,
          tax_id: values.tax_id || null,
          address_line1: values.address_line1 || null,
          city: values.city || null,
          postal_code: values.postal_code || null,
          country: values.country || null,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // 2. Create booking
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .insert({
          customer_id: customer.id,
          start_date: cart.startDate!,
          end_date: cart.endDate!,
          status: "nuevo",
          subtotal: cart.subtotal,
          deposit_total: cart.depositTotal,
          total: cart.total,
          notes: values.notes || null,
        })
        .select()
        .single();
      if (bErr) throw bErr;

      // 3. Create booking items
      const items = cart.items.map((it) => {
        const calc = calcItemPrice({
          priceDay: it.priceDay,
          priceWeek: it.priceWeek,
          days: cart.days,
          quantity: it.quantity,
        });
        return {
          booking_id: booking.id,
          product_id: it.productId,
          product_name: it.name,
          quantity: it.quantity,
          days: cart.days,
          price_day: it.priceDay,
          price_week: it.priceWeek ?? null,
          deposit: it.deposit,
          subtotal: calc.subtotal,
        };
      });
      const { error: iErr } = await supabase.from("booking_items").insert(items);
      if (iErr) throw iErr;

      setSuccess(booking.reference);
      cart.clear();
    } catch (err: any) {
      console.error(err);
      toast.error(t("checkout.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container-page py-24 text-center max-w-lg">
        <CheckCircle2 className="h-14 w-14 text-accent mx-auto mb-5" />
        <h1 className="text-3xl font-display font-medium">{t("checkout.success")}</h1>
        <p className="mt-3 text-secondary">
          {t("checkout.successRef")}: <span className="font-mono font-medium text-foreground">{success}</span>
        </p>
        <Button
          className="mt-8 bg-foreground text-background hover:bg-foreground/90"
          onClick={() => navigate("/")}
        >
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight mb-8">
        {t("checkout.title")}
      </h1>
      <div className="grid lg:grid-cols-[1fr_360px] gap-10">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 p-6 rounded-xl bg-surface border border-border">
          <h2 className="text-lg font-medium">{t("checkout.yourData")}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("common.name") + " *"} error={form.formState.errors.full_name?.message}>
              <Input {...form.register("full_name")} />
            </Field>
            <Field label={t("common.email") + " *"} error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            <Field label={t("common.phone")}>
              <Input {...form.register("phone")} />
            </Field>
            <Field label={t("common.company")}>
              <Input {...form.register("company")} />
            </Field>
            <Field label="NIF/CIF">
              <Input {...form.register("tax_id")} />
            </Field>
            <Field label={t("common.address")}>
              <Input {...form.register("address_line1")} />
            </Field>
            <Field label="Ciudad / Ville">
              <Input {...form.register("city")} />
            </Field>
            <Field label="CP">
              <Input {...form.register("postal_code")} />
            </Field>
            <Field label="País / Country">
              <Input {...form.register("country")} />
            </Field>
          </div>
          <Field label={t("common.notes")}>
            <Textarea rows={4} {...form.register("notes")} />
          </Field>
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting ? t("common.loading") : t("checkout.submit")}
          </Button>
        </form>

        <aside className="h-fit p-6 rounded-xl bg-surface border border-border">
          <h2 className="text-lg font-medium mb-4">{t("cart.summary")}</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between text-secondary">
              <span>{cart.startDate} → {cart.endDate}</span>
              <span>{cart.days} {t("common.days")}</span>
            </div>
            {cart.items.map((it) => (
              <div key={it.productId} className="flex justify-between">
                <span>{it.name} ×{it.quantity}</span>
                <span>
                  {formatCurrency(
                    calcItemPrice({
                      priceDay: it.priceDay,
                      priceWeek: it.priceWeek,
                      days: cart.days,
                      quantity: it.quantity,
                    }).subtotal,
                    i18n.language
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border my-4" />
          <div className="flex justify-between text-sm">
            <span className="text-secondary">{t("cart.subtotal")}</span>
            <span className="font-medium">{formatCurrency(cart.subtotal, i18n.language)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary">{t("cart.deposit")}</span>
            <span className="font-medium">{formatCurrency(cart.depositTotal, i18n.language)}</span>
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-border">
            <span>{t("cart.total")}</span>
            <span className="text-xl font-medium">{formatCurrency(cart.total, i18n.language)}</span>
          </div>
        </aside>
      </div>
    </div>
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

export default Checkout;
