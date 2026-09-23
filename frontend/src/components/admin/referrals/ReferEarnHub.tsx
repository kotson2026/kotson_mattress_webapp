import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Plus,
  ShieldAlert,
  Search,
  Check,
  XCircle,
  PauseCircle,
  X,
  Tag,
  ArrowUpRight,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";

export default function ReferEarnHub() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"rules" | "rewards" | "withdrawals" | "fraud">("rules");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [payWithdrawalItem, setPayWithdrawalItem] = useState<any>(null);
  const [rejectRewardItem, setRejectRewardItem] = useState<any>(null);
  const [holdRewardItem, setHoldRewardItem] = useState<any>(null);

  // 1. Overview 9 KPIs
  const { data: overview } = useQuery({
    queryKey: ["referrals-overview"],
    queryFn: () => apiGet<any>("/admin/referrals/overview"),
  });

  // 2. Rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["referral-rules"],
    queryFn: () => apiGet<any[]>("/admin/referrals/rules"),
    enabled: activeTab === "rules",
  });

  // 3. Rewards Ledger
  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ["referral-rewards", statusFilter, q, page, pageSize],
    queryFn: () =>
      apiGet<{ total: number; rewards: any[] }>(
        `/admin/referrals/rewards?status=${statusFilter}&q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`
      ),
    enabled: activeTab === "rewards",
  });
  const rewards = rewardsData?.rewards || [];
  const rewardsTotal = rewardsData?.total || 0;

  // 4. Withdrawals Queue
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["referral-withdrawals"],
    queryFn: () => apiGet<any[]>("/admin/referrals/withdrawals"),
    enabled: activeTab === "withdrawals",
  });

  // 5. Fraud Alerts
  const { data: fraudData } = useQuery({
    queryKey: ["referral-fraud-alerts"],
    queryFn: () => apiGet<any>("/admin/referrals/fraud-alerts"),
    enabled: activeTab === "fraud",
  });

  // Mutations
  const approveReward = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/referrals/rewards/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referral-rewards"] });
      qc.invalidateQueries({ queryKey: ["referrals-overview"] });
      toast.success("Reward approved for payout");
    },
    onError: (e: any) => toast.error(e.message || "Failed to approve reward"),
  });

  const rejectReward = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiPost(`/admin/referrals/rewards/${id}/reject`, { reason }),
    onSuccess: () => {
      setRejectRewardItem(null);
      qc.invalidateQueries({ queryKey: ["referral-rewards"] });
      qc.invalidateQueries({ queryKey: ["referrals-overview"] });
      toast.success("Reward rejected");
    },
    onError: (e: any) => toast.error(e.message || "Failed to reject reward"),
  });

  const holdReward = useMutation({
    mutationFn: ({ id, note, review_date }: { id: string; note: string; review_date: string }) =>
      apiPost(`/admin/referrals/rewards/${id}/hold`, { note, review_date }),
    onSuccess: () => {
      setHoldRewardItem(null);
      qc.invalidateQueries({ queryKey: ["referral-rewards"] });
      qc.invalidateQueries({ queryKey: ["referrals-overview"] });
      toast.success("Reward placed on hold");
    },
    onError: (e: any) => toast.error(e.message || "Failed to hold reward"),
  });

  const markPaid = useMutation({
    mutationFn: ({ wid, utr, method, date }: { wid: string; utr: string; method: string; date: string }) =>
      apiPost(`/admin/referrals/withdrawals/${wid}/mark-paid`, {
        utr_number: utr,
        payment_method: method,
        payment_date: date,
      }),
    onSuccess: () => {
      setPayWithdrawalItem(null);
      qc.invalidateQueries({ queryKey: ["referral-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["referral-rewards"] });
      qc.invalidateQueries({ queryKey: ["referrals-overview"] });
      toast.success("Payout confirmed with UTR reference. PAYMENT DONE.");
    },
    onError: (e: any) => toast.error(e.message || "Failed to mark paid"),
  });

  return (
    <div className="space-y-6" data-testid="refer-earn-hub">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Refer & Earn Management</h1>
          <p className="text-sm text-muted-foreground">
            Configure product-level reward rules, audit referral attributions, and manage bank payout disbursements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setEditingRule(null);
              setIsRuleModalOpen(true);
            }}
            className="bg-primary text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Reward Rule
          </Button>
        </div>
      </div>

      {/* 9 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Referrers</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_referrers ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Active referral codes</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Referral Leads</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.total_leads ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Attributed signups</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed Sales</span>
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.completed_sales_count ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Orders delivered/paid</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sales Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {overview?.total_sales_value ? inr(overview.total_sales_value) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Gross referral value</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Rewards</span>
            <Tag className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold">
            {overview?.total_rewards_earned ? inr(overview.total_rewards_earned) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Lifetime earned</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approved Ready</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {overview?.rewards_approved_ready ? inr(overview.rewards_approved_ready) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Ready for payout</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-amber-700">
            {overview?.rewards_pending_review ? inr(overview.rewards_pending_review) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">In return-window hold</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Payouts</span>
            <AlertCircle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-orange-700">
            {overview?.pending_withdrawal_count ?? 0} ({overview?.pending_withdrawal_value ? inr(overview.pending_withdrawal_value) : "₹0"})
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Bank transfer queue</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Paid</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {overview?.total_paid_rewards ? inr(overview.total_paid_rewards) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Disbursed with UTR</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border bg-card rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "rules"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tag className="w-4 h-4" />
          Reward Rules Engine
        </button>

        <button
          onClick={() => setActiveTab("rewards")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "rewards"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Rewards Ledger
        </button>

        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "withdrawals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Withdrawal Requests Queue ({overview?.pending_withdrawal_count ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("fraud")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "fraud"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Fraud & Risk Monitor
        </button>
      </div>

      {/* Sub-Tab 1: Rules Engine */}
      {activeTab === "rules" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Scope / Product</TableHead>
                <TableHead>Reward Formula</TableHead>
                <TableHead>Min Order Value</TableHead>
                <TableHead>Sample Commission (₹25k Order)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading rules…
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No reward rules configured.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-sm">{r.rule_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.product_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-foreground">
                        {r.reward_type === "PERCENTAGE" ? `${r.value}% Share` : inr(r.value)}
                      </span>
                    </TableCell>
                    <TableCell>{inr(r.min_order_value || 0)}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">
                      {inr(r.sample_reward || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingRule(r);
                          setIsRuleModalOpen(true);
                        }}
                      >
                        <Tag className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sub-Tab 2: Rewards Ledger */}
      {activeTab === "rewards" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by order #, referrer code, or customer…"
                className="pl-9 bg-background"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground font-semibold">Status:</Label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="held">Held</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Referrer Code & Name</TableHead>
                  <TableHead>Purchaser</TableHead>
                  <TableHead>Reward Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes / Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewardsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Loading rewards ledger…
                    </TableCell>
                  </TableRow>
                ) : rewards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No rewards recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  rewards.map((rw) => (
                    <TableRow key={rw.id}>
                      <TableCell className="font-mono text-xs font-semibold">{rw.order_number}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{rw.referrer_name || "Referrer"}</div>
                        <Badge variant="outline" className="text-[10px] font-mono mt-0.5">
                          {rw.referrer_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{rw.customer_name || "Customer"}</TableCell>
                      <TableCell className="font-bold text-emerald-700">{inr(rw.amount)}</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            rw.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : rw.status === "paid"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : rw.status === "held"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : rw.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {rw.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {rw.rejection_reason || rw.hold_note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {rw.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                                onClick={() => approveReward.mutate(rw.id)}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-amber-700 hover:bg-amber-50"
                                onClick={() => setHoldRewardItem(rw)}
                              >
                                <PauseCircle className="w-3.5 h-3.5 mr-1" /> Hold
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-rose-700 hover:bg-rose-50"
                                onClick={() => setRejectRewardItem(rw)}
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {rw.status === "held" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                              onClick={() => approveReward.mutate(rw.id)}
                            >
                              Release & Approve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <DataTablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={rewardsTotal}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Withdrawal Requests Queue */}
      {activeTab === "withdrawals" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Referrer</TableHead>
                <TableHead>Contact (Phone/Email)</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>UTR / Tx Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawalsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading withdrawal requests…
                  </TableCell>
                </TableRow>
              ) : withdrawals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No withdrawal requests in queue.
                  </TableCell>
                </TableRow>
              ) : (
                withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-semibold text-sm">{w.user_name || "Referrer"}</TableCell>
                    <TableCell className="text-xs">
                      <div>{w.user_phone || "—"}</div>
                      <div className="text-muted-foreground">{w.user_email}</div>
                    </TableCell>
                    <TableCell className="font-bold text-base text-foreground">{inr(w.amount)}</TableCell>
                    <TableCell className="text-xs">{w.payment_method || "Bank NEFT"}</TableCell>
                    <TableCell>
                      {w.utr_number ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono font-bold text-emerald-800">
                          {w.utr_number}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Pending payout</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${
                          w.status === "PAID"
                            ? "bg-emerald-600 text-white font-bold"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {w.status === "PAID" ? "PAYMENT DONE" : "PENDING"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {w.status !== "PAID" ? (
                        <Button
                          size="sm"
                          className="bg-emerald-700 hover:bg-emerald-800 text-white h-8 text-xs font-semibold"
                          onClick={() => setPayWithdrawalItem(w)}
                        >
                          Record UTR Payout
                        </Button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sub-Tab 4: Fraud & Risk Monitor */}
      {activeTab === "fraud" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <h3 className="font-heading text-base font-bold">Automated Fraud Detection</h3>
            <p className="text-xs text-muted-foreground">
              Real-time audit scans matching referrer credentials against order recipients and cancelled order reversals.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Alert Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Details / Message</TableHead>
                  <TableHead>Order #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!fraudData?.alerts || fraudData.alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center text-emerald-700 gap-1">
                        <CheckCircle2 className="w-6 h-6" />
                        <span className="font-semibold text-sm">No Fraud Alerts Detected</span>
                        <span className="text-xs text-muted-foreground">
                          All referral accounts, phone numbers, and orders pass integrity checks.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  fraudData.alerts.map((al: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold text-xs">{al.type}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">
                          {al.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-foreground max-w-md">{al.message}</TableCell>
                      <TableCell className="font-mono text-xs">{al.order_number || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Record UTR Modal */}
      {payWithdrawalItem && (
        <RecordPayoutModal
          withdrawal={payWithdrawalItem}
          onClose={() => setPayWithdrawalItem(null)}
          onConfirm={(utr, method, date) =>
            markPaid.mutate({ wid: payWithdrawalItem.id, utr, method, date })
          }
        />
      )}

      {/* Reject Modal */}
      {rejectRewardItem && (
        <RejectRewardModal
          reward={rejectRewardItem}
          onClose={() => setRejectRewardItem(null)}
          onConfirm={(reason) => rejectReward.mutate({ id: rejectRewardItem.id, reason })}
        />
      )}

      {/* Hold Modal */}
      {holdRewardItem && (
        <HoldRewardModal
          reward={holdRewardItem}
          onClose={() => setHoldRewardItem(null)}
          onConfirm={(note, review_date) => holdReward.mutate({ id: holdRewardItem.id, note, review_date })}
        />
      )}

      {/* Add / Edit Rule Modal */}
      {isRuleModalOpen && (
        <RuleEditorModal
          rule={editingRule}
          onClose={() => setIsRuleModalOpen(false)}
          onSuccess={() => {
            setIsRuleModalOpen(false);
            qc.invalidateQueries({ queryKey: ["referral-rules"] });
          }}
        />
      )}
    </div>
  );
}

function RecordPayoutModal({
  withdrawal,
  onClose,
  onConfirm,
}: {
  withdrawal: any;
  onClose: () => void;
  onConfirm: (utr: string, method: string, date: string) => void;
}) {
  const [utr, setUtr] = useState("");
  const [method, setMethod] = useState("NEFT/RTGS");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-heading text-lg font-bold">Record Bank Payout</h3>
            <p className="text-xs text-muted-foreground">Disburse ₹{withdrawal.amount} to {withdrawal.user_name}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Bank / UPI Reference / UTR Number *</Label>
            <Input
              value={utr}
              onChange={(e) => setUtr(e.target.value.toUpperCase())}
              placeholder="e.g. UTR1299882200"
              className="mt-1 font-mono uppercase font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment Method</Label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="NEFT/RTGS">NEFT / RTGS</option>
                <option value="IMPS">IMPS Instant</option>
                <option value="UPI">UPI Transfer</option>
              </select>
            </div>
            <div>
              <Label>Disbursement Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
            onClick={() => onConfirm(utr, method, date)}
            disabled={!utr.trim()}
          >
            Confirm PAYMENT DONE
          </Button>
        </div>
      </div>
    </div>
  );
}

function RejectRewardModal({
  reward,
  onClose,
  onConfirm,
}: {
  reward: any;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
        <h3 className="font-heading text-lg font-bold text-rose-700">Reject Referral Reward</h3>
        <p className="text-xs text-muted-foreground">
          Mandatory audit reason required to reverse reward for order <strong>{reward.order_number}</strong>.
        </p>

        <div>
          <Label>Rejection Reason *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Order returned during 100-night trial, refund processed."
            className="mt-1"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={reason.trim().length < 5}>
            Confirm Rejection
          </Button>
        </div>
      </div>
    </div>
  );
}

function HoldRewardModal({
  reward,
  onClose,
  onConfirm,
}: {
  reward: any;
  onClose: () => void;
  onConfirm: (note: string, review_date: string) => void;
}) {
  const [note, setNote] = useState("");
  const [reviewDate, setReviewDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
        <h3 className="font-heading text-lg font-bold text-amber-700">Administrative Hold</h3>
        <p className="text-xs text-muted-foreground">
          Place reward on hold pending verification for order <strong>{reward.order_number}</strong>.
        </p>

        <div className="space-y-3">
          <div>
            <Label>Next Review Date *</Label>
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Hold Explanation / Note *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. High order value; awaiting completion of delivery confirmation."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => onConfirm(note, reviewDate)} disabled={!note.trim()}>
            Place on Hold
          </Button>
        </div>
      </div>
    </div>
  );
}

function RuleEditorModal({
  rule,
  onClose,
  onSuccess,
}: {
  rule: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    rule_name: rule?.rule_name || "",
    reward_type: rule?.reward_type || "PERCENTAGE",
    value: rule?.value || 5.0,
    min_order_value: rule?.min_order_value || 5000.0,
  });

  const save = useMutation({
    mutationFn: () => {
      if (rule) {
        return apiPut(`/admin/referrals/rules/${rule.id}`, formData);
      }
      return apiPost("/admin/referrals/rules", formData);
    },
    onSuccess: () => {
      toast.success(rule ? "Rule updated" : "Rule registered");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save rule"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-heading text-lg font-bold">{rule ? "Edit Reward Rule" : "Create Reward Rule"}</h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Rule Name *</Label>
            <Input
              value={formData.rule_name}
              onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
              placeholder="e.g. 7-Zone Ortho Elite Referral Incentive"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reward Type</Label>
              <select
                value={formData.reward_type}
                onChange={(e) => setFormData({ ...formData, reward_type: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <Label>{formData.reward_type === "PERCENTAGE" ? "Percentage Value (%)" : "Fixed Amount (₹)"}</Label>
              <Input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                className="mt-1 font-bold"
              />
            </div>
          </div>

          <div>
            <Label>Minimum Order Value (₹)</Label>
            <Input
              type="number"
              value={formData.min_order_value}
              onChange={(e) => setFormData({ ...formData, min_order_value: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !formData.rule_name}>
            {save.isPending ? "Saving…" : "Save Rule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
