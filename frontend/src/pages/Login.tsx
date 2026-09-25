import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { login } from "@/lib/session";
import LogoMark from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (out) => {
      qc.clear();
      if (out.guest_cart_merged > 0) toast.success(`Signed in — ${out.guest_cart_merged} cart item(s) merged`);
      else toast.success("Signed in");
      const roles = out.user.roles;
      if (roles.includes("owner") || roles.includes("admin")) navigate("/admin");
      else if (roles.includes("manager")) navigate("/manager");
      else if (roles.some((r) => r.startsWith("crm"))) navigate("/crm");
      else navigate("/account");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sign in failed"),
  });

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-deep p-12 text-white lg:flex">
        <LogoMark light />
        <div>
          <h2 className="font-heading text-4xl font-black leading-tight">Organic latex, made in India.</h2>
          <p className="mt-4 max-w-sm text-white/75">
            Sign in to see your orders, addresses and your Refer &amp; Earn link.
          </p>
        </div>
        <p className="text-xs text-white/50">KOTSON NATURALS PRIVATE LIMITED</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="lg:hidden"><LogoMark /></Link>
          <h1 className="mt-6 font-heading text-3xl font-black tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Customers and staff use the same sign-in.</p>

          <form
            className="mt-8 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1.5 min-h-11" data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="mt-1.5 min-h-11" data-testid="login-password-input" />
            </div>
            <Button type="submit" size="lg" className="min-h-12 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold" disabled={mutation.isPending} data-testid="login-form-submit-button">
              {mutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* Quick-Fill Demo Credentials Helper */}
          <div className="mt-8 rounded-2xl border border-[#7C9C59]/30 bg-[#7C9C59]/5 p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#467065] block">
              Quick-Fill Test Credentials:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("crm@kotsonmattress.com");
                  setPassword("Kotson-CRM-2026!");
                }}
                className="h-8 text-[11px] border-border/80 hover:border-[#7C9C59] hover:bg-white"
              >
                CRM Master Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("crm.employee@kotsonmattress.com");
                  setPassword("Kotson-CRMEmp-2026!");
                }}
                className="h-8 text-[11px] border-border/80 hover:border-[#7C9C59] hover:bg-white"
              >
                CRM Employee
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("hello@kotsonmattress.com");
                  setPassword("Kotson-Owner-2026!");
                }}
                className="h-8 text-[11px] border-border/80 hover:border-[#7C9C59] hover:bg-white"
              >
                Owner Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail("manager@kotsonmattress.com");
                  setPassword("Kotson-Manager-2026!");
                }}
                className="h-8 text-[11px] border-border/80 hover:border-[#7C9C59] hover:bg-white"
              >
                Ops Manager
              </Button>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/register" className="font-medium text-brand-deep underline" data-testid="login-register-link">
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Password reset by email is pending a mail provider — ask the owner to reset staff credentials meanwhile.
          </p>
        </div>
      </div>
    </div>
  );
}
