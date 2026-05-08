import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { LogOut, Package, Tag, FolderTree, Users, ClipboardList, FileText, Home, Image, Film, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const AdminLayout = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) return <div className="p-10 text-secondary">{t("common.loading")}</div>;
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />;

  const items = [
    { to: "/admin", label: t("admin.dashboard"), icon: Home, end: true },
    { to: "/admin/bookings", label: t("admin.bookings"), icon: ClipboardList },
    { to: "/admin/hero", label: "Hero", icon: Image },
    { to: "/admin/site-projects", label: "Proyectos", icon: Film },
    { to: "/admin/products", label: t("admin.products.label"), icon: Package },
    { to: "/admin/store-products", label: "Super Store", icon: Store },
    { to: "/admin/categories", label: t("admin.categories"), icon: FolderTree },
    { to: "/admin/tags", label: t("admin.tags"), icon: Tag },
    { to: "/admin/customers", label: t("admin.customers"), icon: Users },
    { to: "/admin/blog", label: t("admin.blog"), icon: FileText },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="font-display font-semibold tracking-tight">Admin Tienda</div>
          <div className="text-xs text-secondary mt-0.5">{user.email}</div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent-soft text-foreground font-medium"
                    : "text-secondary hover:bg-muted hover:text-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 text-secondary">
            <LogOut className="h-4 w-4" /> {t("nav.logout")}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
