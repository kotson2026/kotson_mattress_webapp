import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
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
import Account from "@/pages/Account";
import About from "@/pages/About";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Policy from "@/pages/Policy";
import RefLanding from "@/pages/RefLanding";
import NotFound from "@/pages/NotFound";
import AdminConsole from "@/pages/admin/AdminConsole";
import ManagerConsole from "@/pages/manager/ManagerConsole";
import CRMConsole from "@/pages/crm/CRMConsole";
import OpsConsole from "@/pages/ops/OpsConsole";
import DealerConsole from "@/pages/dealer/DealerConsole";
import RoleGuard from "@/components/auth/RoleGuard";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:category" element={<CollectionCategory />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order/confirmation/:id" element={<OrderConfirmation />} />
        <Route path="/track-order" element={<TrackOrder />} />
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/policies/:slug" element={<Policy />} />
        <Route path="/r/:code" element={<RefLanding />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="bottom-right" />
    </>
  );
}
