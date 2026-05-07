import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Phone, MapPin, MessageCircle, Send, Instagram } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useSiteContact } from "@/hooks/useSiteContact";

const Contact = () => {
  const { t } = useTranslation();
  const { data: contact } = useSiteContact();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const email = contact?.contact_email ?? "thevisionscope.ventas@gmail.com";
  const whatsappUrl = contact?.whatsapp_url ?? "https://wa.me/qr/3BHCCMSKBRQZP1";
  const instagramUrl = contact?.instagram_url ?? "https://www.instagram.com/thevisionscope/";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const subject = encodeURIComponent(`VisionScope · ${form.name || "Contact"}`);
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    toast({ title: t("checkout.success") });
    setSubmitting(false);
  };

  return (
    <div className="container-page py-20 max-w-6xl">
      <span className="cine-eyebrow">{t("contact.eyebrow")}</span>
      <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
        {t("contact.title")}
      </h1>
      <p className="text-secondary mt-3 max-w-xl">{t("contact.intro")}</p>

      <div className="mt-12 grid lg:grid-cols-[1fr_1.3fr] gap-10">
        <div className="space-y-4">
          <div className="p-6 rounded-sm bg-surface border border-border hover-glow transition-smooth">
            <Mail className="h-5 w-5 text-accent mb-4" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">Email</div>
            <a href={`mailto:${email}`} className="font-medium text-foreground hover:text-accent transition-colors">
              {email}
            </a>
          </div>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-6 rounded-sm bg-surface border border-border hover-glow transition-smooth"
          >
            <Instagram className="h-5 w-5 text-accent mb-4" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">Instagram</div>
            <span className="font-medium text-foreground hover:text-accent transition-colors">@thevisionscope</span>
          </a>
          <div className="p-6 rounded-sm bg-surface border border-border hover-glow transition-smooth">
            <MapPin className="h-5 w-5 text-accent mb-4" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">{t("common.address")}</div>
            <div className="font-medium text-foreground">Barcelona · Madrid</div>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-6 rounded-sm border border-accent/40 bg-accent/5 hover:bg-accent hover:text-accent-foreground transition-smooth group"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-accent group-hover:text-accent-foreground" />
              <span className="text-sm font-medium uppercase tracking-[0.2em] text-foreground group-hover:text-accent-foreground">
                {t("contact.whatsapp")}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.22em] text-accent group-hover:text-accent-foreground">→</span>
          </a>
        </div>

        <form onSubmit={onSubmit} className="p-8 rounded-sm bg-surface border border-border space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("contact.name")}</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-background border-border focus-visible:ring-accent" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("contact.email")}</Label>
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-background border-border focus-visible:ring-accent" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("contact.message")}</Label>
            <Textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="bg-background border-border focus-visible:ring-accent" />
          </div>
          <Button type="submit" disabled={submitting} className="bg-accent text-accent-foreground hover:bg-accent/90 uppercase tracking-[0.2em] text-xs h-11 px-7 rounded-sm w-full sm:w-auto gap-2">
            <Send className="h-4 w-4" /> {t("contact.send")}
          </Button>
        </form>
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("contact.whatsapp")}
        className="fixed bottom-6 right-6 z-50 grid place-items-center w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-elegant hover:scale-105 transition-transform"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
};

export default Contact;
