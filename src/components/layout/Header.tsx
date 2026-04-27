import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

export const Header = () => {
  const { t } = useTranslation();
  const { items } = useCart();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Transparent on top of hero (only on home), solid black on scroll
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { to: "/", label: t("nav.home"), end: true },
    { to: "/rental", label: t("nav.rental") },
    { to: "/projects", label: t("nav.projects") },
    { to: "/contact", label: t("nav.contact") },
  ];

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const transparent = isHome && !scrolled && !open;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        transparent
          ? "bg-transparent border-b border-transparent"
          : "bg-background/95 backdrop-blur-md border-b border-border"
      )}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <Link
          to="/"
          className="flex items-baseline gap-1.5 font-display"
          onClick={() => setOpen(false)}
        >
          <span className="text-lg font-semibold tracking-[0.18em] uppercase text-accent">
            Vision
          </span>
          <span className="text-lg font-light tracking-[0.18em] uppercase text-foreground">
            Scope
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "text-xs uppercase tracking-[0.22em] font-medium transition-colors hover:text-accent",
                  isActive ? "text-accent" : "text-foreground/80"
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
            <Button variant="outline" size="sm" className="relative gap-2 border-accent/40 text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent uppercase tracking-[0.18em] text-[11px]">
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
          className="md:hidden p-2 -mr-2 text-foreground"
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
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "text-sm uppercase tracking-[0.2em] py-1.5",
                    isActive ? "text-accent font-medium" : "text-foreground/80"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="pt-2 flex items-center justify-between">
              <LanguageSwitcher />
              <Link to="/cart" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="gap-2 border-accent/40 hover:bg-accent hover:text-accent-foreground uppercase tracking-[0.18em] text-[11px]">
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
