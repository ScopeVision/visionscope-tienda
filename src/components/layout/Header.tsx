import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

export const Header = () => {
  const { t } = useTranslation();
  const { items } = useCart();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/catalog", label: t("nav.catalog") },
    { to: "/blog", label: t("nav.blog") },
    { to: "/contact", label: t("nav.contact") },
  ];

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display" onClick={() => setOpen(false)}>
          <span className="text-lg font-semibold tracking-tight">Lillo</span>
          <span className="text-sm text-secondary uppercase tracking-[0.2em]">Rentals</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  "text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-secondary"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/cart">
            <Button variant="outline" size="sm" className="relative gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span>{t("nav.cart")}</span>
              {itemCount > 0 && (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-foreground">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>
        </div>

        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container-page py-4 flex flex-col gap-3">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "text-base py-1.5",
                    isActive ? "text-foreground font-medium" : "text-secondary"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="pt-2 flex items-center justify-between">
              <LanguageSwitcher />
              <Link to="/cart" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {t("nav.cart")} {itemCount > 0 && `(${itemCount})`}
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
