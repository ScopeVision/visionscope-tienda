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
import { calcItemPrice, formatCurrency, MAX_AUTO_DAYS } from "@/lib/rental";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const schema = z.object({
  full_name: z.string().trim().min(2, "Nombre obligatorio (mín. 2 caracteres)").max(200),
  email: z.string().trim().email("Email no válido").max(255),
  phone: z.string().trim().min(6, "Teléfono obligatorio").max(40),
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
  if (cart.days > MAX_AUTO_DAYS && !success) {
    navigate("/cart");
    return null;
  }

  const explainCustomerError = (err: any, fullName: string, email: string): string => {
    const raw = (err?.message || "").toLowerCase();
    const code = err?.code;

    // RLS violation on customers — diagnose which check failed
    if (raw.includes("row-level security") || code === "42501") {
      const reasons: string[] = [];
      if (fullName.length < 1) {
        reasons.push("• El nombre no puede estar vacío.");
      } else if (fullName.length > 200) {
        reasons.push("• El nombre supera los 200 caracteres permitidos.");
      }
      if (email.length < 3 || email.length > 255) {
        reasons.push("• El email debe tener entre 3 y 255 caracteres.");
      } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        reasons.push(
          "• Formato de email no válido. Usa el formato nombre@dominio.com (sin espacios y con un punto en el dominio)."
        );
      }
      if (reasons.length === 0) {
        reasons.push(
          "• Revisa que el nombre y el email estén bien escritos. El email debe ser válido (ej: nombre@dominio.com) y el nombre no puede ir vacío ni superar 200 caracteres."
        );
      }
      return `No se pudo guardar el cliente:\n${reasons.join("\n")}`;
    }

    if (code === "23505") return "Ya existe un cliente con esos datos.";
    if (raw.includes("violates check constraint")) {
      return "Algún dato no cumple las reglas de validación. Revisa nombre y email.";
    }
    return err?.message || t("checkout.error");
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // Normalize all string fields (trim + lowercase email)
      const fullName = values.full_name.trim();
      const email = values.email.trim().toLowerCase();

      if (fullName.length < 1) {
        toast.error("El nombre es obligatorio.");
        setSubmitting(false);
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        toast.error("Email no válido. Usa el formato nombre@dominio.com.");
        setSubmitting(false);
        return;
      }

      // Create customer + booking in one secure backend operation.
      // This avoids trying to read a customer row from the public checkout,
      // while prices are still recalculated on the backend.
      const { data: checkoutData, error: checkoutErr } = await supabase.functions.invoke(
        "submit-checkout-request",
        {
          body: {
            full_name: fullName,
            email,
            phone: values.phone?.trim() || null,
            company: values.company?.trim() || null,
            tax_id: values.tax_id?.trim() || null,
            address_line1: values.address_line1?.trim() || null,
            city: values.city?.trim() || null,
            postal_code: values.postal_code?.trim() || null,
            country: values.country?.trim() || null,
            notes: values.notes?.trim() || null,
            start_date: cart.startDate!,
            end_date: cart.endDate!,
            items: cart.items.map((it) => ({
              product_id: it.productId,
              quantity: it.quantity,
            })),
          },
        }
      );
      if (checkoutErr) {
        console.error("Checkout function error:", checkoutErr);
        toast.error(explainCustomerError(checkoutErr, fullName, email), { duration: 8000 });
        setSubmitting(false);
        return;
      }
      if (!checkoutData?.ok) {
        toast.error(checkoutData?.error || t("checkout.error"), { duration: 8000 });
        setSubmitting(false);
        return;
      }
      const ref = checkoutData?.reference;

      setSuccess(ref ?? "");
      cart.clear();
    } catch (err: any) {
      console.error("Checkout error:", err);
      const msg = err?.message || err?.error_description || t("checkout.error");
      toast.error(msg, { duration: 8000 });
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
      <div className="mb-10">
        <span className="cine-eyebrow">Checkout</span>
        <h1 className="mt-3 text-3xl md:text-4xl font-display font-medium tracking-tight uppercase">
          {t("checkout.title")}
        </h1>
      </div>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-10">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <section className="p-6 md:p-7 rounded-sm bg-surface border border-border">
            <header className="mb-5 pb-4 border-b border-border">
              <div className="text-[10px] uppercase tracking-[0.28em] text-accent">01</div>
              <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
                {t("checkout.yourData")}
              </h2>
            </header>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("common.name") + " *"} error={form.formState.errors.full_name?.message}>
                <Input {...form.register("full_name")} />
              </Field>
              <Field label={t("common.email") + " *"} error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register("email")} />
              </Field>
              <Field label={t("common.phone") + " *"} error={form.formState.errors.phone?.message}>
                <Input {...form.register("phone")} />
              </Field>
              <Field label={t("common.company")}>
                <Input {...form.register("company")} />
              </Field>
            </div>
          </section>

          <section className="p-6 md:p-7 rounded-sm bg-surface border border-border">
            <header className="mb-5 pb-4 border-b border-border">
              <div className="text-[10px] uppercase tracking-[0.28em] text-accent">02</div>
              <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
                {t("common.address", { defaultValue: "Dirección" })} & NIF
              </h2>
            </header>
            <div className="grid sm:grid-cols-2 gap-4">
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
          </section>

          <section className="p-6 md:p-7 rounded-sm bg-surface border border-border">
            <header className="mb-5 pb-4 border-b border-border">
              <div className="text-[10px] uppercase tracking-[0.28em] text-accent">03</div>
              <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
                {t("common.notes")}
              </h2>
            </header>
            <Field label={t("common.notes")}>
              <Textarea rows={4} {...form.register("notes")} />
            </Field>
          </section>

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 uppercase tracking-[0.2em] text-xs h-12 rounded-sm"
          >
            {submitting ? t("common.loading") : t("checkout.submit")}
          </Button>
        </form>

        <aside className="h-fit lg:sticky lg:top-24 p-6 md:p-7 rounded-sm bg-surface border border-border">
          <header className="mb-5 pb-4 border-b border-border">
            <div className="text-[10px] uppercase tracking-[0.28em] text-accent">Summary</div>
            <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
              {t("cart.summary")}
            </h2>
          </header>

          <div className="text-xs uppercase tracking-[0.18em] text-secondary mb-3 flex justify-between">
            <span>{cart.startDate} → {cart.endDate}</span>
            <span className="text-foreground tabular-nums">
              {cart.days} {t("common.days")}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            {cart.items.map((it) => (
              <div key={it.productId} className="space-y-1.5 pb-3 border-b border-border/60 last:border-0 last:pb-0">
                <div className="flex justify-between gap-3">
                  <span className="text-foreground">{it.name} <span className="text-secondary">×{it.quantity}</span></span>
                  <span className="tabular-nums">
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
                <WeeklyDiscountBadge priceDay={it.priceDay} variant="pill" />
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-border space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">{t("cart.subtotal")}</span>
              <span className="font-medium tabular-nums">{formatCurrency(cart.subtotal, i18n.language)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t("cart.deposit")}</span>
              <span className="font-medium tabular-nums">{formatCurrency(cart.depositTotal, i18n.language)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("cart.total")}</span>
            <span className="text-2xl font-medium tabular-nums text-foreground">
              {formatCurrency(cart.total, i18n.language)}
            </span>
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
    <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-1.5 block">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export default Checkout;

