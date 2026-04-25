import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-24 bg-background">
      <div className="container-page py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tracking-[0.18em] uppercase text-accent">Vision</span>
            <span className="text-lg font-light tracking-[0.18em] uppercase text-foreground">Scope</span>
          </div>
          <p className="mt-4 text-sm text-secondary max-w-sm leading-relaxed">{t("common.tagline")}</p>
        </div>
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.28em] text-accent mb-4">
            VisionScope
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/rental" className="text-foreground/80 hover:text-accent">{t("nav.rental")}</Link></li>
            <li><Link to="/store" className="text-foreground/80 hover:text-accent">{t("nav.store")}</Link></li>
            <li><Link to="/projects" className="text-foreground/80 hover:text-accent">{t("nav.projects")}</Link></li>
            <li><Link to="/contact" className="text-foreground/80 hover:text-accent">{t("nav.contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.28em] text-accent mb-4">
            {t("nav.admin")}
          </h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/admin/login" className="text-foreground/80 hover:text-accent">{t("nav.login")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-5 text-[11px] uppercase tracking-[0.22em] text-secondary flex flex-col md:flex-row justify-between gap-2">
          <span>© {year} VisionScope — All rights reserved.</span>
          <span>Crafted for filmmakers.</span>
        </div>
      </div>
    </footer>
  );
};
