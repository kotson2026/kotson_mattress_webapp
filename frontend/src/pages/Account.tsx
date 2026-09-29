import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { Dealer, Order, ReferralMe } from "@/lib/types";
import { useMe } from "@/lib/session";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CustomerReferralPortal from "@/components/account/CustomerReferralPortal";
import AccountHeader from "@/components/account/AccountHeader";
import AccountNavigation, { type AccountTabId } from "@/components/account/AccountNavigation";
import OrdersPanel from "@/components/account/OrdersPanel";
import AddressesPanel from "@/components/account/AddressesPanel";

export default function Account() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as AccountTabId | null;
  const activeTab: AccountTabId =
    tabParam && ["orders", "addresses", "referrals", "dealer"].includes(tabParam)
      ? tabParam
      : "orders";

  const { data: me, isLoading: isLoadingMe } = useMe();

  const {
    data: orders,
    isLoading: isLoadingOrders,
    isError: isErrorOrders,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiGet<Order[]>("/orders"),
    enabled: !!me,
  });

  const { data: dealer } = useQuery({
    queryKey: ["dealer-me"],
    queryFn: () => apiGet<Dealer>("/dealer/me").catch(() => null),
    enabled: !!me,
    retry: false,
  });

  const signOut = useMutation({
    mutationFn: () => apiPost("/auth/logout"),
    onSettled: () => {
      qc.clear();
      navigate("/");
    },
  });

  const handleTabChange = (tab: AccountTabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "orders") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    });
  };

  if (isLoadingMe) {
    return (
      <div className="min-h-svh bg-[#FAFAF8]">
        <StorefrontHeader />
        <div className="mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8 pt-10 pb-16">
          <div className="h-44 animate-pulse rounded-[20px] bg-[#EAEFE8]" />
          <div className="mt-6 h-12 w-80 animate-pulse rounded-xl bg-[#EAEFE8]" />
          <div className="mt-6 h-80 animate-pulse rounded-[20px] bg-[#EAEFE8]" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-svh bg-[#FAFAF8]">
        <StorefrontHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
          <h1 className="font-heading text-3xl font-black text-[#2D2D2D]">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-[#666666]">
            Your orders, addresses and referral link live here.
          </p>
          <Link
            to="/login"
            className={buttonVariants({ size: "lg" }) + " mt-6 bg-[#467065] text-white hover:bg-[#3B5F56] rounded-xl"}
            data-testid="account-login-link"
          >
            Sign in
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[#FAFAF8] text-[#2D2D2D]">
      {/* Existing Global Storefront Navbar */}
      <StorefrontHeader />

      {/* Account Page Container: max-width ~1220px, responsive padding and rhythm */}
      <main className="mx-auto max-w-[1220px] px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 md:pt-11 pb-16 sm:pb-20">
        {/* Premium Account Header Card */}
        <AccountHeader
          user={me}
          onSignOut={() => signOut.mutate()}
          isSigningOut={signOut.isPending}
        />

        {/* Account Tabs Navigation */}
        <div className="mt-5 sm:mt-6">
          <AccountNavigation
            activeTab={activeTab}
            onChangeTab={handleTabChange}
            showDealerTab={Boolean(dealer || me.roles.includes("dealer"))}
          />
        </div>

        {/* Tab Content Panel */}
        <div className="mt-5 sm:mt-6">
          {activeTab === "orders" && (
            <div id="panel-orders" role="tabpanel" aria-labelledby="tab-orders">
              <OrdersPanel
                orders={orders}
                isLoading={isLoadingOrders}
                isError={isErrorOrders}
                onRetry={() => refetchOrders()}
              />
            </div>
          )}

          {activeTab === "addresses" && (
            <div id="panel-addresses" role="tabpanel" aria-labelledby="tab-addresses">
              <AddressesPanel orders={orders} />
            </div>
          )}

          {activeTab === "referrals" && (
            <div id="panel-referrals" role="tabpanel" aria-labelledby="tab-referrals">
              <CustomerReferralPortal />
            </div>
          )}

          {activeTab === "dealer" && (
            <div
              id="panel-dealer"
              role="tabpanel"
              aria-labelledby="tab-dealer"
              className="rounded-[20px] border border-[#E4E9E2] bg-white p-6 sm:p-8 md:p-10 shadow-[0_1px_4px_rgba(70,112,101,0.02)]"
              data-testid="account-dealer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F6F2] text-[#467065]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold text-[#2D2D2D]">
                    Dealer / B2B Portal
                  </h2>
                  <p className="text-xs text-[#666666]">
                    Wholesale procurement and partner orders
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-[#E9EFE7] pt-6">
                {dealer ? (
                  <div className="space-y-4">
                    <p className="font-semibold text-lg text-[#2D2D2D]">
                      {dealer.org_name}
                    </p>
                    <Badge variant="outline" className="border-[#CBD6C7] text-[#467065]">
                      {dealer.status}
                    </Badge>
                    <div className="pt-2">
                      <Link
                        to="/dealer"
                        className={buttonVariants({ variant: "outline", size: "sm" }) + " rounded-xl border-[#CBD6C7] text-[#467065]"}
                        data-testid="dealer-portal-link"
                      >
                        Open dealer portal
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-[#555555]">
                      Sell Kotson in your store? Apply for a wholesale dealer account.
                    </p>
                    <div className="pt-2">
                      <Link
                        to="/dealer"
                        className={buttonVariants({ size: "sm" }) + " rounded-xl bg-[#467065] text-white hover:bg-[#3B5F56] min-h-11"}
                        data-testid="dealer-apply-link"
                      >
                        Apply as dealer
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Existing Site Footer */}
      <SiteFooter />
    </div>
  );
}
