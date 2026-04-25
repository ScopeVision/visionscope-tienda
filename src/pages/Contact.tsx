import { useTranslation } from "react-i18next";
import { Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {
  const { t } = useTranslation();
  return (
    <div className="container-page py-16 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-display font-medium tracking-tight">{t("nav.contact")}</h1>
      <p className="text-secondary mt-3">{t("common.tagline")}</p>
      <div className="mt-10 grid sm:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-surface border border-border">
          <Mail className="h-5 w-5 text-accent mb-3" />
          <div className="text-xs uppercase tracking-wider text-secondary">Email</div>
          <a href="mailto:hola@lillorentals.com" className="font-medium hover:text-accent">hola@lillorentals.com</a>
        </div>
        <div className="p-5 rounded-xl bg-surface border border-border">
          <Phone className="h-5 w-5 text-accent mb-3" />
          <div className="text-xs uppercase tracking-wider text-secondary">{t("common.phone")}</div>
          <a href="tel:+34000000000" className="font-medium hover:text-accent">+34 000 000 000</a>
        </div>
        <div className="p-5 rounded-xl bg-surface border border-border">
          <MapPin className="h-5 w-5 text-accent mb-3" />
          <div className="text-xs uppercase tracking-wider text-secondary">{t("common.address")}</div>
          <div className="font-medium">Barcelona</div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
