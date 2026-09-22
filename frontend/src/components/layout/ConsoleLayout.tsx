import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldAlert } from "lucide-react";
import { apiPost } from "@/lib/api";
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
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col bg-sidebar px-3 py-5 text-sidebar-foreground md:flex">
        <div className="px-3 pb-6">
          <p className="font-heading text-lg font-black tracking-tight">KOTSON</p>
          <p className="text-xs uppercase tracking-[0.25em] text-sidebar-foreground/60">{area}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label={`${area} navigation`}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "min-h-11 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4">
          <p className="truncate px-3 text-xs text-sidebar-foreground/60">{me?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground"
            onClick={signOut}
            disabled={signingOut}
            data-testid="console-signout-button"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={signOut} data-testid="console-signout-button-mobile">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:hidden" aria-label={`${area} navigation mobile`}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium",
                  isActive ? "border-brand-deep bg-brand-deep text-white" : "border-border text-foreground/70"
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
