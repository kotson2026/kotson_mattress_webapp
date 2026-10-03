import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "@/lib/session";
import { restorePendingCartItem } from "@/lib/pendingCart";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import LogoMark from "@/components/layout/LogoMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feature-flagged test panel: strictly disabled in production builds; only accessible in DEV if explicitly set
  const enableQuickFill = import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_QUICK_FILL === "true";


  const mutation = useMutation({
    mutationFn: () => login(identifier.trim(), password),
    onSuccess: async (out) => {
      qc.clear();

      // Check and restore any pending product from logged-out Add to Cart
      const pendingRes = await restorePendingCartItem();
      if (pendingRes.restored) {
        toast.success(`Signed in — ${pendingRes.item?.product_name || "item"} added to your cart`);
        qc.invalidateQueries({ queryKey: ["cart"] });
        navigate("/cart");
        return;
      }

      if (out.guest_cart_merged > 0) {
        toast.success(`Signed in — ${out.guest_cart_merged} cart item(s) merged`);
      } else {
        toast.success("Signed in successfully");
      }

      const redirect = params.get("redirect");
      if (redirect) {
        navigate(redirect);
        return;
      }

      const roles = out.user.roles || [];
      if (roles.includes("owner") || roles.includes("admin")) {
        navigate("/admin");
      } else if (roles.includes("manager")) {
        navigate("/manager");
      } else if (roles.includes("stock_point_manager")) {
        navigate("/stock-point");
      } else if (roles.some((r) => r.startsWith("crm"))) {
        navigate("/crm");
      } else {
        navigate("/account");
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your email or phone number.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }
    mutation.mutate();
  };

  const handleQuickFill = (emailVal: string, passVal: string) => {
    setIdentifier(emailVal);
    setPassword(passVal);
    toast.info(`Filled test credentials for ${emailVal}`);
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-[#FBF9F5]">
      <AuthBrandPanel
        eyebrow="WELCOME BACK"
        heading="Better sleep starts naturally."
      />

      <div className="flex flex-col justify-center px-4 py-8 sm:px-8 md:px-12">
        <div className="mx-auto w-full max-w-[440px] bg-white sm:rounded-2xl p-6 sm:p-8 sm:shadow-sm sm:border sm:border-stone-200/80">
          <Link to="/" className="lg:hidden inline-block mb-4" aria-label="Kotson Home">
            <LogoMark className="w-[140px] sm:w-[160px]" />
          </Link>

          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Sign in
          </h1>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Email or Phone */}
            <div>
              <Label htmlFor="login-identifier" className="text-xs font-semibold text-neutral-800">
                Email or phone number <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="login-identifier"
                name="username"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your email or phone number"
                required
                autoComplete="username"
                className="mt-1.5 h-11 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                data-testid="login-identifier-input"
              />
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="login-password" className="text-xs font-semibold text-neutral-800">
                Password <span className="text-rose-500">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10 text-sm placeholder:text-neutral-400 placeholder:font-normal border-stone-200 focus-visible:ring-emerald-700"
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#7C9C59] hover:text-[#6c8a4c] hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 rounded-sm"
                  data-testid="login-forgot-password-link"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending}
              className="w-full h-11 mt-2 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold tracking-wide uppercase text-xs shadow-xs"
              data-testid="login-form-submit-button"
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                "SIGN IN"
              )}
            </Button>
          </form>

          {/* TESTING ONLY: Restrained Quick-Fill Test Credentials */}
          {enableQuickFill && (
            <div className="mt-6 pt-5 border-t border-stone-200/80">
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    TESTING ONLY
                  </span>
                  <span className="text-[11px] font-medium text-neutral-600">
                    Quick-Fill Test Credentials
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFill("crm@kotsonmattress.com", "Kotson-CRM-2026!")}
                    className="h-8 text-[11px] font-normal text-neutral-700 bg-white hover:bg-neutral-50 hover:border-stone-400 border-stone-200 justify-center"
                    data-testid="quick-fill-crm-master"
                  >
                    CRM Master Admin
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFill("crm.employee@kotsonmattress.com", "Kotson-CRMEmp-2026!")}
                    className="h-8 text-[11px] font-normal text-neutral-700 bg-white hover:bg-neutral-50 hover:border-stone-400 border-stone-200 justify-center"
                    data-testid="quick-fill-crm-employee"
                  >
                    CRM Employee
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFill("hello@kotsonmattress.com", "Kotson-Owner-2026!")}
                    className="h-8 text-[11px] font-normal text-neutral-700 bg-white hover:bg-neutral-50 hover:border-stone-400 border-stone-200 justify-center"
                    data-testid="quick-fill-owner-admin"
                  >
                    Owner Admin
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFill("manager@kotsonmattress.com", "Kotson-Manager-2026!")}
                    className="h-8 text-[11px] font-normal text-neutral-700 bg-white hover:bg-neutral-50 hover:border-stone-400 border-stone-200 justify-center"
                    data-testid="quick-fill-ops-manager"
                  >
                    Ops Manager
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFill("stock@kotsonmattress.com", "Kotson-Stock-2026!")}
                    className="h-8 text-[11px] font-normal text-neutral-700 bg-white hover:bg-neutral-50 hover:border-stone-400 border-stone-200 col-span-2 justify-center"
                    data-testid="quick-fill-stock-point"
                  >
                    Stock Point
                  </Button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-xs text-neutral-600">
            New here?{" "}
            <Link
              to="/register"
              className="font-semibold text-emerald-800 hover:text-emerald-950 underline ml-1"
              data-testid="login-register-link"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
