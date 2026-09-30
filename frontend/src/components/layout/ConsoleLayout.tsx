import { useState, createContext, useContext, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  ShieldAlert,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  SlidersHorizontal,
  Warehouse,
  Truck,
  Package,
  FileText,
  Globe,
  ShieldCheck,
  Image as ImageIcon,
  Users,
  Building2,
  UserCheck,
  History,
  Database,
  Settings,
  Megaphone,
  Columns3,
  Clock,
  PhoneCall,
  BadgeDollarSign,
  Briefcase,
  CalendarCheck,
  CalendarRange,
  Receipt,
  BarChart3,
  Inbox,
  LifeBuoy,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { isStaff, useMe } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConsoleNavItem {
  to: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface ConsoleLayoutProps {
  area: string;
  title: string;
  allowedRoles: string[];
  nav: ConsoleNavItem[];
  children: ReactNode;
  headerActions?: ReactNode;
  hideHeader?: boolean;
}

export const ConsoleLayoutContext = createContext<{ openMobileDrawer: () => void }>({
  openMobileDrawer: () => {},
});

export const useConsoleLayout = () => useContext(ConsoleLayoutContext);

// Automatic icon mapping for Kotson back-office modules
function getNavIcon(to: string, label: string): React.ComponentType<{ className?: string }> {
  const path = to.toLowerCase();
  const l = label.toLowerCase();

  if (path === "/admin" || path === "/crm" || l === "dashboard") return LayoutDashboard;
  if (path.includes("sales") || l.includes("revenue")) return TrendingUp;
  if (path.includes("orders") || l.includes("orders")) return ShoppingBag;
  if (path.includes("custom-requests") || l.includes("custom")) return SlidersHorizontal;
  if (path.includes("stock-point") || l.includes("stock")) return Warehouse;
  if (path.includes("dispatch") || l.includes("dispatch")) return Truck;
  if (path.includes("catalog") || l.includes("catalog")) return Package;
  if (path.includes("blogs") || l.includes("blog")) return FileText;
  if (path.includes("website-edit") || path.includes("cms") || l.includes("website")) return Globe;
  if (path.includes("claims") || l.includes("claim")) return ShieldCheck;
  if (path.includes("assets") || l.includes("asset")) return ImageIcon;
  if (path.includes("referrals") || l.includes("refer")) return Users;
  if (path.includes("dealers") || l.includes("dealer")) return Building2;
  if (path.includes("staff") || l.includes("staff")) return UserCheck;
  if (path.includes("audit") || l.includes("audit")) return History;
  if (path.includes("test-data") || l.includes("test")) return Database;
  if (path.includes("settings") || l.includes("setting")) return Settings;

  // CRM routes
  if (path.includes("leads") || l.includes("lead")) return Users;
  if (path.includes("pipelines") || l.includes("pipeline")) return Columns3;
  if (path.includes("campaigns") || l.includes("campaign")) return Megaphone;
  if (path.includes("follow-ups") || l.includes("follow")) return Clock;
  if (path.includes("calls") || l.includes("call")) return PhoneCall;
  if (path.includes("customers") || l.includes("customer")) return UserCheck;
  if (path.includes("conversions") || l.includes("conversion")) return BadgeDollarSign;
  if (path.includes("team") || l.includes("team") || l.includes("employee")) return Briefcase;
  if (path.includes("attendance") || l.includes("attendance")) return CalendarCheck;
  if (path.includes("leave") || l.includes("leave")) return CalendarRange;
  if (path.includes("payroll") || l.includes("payroll")) return Receipt;
  if (path.includes("trends") || path.includes("reports") || l.includes("analytic")) return BarChart3;
  if (path.includes("intake") || l.includes("intake")) return Inbox;
  if (path.includes("cases") || l.includes("case")) return LifeBuoy;
  if (path.includes("dispositions") || l.includes("disposition")) return PhoneCall;

  return LayoutDashboard;
}

// Shared back-office shell: fixed sidebar application shell, role gate, session-safe sign-out.
export default function ConsoleLayout({
  area,
  title,
  allowedRoles,
  nav,
  children,
  headerActions,
  hideHeader,
}: ConsoleLayoutProps) {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Compute permitted safely (me may be null/undefined)
  const permitted = !!me && Array.isArray(me.roles) && me.roles.some((r) => allowedRoles.includes(r));

  // testDataStatus query must be declared before any conditional return to satisfy Rules of Hooks
  const { data: testDataStatus } = useQuery<{ is_seeded: boolean }>({
    queryKey: ["admin-test-data-status"],
    queryFn: () => apiGet<{ is_seeded: boolean }>("/admin/test-data/status"),
    enabled: !isLoading && permitted,
    staleTime: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] text-sm text-muted-foreground">
        Loading console workspace…
      </div>
    );
  }

  // me is undefined transiently during session refresh — hold loading state
  // until we have a definitive resolved value (null = not authenticated, object = user)
  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] text-sm text-muted-foreground">
        Verifying session…
      </div>
    );
  }

  if (!permitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center bg-[#F7F4EE]">
        <ShieldAlert className="h-10 w-10 text-brand-deep" />
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {isStaff(me) ? "No access to this area" : "Staff sign-in required"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {area} is restricted to: {allowedRoles.join(", ")}.
        </p>
        <Link to="/login" className={buttonVariants({ size: "lg" })} data-testid="console-login-link">
          Sign in
        </Link>
      </div>
    );
  }

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiPost("/auth/logout");
    } finally {
      qc.clear(); // wipe cached data so no account's data survives the session
      navigate("/login");
    }
  };

  const primaryRole = me?.roles.includes("owner")
    ? "Owner Admin"
    : me?.roles.includes("crm_master")
    ? "CRM Master"
    : me?.roles.includes("crm_employee")
    ? "CRM Executive"
    : me?.roles.includes("admin")
    ? "Administrator"
    : me?.roles.includes("manager")
    ? "Operations Mgr"
    : "Staff";

  return (
    <ConsoleLayoutContext.Provider value={{ openMobileDrawer: () => setMobileDrawerOpen(true) }}>
      <div className="flex min-h-screen md:h-screen md:h-[100dvh] md:overflow-hidden bg-[#F7F4EE] w-full font-sans antialiased text-[#2D2D2D]">
      {/* ── Desktop Fixed Sidebar (Deep Forest #11291F, 3 Regions) ── */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:shrink-0 md:h-screen md:h-[100dvh] bg-[#11291F] text-[#FAF8F5] border-r border-[#1D3528] shadow-xl z-20 transition-all duration-200 select-none",
          sidebarCollapsed ? "md:w-20" : "md:w-64"
        )}
        aria-label={`${area} Desktop Sidebar`}
      >
        {/* Region 1: BRAND / ROLE HEADER — FIXED WITHIN SIDEBAR */}
        <div className="shrink-0 px-4 pt-5 pb-4 border-b border-[#1D3528]/80 flex items-center justify-between">
          {!sidebarCollapsed ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-white">
                  KOTSON
                </span>
                <span className="rounded-md bg-[#7C9C59]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9EC379] border border-[#7C9C59]/30">
                  Naturals
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A2B8AA]">
                  {area}
                </span>
                <span className="h-1 w-1 rounded-full bg-[#7C9C59]" />
                <span className="text-[9px] font-semibold text-[#809B88]">
                  {primaryRole}
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex flex-col items-center">
              <span className="font-display text-lg font-black text-white">K</span>
              <span className="text-[8px] font-bold text-[#7C9C59]">NAT</span>
            </div>
          )}

          {/* Tablet/Desktop Sidebar Collapse Toggle */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[#8DA695] hover:text-white hover:bg-[#1A372A] transition-colors focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:outline-none"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Region 2: NAVIGATION ITEMS — INDEPENDENTLY SCROLLABLE */}
        <nav
          className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 flex flex-col gap-1 console-nav-scroll"
          aria-label={`${area} navigation`}
        >
          {nav.map((n) => {
            const Icon = n.icon || getNavIcon(n.to, n.label);
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end
                title={sidebarCollapsed ? n.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:outline-none",
                    sidebarCollapsed ? "justify-center px-2" : "justify-between",
                    isActive
                      ? "bg-[#1E3A2C] text-white font-semibold shadow-xs border-l-3 border-[#7C9C59] pl-2.5"
                      : "text-[#D3DFD5]/80 hover:text-white hover:bg-[#183125]"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-[#7C9C59]" : "text-[#8FA697]"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{n.label}</span>
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {n.badge && (
                          <span className="rounded-full bg-[#1A3326] px-1.5 py-0.2 text-[10px] font-bold text-[#A2C29A] border border-[#2D4D3A]">
                            {n.badge}
                          </span>
                        )}
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#7C9C59] shrink-0" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Region 3: ACCOUNT & SIGN OUT FOOTER — FIXED WITHIN SIDEBAR */}
        <div className="shrink-0 border-t border-[#1D3528] p-3 bg-[#0D2118]">
          {!sidebarCollapsed ? (
            <>
              <div className="rounded-xl bg-[#162E22] p-2.5 border border-[#244233]">
                <p className="truncate text-xs font-semibold text-white">
                  {me?.name || me?.email}
                </p>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-[#9CB3A3]">
                  <span className="truncate">{me?.email}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start text-[#D3DFD5]/80 hover:text-white hover:bg-[#1B3527] text-xs h-8.5 rounded-xl focus-visible:ring-2 focus-visible:ring-brand-leaf"
                onClick={signOut}
                disabled={signingOut}
                data-testid="console-signout-button"
              >
                <LogOut className="mr-2 h-3.5 w-3.5 text-[#7C9C59]" /> Sign out
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="h-8 w-8 rounded-full bg-[#162E22] flex items-center justify-center text-xs font-bold text-white border border-[#244233]"
                title={`${me?.name || me?.email} (${me?.email})`}
              >
                {(me?.name || me?.email || "U")[0].toUpperCase()}
              </div>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                title="Sign out"
                className="p-2 rounded-xl text-[#8DA695] hover:text-white hover:bg-[#1B3527] transition-colors focus-visible:ring-2 focus-visible:ring-brand-leaf focus-visible:outline-none"
                data-testid="console-signout-button-collapsed"
              >
                <LogOut className="h-4 w-4 text-[#7C9C59]" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile Sidebar Drawer with Backdrop ──────────────────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative flex flex-col w-72 max-w-[85vw] h-full bg-[#11291F] text-[#FAF8F5] shadow-2xl z-10 border-r border-[#1D3528]">
            {/* Drawer Header */}
            <div className="shrink-0 flex items-center justify-between px-5 pt-6 pb-5 border-b border-[#1D3528]/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl font-bold tracking-tight text-white">
                    KOTSON
                  </span>
                  <span className="rounded-md bg-[#7C9C59]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#9EC379] border border-[#7C9C59]/30">
                    Naturals
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#A2B8AA]">
                  {area} Console
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-lg p-1.5 text-[#A2B8AA] hover:bg-[#1A372A] hover:text-white transition-colors"
                aria-label="Close mobile menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation List */}
            <nav
              className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-1 console-nav-scroll"
              aria-label={`${area} mobile drawer navigation`}
            >
              {nav.map((n) => {
                const Icon = n.icon || getNavIcon(n.to, n.label);
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-all flex items-center justify-between",
                        isActive
                          ? "bg-[#1E3A2C] text-white font-semibold shadow-xs border-l-3 border-[#7C9C59] pl-2.5"
                          : "text-[#D3DFD5]/80 hover:text-white hover:bg-[#183125]"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-[#7C9C59]" : "text-[#8FA697]"
                            )}
                          />
                          <span>{n.label}</span>
                        </div>
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#7C9C59] shrink-0" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="shrink-0 border-t border-[#1D3528] p-4 bg-[#0D2118]">
              <div className="rounded-xl bg-[#162E22] p-2.5 border border-[#244233]">
                <p className="truncate text-xs font-medium text-white">{me?.name || me?.email}</p>
                <p className="truncate text-[11px] text-[#A2B8AA]">{me?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start text-[#D3DFD5]/80 hover:text-white hover:bg-[#1B3527] text-xs h-9 rounded-xl"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  signOut();
                }}
                disabled={signingOut}
                data-testid="console-drawer-signout-button"
              >
                <LogOut className="mr-2 h-3.5 w-3.5 text-[#7C9C59]" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area with Warm Ivory Canvas (Independently Scrollable) ── */}
      <main className="flex-1 min-w-0 md:h-screen md:h-[100dvh] md:overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 bg-[#F7F4EE]">
        {/* Top Header Bar */}
        {!hideHeader && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E0D5] pb-3.5">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Trigger Button */}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="md:hidden flex items-center justify-center p-2 rounded-xl border border-[#E6E0D5] bg-card text-[#2D2D2D] hover:bg-muted transition-colors"
                aria-label="Open navigation menu"
                data-testid="console-mobile-menu-trigger"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-[#16241C]">
                    {title}
                  </h1>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Kotson Mattresses Executive & Operations Center
                  </p>
                </div>
                {testDataStatus?.is_seeded && (
                  <div
                    className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-800 border border-emerald-300 shadow-xs"
                    data-testid="test-data-active-pill"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>TEST DATA ACTIVE</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {headerActions}
              <Button
                variant="outline"
                size="sm"
                className="md:hidden border-[#E6E0D5]"
                onClick={signOut}
                data-testid="console-signout-button-mobile"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        )}

        {/* Mobile Horizontal Navigation Tabs (Preserved for quick thumb-switching) */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 md:hidden console-nav-scroll" aria-label={`${area} navigation mobile`}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xs shrink-0 transition-all",
                  isActive
                    ? "border-[#11291F] bg-[#11291F] text-white"
                    : "border-[#E6E0D5] bg-card text-foreground/80 hover:bg-muted"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>

        {children}
      </main>
    </div>
  </ConsoleLayoutContext.Provider>
  );
}

// Export AdminShell as alias so components can import { AdminShell } or { ConsoleLayout }
export { ConsoleLayout as AdminShell };
