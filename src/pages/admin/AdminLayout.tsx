import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Package,
  Tag,
  FolderTree,
  Users,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Image as ImageIcon,
  Film,
  Store,
  Settings,
  Mail,
  Plug,
  BadgePercent,
  Home as HomeIcon,
  Star,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  disabled?: boolean;
};

type Module = {
  key: string;
  label: string;
  items: Item[];
};

const AdminLayout = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) return <div className="p-10 text-secondary">{t("common.loading")}</div>;
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />;

  const modules: Module[] = [
    {
      key: "rental",
      label: "Rental",
      items: [
        { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/admin/bookings", label: "Orders", icon: ClipboardList },
        { to: "/admin/products", label: "Products", icon: Package },
        { to: "/admin/categories", label: "Categories", icon: FolderTree },
        { to: "/admin/tags", label: "Tags", icon: Tag },
        { to: "/admin/customers", label: "Customers", icon: Users },
      ],
    },
    {
      key: "store",
      label: "Super Store",
      items: [
        { to: "/admin/store-products", label: "Products", icon: Store },
        { to: "/admin/store-categories", label: "Categories", icon: FolderTree },
        { to: "/admin/store-tags", label: "Tags", icon: Tag },
      ],
    },
    {
      key: "cms",
      label: "CMS",
      items: [
        { to: "/admin/hero", label: "Hero", icon: ImageIcon },
        { to: "/admin/site-projects", label: "Projects", icon: Film },
        { to: "/admin/blog", label: "Blog", icon: FileText },
      ],
    },
    {
      key: "system",
      label: "System",
      items: [
        { to: "/admin", label: "Settings", icon: Settings, end: true },
        { to: "#", label: "Emails (soon)", icon: Mail, disabled: true },
        { to: "#", label: "Integrations (soon)", icon: Plug, disabled: true },
        { to: "#", label: "Pricing rules (soon)", icon: BadgePercent, disabled: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="font-display font-semibold tracking-tight">Admin · VisionScope</div>
          <div className="text-xs text-secondary mt-0.5 truncate">{user.email}</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {modules.map((mod) => (
            <div key={mod.key}>
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.14em] text-secondary/70 font-medium">
                {mod.label}
              </div>
              <div className="space-y-0.5">
                {mod.items.map((it) =>
                  it.disabled ? (
                    <div
                      key={`${mod.key}-${it.label}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-secondary/40 cursor-not-allowed select-none"
                      title="Próximamente"
                    >
                      <it.icon className="h-4 w-4" />
                      {it.label}
                    </div>
                  ) : (
                    <NavLink
                      key={`${mod.key}-${it.to}-${it.label}`}
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
                  )
                )}
              </div>
            </div>
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
