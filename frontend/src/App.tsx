import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { CheckoutDrawerProvider } from "@/components/checkout/CheckoutDrawer";
import Home from "@/pages/Home";
import Collections from "@/pages/Collections";
import CollectionCategory from "@/pages/CollectionCategory";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import TrackOrder from "@/pages/TrackOrder";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Account from "@/pages/Account";
import About from "@/pages/About";
import SleepScience from "@/pages/SleepScience";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Policy from "@/pages/Policy";
import RefLanding from "@/pages/RefLanding";
import BlogList from "@/pages/BlogList";
import BlogDetail from "@/pages/BlogDetail";
import NotFound from "@/pages/NotFound";
import CustomizableProductsLanding from "@/pages/CustomizableProductsLanding";
import CustomizerWorkspace from "@/pages/CustomizerWorkspace";
import AdminConsole from "@/pages/admin/AdminConsole";
import ManagerConsole from "@/pages/manager/ManagerConsole";
import CRMConsole from "@/pages/crm/CRMConsole";
import DealerConsole from "@/pages/dealer/DealerConsole";
import StockPointManagerConsole from "@/pages/stock_point/StockPointManagerConsole";
import RoleGuard from "@/components/auth/RoleGuard";
import KotsonChatbot from "@/components/chat/KotsonChatbot";
import StoresRedesignGallery from "@/pages/preview/StoresRedesignGallery";
import CustomerTestimonials from "@/components/home/CustomerTestimonials";
import { apiPost } from "@/lib/api";

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

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <CheckoutDrawerProvider>
      <ReferralTracker />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:category" element={<CollectionCategory />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
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
      <KotsonChatbot />
      <Toaster position="bottom-right" />
    </CheckoutDrawerProvider>
  );
}
