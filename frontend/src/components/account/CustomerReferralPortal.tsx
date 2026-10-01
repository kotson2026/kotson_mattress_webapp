import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Share2,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building,
  FileText,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Info,
  DollarSign,
  Users,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ReferralPortalData } from "@/lib/types";

export default function CustomerReferralPortal() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "kyc" | "leads" | "sales" | "withdrawals">("overview");

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Withdrawal modal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");

  // KYC form state
  const [panNumber, setPanNumber] = useState("");
  const [panName, setPanName] = useState("");
  const [panDocUrl, setPanDocUrl] = useState("");

  // Bank form state
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountConfirm, setBankAccountConfirm] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  // Fetch portal data
  const { data: portal, isLoading, isError, refetch } = useQuery<ReferralPortalData>({
    queryKey: ["referral-portal-data"],
    queryFn: () => apiGet<ReferralPortalData>("/referrals/portal"),
  });

  // Submit KYC mutation
  const submitKYC = useMutation({
    mutationFn: (payload: { pan_number: string; name_as_per_pan: string; document_url?: string }) =>
      apiPost("/referrals/kyc", payload),
    onSuccess: () => {
      toast.success("PAN details submitted for verification");
      qc.invalidateQueries({ queryKey: ["referral-portal-data"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit PAN details"),
  });

  // Submit Bank mutation
  const submitBank = useMutation({
    mutationFn: (payload: {
      account_holder_name: string;
      account_number: string;
      confirm_account_number: string;
      ifsc_code: string;
      bank_name?: string;
      branch_name?: string;
    }) => apiPost("/referrals/bank", payload),
    onSuccess: () => {
      toast.success("Bank details submitted for verification");
      qc.invalidateQueries({ queryKey: ["referral-portal-data"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit bank details"),
  });

  // Request Withdrawal mutation
  const requestWithdrawal = useMutation({
    mutationFn: (amount: number) => apiPost("/referrals/request-withdrawal", { amount }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted successfully");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      qc.invalidateQueries({ queryKey: ["referral-portal-data"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Withdrawal request failed"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-[#E5E0D8] bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#467065] border-t-transparent" />
          <p className="text-xs text-[#6B716C]">Loading referral portal...</p>
        </div>
      </div>
    );
  }

  if (isError || !portal || !portal.user) {
    return (
      <div className="rounded-2xl border border-[#E5E0D8] bg-white p-8 text-center" data-testid="referral-portal-error">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-bold text-[#11291F]">Unable to load Refer &amp; Earn</h3>
        <p className="mt-1 text-sm text-[#6B716C]">
          We could not load your referral dashboard at this time. Please try refreshing.
        </p>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="mt-4 border-[#CBD6C7] text-xs font-semibold"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const user = portal.user;
  const wallet = portal.wallet || {
    pending_commission: 0,
    available_to_withdraw: 0,
    reserved_for_withdrawal: 0,
    total_earned: 0,
    paid_commission: 0,
  };
  const performance = portal.performance || {
    total_leads: 0,
    total_sales: 0,
    sales_value: 0,
    conversion_rate: 0,
  };
  const leads = Array.isArray(portal.leads) ? portal.leads : [];
  const sales = Array.isArray(portal.sales) ? portal.sales : [];
  const withdrawals = Array.isArray(portal.withdrawals) ? portal.withdrawals : [];
  const tax_settings = portal.tax_settings || {
    tds_enabled: true,
    pan_available_rate: 5,
    pan_not_available_rate: 20,
    applicable_threshold: 15000,
    payment_nature: "194H",
  };

  const isKycVerified = user.kyc?.status === "VERIFIED";
  const isBankVerified = user.bank?.status === "VERIFIED";
  const isSetupComplete = isKycVerified && isBankVerified;
  const canWithdraw = isSetupComplete && wallet.available_to_withdraw > 0;

  const copyCode = async () => {
    if (!user.referral_code) return;
    await navigator.clipboard.writeText(user.referral_code);
    setCopiedCode(true);
    toast.success("Referral code copied");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareOrCopyLink = async () => {
    if (!user.share_url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Kotson Refer & Earn",
          text: `Use my referral code ${user.referral_code} to get exclusive rewards on Kotson Organic Mattresses!`,
          url: user.share_url,
        });
        toast.success("Referral link shared");
        return;
      } catch (err) {
        // Fallback to clipboard if share was cancelled or unsupported
      }
    }
    await navigator.clipboard.writeText(user.share_url);
    setCopiedLink(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Estimated TDS calculation for withdrawal modal
  const numericWithdrawAmount = parseFloat(withdrawAmount) || 0;
  const applicableTdsRate = isKycVerified
    ? tax_settings.pan_available_rate
    : tax_settings.pan_not_available_rate;
  const estimatedTds = tax_settings.tds_enabled
    ? Math.round((numericWithdrawAmount * applicableTdsRate) / 100)
    : 0;
  const estimatedNet = Math.max(0, numericWithdrawAmount - estimatedTds);

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericWithdrawAmount <= 0) {
      toast.error("Please enter a valid withdrawal amount");
      return;
    }
    if (numericWithdrawAmount > wallet.available_to_withdraw) {
      toast.error(`Cannot withdraw more than available balance (${inr(wallet.available_to_withdraw)})`);
      return;
    }
    requestWithdrawal.mutate(numericWithdrawAmount);
  };

  return (
    <div className="space-y-6 text-[#2D2D2D]" data-testid="customer-referral-portal">
      {/* ─────────────────────────────────────────────────────────────
          1. SUBNAV TABS (Redesigned Compact Tabs with Real Authoritative Counts)
          ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#E5E0D8] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg transition border ${
              activeTab === "overview"
                ? "bg-[#467065] text-white border-[#467065] shadow-xs"
                : "bg-white text-[#2D2D2D] border-[#E5E0D8] hover:bg-[#F7F4EE]"
            }`}
            data-testid="tab-overview"
          >
            Overview & Wallet
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("kyc")}
            className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg transition border flex items-center gap-1.5 ${
              activeTab === "kyc"
                ? "bg-[#467065] text-white border-[#467065] shadow-xs"
                : "bg-white text-[#2D2D2D] border-[#E5E0D8] hover:bg-[#F7F4EE]"
            }`}
            data-testid="tab-kyc"
          >
            KYC & Bank Details
            {!isSetupComplete && (
              <span
                className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0"
                title="Setup incomplete"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg transition border ${
              activeTab === "leads"
                ? "bg-[#467065] text-white border-[#467065] shadow-xs"
                : "bg-white text-[#2D2D2D] border-[#E5E0D8] hover:bg-[#F7F4EE]"
            }`}
            data-testid="tab-leads"
          >
            My Leads ({leads.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sales")}
            className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg transition border ${
              activeTab === "sales"
                ? "bg-[#467065] text-white border-[#467065] shadow-xs"
                : "bg-white text-[#2D2D2D] border-[#E5E0D8] hover:bg-[#F7F4EE]"
            }`}
            data-testid="tab-sales"
          >
            My Sales ({sales.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("withdrawals")}
            className={`whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-lg transition border ${
              activeTab === "withdrawals"
                ? "bg-[#467065] text-white border-[#467065] shadow-xs"
                : "bg-white text-[#2D2D2D] border-[#E5E0D8] hover:bg-[#F7F4EE]"
            }`}
            data-testid="tab-withdrawals"
          >
            Withdrawal History ({withdrawals.length})
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TAB: OVERVIEW & WALLET
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Horizontal Hero Card (Approved Kotson Layout) */}
          <div className="rounded-2xl border border-[#E5E0D8] bg-[#F7F4EE]/60 p-6 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column (~65% on Desktop) */}
              <div className="lg:col-span-8 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#467065]">
                  OFFICIAL KOTSON REFER & EARN
                </span>
                <h2 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-[#11291F]">
                  Share & Earn Commission
                </h2>
                <p className="text-sm text-[#6B716C] max-w-2xl leading-relaxed">
                  Earn commission when customers purchase eligible Kotson products through your referral link or code.
                  Commission varies by product according to the active Refer & Earn offer.
                </p>

                {/* Referral Code & Sharing Controls */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-[#E5E0D8] bg-white px-3.5 py-2 shadow-2xs">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[#6B716C]">
                      YOUR CODE
                    </span>
                    <span className="font-mono text-base font-bold tracking-wide text-[#11291F]">
                      {user.referral_code || "—"}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyCode}
                    className="h-10 border-[#E5E0D8] bg-white hover:bg-[#F7F4EE] text-xs font-semibold"
                    data-testid="btn-copy-code"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5 text-[#467065]" /> Copy Code
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={shareOrCopyLink}
                    className="h-10 bg-[#467065] text-white hover:bg-[#11291F] text-xs font-semibold shadow-xs"
                    data-testid="btn-share-link"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-white" /> Link Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share Link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Right Column (~35% on Desktop) — Verification Status */}
              <div className="lg:col-span-4 rounded-xl border border-[#E5E0D8] bg-white p-4.5 shadow-2xs space-y-3">
                <div className="text-[11px] font-bold text-[#6B716C] uppercase tracking-wider">
                  Verification Status
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#6B716C]">PAN (KYC):</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isKycVerified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : user.kyc?.status === "PENDING_VERIFICATION"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-neutral-200 bg-neutral-50 text-[#6B716C]"
                      }`}
                    >
                      {user.kyc?.status || "NOT_SUBMITTED"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#6B716C]">Bank Account:</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isBankVerified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : user.bank?.status === "PENDING_VERIFICATION"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-neutral-200 bg-neutral-50 text-[#6B716C]"
                      }`}
                    >
                      {user.bank?.status || "NOT_ADDED"}
                    </Badge>
                  </div>
                </div>

                {!isSetupComplete && (
                  <div className="pt-2 border-t border-[#E5E0D8]/60">
                    <p className="text-[11px] text-[#6B716C]">Complete setup to enable withdrawals</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("kyc")}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#467065] hover:text-[#11291F] transition"
                    >
                      Complete Now <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. PERFORMANCE 4-CARD SECTION (Authoritative Metrics Only)
              ───────────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B716C] mb-3">
              Referral Performance
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Attributed Leads */}
              <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-[#6B716C]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Attributed Leads</span>
                  <Users className="h-4 w-4 text-[#467065]" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-[#11291F]">
                  {performance.total_leads}
                </div>
                <div className="text-[11px] text-[#6B716C] mt-1">Customers joined with your code</div>
              </div>

              {/* Referral Sales */}
              <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-[#6B716C]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Referral Sales</span>
                  <ShoppingBag className="h-4 w-4 text-[#467065]" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-[#11291F]">
                  {performance.total_sales}
                </div>
                <div className="text-[11px] text-[#6B716C] mt-1">Paid qualified orders</div>
              </div>

              {/* Referral Sales Value */}
              <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-[#6B716C]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Referral Sales Value</span>
                  <DollarSign className="h-4 w-4 text-[#467065]" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-[#11291F]">
                  {inr(performance.sales_value)}
                </div>
                <div className="text-[11px] text-[#6B716C] mt-1">Gross order merchandise value</div>
              </div>

              {/* Conversion Rate */}
              <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-[#6B716C]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Conversion Rate</span>
                  <TrendingUp className="h-4 w-4 text-[#467065]" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-[#11291F]">
                  {performance.conversion_rate}%
                </div>
                <div className="text-[11px] text-[#6B716C] mt-1">Attributed leads converted to sales</div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. REFER & EARN WALLET (4 Compact Cards + Authoritative CTA)
              ───────────────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B716C]">
                Refer & Earn Wallet
              </h3>

              {/* Authoritative Withdrawal Action */}
              <div>
                {!isSetupComplete ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("kyc")}
                    className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-semibold h-9"
                    data-testid="btn-complete-kyc-to-withdraw"
                  >
                    <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-700" /> Complete KYC to Withdraw
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={wallet.available_to_withdraw <= 0}
                    onClick={() => setIsWithdrawModalOpen(true)}
                    className="bg-[#467065] text-white hover:bg-[#11291F] text-xs font-semibold h-9 shadow-xs"
                    data-testid="btn-withdraw-funds"
                  >
                    <Wallet className="mr-1.5 h-3.5 w-3.5" /> Withdraw Funds
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Pending Commission */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-amber-900">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Pending Commission</span>
                  <Clock className="h-4 w-4 text-amber-700" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-amber-950">
                  {inr(wallet.pending_commission)}
                </div>
                <div className="text-[11px] text-amber-800 mt-1">Under verification / applicable return period</div>
              </div>

              {/* Available to Withdraw */}
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-900">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Available to Withdraw</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-emerald-950">
                  {inr(wallet.available_to_withdraw)}
                </div>
                <div className="text-[11px] text-emerald-800 mt-1">Cleared and eligible for withdrawal</div>
              </div>

              {/* Total Commission Earned */}
              <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-[#6B716C]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Commission Earned</span>
                  <TrendingUp className="h-4 w-4 text-[#467065]" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-[#11291F]">
                  {inr(wallet.total_earned)}
                </div>
                <div className="text-[11px] text-[#6B716C] mt-1">Total approved rewards credited</div>
              </div>

              {/* Total Withdrawn / Paid */}
              <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-[#6B716C]">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Withdrawn / Paid</span>
                  <CreditCard className="h-4 w-4 text-[#467065]" />
                </div>
                <div className="mt-2 font-heading text-2xl font-bold text-[#11291F]">
                  {inr(wallet.paid_commission)}
                </div>
                <div className="text-[11px] text-[#6B716C] mt-1">Transferred to bank account</div>
              </div>
            </div>

            {wallet.reserved_for_withdrawal > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-900">
                <Info className="h-4 w-4 flex-shrink-0 text-blue-700" />
                <span>
                  <strong>{inr(wallet.reserved_for_withdrawal)}</strong> is currently reserved for active withdrawal requests and cannot be requested twice.
                </span>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              5. CENTRALIZED STATUTORY TDS NOTICE (Derived from Settings)
              ───────────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 text-xs text-[#6B716C] space-y-1 shadow-2xs">
            <p className="font-bold text-[#11291F]">
              Statutory Tax & Accounting Notice ({tax_settings.payment_nature || "Section 393 Compliance"}):
            </p>
            <p className="leading-relaxed">
              Referral commission payments are subject to statutory withholding at source (TDS) under applicable tax laws.
              Current verified PAN rate is <strong>{tax_settings.pan_available_rate}%</strong> (or {tax_settings.pan_not_available_rate}% without PAN).
              Disbursements are transferred directly to verified bank accounts upon administrator clearance.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. TAB: KYC & BANK DETAILS (Clean Secure Setup Flow)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "kyc" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PAN (KYC) Card */}
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#467065]" />
                  <h3 className="font-heading font-bold text-lg text-[#11291F]">PAN Details (KYC)</h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isKycVerified
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : user.kyc?.status === "PENDING_VERIFICATION"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-neutral-200 bg-neutral-50 text-[#6B716C]"
                  }`}
                >
                  {user.kyc?.status || "NOT_SUBMITTED"}
                </Badge>
              </div>

              {isKycVerified ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-900 text-xs">
                    ✓ Your PAN details have been verified. Standard statutory TDS rate ({tax_settings.pan_available_rate}%) applies to all withdrawals.
                  </div>
                  <div>
                    <span className="text-xs text-[#6B716C]">Permanent Account Number (PAN):</span>
                    <div className="font-mono text-base font-bold tracking-wider text-[#11291F]">
                      {user.kyc.pan_masked}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-[#6B716C]">Name as per PAN:</span>
                    <div className="font-semibold text-[#11291F]">{user.kyc.pan_name || user.kyc.name_as_per_pan}</div>
                  </div>
                  {user.kyc.verified_at && (
                    <div className="text-xs text-[#6B716C]">
                      Verified on: {user.kyc.verified_at.slice(0, 10)}
                    </div>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!panNumber || !panName) {
                      toast.error("Please fill in PAN number and Name");
                      return;
                    }
                    submitKYC.mutate({
                      pan_number: panNumber.trim().toUpperCase(),
                      name_as_per_pan: panName.trim(),
                      document_url: panDocUrl.trim() || undefined,
                    });
                  }}
                  className="space-y-3.5 text-sm"
                >
                  {user.kyc?.status === "PENDING_VERIFICATION" && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 text-xs">
                      ⏳ PAN details submitted on {user.kyc.verified_at || "recently"}. Awaiting Owner Admin review.
                    </div>
                  )}
                  {user.kyc?.status === "REJECTED" && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-900 text-xs">
                      ✕ Rejection reason: {user.kyc.rejection_reason || "Details mismatch. Please re-submit."}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="pan-num" className="text-xs font-semibold text-[#2D2D2D]">PAN Number *</Label>
                    <Input
                      id="pan-num"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      className="font-mono uppercase mt-1 h-9 border-[#E5E0D8]"
                      required
                    />
                    <p className="text-[11px] text-[#6B716C] mt-0.5">
                      Sensitive identity data is securely stored and masked.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="pan-name" className="text-xs font-semibold text-[#2D2D2D]">Full Name (as per PAN) *</Label>
                    <Input
                      id="pan-name"
                      placeholder="e.g. KRANTHI KUMAR"
                      value={panName}
                      onChange={(e) => setPanName(e.target.value)}
                      className="mt-1 h-9 border-[#E5E0D8]"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="pan-doc" className="text-xs font-semibold text-[#2D2D2D]">PAN Card Document Link (Optional)</Label>
                    <Input
                      id="pan-doc"
                      placeholder="https://..."
                      value={panDocUrl}
                      onChange={(e) => setPanDocUrl(e.target.value)}
                      className="mt-1 h-9 border-[#E5E0D8]"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitKYC.isPending}
                    className="w-full bg-[#467065] text-white hover:bg-[#11291F] text-xs font-semibold h-9 shadow-xs"
                  >
                    {submitKYC.isPending ? "Submitting..." : "Submit PAN for Verification"}
                  </Button>
                </form>
              )}
            </div>

            {/* Bank Details Card */}
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8]">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-[#467065]" />
                  <h3 className="font-heading font-bold text-lg text-[#11291F]">Bank Account Details</h3>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isBankVerified
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : user.bank?.status === "PENDING_VERIFICATION"
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-neutral-200 bg-neutral-50 text-[#6B716C]"
                  }`}
                >
                  {user.bank?.status || "NOT_ADDED"}
                </Badge>
              </div>

              {isBankVerified ? (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-900 text-xs">
                    ✓ Your bank account is verified. Withdrawals will be directly disbursed to this account.
                  </div>
                  <div>
                    <span className="text-xs text-[#6B716C]">Account Holder:</span>
                    <div className="font-semibold text-[#11291F]">{user.bank.account_holder_name}</div>
                  </div>
                  <div>
                    <span className="text-xs text-[#6B716C]">Bank Account Number:</span>
                    <div className="font-mono text-base font-bold tracking-wider text-[#11291F]">
                      {user.bank.account_number_masked}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-[#6B716C]">IFSC Code:</span>
                      <div className="font-mono font-medium text-[#11291F]">{user.bank.ifsc_code}</div>
                    </div>
                    <div>
                      <span className="text-xs text-[#6B716C]">Bank Name:</span>
                      <div className="font-medium text-[#11291F]">{user.bank.bank_name || "—"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!bankHolder || !bankAccount || !bankAccountConfirm || !bankIfsc) {
                      toast.error("Please fill in all required bank fields");
                      return;
                    }
                    if (bankAccount !== bankAccountConfirm) {
                      toast.error("Account numbers do not match");
                      return;
                    }
                    submitBank.mutate({
                      account_holder_name: bankHolder.trim(),
                      account_number: bankAccount.trim(),
                      confirm_account_number: bankAccountConfirm.trim(),
                      ifsc_code: bankIfsc.trim().toUpperCase(),
                      bank_name: bankName.trim() || undefined,
                      branch_name: bankBranch.trim() || undefined,
                    });
                  }}
                  className="space-y-3 text-sm"
                >
                  {user.bank?.status === "PENDING_VERIFICATION" && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 text-xs">
                      ⏳ Bank details submitted on {user.bank.verified_at || "recently"}. Awaiting review.
                    </div>
                  )}
                  {user.bank?.status === "NEEDS_CORRECTION" && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-900 text-xs">
                      ✕ Correction required: {user.bank.rejection_reason || "Check account number or IFSC."}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="bank-holder" className="text-xs font-semibold text-[#2D2D2D]">Account Holder Name *</Label>
                    <Input
                      id="bank-holder"
                      placeholder="e.g. KRANTHI KUMAR"
                      value={bankHolder}
                      onChange={(e) => setBankHolder(e.target.value)}
                      className="mt-1 h-9 border-[#E5E0D8]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="bank-acc" className="text-xs font-semibold text-[#2D2D2D]">Account Number *</Label>
                      <Input
                        id="bank-acc"
                        type="password"
                        placeholder="••••••••••••"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        className="font-mono mt-1 h-9 border-[#E5E0D8]"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank-acc-conf" className="text-xs font-semibold text-[#2D2D2D]">Confirm Account *</Label>
                      <Input
                        id="bank-acc-conf"
                        placeholder="Re-enter account"
                        value={bankAccountConfirm}
                        onChange={(e) => setBankAccountConfirm(e.target.value)}
                        className="font-mono mt-1 h-9 border-[#E5E0D8]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="bank-ifsc" className="text-xs font-semibold text-[#2D2D2D]">IFSC Code *</Label>
                      <Input
                        id="bank-ifsc"
                        placeholder="HDFC0001234"
                        value={bankIfsc}
                        onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                        className="font-mono uppercase mt-1 h-9 border-[#E5E0D8]"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank-nm" className="text-xs font-semibold text-[#2D2D2D]">Bank Name</Label>
                      <Input
                        id="bank-nm"
                        placeholder="e.g. HDFC Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="mt-1 h-9 border-[#E5E0D8]"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitBank.isPending}
                    className="w-full bg-[#467065] text-white hover:bg-[#11291F] text-xs font-semibold h-9 shadow-xs mt-2"
                  >
                    {submitBank.isPending ? "Saving..." : "Save & Verify Bank Details"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. TAB: MY LEADS (Privacy-Safe Compact Table)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "leads" && (
        <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#11291F]">Attributed Referral Leads</h3>
              <p className="text-xs text-[#6B716C]">
                Customers who engaged through your referral link or code. Contact details are masked for customer privacy.
              </p>
            </div>
            <Badge variant="outline" className="border-[#E5E0D8] bg-[#F7F4EE] text-[#11291F] text-xs">
              {leads.length} Leads Total
            </Badge>
          </div>

          {leads.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B716C]">
              No referral leads recorded yet. Share your code or referral link to start tracking referrals.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5E0D8] bg-[#F7F4EE]/60 text-[11px] font-bold text-[#6B716C] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Lead / Customer</th>
                    <th className="py-2.5 px-3">Attributed Date</th>
                    <th className="py-2.5 px-3">Last Activity</th>
                    <th className="py-2.5 px-3">Journey Stage</th>
                    <th className="py-2.5 px-3">Converted</th>
                    <th className="py-2.5 px-3">Orders / Value</th>
                    <th className="py-2.5 px-3">Commission Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#E5E0D8]">
                  {leads.map((l: any) => (
                    <tr key={l.id} className="hover:bg-[#F7F4EE]/30 transition">
                      <td className="py-2.5 px-3 font-medium">
                        <div className="font-bold text-[#11291F]">
                          {l.name || l.lead_number || `Customer #${(l.id || "").slice(-6).toUpperCase()}`}
                        </div>
                        <div className="text-[11px] font-mono text-[#6B716C]">
                          {l.customer_email_masked || l.customer_phone_masked || l.code}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#6B716C] whitespace-nowrap">
                        {l.attributed_date ? l.attributed_date.slice(0, 10) : l.created_at ? l.created_at.slice(0, 10) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-[#2D2D2D]">
                        {l.activity || "Added to Cart"}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                            l.status === "CONVERTED" || l.status === "PURCHASED"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : l.status === "PAYMENT_CANCELLED" || l.status === "PAYMENT_FAILED"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-neutral-200 bg-neutral-50 text-[#6B716C]"
                          }`}
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        {l.converted ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="text-[#6B716C]">No</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#11291F]">
                        {l.sales || (l.sale_value ? inr(l.sale_value) : "—")}
                      </td>
                      <td className="py-2.5 px-3">
                        {l.commission_status && l.commission_status !== "—" ? (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-semibold ${
                              l.commission_status === "APPROVED" || l.commission_status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {l.commission_status}
                          </Badge>
                        ) : (
                          <span className="text-[#6B716C]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. TAB: MY SALES (Product-Specific Commission Snapshots)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          {/* Earnings by Product Section */}
          {portal.earnings_by_product && portal.earnings_by_product.length > 0 && (
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-lg text-[#11291F]">Earnings by Product Line</h3>
                  <p className="text-xs text-[#6B716C]">
                    Breakdown of referral commissions earned across different mattress and accessory lines.
                  </p>
                </div>
                <Badge variant="outline" className="border-[#E5E0D8] bg-[#F7F4EE] text-[#11291F] text-xs">
                  {portal.earnings_by_product.length} Product Categories
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {portal.earnings_by_product.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-[#E5E0D8] bg-[#F7F4EE]/40 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate text-[#11291F]">{item.product_name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono border-[#E5E0D8]">
                        {item.category}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-xs text-[#6B716C]">
                        {item.sales_count} sale{item.sales_count !== 1 ? "s" : ""}
                      </span>
                      <span className="font-bold text-sm text-[#467065]">{inr(item.commission_earned)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Qualified Referral Sales Table */}
          <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#11291F]">Qualified Referral Sales</h3>
                <p className="text-xs text-[#6B716C]">
                  Orders attributed to your referral code with product rule and commission snapshots.
                </p>
              </div>
              <Badge variant="outline" className="border-[#E5E0D8] bg-[#F7F4EE] text-[#11291F] text-xs">
                {sales.length} Sales
              </Badge>
            </div>

            {sales.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#6B716C]">
                No referral orders completed yet. When customers complete a purchase using your referral code, orders will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E5E0D8] bg-[#F7F4EE]/60 text-[11px] font-bold text-[#6B716C] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Order / Ref</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Eligible Amount</th>
                      <th className="py-2.5 px-3">Commission Rule</th>
                      <th className="py-2.5 px-3 text-right">Commission Earned</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D8]">
                    {sales.map((s: any) => {
                      const rawStatus = (s.status || s.commission_status || "PENDING").toUpperCase();
                      let badgeColor = "border-neutral-200 bg-neutral-50 text-[#6B716C]";
                      if (rawStatus === "PENDING") badgeColor = "border-amber-300 bg-amber-50 text-amber-800";
                      if (rawStatus === "APPROVED") badgeColor = "border-emerald-300 bg-emerald-50 text-emerald-800";
                      if (rawStatus === "PAID") badgeColor = "border-blue-300 bg-blue-50 text-blue-800";
                      if (rawStatus === "REVERSED") badgeColor = "border-rose-300 bg-rose-50 text-rose-800";

                      const ruleSnapshot = s.commission_rule_snapshot;
                      const ruleStr = s.commission_rule || (ruleSnapshot ? `${ruleSnapshot.commission_type === 'FLAT' ? inr(ruleSnapshot.commission_value) : ruleSnapshot.commission_value + '%'}` : "Product Rule");
                      const dateStr = s.created_at || s.order_date || "";

                      return (
                        <tr key={s.id || s.order_id || s.order_number} className="hover:bg-[#F7F4EE]/30 transition">
                          <td className="py-2.5 px-3 text-[#6B716C] whitespace-nowrap">
                            {dateStr ? dateStr.slice(0, 10) : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-[#11291F]">
                            {s.order_number || s.id}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#11291F]">{s.product_name || "Catalogue Product"}</td>
                          <td className="py-2.5 px-3 text-[#6B716C]">{s.product_category || "Store"}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#11291F]">{s.quantity || 1}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-[#2D2D2D]">
                            {inr(s.eligible_sale_amount ?? s.eligible_sale_value ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-[#6B716C]">{ruleStr}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#467065]">
                            {inr(s.amount ?? s.commission_amount ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
                              {rawStatus}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          9. TAB: WITHDRAWAL HISTORY (Authoritative Multi-State Payouts)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "withdrawals" && (
        <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#11291F]">Withdrawal Requests & Payouts</h3>
              <p className="text-xs text-[#6B716C]">
                Track all withdrawal requests, statutory TDS deductions, and bank disbursement references (UTR).
              </p>
            </div>
            {canWithdraw && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsWithdrawModalOpen(true)}
                className="bg-[#467065] text-white hover:bg-[#11291F] text-xs font-semibold h-8 shadow-xs"
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Request Withdrawal
              </Button>
            )}
          </div>

          {withdrawals.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B716C]">
              No withdrawal requests submitted yet. Once your available balance is cleared and KYC is verified, you can request a withdrawal here.
            </div>
          ) : (
            <div className="space-y-3.5">
              {withdrawals.map((w: any) => {
                const isPaid = w.status === "PAID";
                const isApproved = w.status === "APPROVED" || w.status === "PROCESSING";
                const isHold = w.status === "ON_HOLD";
                const isRejected = w.status === "REJECTED";

                return (
                  <div
                    key={w.id}
                    className="rounded-xl border border-[#E5E0D8] bg-white p-4 transition hover:bg-[#F7F4EE]/20 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E0D8]">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[#11291F]">
                          {w.request_number || w.id}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isPaid
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : isApproved
                              ? "border-blue-300 bg-blue-50 text-blue-800"
                              : isHold
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : isRejected
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : "border-neutral-200 bg-neutral-50 text-[#6B716C]"
                          }`}
                        >
                          {w.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-[#6B716C]">
                        Requested: {w.created_at ? w.created_at.slice(0, 10) : "—"}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[#6B716C]">Requested Amount:</span>
                        <div className="font-bold text-[#11291F] text-sm mt-0.5">{inr(w.amount)}</div>
                      </div>
                      <div>
                        <span className="text-[#6B716C]">TDS ({w.tds_rate}%):</span>
                        <div className="font-bold text-rose-700 text-sm mt-0.5">−{inr(w.tds_amount)}</div>
                      </div>
                      <div>
                        <span className="text-[#6B716C]">Net Payable:</span>
                        <div className="font-bold text-[#467065] text-sm mt-0.5">{inr(w.net_payable)}</div>
                      </div>
                      <div>
                        <span className="text-[#6B716C]">UTR / Reference:</span>
                        <div className="font-mono font-medium text-[#11291F] mt-0.5">{w.payout_details?.utr_number || "—"}</div>
                      </div>
                    </div>

                    {isApproved && (
                      <div className="mt-3 rounded-lg bg-blue-50/70 border border-blue-200 p-2.5 text-xs text-blue-900 flex items-start gap-2">
                        <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-700" />
                        <span>
                          Your withdrawal request has been approved and is being processed. Amount will be credited to your verified bank account within the standard processing window.
                        </span>
                      </div>
                    )}

                    {isHold && (
                      <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-700" />
                        <span>
                          Withdrawal On Hold: <strong>{w.hold_reason || "Under verification."}</strong> Reserved balance remains protected.
                        </span>
                      </div>
                    )}

                    {isRejected && (
                      <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-900 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-700" />
                        <span>
                          Withdrawal Rejected: <strong>{w.rejection_reason || "Account details mismatch."}</strong> Amount has been restored to your available balance.
                        </span>
                      </div>
                    )}

                    {isPaid && w.payout_details && (
                      <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-700" />
                        <span>
                          Disbursed on {w.payout_details.payment_date || "recently"} via {w.payout_details.payment_method || "Bank Transfer"} (UTR: {w.payout_details.utr_number}).
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. WITHDRAWAL REQUEST MODAL
          ───────────────────────────────────────────────────────────── */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D8]">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#467065]" />
                <h3 className="font-heading font-bold text-lg text-[#11291F]">Request Commission Withdrawal</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="text-[#6B716C] hover:text-[#11291F] text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div className="rounded-xl bg-[#F7F4EE] p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#6B716C]">
                  <span>Available Balance:</span>
                  <span className="font-bold text-[#467065] text-sm">{inr(wallet.available_to_withdraw)}</span>
                </div>
                <div className="flex justify-between text-[#6B716C]">
                  <span>Disbursing to:</span>
                  <span className="font-mono font-medium text-[#11291F]">{user.bank?.account_number_masked || "Verified Bank Account"}</span>
                </div>
                <div className="flex justify-between text-[#6B716C]">
                  <span>PAN (KYC):</span>
                  <span className="font-mono font-medium text-[#11291F]">{user.kyc?.pan_masked || "Verified"}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="req-withdraw-amt" className="text-xs font-semibold text-[#2D2D2D]">
                  Withdrawal Amount (INR) *
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-[#6B716C] font-semibold">₹</span>
                  <Input
                    id="req-withdraw-amt"
                    type="number"
                    min="1"
                    max={wallet.available_to_withdraw}
                    step="1"
                    placeholder="Enter amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-7 font-semibold h-10 border-[#E5E0D8]"
                    required
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#6B716C] mt-1">
                  <span>Max withdrawable: {inr(wallet.available_to_withdraw)}</span>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(wallet.available_to_withdraw.toString())}
                    className="text-[#467065] font-bold hover:underline"
                  >
                    Withdraw All
                  </button>
                </div>
              </div>

              {/* Dynamic Statutory TDS Calculation Breakdown */}
              {numericWithdrawAmount > 0 && (
                <div className="rounded-xl border border-[#E5E0D8] bg-[#F7F4EE]/50 p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-[#11291F] border-b border-[#E5E0D8] pb-1">
                    Statutory TDS Deduction ({tax_settings.payment_nature || "Section 393 Compliance"}):
                  </div>
                  <div className="flex justify-between text-[#6B716C]">
                    <span>Requested Gross:</span>
                    <span className="font-medium text-[#11291F]">{inr(numericWithdrawAmount)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>Estimated TDS ({applicableTdsRate}%):</span>
                    <span className="font-medium">−{inr(estimatedTds)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#467065] text-sm border-t border-[#E5E0D8] pt-1">
                    <span>Estimated Net Payable:</span>
                    <span>{inr(estimatedNet)}</span>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-[#6B716C] leading-normal">
                Notice: The requested amount is immediately reserved so it cannot be requested twice. Payout follows administrator approval.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="flex-1 h-9 border-[#E5E0D8] text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={requestWithdrawal.isPending || numericWithdrawAmount <= 0}
                  className="flex-1 bg-[#467065] text-white hover:bg-[#11291F] text-xs font-semibold h-9 shadow-xs"
                >
                  {requestWithdrawal.isPending ? "Submitting..." : "Confirm Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
