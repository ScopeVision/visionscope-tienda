import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-24 bg-background">
      <div className="container-page py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-display text-lg font-semibold tracking-tight">Lillo Rentals</div>
          <p className="mt-3 text-sm text-secondary max-w-sm">{t("common.tagline")}</p>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-secondary mb-3">
            {t("nav.catalog")}
          </h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/catalog" className="hover:text-accent">{t("nav.catalog")}</Link></li>
            <li><Link to="/blog" className="hover:text-accent">{t("nav.blog")}</Link></li>
            <li><Link to="/contact" className="hover:text-accent">{t("nav.contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-secondary mb-3">
            {t("nav.admin")}
          </h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/admin/login" className="hover:text-accent">{t("nav.login")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-5 text-xs text-secondary flex flex-col md:flex-row justify-between gap-2">
          <span>© {year} Lillo Rentals. All rights reserved.</span>
          <span>Crafted for filmmakers.</span>
        </div>
      </div>
    </footer>
  );
};
