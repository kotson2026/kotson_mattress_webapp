import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { signup } from "@/lib/session";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // A valid URL attribution or stored session prefills the code
  useEffect(() => {
    const fromUrl = params.get("ref");
    const storedSession = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(REF_KEY) : null;
    const storedLocal = typeof localStorage !== "undefined" ? localStorage.getItem(REF_KEY) : null;
    const code = (fromUrl || storedSession || storedLocal || "").trim().toUpperCase();
    if (code) {
      setRefCode(code);
      setPrefilled(true);
    }
  }, [params]);

  const mutation = useMutation({
    mutationFn: () => signup({ email, name, phone: phone || null, password, referral_code: refCode || null }),
    onSuccess: (out) => {
      qc.clear();
      // Lead attribution is preserved; do NOT wipe stored referral attribution
      toast.success(out.guest_cart_merged > 0 ? `Account created — ${out.guest_cart_merged} cart item(s) merged` : "Account created");
      const redirect = params.get("redirect") || (out.guest_cart_merged > 0 ? "/cart" : "/account");
      navigate(redirect);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create account"),
  });


  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <AuthBrandPanel
        heading="Every account gets a referral link."
        subheading="Your unique code is minted the moment you sign up. Reward economics are published by the owner — nothing is promised until then."
      />

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="lg:hidden inline-block mb-3" aria-label="Kotson Home">
            <LogoMark className="w-[150px] sm:w-[170px]" />
          </Link>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-tight">Create your account</h1>

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
              <Label htmlFor="reg-phone">Phone number (optional)</Label>
              <Input id="reg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" className="mt-1.5 min-h-11" data-testid="register-phone-input" />
            </div>
            <div>
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className="mt-1.5 min-h-11" data-testid="register-password-input" />
              <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="reg-ref">Referral code (optional)</Label>
              <div className="relative mt-1.5">
                <Input
                  id="reg-ref"
                  value={refCode}
                  onChange={(e) => {
                    setRefCode(e.target.value.toUpperCase());
                    setPrefilled(false);
                  }}
                  placeholder="e.g. KOT-KRA123"
                  className="min-h-11 font-mono tracking-wider uppercase font-semibold text-slate-900"
                  data-testid="register-referral-input"
                />
              </div>
              {refCode ? (
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200"
                  data-testid="register-referral-applied-badge"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{prefilled ? "✓ Referral applied automatically" : "✓ Referral code applied"}</span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="register-referral-note">
                  Have a referral code? Enter it above to link your account to your referrer.
                </p>
              )}
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
