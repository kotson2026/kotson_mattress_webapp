import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signup } from "@/lib/session";
import LogoMark from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REF_KEY = "kotson_ref";

export default function Register() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // A valid URL attribution prefills the code; the user may still override it manually
  // BEFORE confirming signup (after signup the referred-by relationship is immutable).
  useEffect(() => {
    const fromUrl = params.get("ref");
    const stored = sessionStorage.getItem(REF_KEY);
    const code = (fromUrl ?? stored ?? "").toUpperCase();
    if (code) {
      setRefCode(code);
      setPrefilled(true);
    }
  }, [params]);

  const mutation = useMutation({
    mutationFn: () => signup({ email, name, password, referral_code: refCode || null }),
    onSuccess: (out) => {
      qc.clear();
      sessionStorage.removeItem(REF_KEY);
      toast.success(out.guest_cart_merged > 0 ? `Account created — ${out.guest_cart_merged} cart item(s) merged` : "Account created");
      navigate("/account");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create account"),
  });

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-charcoal p-12 text-brand-sand lg:flex">
        <LogoMark light />
        <div>
          <h2 className="font-heading text-4xl font-black leading-tight">Every account gets a referral link.</h2>
          <p className="mt-4 max-w-sm text-brand-sand/70">
            Your unique code is minted the moment you sign up. Reward economics are published by the owner — nothing is promised until then.
          </p>
        </div>
        <p className="text-xs text-brand-sand/50">KOTSON NATURALS PRIVATE LIMITED</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="lg:hidden"><LogoMark /></Link>
          <h1 className="mt-6 font-heading text-3xl font-black tracking-tight">Create your account</h1>

          <form
            className="mt-8 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div>
              <Label htmlFor="reg-name">Full name</Label>
              <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} className="mt-1.5 min-h-11" data-testid="register-name-input" />
            </div>
            <div>
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="mt-1.5 min-h-11" data-testid="register-email-input" />
            </div>
            <div>
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="mt-1.5 min-h-11" data-testid="register-password-input" />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="reg-ref">Referral code (optional)</Label>
              <Input id="reg-ref" value={refCode} onChange={(e) => { setRefCode(e.target.value.toUpperCase()); setPrefilled(false); }} className="mt-1.5 min-h-11" data-testid="register-referral-input" />
              <p className="mt-1 text-xs text-muted-foreground" data-testid="register-referral-note">
                {prefilled
                  ? "Prefilled from the referral link you followed — you can replace it before creating the account."
                  : "A referral code records attribution only. Any benefit applies strictly per a published owner rule."}
              </p>
            </div>
            <Button type="submit" size="lg" className="min-h-12" disabled={mutation.isPending} data-testid="register-form-submit-button">
              {mutation.isPending ? "Creating…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand-deep underline" data-testid="register-login-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
