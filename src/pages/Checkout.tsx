import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { calcItemPrice, formatCurrency, MAX_AUTO_DAYS } from "@/lib/rental";
import { WeeklyDiscountBadge } from "@/components/catalog/WeeklyDiscountBadge";
import { useSiteContact } from "@/hooks/useSiteContact";
import { toast } from "sonner";
import {
  CheckCircle2,
  ShieldCheck,
  Clock,
  HandCoins,
  MessageCircle,
  ArrowLeft,
  ArrowRight,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().trim().min(2, "Nombre obligatorio (mín. 2 caracteres)").max(200),
  email: z.string().trim().email("Email no válido").max(255),
  phone: z.string().trim().min(6, "Teléfono obligatorio").max(40),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  tax_id: z.string().trim().min(1, "NIF/CIF obligatorio").max(40),
  address_line1: z.string().trim().min(5, "Dirección obligatoria (mín. 5 caracteres)").max(200),
  city: z.string().trim().min(2, "Ciudad obligatoria").max(100),
  region: z.string().trim().max(100).optional().or(z.literal("")),
  postal_code: z.string().trim().min(4, "Código postal obligatorio").max(20),
  country: z.string().trim().min(2, "País obligatorio").max(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

type SuccessSnapshot = {
  reference: string;
  startDate: string;
  endDate: string;
  days: number;
  items: CartItem[];
  subtotal: number;
  deposit: number;
  fullName: string;
  email: string;
  phone: string;
};

const STEPS = [
  { id: 1, label: "Datos" },
  { id: 2, label: "Dirección" },
  { id: 3, label: "Revisar" },
] as const;

const Checkout = () => {
  const { t, i18n } = useTranslation();
  const cart = useCart();
  const navigate = useNavigate();
  const { data: contact } = useSiteContact();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessSnapshot | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<"found" | "not_found" | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      company: "",
      tax_id: "",
      address_line1: "",
      city: "",
      region: "",
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
    if (raw.includes("row-level security") || code === "42501") {
      const reasons: string[] = [];
      if (fullName.length < 1) reasons.push("• El nombre no puede estar vacío.");
      else if (fullName.length > 200) reasons.push("• El nombre supera los 200 caracteres permitidos.");
      if (email.length < 3 || email.length > 255) reasons.push("• El email debe tener entre 3 y 255 caracteres.");
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        reasons.push("• Formato de email no válido. Usa el formato nombre@dominio.com.");
      if (reasons.length === 0) reasons.push("• Revisa que el nombre y el email estén bien escritos.");
      return `No se pudo guardar el cliente:\n${reasons.join("\n")}`;
    }
    if (code === "23505") return "Ya existe un cliente con esos datos.";
    if (raw.includes("violates check constraint"))
      return "Algún dato no cumple las reglas de validación. Revisa nombre y email.";
    if (raw.includes("product not found or not published")) {
      return "Uno o más productos de tu carrito ya no están disponibles. Hemos actualizado tu carrito — revísalo antes de continuar.";
    }
    return err?.message || t("checkout.error");
  };

  const handleEmailLookup = async () => {
    const email = lookupEmail.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Introduce un email válido para buscar tus datos.");
      return;
    }
    setLookupLoading(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("full_name, email, phone, company, tax_id, address_line1, city, postal_code, country")
        .eq("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        form.setValue("full_name", data.full_name ?? "");
        form.setValue("email", data.email ?? "");
        form.setValue("phone", data.phone ?? "");
        form.setValue("company", data.company ?? "");
        form.setValue("tax_id", data.tax_id ?? "");
        form.setValue("address_line1", data.address_line1 ?? "");
        form.setValue("city", data.city ?? "");
        form.setValue("postal_code", data.postal_code ?? "");
        form.setValue("country", data.country ?? "");
        setLookupResult("found");
        toast.success("¡Bienvenido/a de vuelta! Hemos prellenado tus datos anteriores.");
      } else {
        setLookupResult("not_found");
      }
    } catch {
      toast.error("No se pudo buscar el cliente. Rellena el formulario manualmente.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    toast.info("Google OAuth pendiente de configurar. Por favor, introduce tus datos manualmente.", { duration: 5000 });
  };

  const goNext = async () => {
    if (step === 1) {
      const ok = await form.trigger(["full_name", "email", "phone", "company"]);
      if (!ok) return;
      setStep(2);
    } else if (step === 2) {
      const ok = await form.trigger(["tax_id", "address_line1", "city", "postal_code", "country", "region"]);
      if (!ok) return;
      const countryVal = form.getValues("country").toLowerCase();
      const regionVal = (form.getValues("region") ?? "").toLowerCase();
      if (countryVal && !["españa", "spain", "espanya", "es"].some(v => countryVal.includes(v))) {
        toast.warning("Nota: habitualmente operamos en España. Si tu dirección es correcta, puedes continuar.", { duration: 6000 });
      }
      if (regionVal && !["cataluña", "catalonia", "catalunya", "cat"].some(v => regionVal.includes(v))) {
        toast.warning("Nota: habitualmente servimos pedidos en Cataluña. Si tu dirección es correcta, puedes continuar.", { duration: 6000 });
      }
      setStep(3);
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (values: FormValues) => {
    if (!addressConfirmed) {
      toast.error("Por favor, confirma que la dirección es correcta antes de enviar.");
      return;
    }
    setSubmitting(true);
    try {
      // Check which items are still published
      const productIds = cart.items.map(it => it.productId);
      const { data: publishedCheck } = await supabase
        .from('products')
        .select('id, name_es, published')
        .in('id', productIds);
      const unavailable = cart.items.filter(it => {
        const found = (publishedCheck ?? []).find((p: any) => p.id === it.productId);
        return !found || !found.published;
      });
      if (unavailable.length > 0) {
        unavailable.forEach(it => {
          cart.remove(it.productId);
          toast.error(`"${it.name}" ya no está disponible y ha sido eliminado del carrito.`, { duration: 8000 });
        });
        setSubmitting(false);
        return;
      }

      const fullName = values.full_name.trim();
      const email = values.email.trim().toLowerCase();
      if (fullName.length < 1) return toast.error("El nombre es obligatorio.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return toast.error("Email no válido. Usa el formato nombre@dominio.com.");

      // Snapshot BEFORE clearing cart so the success screen can show the recap
      const snapshot: Omit<SuccessSnapshot, "reference"> = {
        startDate: cart.startDate!,
        endDate: cart.endDate!,
        days: cart.days,
        items: [...cart.items],
        subtotal: cart.subtotal,
        deposit: cart.depositTotal,
        fullName,
        email,
        phone: values.phone.trim(),
      };

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
            items: cart.items.map((it) => ({ product_id: it.productId, quantity: it.quantity })),
            language: i18n.language,
          },
        },
      );
      if (checkoutErr) {
        console.error("Checkout function error:", checkoutErr);
        toast.error(explainCustomerError(checkoutErr, fullName, email), { duration: 8000 });
        return;
      }
      if (!checkoutData?.ok) {
        toast.error(checkoutData?.error || t("checkout.error"), { duration: 8000 });
        return;
      }
      const ref = checkoutData?.reference || "";
      setSuccess({ ...snapshot, reference: ref });
      cart.clear();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err?.message || err?.error_description || t("checkout.error"), { duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  // ----- SUCCESS / CONFIRMATION ------------------------------------------------
  if (success) return <SuccessScreen snapshot={success} contact={contact} />;

  // ----- CHECKOUT --------------------------------------------------------------
  const v = form.watch();

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <span className="cine-eyebrow">Checkout</span>
        <h1 className="mt-3 text-3xl md:text-4xl font-display font-medium tracking-tight uppercase">
          {t("checkout.title")}
        </h1>
        <p className="mt-3 text-sm text-secondary max-w-xl">
          Solicitud sin pago automático. Revisamos cada reserva manualmente y te confirmamos la
          disponibilidad en menos de 24 h.
        </p>
      </div>

      {/* Trust strip */}
      <div className="mb-8 grid sm:grid-cols-3 gap-2 text-xs">
        <TrustItem icon={Clock} title="Respuesta < 24 h" desc="Lunes a viernes" />
        <TrustItem icon={ShieldCheck} title="Reserva manual" desc="Confirmamos disponibilidad antes de cobrar" />
        <TrustItem icon={HandCoins} title="Sin cargos automáticos" desc="Pagas tras la confirmación" />
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-10">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
            {STEPS.map((s, idx) => (
              <li key={s.id} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    "h-7 w-7 grid place-items-center rounded-full border text-[11px] font-medium transition-colors",
                    s.id === step
                      ? "border-accent bg-accent text-accent-foreground"
                      : s.id < step
                        ? "border-accent/60 text-accent"
                        : "border-border text-secondary/60",
                  )}
                >
                  {s.id < step ? "✓" : s.id}
                </div>
                <span
                  className={cn(
                    "hidden sm:inline",
                    s.id === step ? "text-foreground" : "text-secondary/60",
                  )}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-border" />
                )}
              </li>
            ))}
          </ol>

          {/* STEP 1 - Data */}
          {step === 1 && (
            <>
              {/* Customer identification */}
              <div className="p-5 rounded-sm bg-surface border border-border space-y-4">
                <div className="text-[10px] uppercase tracking-[0.28em] text-accent mb-1">¿Ya has alquilado antes?</div>
                <div className="grid md:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleLogin}
                      className="w-full h-11 gap-3 border-border hover:border-accent justify-center"
                    >
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continuar con Google
                    </Button>
                    <p className="text-[10px] text-secondary text-center">Pre-rellena tus datos automáticamente</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="tu@email.com"
                        value={lookupEmail}
                        onChange={e => setLookupEmail(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleEmailLookup(); } }}
                        className="h-11 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleEmailLookup}
                        disabled={lookupLoading}
                        className="h-11 px-4 shrink-0"
                      >
                        {lookupLoading ? "…" : "Buscar"}
                      </Button>
                    </div>
                    {lookupResult === "found" && (
                      <p className="text-xs text-green-500">✓ Datos prellenados — revísalos abajo</p>
                    )}
                    {lookupResult === "not_found" && (
                      <p className="text-xs text-secondary">No encontrado — rellena el formulario</p>
                    )}
                  </div>
                </div>
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] uppercase tracking-[0.22em] text-secondary shrink-0">O rellena manualmente</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </div>

              <section className="p-6 md:p-7 rounded-sm bg-surface border border-border">
                <header className="mb-5 pb-4 border-b border-border">
                  <div className="text-[10px] uppercase tracking-[0.28em] text-accent">01</div>
                  <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
                    {t("checkout.yourData")}
                  </h2>
                </header>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label={t("common.name") + " *"} error={form.formState.errors.full_name?.message}>
                    <Input autoComplete="name" {...form.register("full_name")} />
                  </Field>
                  <Field label={t("common.email") + " *"} error={form.formState.errors.email?.message}>
                    <Input type="email" autoComplete="email" {...form.register("email")} />
                  </Field>
                  <Field label={t("common.phone") + " *"} error={form.formState.errors.phone?.message}>
                    <Input autoComplete="tel" {...form.register("phone")} />
                  </Field>
                  <Field label={t("common.company")}>
                    <Input autoComplete="organization" {...form.register("company")} />
                  </Field>
                </div>
              </section>
            </>
          )}

          {/* STEP 2 - Address */}
          {step === 2 && (
            <section className="p-6 md:p-7 rounded-sm bg-surface border border-border">
              <header className="mb-5 pb-4 border-b border-border">
                <div className="text-[10px] uppercase tracking-[0.28em] text-accent">02</div>
                <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
                  Dirección & facturación
                </h2>
              </header>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="NIF/CIF *" error={form.formState.errors.tax_id?.message}>
                  <Input {...form.register("tax_id")} />
                </Field>
                <Field label="Dirección *" error={form.formState.errors.address_line1?.message}>
                  <Input autoComplete="street-address" {...form.register("address_line1")} />
                </Field>
                <Field label="Ciudad *" error={form.formState.errors.city?.message}>
                  <Input autoComplete="address-level2" {...form.register("city")} />
                </Field>
                <Field label="Provincia *" error={form.formState.errors.region?.message}>
                  <Input {...form.register("region")} placeholder="Ej: Cataluña" />
                </Field>
                <Field label="CP *" error={form.formState.errors.postal_code?.message}>
                  <Input autoComplete="postal-code" {...form.register("postal_code")} />
                </Field>
                <Field label="País *" error={form.formState.errors.country?.message}>
                  <Input autoComplete="country-name" {...form.register("country")} />
                </Field>
              </div>
              <div className="mt-5">
                <Field label={t("common.notes")}>
                  <Textarea
                    rows={3}
                    placeholder="Producción, día de recogida, cualquier comentario…"
                    {...form.register("notes")}
                  />
                </Field>
              </div>
            </section>
          )}

          {/* STEP 3 - Review */}
          {step === 3 && (
            <section className="p-6 md:p-7 rounded-sm bg-surface border border-border space-y-5">
              <header className="pb-4 border-b border-border">
                <div className="text-[10px] uppercase tracking-[0.28em] text-accent">03</div>
                <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
                  Revisa tu solicitud
                </h2>
              </header>

              <ReviewBlock title="Contacto">
                <ReviewRow label="Nombre" value={v.full_name} />
                <ReviewRow label="Email" value={v.email} />
                <ReviewRow label="Teléfono" value={v.phone} />
                {v.company && <ReviewRow label="Empresa" value={v.company} />}
              </ReviewBlock>

              {(v.address_line1 || v.city || v.postal_code || v.country || v.tax_id || v.region) && (
                <ReviewBlock title="Dirección">
                  {v.tax_id && <ReviewRow label="NIF/CIF" value={v.tax_id} />}
                  {v.address_line1 && <ReviewRow label="Dirección" value={v.address_line1} />}
                  {v.city && <ReviewRow label="Ciudad" value={v.city} />}
                  {v.region && <ReviewRow label="Provincia" value={v.region} />}
                  {v.postal_code && <ReviewRow label="CP" value={v.postal_code} />}
                  {v.country && <ReviewRow label="País" value={v.country} />}
                </ReviewBlock>
              )}

              <label className="flex items-start gap-3 cursor-pointer mt-4 pt-4 border-t border-border">
                <input
                  type="checkbox"
                  checked={addressConfirmed}
                  onChange={e => setAddressConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent shrink-0"
                />
                <span className="text-sm text-secondary leading-snug">
                  Confirmo que la dirección indicada es correcta y está actualizada.
                </span>
              </label>

              {v.notes && (
                <ReviewBlock title="Notas">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{v.notes}</p>
                </ReviewBlock>
              )}

              <div className="rounded-sm border border-accent/40 bg-accent/5 p-4 text-xs text-secondary leading-relaxed">
                Al enviar la solicitud guardamos tu pedido. Te contactaremos para confirmar
                disponibilidad y proceder con el pago. No se realiza ningún cargo automático.
              </div>
            </section>
          )}

          {/* Navigation */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={step === 1 ? () => navigate("/cart") : goBack}
              className="gap-2 text-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? "Volver al carrito" : "Atrás"}
            </Button>

            {step < 3 ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                className="gap-2 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-[0.2em] text-xs h-12 rounded-sm"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={submitting || !addressConfirmed}
                className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 uppercase tracking-[0.2em] text-xs h-12 rounded-sm"
              >
                {submitting ? t("common.loading") : t("checkout.submit")}
              </Button>
            )}
          </div>

          {/* WhatsApp shortcut */}
          {contact?.whatsapp_url && (
            <div className="rounded-sm border border-border bg-surface p-4 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-4 w-4 text-accent mt-0.5" />
                <div>
                  <div className="font-medium">¿Prefieres confirmar por WhatsApp?</div>
                  <div className="text-secondary text-xs mt-0.5">
                    Te respondemos en directo y resolvemos cualquier duda.
                  </div>
                </div>
              </div>
              <a
                href={contact.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-accent hover:underline"
              >
                Abrir <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          )}
        </form>

        {/* Sticky summary */}
        <aside className="h-fit lg:sticky lg:top-24 p-6 md:p-7 rounded-sm bg-surface border border-border">
          <header className="mb-5 pb-4 border-b border-border">
            <div className="text-[10px] uppercase tracking-[0.28em] text-accent">Summary</div>
            <h2 className="mt-1.5 text-base font-medium uppercase tracking-[0.06em]">
              {t("cart.summary")}
            </h2>
          </header>

          <div className="text-xs uppercase tracking-[0.18em] text-secondary mb-3 flex justify-between">
            <span>
              {cart.startDate} → {cart.endDate}
            </span>
            <span className="text-foreground tabular-nums">
              {cart.days} {t("common.days")}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            {cart.items.map((it) => (
              <div
                key={it.productId}
                className="space-y-1.5 pb-3 border-b border-border/60 last:border-0 last:pb-0"
              >
                <div className="flex justify-between gap-3">
                  <span className="text-foreground">
                    {it.name} <span className="text-secondary">×{it.quantity}</span>
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(
                      calcItemPrice({
                        priceDay: it.priceDay,
                        priceWeek: it.priceWeek,
                        days: cart.days,
                        quantity: it.quantity,
                      }).subtotal,
                      i18n.language,
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
              <span className="font-medium tabular-nums">
                {formatCurrency(cart.subtotal, i18n.language)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t("cart.deposit")}</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(cart.depositTotal, i18n.language)}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em] text-secondary">
              {t("cart.total")}
            </span>
            <span className="text-2xl font-medium tabular-nums text-foreground">
              {formatCurrency(cart.total, i18n.language)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ---------- success screen ---------- */
const SuccessScreen = ({
  snapshot,
  contact,
}: {
  snapshot: SuccessSnapshot;
  contact?: { whatsapp_url: string; contact_email: string };
}) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(snapshot.reference);
      toast.success("Referencia copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const wa = useMemo(() => {
    if (!contact?.whatsapp_url) return null;
    const msg = encodeURIComponent(
      `Hola, acabo de solicitar la reserva ${snapshot.reference} (${snapshot.startDate} → ${snapshot.endDate}). ¿Podéis confirmarme la disponibilidad?`,
    );
    const url = contact.whatsapp_url;
    return url.includes("?") ? `${url}&text=${msg}` : `${url}?text=${msg}`;
  }, [contact?.whatsapp_url, snapshot]);

  return (
    <div className="container-page py-16 max-w-2xl">
      <div className="text-center mb-10">
        <CheckCircle2 className="h-14 w-14 text-accent mx-auto mb-5" />
        <h1 className="text-3xl md:text-4xl font-display font-medium uppercase tracking-tight">
          Solicitud recibida
        </h1>
        <p className="mt-4 text-secondary max-w-lg mx-auto leading-relaxed">
          Gracias {snapshot.fullName.split(" ")[0]}. Hemos registrado tu solicitud y la revisaremos
          manualmente. Te confirmamos por email en menos de 24 h laborables.
        </p>
      </div>

      {/* Reference */}
      <div className="rounded-sm border border-border bg-surface p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-secondary">Referencia</div>
          <div className="mt-1 font-mono text-lg font-medium tracking-wider">
            {snapshot.reference || "—"}
          </div>
        </div>
        {snapshot.reference && (
          <Button variant="ghost" size="sm" onClick={copyRef} className="gap-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        )}
      </div>

      {/* Recap */}
      <div className="rounded-sm border border-border bg-surface p-6 space-y-5">
        <div className="flex justify-between text-xs uppercase tracking-[0.22em]">
          <span className="text-secondary">Fechas</span>
          <span className="text-foreground tabular-nums">
            {snapshot.startDate} → {snapshot.endDate} · {snapshot.days} días
          </span>
        </div>

        <div className="border-t border-border pt-4 space-y-3 text-sm">
          {snapshot.items.map((it) => (
            <div key={it.productId} className="flex justify-between gap-3">
              <span>
                {it.name} <span className="text-secondary">×{it.quantity}</span>
              </span>
              <span className="tabular-nums text-secondary">
                {formatCurrency(
                  calcItemPrice({
                    priceDay: it.priceDay,
                    priceWeek: it.priceWeek,
                    days: snapshot.days,
                    quantity: it.quantity,
                  }).subtotal,
                  i18n.language,
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.22em] text-secondary">Total estimado</span>
          <span className="text-2xl font-medium tabular-nums">
            {formatCurrency(snapshot.subtotal, i18n.language)}
          </span>
        </div>
        {snapshot.deposit > 0 && (
          <p className="text-xs text-secondary -mt-2">
            Fianza estimada: {formatCurrency(snapshot.deposit, i18n.language)} · se gestiona al
            entregar el equipo.
          </p>
        )}
      </div>

      {/* Next steps */}
      <div className="mt-8 rounded-sm border border-border bg-surface p-6">
        <h2 className="text-[10px] uppercase tracking-[0.28em] text-accent mb-4">Próximos pasos</h2>
        <ol className="space-y-3 text-sm text-secondary">
          <Step n={1}>Revisamos manualmente la disponibilidad de tu equipo.</Step>
          <Step n={2}>
            Te escribimos a <span className="text-foreground">{snapshot.email}</span> con la
            confirmación y los detalles de pago.
          </Step>
          <Step n={3}>Confirmas el pago y reservamos definitivamente el equipo.</Step>
        </ol>
      </div>

      {/* Actions */}
      <div className="mt-8 grid sm:grid-cols-2 gap-3">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-12 rounded-sm bg-accent text-accent-foreground hover:bg-accent/90 uppercase tracking-[0.2em] text-xs"
          >
            <MessageCircle className="h-4 w-4" /> Confirmar por WhatsApp
          </a>
        )}
        <Button
          variant="outline"
          className="h-12 rounded-sm uppercase tracking-[0.2em] text-xs"
          onClick={() => navigate("/")}
        >
          Volver al inicio
        </Button>
      </div>

      {contact?.contact_email && (
        <p className="mt-6 text-center text-xs text-secondary">
          ¿Dudas?{" "}
          <a className="text-accent hover:underline" href={`mailto:${contact.contact_email}`}>
            {contact.contact_email}
          </a>
        </p>
      )}
    </div>
  );
};

/* ---------- atoms ---------- */
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
    <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-1.5 block">
      {label}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

const TrustItem = ({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) => (
  <div className="flex items-start gap-3 p-3 rounded-sm bg-surface border border-border">
    <Icon className="h-4 w-4 text-accent mt-0.5 shrink-0" />
    <div>
      <div className="text-foreground font-medium text-[11px] uppercase tracking-[0.14em]">
        {title}
      </div>
      <div className="text-secondary text-[11px] mt-0.5 leading-snug">{desc}</div>
    </div>
  </div>
);

const ReviewBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-2">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-secondary">{label}</span>
    <span className="text-foreground text-right break-all">{value}</span>
  </div>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="shrink-0 h-6 w-6 grid place-items-center rounded-full border border-accent/40 text-[11px] text-accent font-medium">
      {n}
    </span>
    <span className="leading-relaxed pt-0.5">{children}</span>
  </li>
);

export default Checkout;
