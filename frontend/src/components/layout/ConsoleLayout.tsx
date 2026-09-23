import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { isStaff, useMe } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConsoleNavItem {
  to: string;
  label: string;
}

interface ConsoleLayoutProps {
  area: string;
  title: string;
  allowedRoles: string[];
  nav: ConsoleNavItem[];
  children: ReactNode;
}

// Shared back-office shell: dark sidebar, role gate, session-safe sign-out.
export default function ConsoleLayout({ area, title, allowedRoles, nav, children }: ConsoleLayoutProps) {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  if (isLoading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  const permitted = !!me && me.roles.some((r) => allowedRoles.includes(r));

  const { data: testDataStatus } = useQuery<{ is_seeded: boolean }>({
    queryKey: ["admin-test-data-status"],
    queryFn: () => apiGet<{ is_seeded: boolean }>("/admin/test-data/status"),
    enabled: permitted,
    staleTime: 15000,
  });

  if (!permitted) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-brand-deep" />
        <h1 className="font-heading text-2xl font-bold">{isStaff(me) ? "No access to this area" : "Staff sign-in required"}</h1>
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

  return (
    <div className="flex min-h-svh bg-[#FAF8F5]">
      {/* Brand Sidebar (Botanical Organic Deep Forest) */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col bg-[#16241C] px-3.5 py-6 text-[#FAF8F5] border-r border-[#24372B] md:flex shadow-xl z-20">
        <div className="px-3 pb-6 border-b border-[#24372B]/70">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-white">
              KOTSON
            </span>
            <span className="rounded-md bg-brand-leaf/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-leaf border border-brand-leaf/30">
              Naturals
            </span>
          </div>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#A6B8AA]">
            {area} Console
          </p>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto pr-1" aria-label={`${area} navigation`}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                cn(
                  "min-h-10 rounded-xl px-3.5 py-2 text-xs font-medium transition-all flex items-center justify-between",
                  isActive
                    ? "bg-[#25382B] text-white font-semibold shadow-xs border-l-3 border-brand-leaf pl-3"
                    : "text-[#D3DFD5]/80 hover:text-white hover:bg-[#1E3024]"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span>{n.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand-leaf" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-[#24372B] pt-4">
          <div className="rounded-xl bg-[#1D2E23] p-2.5">
            <p className="truncate text-xs font-medium text-white">{me?.name || me?.email}</p>
            <p className="truncate text-[11px] text-[#A6B8AA]">{me?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-[#D3DFD5]/80 hover:text-white hover:bg-[#203227] text-xs h-9 rounded-xl"
            onClick={signOut}
            disabled={signingOut}
            data-testid="console-signout-button"
          >
            <LogOut className="mr-2 h-3.5 w-3.5 text-brand-leaf" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area with Warm Sand Canvas */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 bg-[#FAF8F5]">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#E6E0D5] pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="font-heading text-2xl font-black tracking-tight text-brand-charcoal">{title}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Kotson Mattresses Executive & Operations Center</p>
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
          <Button variant="outline" size="sm" className="md:hidden border-[#E6E0D5]" onClick={signOut} data-testid="console-signout-button-mobile">
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 md:hidden" aria-label={`${area} navigation mobile`}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-xs",
                  isActive
                    ? "border-brand-deep bg-brand-deep text-white"
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
  );
}
