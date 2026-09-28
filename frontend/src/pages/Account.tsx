import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Dealer, Order, ReferralMe } from "@/lib/types";
import { fmtDate, inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import StorefrontHeader from "@/components/layout/StorefrontHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CustomerReferralPortal from "@/components/account/CustomerReferralPortal";

export default function Account() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "orders";
  const { data: me, isLoading } = useMe();

  const { data: orders } = useQuery({ queryKey: ["orders"], queryFn: () => apiGet<Order[]>("/orders"), enabled: !!me });
  const { data: referrals } = useQuery({ queryKey: ["referrals"], queryFn: () => apiGet<ReferralMe>("/referrals/me"), enabled: !!me });
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

  if (isLoading) {
    return (
      <div className="min-h-svh">
        <StorefrontHeader />
        <div className="mx-auto max-w-5xl px-4 py-12"><div className="h-64 animate-pulse rounded-2xl bg-brand-sand" /></div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-svh">
        <StorefrontHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center sm:px-6">
          <h1 className="font-heading text-3xl font-black">Sign in to your account</h1>
          <p className="mt-2 text-muted-foreground">Your orders, addresses and referral link live here.</p>
          <Link to="/login" className={buttonVariants({ size: "lg" }) + " mt-6"} data-testid="account-login-link">Sign in</Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const copyLink = async () => {
    if (!referrals?.share_url) return;
    await navigator.clipboard.writeText(referrals.share_url);
    toast.success("Referral link copied");
  };

  return (
    <div className="min-h-svh">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl font-black tracking-tight" data-testid="account-heading">Hello, {me.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="account-email">{me.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {me.roles.filter((r) => r !== "customer").map((r) => (
              <Link key={r} to={r === "manager" ? "/manager" : r.startsWith("crm") ? "/crm" : r === "dealer" ? "/dealer" : "/admin"} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {r} console
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={() => signOut.mutate()} data-testid="account-signout-button">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>

        <Tabs defaultValue={initialTab} className="mt-8">
          <TabsList variant="line">
            <TabsTrigger value="orders" data-testid="account-tab-orders">Orders</TabsTrigger>
            <TabsTrigger value="addresses" data-testid="account-tab-addresses">Addresses</TabsTrigger>
            <TabsTrigger value="referrals" data-testid="account-tab-referrals">Refer &amp; Earn</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-6">
            {(orders ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center" data-testid="account-orders-empty">
                <p className="font-heading text-lg font-semibold">No orders yet</p>
                <Link to="/collections" className="mt-3 inline-block text-brand-deep underline">Start shopping</Link>
              </div>
            ) : (
              <Table data-testid="account-orders-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfilment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(orders ?? []).map((o) => (
                    <TableRow key={o.id} data-testid={`account-order-${o.order_number}`}>
                      <TableCell>
                        <Link to={`/order/confirmation/${o.id}`} className="font-medium text-brand-deep underline">{o.order_number}</Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(o.created_at)}</TableCell>
                      <TableCell><Badge variant={o.payment_status === "paid" ? "default" : "outline"}>{o.payment_status}</Badge></TableCell>
                      <TableCell className="text-sm">{o.fulfilment_status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(o.amounts.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="addresses" className="mt-6">
            <div className="rounded-2xl border border-border bg-card p-6" data-testid="account-addresses">
              <h2 className="font-heading text-lg font-bold">Delivery addresses</h2>
              {(orders ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Addresses you use at checkout are saved with each order and listed here.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {[...new Map((orders ?? []).map((o) => [`${o.address.line1}-${o.address.pincode}`, o.address])).values()].map((a, i) => (
                    <li key={i} className="rounded-xl border border-border p-4 text-sm">
                      <p className="font-medium">{a.full_name}</p>
                      <p className="text-muted-foreground">
                        {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode} · {a.phone}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="referrals" className="mt-6">
            <CustomerReferralPortal />
          </TabsContent>

          <TabsContent value="dealer" className="mt-6">
            <div className="max-w-xl rounded-2xl border border-border bg-card p-6" data-testid="account-dealer">
              <h2 className="font-heading text-lg font-bold">Dealer / B2B Portal</h2>
              {dealer ? (
                <>
                  <p className="mt-3 font-medium">{dealer.org_name}</p>
                  <Badge variant="outline" className="mt-2">{dealer.status}</Badge>
                  <div className="mt-4">
                    <Link to="/dealer" className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="dealer-portal-link">
                      Open dealer portal
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">Sell Kotson in your store? Apply for a wholesale dealer account.</p>
                  <div className="mt-4">
                    <Link to="/dealer" className={buttonVariants({ size: "sm" }) + " min-h-11"} data-testid="dealer-apply-link">
                      Apply as dealer
                    </Link>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}
