import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Send, FileDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { COMM_TYPES, type CommType, renderTemplate, type CommContext } from "@/lib/bookingEmails";
import { generateBookingPdf } from "@/lib/bookingPdf";
import { useSiteContact } from "@/hooks/useSiteContact";
import { formatCurrency } from "@/lib/rental";

type Props = {
  booking: any; // booking with customer + items
};

export default function BookingCommunications({ booking }: Props) {
  const qc = useQueryClient();
  const { i18n } = useTranslation();
  const { data: contact } = useSiteContact();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CommType>("availability_confirmed");
  const [lang, setLang] = useState<string>(i18n.language || "es");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: comms = [] } = useQuery({
    queryKey: ["booking-comms", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_communications" as any)
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const ctx: CommContext = useMemo(() => {
    const itemsText = (booking.items ?? [])
      .map((it: any) => `- ${it.product_name} x${it.quantity} (${it.days}d)`)
      .join("\n");
    return {
      reference: booking.reference,
      customerName: booking.customer?.full_name || "",
      startDate: booking.start_date,
      endDate: booking.end_date,
      itemsText,
      total: formatCurrency(Number(booking.total), i18n.language),
      contactEmail: contact?.contact_email || "",
      whatsappUrl: contact?.whatsapp_url || "",
    };
  }, [booking, contact, i18n.language]);

  const openComposer = (t: CommType) => {
    const tpl = renderTemplate(t, lang, ctx);
    setType(t);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setOpen(true);
  };

  const onLangChange = (l: string) => {
    setLang(l);
    const tpl = renderTemplate(type, l, ctx);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const onSend = async () => {
    if (!booking.customer?.email) {
      toast.error("El cliente no tiene email");
      return;
    }
    setSending(true);
    try {
      // Log the communication. Actual delivery will be wired when an email
      // provider (Lovable Emails / Resend / SMTP) is configured.
      const { error } = await supabase.from("booking_communications" as any).insert({
        booking_id: booking.id,
        type,
        status: "queued",
        language: lang,
        recipient_email: booking.customer.email,
        subject,
        body,
      });
      if (error) throw error;
      toast.success("Email registrado en el historial. Configura un proveedor para envío real.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["booking-comms", booking.id] });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo registrar el email");
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = () => {
    generateBookingPdf({
      reference: booking.reference,
      status: booking.status,
      paymentStatus: booking.payment_status,
      startDate: booking.start_date,
      endDate: booking.end_date,
      customer: booking.customer || { full_name: "", email: "" },
      items: (booking.items ?? []).map((it: any) => ({
        product_name: it.product_name,
        quantity: it.quantity,
        days: it.days,
        price_day: Number(it.price_day),
        subtotal: Number(it.subtotal),
      })),
      subtotal: Number(booking.subtotal),
      deposit: Number(booking.deposit_total),
      total: Number(booking.total),
      contactEmail: contact?.contact_email,
      whatsappUrl: contact?.whatsapp_url,
      brandName: "The Vision Scope",
    });
  };

  return (
    <section className="rounded-md border border-border p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          <h3 className="font-medium">Comunicación con el cliente</h3>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-secondary">Idioma</Label>
          <Select value={lang} onValueChange={onLangChange}>
            <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="es">ES</SelectItem>
              <SelectItem value="ca">CA</SelectItem>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="fr">FR</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-2" onClick={downloadPdf}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {COMM_TYPES.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant="outline"
            className="justify-start gap-2"
            onClick={() => openComposer(t.value)}
          >
            <Send className="h-3.5 w-3.5" /> {t.label}
          </Button>
        ))}
      </div>

      <Separator />

      <div>
        <p className="text-xs text-secondary mb-2">Historial ({comms.length})</p>
        {comms.length === 0 ? (
          <p className="text-xs text-secondary">Sin comunicaciones enviadas todavía.</p>
        ) : (
          <ul className="space-y-2">
            {comms.map((c: any) => (
              <li key={c.id} className="text-xs p-2 rounded border border-border bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{c.type}</Badge>
                    <Badge variant="outline">{c.language?.toUpperCase()}</Badge>
                    <Badge>{c.status}</Badge>
                  </div>
                  <span className="text-secondary">
                    {new Date(c.created_at).toLocaleString(i18n.language)}
                  </span>
                </div>
                <p className="mt-1 font-medium truncate">{c.subject}</p>
                <p className="text-secondary truncate">{c.recipient_email}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Vista previa — {COMM_TYPES.find((x) => x.value === type)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Para</Label>
              <Input value={booking.customer?.email || ""} readOnly />
            </div>
            <div>
              <Label className="text-xs">Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Contenido</Label>
              <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={onSend} disabled={sending} className="gap-2">
                <Send className="h-4 w-4" /> {sending ? "Registrando…" : "Registrar envío"}
              </Button>
            </div>
            <p className="text-[11px] text-secondary">
              El envío real por email se activará cuando se configure el proveedor (Lovable Emails, Resend o SMTP).
              Por ahora la comunicación queda registrada en el historial del pedido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
