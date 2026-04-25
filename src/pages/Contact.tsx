import { useTranslation } from "react-i18next";
import { Mail, Phone, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const Contact = () => {
  const { t } = useTranslation();
  return (
    <div className="container-page py-20 max-w-5xl">
      <span className="cine-eyebrow">Get in touch</span>
      <h1 className="mt-3 text-4xl md:text-5xl font-display font-medium tracking-tight uppercase">
        {t("nav.contact")}
      </h1>
      <p className="text-secondary mt-3 max-w-xl">{t("common.tagline")}</p>

      <div className="mt-12 grid lg:grid-cols-[1fr_1.2fr] gap-10">
        {/* Info cards */}
        <div className="grid gap-4">
          <div className="p-6 rounded-sm bg-surface border border-border hover-glow transition-smooth">
            <Mail className="h-5 w-5 text-accent mb-4" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">Email</div>
            <a href="mailto:hello@visionscope.com" className="font-medium text-foreground hover:text-accent transition-colors">
              hello@visionscope.com
            </a>
          </div>
          <div className="p-6 rounded-sm bg-surface border border-border hover-glow transition-smooth">
            <Phone className="h-5 w-5 text-accent mb-4" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">{t("common.phone")}</div>
            <a href="tel:+34000000000" className="font-medium text-foreground hover:text-accent transition-colors">
              +34 000 000 000
            </a>
          </div>
          <div className="p-6 rounded-sm bg-surface border border-border hover-glow transition-smooth">
            <MapPin className="h-5 w-5 text-accent mb-4" />
            <div className="text-[10px] uppercase tracking-[0.28em] text-secondary">{t("common.address")}</div>
            <div className="font-medium text-foreground">Barcelona · Madrid</div>
          </div>
        </div>

        {/* Form */}
        <form
          className="p-8 rounded-sm bg-surface border border-border space-y-5"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("common.name")}</Label>
              <Input className="bg-background border-border focus-visible:ring-accent" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("common.email")}</Label>
              <Input type="email" className="bg-background border-border focus-visible:ring-accent" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("common.company")}</Label>
            <Input className="bg-background border-border focus-visible:ring-accent" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t("common.notes")}</Label>
            <Textarea rows={5} className="bg-background border-border focus-visible:ring-accent" />
          </div>
          <Button
            type="submit"
            className="bg-accent text-accent-foreground hover:bg-accent/90 uppercase tracking-[0.2em] text-xs h-11 px-7 rounded-sm w-full sm:w-auto"
          >
            {t("checkout.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Contact;
