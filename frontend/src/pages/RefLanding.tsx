import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiPost } from "@/lib/api";

const REF_KEY = "kotson_ref";

// Referral landing: records consent-aware click attribution, persists the code for
// browse → cart → checkout/signup, then redirects to the correct public page.
export default function RefLanding() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const to = params.get("to") ?? "/";

  useEffect(() => {
    const run = async () => {
      const upper = (code ?? "").toUpperCase();
      if (upper) {
        sessionStorage.setItem(REF_KEY, upper);
        try {
          await apiPost("/referrals/click", { code: upper, path: to });
          await apiPost("/cart/referral", { code: upper }); // persists through guest browse/cart
        } catch {
          // attribution is best-effort; never block the shopper
        }
      }
      navigate(to.startsWith("/") ? to : "/", { replace: true });
    };
    void run();
  }, [code, to, navigate]);

  return (
    <div className="flex min-h-svh items-center justify-center px-6 text-center" data-testid="ref-landing">
      <div>
        <p className="font-heading text-xl font-bold">Taking you to Kotson Mattress…</p>
        <p className="mt-2 text-sm text-muted-foreground">Referral code {code?.toUpperCase()} recorded.</p>
      </div>
    </div>
  );
}
