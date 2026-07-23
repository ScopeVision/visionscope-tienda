import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Wallet,
  KanbanSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
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

const STORAGE_KEY = "admin:sidebar-collapsed";

const AdminLayout = () => {
  const { t } = useTranslation();
  const { user, isAdmin, loading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

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
      key: "finance",
      label: "Finance",
      items: [{ to: "/admin/finance", label: "Finanzas", icon: Wallet }],
    },
    {
      key: "operations",
      label: "Productividad",
      items: [{ to: "/admin/operations", label: "Operations Hub", icon: KanbanSquare }],
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

  const isCollapsed = !isMobile && collapsed;

  const SidebarInner = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "border-b border-border flex items-center gap-2",
          isCollapsed ? "p-3 justify-center" : "p-5 justify-between"
        )}
      >
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="font-display font-semibold tracking-tight truncate">Admin · VisionScope</div>
            <div className="text-xs text-secondary mt-0.5 truncate">{user.email}</div>
          </div>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-secondary hover:text-foreground"
            onClick={() => setCollapsed((c) => !c)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
      </div>
      <nav className={cn("flex-1 overflow-y-auto space-y-5", isCollapsed ? "p-2" : "p-3")}>
        {modules.map((mod) => (
          <div key={mod.key}>
            {!isCollapsed && (
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.14em] text-secondary/70 font-medium">
                {mod.label}
              </div>
            )}
            <div className="space-y-0.5">
              {mod.items.map((it) =>
                it.disabled ? (
                  <div
                    key={`${mod.key}-${it.label}`}
                    className={cn(
                      "flex items-center gap-3 rounded-md text-sm text-secondary/40 cursor-not-allowed select-none",
                      isCollapsed ? "justify-center p-2" : "px-3 py-2"
                    )}
                    title={isCollapsed ? it.label : "Próximamente"}
                  >
                    <it.icon className="h-4 w-4" />
                    {!isCollapsed && it.label}
                  </div>
                ) : (
                  <NavLink
                    key={`${mod.key}-${it.to}-${it.label}`}
                    to={it.to}
                    end={it.end}
                    onClick={onNavigate}
                    title={isCollapsed ? it.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-md text-sm transition-colors",
                        isCollapsed ? "justify-center p-2" : "px-3 py-2",
                        isActive
                          ? "bg-accent-soft text-foreground font-medium"
                          : "text-secondary hover:bg-muted hover:text-foreground"
                      )
                    }
                  >
                    <it.icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="truncate">{it.label}</span>}
                  </NavLink>
                )
              )}
            </div>
          </div>
        ))}
      </nav>
      <div className={cn("border-t border-border space-y-2", isCollapsed ? "p-2" : "p-3")}>
        {!isCollapsed && <LanguageSwitcher />}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className={cn("w-full text-secondary", isCollapsed ? "justify-center px-0" : "justify-start gap-2")}
          title={isCollapsed ? t("nav.logout") : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && t("nav.logout")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {isMobile ? (
        <>
          <header className="fixed top-0 inset-x-0 z-40 h-12 flex items-center gap-2 px-3 border-b border-border bg-surface">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-surface">
                <SidebarInner onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="font-display font-semibold tracking-tight text-sm">Admin · VisionScope</div>
          </header>
          <main className="flex-1 overflow-auto pt-12">
            <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
              <Outlet />
            </div>
          </main>
        </>
      ) : (
        <>
          <aside
            className={cn(
              "shrink-0 border-r border-border bg-surface transition-[width] duration-300 ease-in-out",
              isCollapsed ? "w-16" : "w-64"
            )}
          >
            <SidebarInner />
          </aside>
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1400px] mx-auto p-8">
              <Outlet />
            </div>
          </main>
        </>
      )}
    </div>
  );
};

export default AdminLayout;
