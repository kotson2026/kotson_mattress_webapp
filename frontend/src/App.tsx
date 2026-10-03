import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { CheckoutDrawerProvider } from "@/components/checkout/CheckoutDrawer";
import Home from "@/pages/Home";
import Collections from "@/pages/Collections";
import CollectionCategory from "@/pages/CollectionCategory";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/NotFound";
import RoleGuard from "@/components/auth/RoleGuard";
import KotsonChatbot from "@/components/chat/KotsonChatbot";
import CustomerTestimonials from "@/components/home/CustomerTestimonials";
import { apiPost } from "@/lib/api";

// Lazy-loaded secondary pages and administrative, CRM, dealer consoles to keep initial storefront bundle ultra-fast
const Account = lazy(() => import("@/pages/Account"));
const CustomizableProductsLanding = lazy(() => import("@/pages/CustomizableProductsLanding"));
const About = lazy(() => import("@/pages/About"));
const SleepScience = lazy(() => import("@/pages/SleepScience"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Contact = lazy(() => import("@/pages/Contact"));
const Policy = lazy(() => import("@/pages/Policy"));
const BlogList = lazy(() => import("@/pages/BlogList"));
const BlogDetail = lazy(() => import("@/pages/BlogDetail"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));
const RefLanding = lazy(() => import("@/pages/RefLanding"));
const AdminConsole = lazy(() => import("@/pages/admin/AdminConsole"));
const ManagerConsole = lazy(() => import("@/pages/manager/ManagerConsole"));
const CRMConsole = lazy(() => import("@/pages/crm/CRMConsole"));
const DealerConsole = lazy(() => import("@/pages/dealer/DealerConsole"));
const StockPointManagerConsole = lazy(() => import("@/pages/stock_point/StockPointManagerConsole"));
const CustomizerWorkspace = lazy(() => import("@/pages/CustomizerWorkspace"));
const StoresRedesignGallery = lazy(() => import("@/pages/preview/StoresRedesignGallery"));

function ConsoleLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1B365D] border-t-transparent" />
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Loading Workspace...</p>
    </div>
  );
}

function ReferralTracker() {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const refParam = searchParams.get("ref") || searchParams.get("referral");
    if (refParam) {
      const cleanRef = refParam.trim().toUpperCase();
      try {
        localStorage.setItem("kotson_ref", cleanRef);
        sessionStorage.setItem("kotson_ref", cleanRef);
        localStorage.setItem("kotson_referral_code", cleanRef);
        sessionStorage.setItem("kotson_referral_code", cleanRef);
      } catch (e) {
        // Storage access may be restricted
      }
      // Record referral attribution touch and link to cart session
      apiPost("/referrals/click", { code: cleanRef, path: location.pathname }).catch(() => {});
      apiPost("/cart/referral", { code: cleanRef }).catch(() => {});
    }
  }, [location.search, location.pathname]);

  return null;
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace("#", "");
      const scrollToElement = () => {
        const el = document.getElementById(targetId);
        if (el) {
          const isHeadless = typeof navigator !== "undefined" && navigator.userAgent.includes("Headless");
          el.scrollIntoView({ behavior: isHeadless ? "auto" : "smooth" });
          return true;
        }
        return false;
      };

      if (!scrollToElement()) {
        const t1 = setTimeout(scrollToElement, 100);
        const t2 = setTimeout(scrollToElement, 300);
        const t3 = setTimeout(scrollToElement, 600);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
        };
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  return null;
}

import { trackPageAttribution, syncCustomerAttribution } from "@/lib/attribution";

function MarketingAttributionTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageAttribution();
  }, [location.search, location.pathname]);

  return null;
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <CheckoutDrawerProvider>
      <ReferralTracker />
      <MarketingAttributionTracker />
      <ScrollToTop />
      <Suspense fallback={<ConsoleLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Core Direct Category & Storefront Route Aliases (Step 8 Parity) */}
          <Route path="/mattresses" element={<Navigate to="/collections/mattresses" replace />} />
          <Route path="/pillows" element={<Navigate to="/collections/pillows" replace />} />
          <Route path="/toppers" element={<Navigate to="/collections/toppers" replace />} />
          <Route path="/baby-kids" element={<Navigate to="/collections/baby-kids" replace />} />
          <Route path="/signin" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route path="/orders" element={<Navigate to="/account?tab=orders" replace />} />

          <Route path="/collections" element={<Collections />} />
          <Route path="/collections/:category" element={<CollectionCategory />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/customizable-products" element={<CustomizableProductsLanding />} />
          <Route path="/customizable-products/:category" element={<CustomizableProductsLanding />} />
          <Route path="/customizable-products/customize/:slug" element={<CustomizerWorkspace />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/confirmation/:id" element={<OrderConfirmation />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/account" element={<Account />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/why-kotson" element={<Navigate to="/about" replace />} />
          <Route path="/sleep-science" element={<SleepScience />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blogs" element={<BlogList />} />
          <Route path="/blogs/:slug" element={<BlogDetail />} />
          <Route path="/policies/:slug" element={<Policy />} />
          <Route path="/r/:code" element={<RefLanding />} />
          <Route path="/referrals" element={<Navigate to="/account?tab=referrals" replace />} />
          <Route path="/internal/stores-preview" element={<StoresRedesignGallery />} />
          <Route path="/internal/testimonials-preview" element={<CustomerTestimonials />} />
          <Route
            path="/admin/*"
            element={
              <RoleGuard allowedRoles={["owner", "admin", "crm_master"]}>
                <AdminConsole />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/*"
            element={
              <RoleGuard allowedRoles={["owner", "admin", "manager"]}>
                <ManagerConsole />
              </RoleGuard>
            }
          />
          <Route
            path="/crm/*"
            element={
              <RoleGuard allowedRoles={["owner", "admin", "crm_master", "crm_manager", "crm_employee"]}>
                <CRMConsole />
              </RoleGuard>
            }
          />
          <Route
            path="/ops/*"
            element={<Navigate to="/admin/dispatch" replace />}
          />
          <Route
            path="/dealer/*"
            element={
              <RoleGuard allowedRoles={["owner", "admin", "dealer"]}>
                <DealerConsole />
              </RoleGuard>
            }
          />
          <Route
            path="/stock-point/*"
            element={
              <RoleGuard allowedRoles={["owner", "admin", "stock_point_manager"]}>
                <StockPointManagerConsole />
              </RoleGuard>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <KotsonChatbot />
      <Toaster position="bottom-right" />
    </CheckoutDrawerProvider>
  );
}
