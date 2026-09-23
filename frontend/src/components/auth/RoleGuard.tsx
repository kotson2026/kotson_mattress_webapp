import type { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useMe } from "@/lib/session";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles?: string[];
  fallbackPath?: string;
}

export default function RoleGuard({
  children,
  allowedRoles = [],
  fallbackPath = "/account",
}: RoleGuardProps) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!me) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (allowedRoles.length > 0) {
    const userRoles = me.roles || [];
    // Owner and Admin have omnipotent access across administrative consoles
    const isSuperAdmin = userRoles.includes("owner") || userRoles.includes("admin");
    const hasPermission = isSuperAdmin || allowedRoles.some((r) => userRoles.includes(r));

    if (!hasPermission) {
      return (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold">Access Restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({me.email}) does not have permission to view this section.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to={fallbackPath} className={buttonVariants({ variant: "outline" })}>
              Return to Account
            </Link>
            <Link to="/" className={buttonVariants()}>
              Homepage
            </Link>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
