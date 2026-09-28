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
  ShieldCheck,
  Search,
  Check,
  XCircle,
  PauseCircle,
  X,
  Tag,
  ArrowUpRight,
  Download,
  Filter,
  Eye,
  Building,
  FileSpreadsheet,
  ArrowUpDown,
  AlertTriangle,
  Info,
  Calendar,
  Lock,
  Settings,
  Layers,
  Trash,
  Sliders,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { inr, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  ReferralOverviewMetrics,
  ReferrersResponse,
  ReferrerRow,
  ReferrerDetail,
  WithdrawalsResponse,
  WithdrawalItem,
  TaxSettings,
} from "@/lib/types";

export default function ReferEarnHub() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"referrers" | "leads" | "withdrawals" | "tax_settings" | "rules" | "fraud">("referrers");

  // ==========================================
  // LEADS & FUNNEL TAB STATE
  // ==========================================
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("ALL");
  const [leadPage, setLeadPage] = useState(1);

  // ==========================================
  // REFERRERS TAB STATE (SEARCH, ADVANCED FILTERS, SORTING, PAGINATION)
  // ==========================================

  const [refSearch, setRefSearch] = useState("");
  const [refStatusFilter, setRefStatusFilter] = useState("ALL");
  const [refLeadFilterType, setRefLeadFilterType] = useState("all");
  const [refLeadVal1, setRefLeadVal1] = useState("");
  const [refLeadVal2, setRefLeadVal2] = useState("");
  const [refSalesFilterType, setRefSalesFilterType] = useState("all");
  const [refSalesVal1, setRefSalesVal1] = useState("");
  const [refSalesVal2, setRefSalesVal2] = useState("");
  const [refDatePreset, setRefDatePreset] = useState("ALL");
  const [refStartDate, setRefStartDate] = useState("");
  const [refEndDate, setRefEndDate] = useState("");
  const [refSortBy, setRefSortBy] = useState("date_joined");
  const [refSortDir, setRefSortDir] = useState<"asc" | "desc">("desc");
  const [refPage, setRefPage] = useState(1);
  const [refPageSize, setRefPageSize] = useState(15);

  // Selected Referrer Detail Modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailActiveTab, setDetailActiveTab] = useState<"profile" | "leads" | "sales" | "ledger" | "withdrawals">("profile");

  // Admin KYC / Bank verify modals inside detail
  const [kycRejectModal, setKycRejectModal] = useState<{ open: boolean; userId: string; reason: string }>({
    open: false,
    userId: "",
    reason: "",
  });
  const [bankRejectModal, setBankRejectModal] = useState<{ open: boolean; userId: string; reason: string }>({
    open: false,
    userId: "",
    reason: "",
  });

  // ==========================================
  // WITHDRAWALS TAB STATE
  // ==========================================
  const [withStatusFilter, setWithStatusFilter] = useState("ALL");
  const [withSearch, setWithSearch] = useState("");
  const [withPage, setWithPage] = useState(1);

  // Action Modals for Withdrawals
  const [holdModal, setHoldModal] = useState<{ open: boolean; wid: string; reason: string }>({
    open: false,
    wid: "",
    reason: "",
  });
  const [rejectWithdrawalModal, setRejectWithdrawalModal] = useState<{ open: boolean; wid: string; reason: string }>({
    open: false,
    wid: "",
    reason: "",
  });
  const [markPaidModal, setMarkPaidModal] = useState<{
    open: boolean;
    item: WithdrawalItem | null;
    utr: string;
    method: string;
    date: string;
  }>({
    open: false,
    item: null,
    utr: "",
    method: "NEFT",
    date: new Date().toISOString().slice(0, 10),
  });

  // ==========================================
  // PRODUCT-LEVEL REFERRAL RULES & MODAL STATE
  // ==========================================
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleProductIds, setRuleProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [ruleCommissionType, setRuleCommissionType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [ruleCommissionValue, setRuleCommissionValue] = useState("5");
  const [ruleCommissionBasis, setRuleCommissionBasis] = useState<"selling_price" | "net_price">("selling_price");
  const [ruleDiscountType, setRuleDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [ruleDiscountValue, setRuleDiscountValue] = useState("3");
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [ruleValidFrom, setRuleValidFrom] = useState("");
  const [ruleValidUntil, setRuleValidUntil] = useState("");
  const [ruleNotes, setRuleNotes] = useState("");

  // Bulk Selection
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    promotion_stacking_mode: "combine",
    coupon_stacking_mode: "disallow",
    commission_price_basis: "selling_price",
    flat_quantity_semantics: "per_unit",
    allow_self_referral: false,
    attribution_ttl_days: 90,
  });

  // ==========================================
  // 1. TOP 8 KPI CARDS QUERY (Authoritative from Backend)
  // ==========================================
  const { data: overview } = useQuery<ReferralOverviewMetrics>({
    queryKey: ["referrals-overview"],
    queryFn: () => apiGet<ReferralOverviewMetrics>("/admin/referrals/overview"),
  });

  // ==========================================
  // 2. REFERRERS QUERY
  // ==========================================
  const buildReferrersQuery = () => {
    const params = new URLSearchParams();
    if (refSearch) params.set("q", refSearch);
    if (refStatusFilter !== "ALL") params.set("status", refStatusFilter);

    if (refLeadFilterType !== "all" && refLeadVal1) {
      params.set("lead_operator", refLeadFilterType);
      params.set("lead_value", refLeadVal1);
      if (refLeadFilterType === "range" && refLeadVal2) params.set("lead_value_max", refLeadVal2);
    }

    if (refSalesFilterType !== "all" && refSalesVal1) {
      params.set("sales_operator", refSalesFilterType);
      params.set("sales_value", refSalesVal1);
      if (refSalesFilterType === "range" && refSalesVal2) params.set("sales_value_max", refSalesVal2);
    }

    if (refDatePreset !== "ALL") {
      params.set("date_preset", refDatePreset);
      if (refDatePreset === "custom") {
        if (refStartDate) params.set("start_date", refStartDate);
        if (refEndDate) params.set("end_date", refEndDate);
      }
    }

    params.set("sort_by", refSortBy);
    params.set("sort_dir", refSortDir);
    params.set("page", String(refPage));
    params.set("limit", String(refPageSize));

    return params.toString();
  };

  const { data: referrersData, isLoading: referrersLoading } = useQuery<ReferrersResponse>({
    queryKey: [
      "admin-referrers",
      refSearch,
      refStatusFilter,
      refLeadFilterType,
      refLeadVal1,
      refLeadVal2,
      refSalesFilterType,
      refSalesVal1,
      refSalesVal2,
      refDatePreset,
      refStartDate,
      refEndDate,
      refSortBy,
      refSortDir,
      refPage,
      refPageSize,
    ],
    queryFn: () => apiGet<ReferrersResponse>(`/admin/referrals/referrers?${buildReferrersQuery()}`),
    enabled: activeTab === "referrers",
  });

  // Referrer Detail Query
  const { data: referrerDetail, isLoading: detailLoading } = useQuery<ReferrerDetail>({
    queryKey: ["admin-referrer-detail", selectedUserId],
    queryFn: () => apiGet<ReferrerDetail>(`/admin/referrals/referrers/${selectedUserId}`),
    enabled: !!selectedUserId,
  });

  // ==========================================
  // 3. WITHDRAWALS QUERY
  // ==========================================
  const { data: withdrawalsData, isLoading: withdrawalsLoading } = useQuery<WithdrawalsResponse>({
    queryKey: ["admin-withdrawals", withStatusFilter, withSearch, withPage],
    queryFn: () =>
      apiGet<WithdrawalsResponse>(
        `/admin/referrals/withdrawals?status=${withStatusFilter}&q=${encodeURIComponent(withSearch)}&page=${withPage}&limit=15`
      ),
    enabled: activeTab === "withdrawals",
  });

  // ==========================================
  // 3B. REFERRAL LEADS & FUNNEL QUERY
  // ==========================================
  const { data: leadsData, isLoading: leadsLoading } = useQuery<any>({
    queryKey: ["admin-referral-leads", leadSearch, leadStatusFilter, leadPage],
    queryFn: () =>
      apiGet(
        `/admin/referrals/leads?q=${encodeURIComponent(leadSearch)}&status=${leadStatusFilter}&page=${leadPage}&limit=15`
      ),
    enabled: activeTab === "leads",
  });


  // ==========================================
  // 4. TAX / TDS SETTINGS QUERY & MUTATION
  // ==========================================
  const { data: taxSettings, isLoading: taxLoading } = useQuery<TaxSettings>({
    queryKey: ["admin-tax-settings"],
    queryFn: () => apiGet<TaxSettings>("/admin/referrals/tax-settings"),
  });

  const [formTdsEnabled, setFormTdsEnabled] = useState<boolean>(true);
  const [formPaymentNature, setFormPaymentNature] = useState("");
  const [formPanRate, setFormPanRate] = useState("5.0");
  const [formNoPanRate, setFormNoPanRate] = useState("20.0");
  const [formThreshold, setFormThreshold] = useState("15000");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState("2026-04-01");
  const [formEffectiveUntil, setFormEffectiveUntil] = useState("");
  const [formTaxNotes, setFormTaxNotes] = useState("");

  React.useEffect(() => {
    if (taxSettings) {
      setFormTdsEnabled(taxSettings.tds_enabled);
      setFormPaymentNature(taxSettings.payment_nature || "Brokerage / Referral Commission");
      setFormPanRate(String(taxSettings.pan_available_rate ?? 5.0));
      setFormNoPanRate(String(taxSettings.pan_not_available_rate ?? 20.0));
      setFormThreshold(String(taxSettings.applicable_threshold ?? 15000));
      setFormEffectiveFrom(taxSettings.effective_from || "2026-04-01");
      setFormEffectiveUntil(taxSettings.effective_until || "");
      setFormTaxNotes(taxSettings.notes || "");
    }
  }, [taxSettings]);

  const updateTaxSettings = useMutation({
    mutationFn: (payload: any) => apiPut("/admin/referrals/tax-settings", payload),
    onSuccess: () => {
      toast.success("Statutory TDS configuration updated successfully");
      qc.invalidateQueries({ queryKey: ["admin-tax-settings"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to update tax configuration"),
  });

  // ==========================================
  // 5. PRODUCT-LEVEL COMMISSION RULES QUERY & MUTATIONS
  // ==========================================
  const { data: rules = [], isLoading: rulesLoading } = useQuery<any[]>({
    queryKey: ["referral-rules"],
    queryFn: () => apiGet<any[]>("/admin/referrals/rules"),
    enabled: activeTab === "rules",
  });

  const { data: catalogProducts = [] } = useQuery<any[]>({
    queryKey: ["referral-products-catalog"],
    queryFn: () => apiGet<any[]>("/admin/referrals/products-catalog"),
  });

  const { data: referralSettings } = useQuery<any>({
    queryKey: ["referral-settings"],
    queryFn: () => apiGet<any>("/admin/referrals/settings"),
  });

  React.useEffect(() => {
    if (referralSettings) {
      setSettingsForm({
        promotion_stacking_mode: referralSettings.promotion_stacking_mode || "combine",
        coupon_stacking_mode: referralSettings.coupon_stacking_mode || "disallow",
        commission_price_basis: referralSettings.commission_price_basis || "selling_price",
        flat_quantity_semantics: referralSettings.flat_quantity_semantics || "per_unit",
        allow_self_referral: !!referralSettings.allow_self_referral,
        attribution_ttl_days: referralSettings.attribution_ttl_days || 90,
      });
    }
  }, [referralSettings]);

  const updateReferralSettings = useMutation({
    mutationFn: (payload: any) => apiPut("/admin/referrals/settings", payload),
    onSuccess: () => {
      toast.success("Referral stacking & calculation rules updated");
      qc.invalidateQueries({ queryKey: ["referral-settings"] });
      setIsSettingsModalOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update settings"),
  });

  const saveRule = useMutation({
    mutationFn: (payload: any) =>
      editingRule ? apiPut(`/admin/referrals/rules/${editingRule.id}`, payload) : apiPost("/admin/referrals/rules", payload),
    onSuccess: () => {
      setIsRuleModalOpen(false);
      setEditingRule(null);
      qc.invalidateQueries({ queryKey: ["referral-rules"] });
      toast.success("Referral rule saved successfully");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save rule"),
  });

  const deleteRule = useMutation({
    mutationFn: (rid: string) => apiDelete(`/admin/referrals/rules/${rid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referral-rules"] });
      toast.success("Referral rule deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete rule"),
  });

  const bulkActionRules = useMutation({
    mutationFn: ({ rule_ids, action }: { rule_ids: string[]; action: "activate" | "deactivate" | "delete" }) =>
      apiPost("/admin/referrals/rules/bulk", { rule_ids, action }),
    onSuccess: (data: any) => {
      setSelectedRuleIds([]);
      qc.invalidateQueries({ queryKey: ["referral-rules"] });
      toast.success(data?.message || "Bulk action completed");
    },
    onError: (e: any) => toast.error(e.message || "Bulk action failed"),
  });

  const openCreateRuleModal = () => {
    setEditingRule(null);
    setRuleName("");
    setRuleProductIds([]);
    setProductSearch("");
    setRuleCommissionType("PERCENTAGE");
    setRuleCommissionValue("5");
    setRuleCommissionBasis("selling_price");
    setRuleDiscountType("PERCENTAGE");
    setRuleDiscountValue("3");
    setRuleIsActive(true);
    setRuleValidFrom("");
    setRuleValidUntil("");
    setRuleNotes("");
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: any) => {
    setEditingRule(rule);
    setRuleName(rule.rule_name || rule.name || "");
    const pIds = rule.product_ids || (rule.product_id ? [rule.product_id] : []);
    setRuleProductIds(pIds);
    setProductSearch("");
    const commType = (rule.commission_type || rule.reward_type || "PERCENTAGE").toUpperCase();
    setRuleCommissionType(commType === "FLAT" || commType === "FIXED" ? "FLAT" : "PERCENTAGE");
    setRuleCommissionValue(String(rule.commission_value ?? rule.value ?? 5));
    setRuleCommissionBasis(rule.commission_basis || "selling_price");
    const discType = (rule.discount_type || "PERCENTAGE").toUpperCase();
    setRuleDiscountType(discType === "FLAT" || discType === "FIXED" ? "FLAT" : "PERCENTAGE");
    setRuleDiscountValue(String(rule.discount_value ?? 0));
    setRuleIsActive(rule.is_active !== false);
    setRuleValidFrom(rule.effective_from || "");
    setRuleValidUntil(rule.effective_until || "");
    setRuleNotes(rule.notes || "");
    setIsRuleModalOpen(true);
  };

  // ==========================================
  // 6. FRAUD QUERY
  // ==========================================
  const { data: fraudData } = useQuery<any>({
    queryKey: ["referral-fraud-alerts"],
    queryFn: () => apiGet<any>("/admin/referrals/fraud-alerts"),
    enabled: activeTab === "fraud",
  });

  // ==========================================
  // MUTATIONS (VERIFICATIONS & WITHDRAWAL ACTIONS)
  // ==========================================
  const verifyKYC = useMutation({
    mutationFn: ({ userId, action, reason }: { userId: string; action: "VERIFY" | "REJECT"; reason?: string }) =>
      apiPost(`/admin/referrals/referrers/${userId}/kyc-verify`, { action, reason }),
    onSuccess: () => {
      setKycRejectModal({ open: false, userId: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["admin-referrer-detail", selectedUserId] });
      qc.invalidateQueries({ queryKey: ["admin-referrers"] });
      toast.success("KYC status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update KYC"),
  });

  const verifyBank = useMutation({
    mutationFn: ({ userId, action, reason }: { userId: string; action: "VERIFY" | "REJECT"; reason?: string }) =>
      apiPost(`/admin/referrals/referrers/${userId}/bank-verify`, { action, reason }),
    onSuccess: () => {
      setBankRejectModal({ open: false, userId: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["admin-referrer-detail", selectedUserId] });
      qc.invalidateQueries({ queryKey: ["admin-referrers"] });
      toast.success("Bank verification status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update Bank status"),
  });

  const reviewWithdrawal = useMutation({
    mutationFn: ({ wid, action, reason }: { wid: string; action: "APPROVE" | "HOLD" | "REJECT"; reason?: string }) =>
      apiPost(`/admin/referrals/withdrawals/${wid}/review`, { action, reason }),
    onSuccess: (data: any, vars) => {
      setHoldModal({ open: false, wid: "", reason: "" });
      setRejectWithdrawalModal({ open: false, wid: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["referrals-overview"] });
      if (vars.action === "APPROVE") {
        toast.success(
          "Withdrawal approved and marked for processing. Referrer will be notified of expected 7–10 days disbursement."
        );
      } else if (vars.action === "REJECT") {
        toast.success("Withdrawal rejected. Reserved amount restored to Referrer's available wallet balance.");
      } else {
        toast.success("Withdrawal request placed on hold.");
      }
    },
    onError: (e: any) => toast.error(e.message || "Action failed"),
  });

  const markWithdrawalPaid = useMutation({
    mutationFn: ({
      wid,
      utr,
      method,
      date,
    }: {
      wid: string;
      utr: string;
      method: string;
      date: string;
    }) =>
      apiPost(`/admin/referrals/withdrawals/${wid}/mark-paid`, {
        utr_number: utr,
        payment_method: method,
        payment_date: date,
      }),
    onSuccess: () => {
      setMarkPaidModal({ open: false, item: null, utr: "", method: "NEFT", date: "" });
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["referrals-overview"] });
      toast.success("Payout confirmed with UTR reference. Marked as PAID.");
    },
    onError: (e: any) => toast.error(e.message || "Failed to mark paid"),
  });

  // Sort handler for Referrers Table
  const handleSort = (field: string) => {
    if (refSortBy === field) {
      setRefSortDir(refSortDir === "asc" ? "desc" : "asc");
    } else {
      setRefSortBy(field);
      setRefSortDir("desc");
    }
    setRefPage(1);
  };

  return (
    <div className="space-y-6" data-testid="refer-earn-hub">
      {/* Header with Title and Export Options */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Refer & Earn Management</h1>
          <p className="text-sm text-muted-foreground">
            Complete referral attribution, commission ledger, wallet balances, KYC, and Section 393 payout disbursement engine.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/admin/referrals/export/leads"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" /> Export Referral Leads
          </a>
          <a
            href="/api/admin/referrals/export/referrers"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export Referrers
          </a>

          <a
            href="/api/admin/referrals/export/rules"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" /> Export Rules
          </a>
          <a
            href="/api/admin/referrals/export/discounts"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" /> Export Discounts
          </a>
          <a
            href="/api/admin/referrals/export/withdrawals"
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" /> Export Payouts
          </a>
          <Button
            variant="outline"
            onClick={() => setIsSettingsModalOpen(true)}
            className="text-xs"
          >
            <Settings className="w-3.5 h-3.5 mr-1.5" /> Stacking Rules
          </Button>
          <Button
            onClick={openCreateRuleModal}
            className="bg-primary text-primary-foreground text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> + CREATE REFERRAL RULE
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. TOP 8 AUTHORITATIVE KPI CARDS                             */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
        {/* TOTAL REFERRERS */}
        <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Referrers</span>
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-1.5 text-xl font-bold">{overview?.total_referrers ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Enrolled partners</div>
        </div>

        {/* TOTAL REFERRAL LEADS */}
        <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Leads</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-emerald-700">{overview?.total_referral_leads ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Attributed clicks/leads</div>
        </div>

        {/* REFERRAL SALES */}
        <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sales Count</span>
            <ShoppingBag className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-1.5 text-xl font-bold">{overview?.referral_sales ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Paid eligible orders</div>
        </div>

        {/* REFERRAL SALES VALUE */}
        <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sales Value</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-base font-bold text-emerald-700 truncate">
            {overview?.referral_sales_value ? inr(overview.referral_sales_value) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Gross order value</div>
        </div>

        {/* CUSTOMER REFERRAL DISCOUNTS GIVEN */}
        <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 shadow-sm">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cust. Discounts</span>
            <Tag className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="mt-1.5 text-base font-bold text-purple-900 truncate">
            {overview?.customer_discounts_given ? inr(overview.customer_discounts_given) : "—"}
          </div>
          <div className="text-[10px] text-purple-700 mt-0.5">Discounts granted</div>
        </div>

        {/* PENDING COMMISSION */}
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Comm.</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1.5 text-base font-bold text-amber-900 truncate">
            {overview?.pending_commission ? inr(overview.pending_commission) : "—"}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">Clearing hold</div>
        </div>

        {/* APPROVED COMMISSION */}
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Approved Ready</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-base font-bold text-emerald-900 truncate">
            {overview?.approved_commission ? inr(overview.approved_commission) : "—"}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">In wallet balance</div>
        </div>

        {/* TOTAL COMMISSION EARNED */}
        <div className="p-3 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Earned</span>
            <Tag className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-1.5 text-base font-bold truncate">
            {overview?.total_commission_earned ? inr(overview.total_commission_earned) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Lifetime accrued</div>
        </div>

        {/* PENDING WITHDRAWALS */}
        <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50 shadow-sm">
          <div className="flex items-center justify-between text-orange-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Payouts</span>
            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-orange-900">{overview?.pending_withdrawals ?? 0}</div>
          <div className="text-[10px] text-orange-700 mt-0.5">Awaiting disbursement</div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "referrers" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("referrers")}
          data-testid="admin-tab-referrers"
        >
          <Users className="w-4 h-4 mr-1.5" /> Referrers
        </Button>
        <Button
          variant={activeTab === "leads" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("leads")}
          data-testid="admin-tab-leads"
        >
          <TrendingUp className="w-4 h-4 mr-1.5" /> Referral Leads & Funnel
        </Button>

        <Button
          variant={activeTab === "withdrawals" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("withdrawals")}
          className="relative"
          data-testid="admin-tab-withdrawals"
        >
          <CreditCard className="w-4 h-4 mr-1.5" /> Withdrawal Requests
          {(overview?.pending_withdrawals ?? 0) > 0 && (
            <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {overview?.pending_withdrawals}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === "tax_settings" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("tax_settings")}
          data-testid="admin-tab-tax-settings"
        >
          <Building className="w-4 h-4 mr-1.5" /> Tax / TDS Settings
        </Button>
        <Button
          variant={activeTab === "rules" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("rules")}
          data-testid="admin-tab-rules"
        >
          <Tag className="w-4 h-4 mr-1.5" /> Commission Rules
        </Button>
        <Button
          variant={activeTab === "fraud" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("fraud")}
          data-testid="admin-tab-fraud"
        >
          <ShieldAlert className="w-4 h-4 mr-1.5" /> Fraud & Risk
        </Button>
      </div>

      {/* ============================================================ */}
      {/* 2. TAB: REFERRERS TABLE WITH SEARCH, ADVANCED FILTERS, SORT   */}
      {/* ============================================================ */}
      {activeTab === "referrers" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or code..."
                  value={refSearch}
                  onChange={(e) => {
                    setRefSearch(e.target.value);
                    setRefPage(1);
                  }}
                  className="pl-9"
                  data-testid="referrers-search-input"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={refStatusFilter}
                  onChange={(e) => {
                    setRefStatusFilter(e.target.value);
                    setRefPage(1);
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Referrers</option>
                  <option value="INACTIVE">Inactive Referrers</option>
                </select>
              </div>

              {/* Date Presets */}
              <div>
                <select
                  value={refDatePreset}
                  onChange={(e) => {
                    setRefDatePreset(e.target.value);
                    setRefPage(1);
                  }}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ALL">Date Joined: All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Reset Filters */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRefSearch("");
                    setRefStatusFilter("ALL");
                    setRefLeadFilterType("all");
                    setRefLeadVal1("");
                    setRefLeadVal2("");
                    setRefSalesFilterType("all");
                    setRefSalesVal1("");
                    setRefSalesVal2("");
                    setRefDatePreset("ALL");
                    setRefStartDate("");
                    setRefEndDate("");
                    setRefPage(1);
                  }}
                  className="w-full"
                >
                  Reset Filters
                </Button>
              </div>
            </div>

            {/* Custom Date Inputs if 'custom' is selected */}
            {refDatePreset === "custom" && (
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-xs">
                  <span>From:</span>
                  <Input
                    type="date"
                    value={refStartDate}
                    onChange={(e) => setRefStartDate(e.target.value)}
                    className="w-36 h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>To:</span>
                  <Input
                    type="date"
                    value={refEndDate}
                    onChange={(e) => setRefEndDate(e.target.value)}
                    className="w-36 h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Numeric Filters for Leads and Sales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border text-xs">
              {/* Leads Count Filter */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground w-20">Leads:</span>
                <select
                  value={refLeadFilterType}
                  onChange={(e) => setRefLeadFilterType(e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="all">Any Count</option>
                  <option value="eq">Equals (=)</option>
                  <option value="gte">Greater Than or Equal (&gt;=)</option>
                  <option value="lte">Less Than or Equal (&lt;=)</option>
                  <option value="range">Range (min - max)</option>
                </select>
                {refLeadFilterType !== "all" && (
                  <Input
                    type="number"
                    placeholder="Val"
                    value={refLeadVal1}
                    onChange={(e) => setRefLeadVal1(e.target.value)}
                    className="w-20 h-8 text-xs"
                  />
                )}
                {refLeadFilterType === "range" && (
                  <>
                    <span>-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={refLeadVal2}
                      onChange={(e) => setRefLeadVal2(e.target.value)}
                      className="w-20 h-8 text-xs"
                    />
                  </>
                )}
              </div>

              {/* Sales Count Filter */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground w-20">Sales:</span>
                <select
                  value={refSalesFilterType}
                  onChange={(e) => setRefSalesFilterType(e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="all">Any Count</option>
                  <option value="eq">Equals (=)</option>
                  <option value="gte">Greater Than or Equal (&gt;=)</option>
                  <option value="lte">Less Than or Equal (&lt;=)</option>
                  <option value="range">Range (min - max)</option>
                </select>
                {refSalesFilterType !== "all" && (
                  <Input
                    type="number"
                    placeholder="Val"
                    value={refSalesVal1}
                    onChange={(e) => setRefSalesVal1(e.target.value)}
                    className="w-20 h-8 text-xs"
                  />
                )}
                {refSalesFilterType === "range" && (
                  <>
                    <span>-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={refSalesVal2}
                      onChange={(e) => setRefSalesVal2(e.target.value)}
                      className="w-20 h-8 text-xs"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* REFERRERS TABLE */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">
                        Referral Name {refSortBy === "name" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead>Referral Code</TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("leads")}>
                      <div className="flex items-center justify-center gap-1">
                        Leads {refSortBy === "leads" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-center" onClick={() => handleSort("sales")}>
                      <div className="flex items-center justify-center gap-1">
                        Sales {refSortBy === "sales" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort("sales_value")}>
                      <div className="flex items-center justify-end gap-1">
                        Sales Value {refSortBy === "sales_value" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort("pending")}>
                      <div className="flex items-center justify-end gap-1">
                        Pending {refSortBy === "pending" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort("available")}>
                      <div className="flex items-center justify-end gap-1">
                        Approved / Avail {refSortBy === "available" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort("earned")}>
                      <div className="flex items-center justify-end gap-1">
                        Total Earned {refSortBy === "earned" && <ArrowUpDown className="h-3 w-3" />}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Withdrawn / Paid</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrersLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                        Loading authoritative referrers...
                      </TableCell>
                    </TableRow>
                  ) : (referrersData?.referrers || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                        No referrers matched your filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (referrersData?.referrers || []).map((r: ReferrerRow) => (
                      <TableRow key={r.user_id} className="hover:bg-muted/20 text-xs">
                        <TableCell className="font-semibold text-foreground py-3">
                          <div>{r.name}</div>
                          <div className="text-[11px] text-muted-foreground font-normal">{r.email}</div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-primary">{r.referral_code}</TableCell>
                        <TableCell className="text-center font-semibold">{r.leads_count}</TableCell>
                        <TableCell className="text-center font-semibold text-emerald-700">{r.sales_count}</TableCell>
                        <TableCell className="text-right font-medium">{inr(r.sales_value)}</TableCell>
                        <TableCell className="text-right text-amber-700 font-medium">{inr(r.pending_amount)}</TableCell>
                        <TableCell className="text-right text-emerald-700 font-bold">{inr(r.available_amount)}</TableCell>
                        <TableCell className="text-right font-semibold">{inr(r.total_earned)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{inr(r.paid_amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              r.status === "Active"
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-border text-muted-foreground"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUserId(r.user_id);
                              setDetailActiveTab("profile");
                            }}
                            className="h-7 px-2.5 text-xs text-primary hover:bg-primary hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <div>
                Total Referrers: <strong>{referrersData?.total || 0}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refPage <= 1}
                  onClick={() => setRefPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2 text-xs"
                >
                  Previous
                </Button>
                <span>
                  Page {refPage} of {Math.max(1, Math.ceil((referrersData?.total || 0) / refPageSize))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={refPage >= Math.ceil((referrersData?.total || 0) / refPageSize)}
                  onClick={() => setRefPage((p) => p + 1)}
                  className="h-8 px-2 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2B. TAB: REFERRAL LEADS & FUNNEL ANALYTICS                   */}
      {/* ============================================================ */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Funnel Metrics Cards */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base">Referral Conversion Funnel</h3>
                <p className="text-xs text-muted-foreground">
                  Complete acquisition journey from referral link entry to verified paid conversions.
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                Conversion: {overview?.funnel?.conversion_rate ?? 0}%
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">1. Link Visits</span>
                <div className="text-xl font-bold mt-1">{overview?.funnel?.visits ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Clicks tracked</div>
              </div>
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <span className="text-[10px] font-bold uppercase text-emerald-800">2. Qualified Leads</span>
                <div className="text-xl font-bold text-emerald-900 mt-1">{overview?.funnel?.leads ?? 0}</div>
                <div className="text-[10px] text-emerald-700">Meaningful action</div>
              </div>
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                <span className="text-[10px] font-bold uppercase text-blue-800">3. Accounts Created</span>
                <div className="text-xl font-bold text-blue-900 mt-1">{overview?.funnel?.accounts_created ?? 0}</div>
                <div className="text-[10px] text-blue-700">Registered users</div>
              </div>
              <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/50">
                <span className="text-[10px] font-bold uppercase text-indigo-800">4. Carts Active</span>
                <div className="text-xl font-bold text-indigo-900 mt-1">{overview?.funnel?.carts_active ?? 0}</div>
                <div className="text-[10px] text-indigo-700">Added product</div>
              </div>
              <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/50">
                <span className="text-[10px] font-bold uppercase text-purple-800">5. Checkout Started</span>
                <div className="text-xl font-bold text-purple-900 mt-1">{overview?.funnel?.checkout_started ?? 0}</div>
                <div className="text-[10px] text-purple-700">Entered checkout</div>
              </div>
              <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-100/60">
                <span className="text-[10px] font-bold uppercase text-emerald-900">6. Verified Sales</span>
                <div className="text-xl font-bold text-emerald-950 mt-1">{overview?.funnel?.sales ?? 0}</div>
                <div className="text-[10px] text-emerald-800 font-semibold">Paid orders</div>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "All Leads", val: "ALL" },
                { label: "Cart Active", val: "CART_ACTIVE" },
                { label: "Account Created", val: "ACCOUNT_CREATED" },
                { label: "Checkout Started", val: "CHECKOUT_STARTED" },
                { label: "Payment Cancelled", val: "PAYMENT_CANCELLED" },
                { label: "Converted / Paid", val: "CONVERTED" },
              ].map((pill) => (
                <Button
                  key={pill.val}
                  variant={leadStatusFilter === pill.val ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setLeadStatusFilter(pill.val);
                    setLeadPage(1);
                  }}
                  className="h-8 text-xs"
                >
                  {pill.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-64">
                <Input
                  placeholder="Search lead, customer, code..."
                  value={leadSearch}
                  onChange={(e) => {
                    setLeadSearch(e.target.value);
                    setLeadPage(1);
                  }}
                  className="h-9 text-xs"
                />
              </div>
              <a
                href="/api/admin/referrals/export/leads"
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted shadow-sm h-9"
              >
                <Download className="h-3.5 w-3.5" /> Export
              </a>
            </div>
          </div>

          {/* Leads Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {leadsLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading referral leads...</div>
            ) : !leadsData?.leads || leadsData.leads.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No referral leads found for the selected criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>First Attributed</TableHead>
                      <TableHead>Current Activity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead className="text-right">Sales Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {leadsData.leads.map((lead: any) => (
                      <TableRow key={lead.id || lead._id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-mono font-semibold text-foreground">
                          {lead.lead_number || `#REF-${(lead.id || "").slice(-6).toUpperCase()}`}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-foreground">{lead.customer_name || "Guest Lead"}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {lead.customer_email || lead.customer_phone || "—"}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-brand-deep">
                          {lead.referral_code}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                          {lead.first_attributed ? lead.first_attributed.slice(0, 10) : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-foreground">
                          {lead.current_activity || "Cart / Browse"}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono uppercase ${
                              lead.status === "CONVERTED" || lead.status === "PURCHASED"
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold"
                                : lead.status === "PAYMENT_CANCELLED" || lead.status === "PAYMENT_FAILED"
                                ? "border-amber-400 bg-amber-50 text-amber-800"
                                : "border-slate-300 bg-slate-50 text-slate-700"
                            }`}
                          >
                            {lead.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {lead.orders && lead.orders.length > 0 ? (
                            <span className="font-semibold text-emerald-700">{lead.orders.join(", ")}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold">
                          {lead.sales_value ? inr(lead.sales_value) : "—"}
                        </td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Leads Pagination */}
            {leadsData && leadsData.total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <div>
                  Total Leads: <strong>{leadsData.total}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={leadPage <= 1}
                    onClick={() => setLeadPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2 text-xs"
                  >
                    Previous
                  </Button>
                  <span>
                    Page {leadPage} of {Math.max(1, Math.ceil(leadsData.total / 15))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={leadPage >= Math.ceil(leadsData.total / 15)}
                    onClick={() => setLeadPage((p) => p + 1)}
                    className="h-8 px-2 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}

      {/* 3. TAB: WITHDRAWAL REQUESTS & PAYOUT QUEUE                   */}
      {/* ============================================================ */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          {/* Status Metrics Pills */}
          {withdrawalsData?.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/60">
                <span className="text-[10px] font-bold uppercase text-orange-800">Pending Requests</span>
                <div className="text-xl font-bold text-orange-900 mt-1">
                  {withdrawalsData.metrics.pending_requests}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60">
                <span className="text-[10px] font-bold uppercase text-amber-800">On Hold</span>
                <div className="text-xl font-bold text-amber-900 mt-1">{withdrawalsData.metrics.on_hold}</div>
              </div>
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60">
                <span className="text-[10px] font-bold uppercase text-blue-800">Approved / Processing</span>
                <div className="text-xl font-bold text-blue-900 mt-1">
                  {withdrawalsData.metrics.approved + withdrawalsData.metrics.processing}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <span className="text-[10px] font-bold uppercase text-emerald-800">Paid Disbursed</span>
                <div className="text-xl font-bold text-emerald-900 mt-1">{withdrawalsData.metrics.paid}</div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-card">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Total Disbursed</span>
                <div className="text-base font-bold text-emerald-700 mt-1 truncate">
                  {inr(withdrawalsData.metrics.total_paid)}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border bg-card">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">TDS Deducted</span>
                <div className="text-base font-bold text-rose-700 mt-1 truncate">
                  {inr(withdrawalsData.metrics.tds_deducted)}
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "All", val: "ALL" },
                { label: "Pending", val: "PENDING" },
                { label: "On Hold", val: "ON_HOLD" },
                { label: "Approved / Processing", val: "APPROVED" },
                { label: "Paid", val: "PAID" },
                { label: "Rejected", val: "REJECTED" },
              ].map((pill) => (
                <Button
                  key={pill.val}
                  variant={withStatusFilter === pill.val ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setWithStatusFilter(pill.val);
                    setWithPage(1);
                  }}
                  className="h-8 text-xs"
                >
                  {pill.label}
                </Button>
              ))}
            </div>
            <div className="w-64">
              <Input
                placeholder="Search request, code, UTR..."
                value={withSearch}
                onChange={(e) => {
                  setWithSearch(e.target.value);
                  setWithPage(1);
                }}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Withdrawals Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead>Request ID</TableHead>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Referral Code</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead className="text-center">KYC</TableHead>
                    <TableHead className="text-center">Bank</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawalsLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                        Loading withdrawal requests...
                      </TableCell>
                    </TableRow>
                  ) : (withdrawalsData?.withdrawals || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                        No withdrawal requests in this status.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (withdrawalsData?.withdrawals || []).map((w: WithdrawalItem) => {
                      const isPending = w.status === "REQUESTED" || w.status === "UNDER_REVIEW";
                      const isApproved = w.status === "APPROVED" || w.status === "PROCESSING";
                      const isHold = w.status === "ON_HOLD";
                      const isPaid = w.status === "PAID";

                      return (
                        <TableRow key={w.id} className="hover:bg-muted/20 text-xs">
                          <TableCell className="font-mono font-bold text-primary">{w.request_number || w.id}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground">{w.user_name}</div>
                            <div className="text-[11px] text-muted-foreground">{w.user_email}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{w.referral_code}</TableCell>
                          <TableCell className="text-right font-semibold">{inr(w.amount)}</TableCell>
                          <TableCell className="text-right text-rose-700">
                            {w.tds_amount > 0 ? `−${inr(w.tds_amount)} (${w.tds_rate}%)` : "₹0"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-700">{inr(w.net_payable)}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                w.kyc_status === "VERIFIED"
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 text-[10px]"
                                  : "border-amber-500 bg-amber-50 text-amber-800 text-[10px]"
                              }
                            >
                              {w.kyc_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                w.bank_status === "VERIFIED"
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 text-[10px]"
                                  : "border-amber-500 bg-amber-50 text-amber-800 text-[10px]"
                              }
                            >
                              {w.bank_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {w.created_at ? w.created_at.slice(0, 10) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                isPaid
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                  : isApproved
                                  ? "border-blue-500 bg-blue-50 text-blue-800"
                                  : isHold
                                  ? "border-amber-500 bg-amber-50 text-amber-800"
                                  : "border-border text-foreground"
                              }
                            >
                              {w.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Pending actions */}
                              {(isPending || isHold) && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => reviewWithdrawal.mutate({ wid: w.id, action: "APPROVE" })}
                                    disabled={reviewWithdrawal.isPending}
                                    className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                                  >
                                    Approve
                                  </Button>
                                  {isPending && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setHoldModal({ open: true, wid: w.id, reason: "" })}
                                      className="h-7 px-2 border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px]"
                                    >
                                      Hold
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRejectWithdrawalModal({ open: true, wid: w.id, reason: "" })}
                                    className="h-7 px-2 border-rose-300 text-rose-800 hover:bg-rose-50 text-[11px]"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}

                              {/* Approved / Processing -> Mark Paid */}
                              {isApproved && (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setMarkPaidModal({
                                      open: true,
                                      item: w,
                                      utr: "",
                                      method: "NEFT",
                                      date: new Date().toISOString().slice(0, 10),
                                    })
                                  }
                                  className="h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px]"
                                >
                                  Mark as Paid
                                </Button>
                              )}

                              {isPaid && (
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  UTR: {w.payout_details?.utr_number || "Paid"}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <div>
                Total Requests: <strong>{withdrawalsData?.total || 0}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={withPage <= 1}
                  onClick={() => setWithPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2 text-xs"
                >
                  Previous
                </Button>
                <span>Page {withPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(withdrawalsData?.withdrawals || []).length < 15}
                  onClick={() => setWithPage((p) => p + 1)}
                  className="h-8 px-2 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. TAB: STATUTORY TAX / TDS SETTINGS (SECTION 393 COMPLIANT)  */}
      {/* ============================================================ */}
      {activeTab === "tax_settings" && (
        <div className="max-w-3xl space-y-6">
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Statutory Tax & Accounting Notice (Section 393, Income-tax Act, 2025)</p>
              <p className="mt-1">
                "Tax configuration must match Kotson's current statutory requirements. Non-salary withholding including
                commission/brokerage falls under the applicable provisions of Section 393. The exact applicable rate,
                threshold, PAN/no-PAN treatment, and exemptions must be confirmed by Kotson's accountant/tax
                professional. Do not make unverified assumptions."
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <h3 className="font-heading font-bold text-lg">Tax / TDS Configuration Engine</h3>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-muted/30">
              <div>
                <span className="font-semibold text-sm">Enable Statutory TDS Withholding</span>
                <p className="text-xs text-muted-foreground">
                  Automatically calculate and deduct TDS from approved referral disbursements.
                </p>
              </div>
              <input
                type="checkbox"
                checked={formTdsEnabled}
                onChange={(e) => setFormTdsEnabled(e.target.checked)}
                className="h-5 w-5 rounded border-input text-primary focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tds-nature">Payment Nature / Accounting Classification *</Label>
                <Input
                  id="tds-nature"
                  value={formPaymentNature}
                  onChange={(e) => setFormPaymentNature(e.target.value)}
                  placeholder="e.g. Brokerage / Referral Commission (Sec 393)"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="tds-threshold">Applicable Threshold (INR) *</Label>
                <Input
                  id="tds-threshold"
                  type="number"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Threshold exemption limit per financial year.</p>
              </div>

              <div>
                <Label htmlFor="tds-pan-rate">PAN Available Rate (%) *</Label>
                <Input
                  id="tds-pan-rate"
                  type="number"
                  step="0.1"
                  value={formPanRate}
                  onChange={(e) => setFormPanRate(e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Rate applied when referrer has verified PAN.</p>
              </div>

              <div>
                <Label htmlFor="tds-nopan-rate">PAN Not Available Rate (%) *</Label>
                <Input
                  id="tds-nopan-rate"
                  type="number"
                  step="0.1"
                  value={formNoPanRate}
                  onChange={(e) => setFormNoPanRate(e.target.value)}
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Rate applied if PAN is absent/unverified.</p>
              </div>

              <div>
                <Label htmlFor="tds-eff-from">Effective From Date *</Label>
                <Input
                  id="tds-eff-from"
                  type="date"
                  value={formEffectiveFrom}
                  onChange={(e) => setFormEffectiveFrom(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="tds-eff-until">Effective Until Date (Optional)</Label>
                <Input
                  id="tds-eff-until"
                  type="date"
                  value={formEffectiveUntil}
                  onChange={(e) => setFormEffectiveUntil(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tds-notes">Accounting & Statutory Notes</Label>
              <Textarea
                id="tds-notes"
                value={formTaxNotes}
                onChange={(e) => setFormTaxNotes(e.target.value)}
                placeholder="Internal accounting reference or tax counsel circular..."
                className="mt-1 h-20"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button
                onClick={() => {
                  updateTaxSettings.mutate({
                    tds_enabled: formTdsEnabled,
                    payment_nature: formPaymentNature,
                    pan_available_rate: parseFloat(formPanRate) || 0,
                    pan_not_available_rate: parseFloat(formNoPanRate) || 0,
                    applicable_threshold: parseFloat(formThreshold) || 0,
                    effective_from: formEffectiveFrom,
                    effective_until: formEffectiveUntil || null,
                    notes: formTaxNotes,
                  });
                }}
                disabled={updateTaxSettings.isPending}
                className="bg-primary text-primary-foreground"
              >
                {updateTaxSettings.isPending ? "Saving..." : "Save Statutory TDS Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ============================================================ */}
      {/* 5. TAB: REFERRAL RULES (PRODUCT-LEVEL & BULK MANAGEMENT)     */}
      {/* ============================================================ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-heading font-bold text-lg">Authoritative Referral Rules</h3>
              <p className="text-xs text-muted-foreground">
                Set product-specific Referrer Commissions and Customer Referral Discounts. Rules snapshot permanently on orders.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsModalOpen(true)}
                className="text-xs"
              >
                <Sliders className="h-3.5 w-3.5 mr-1.5" /> Stacking & Price Basis
              </Button>
              <Button
                size="sm"
                onClick={openCreateRuleModal}
                className="bg-primary text-primary-foreground text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> + CREATE REFERRAL RULE
              </Button>
            </div>
          </div>

          {/* Bulk Action Toolbar */}
          {selectedRuleIds.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Badge variant="default" className="text-xs">{selectedRuleIds.length}</Badge>
                <span>rule(s) selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkActionRules.mutate({ rule_ids: selectedRuleIds, action: "activate" })}
                  disabled={bulkActionRules.isPending}
                  className="h-7 text-xs border-emerald-400 text-emerald-800 hover:bg-emerald-50"
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Activate Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkActionRules.mutate({ rule_ids: selectedRuleIds, action: "deactivate" })}
                  disabled={bulkActionRules.isPending}
                  className="h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
                >
                  <PauseCircle className="h-3.5 w-3.5 mr-1" /> Deactivate Selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${selectedRuleIds.length} rule(s)?`)) {
                      bulkActionRules.mutate({ rule_ids: selectedRuleIds, action: "delete" });
                    }
                  }}
                  disabled={bulkActionRules.isPending}
                  className="h-7 text-xs border-rose-400 text-rose-800 hover:bg-rose-50"
                >
                  <Trash className="h-3.5 w-3.5 mr-1" /> Delete Selected
                </Button>
                <button
                  onClick={() => setSelectedRuleIds([])}
                  className="text-muted-foreground hover:text-foreground text-xs underline ml-1"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Rule Management Table (Requirement 8) */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRuleIds.length === rules.length && rules.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRuleIds(rules.map((r) => r.id));
                        } else {
                          setSelectedRuleIds([]);
                        }
                      }}
                      className="rounded border-border text-primary cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Customer Discount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Valid From</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground text-xs">
                      No referral rules configured yet. Click "+ CREATE REFERRAL RULE" to assign product-level commission and customer discounts.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => {
                    const isSelected = selectedRuleIds.includes(rule.id);
                    const commType = (rule.commission_type || rule.reward_type || "PERCENTAGE").toUpperCase();
                    const commVal = commType === "FLAT" || commType === "FIXED" ? inr(rule.commission_value || rule.value) : `${rule.commission_value || rule.value}%`;

                    const discType = (rule.discount_type || "PERCENTAGE").toUpperCase();
                    const discVal = discType === "FLAT" || discType === "FIXED" ? inr(rule.discount_value || 0) : `${rule.discount_value || 0}%`;

                    const prodCount = rule.products?.length || (rule.product_ids?.length || 1);

                    return (
                      <TableRow key={rule.id} className={`hover:bg-muted/20 text-xs ${isSelected ? "bg-muted/30" : ""}`}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRuleIds([...selectedRuleIds, rule.id]);
                              } else {
                                setSelectedRuleIds(selectedRuleIds.filter((id) => id !== rule.id));
                              }
                            }}
                            className="rounded border-border text-primary cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-foreground max-w-xs">
                          <div className="truncate font-medium" title={rule.product_names}>
                            {rule.product_names || "All Products"}
                          </div>
                          {prodCount > 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              {prodCount} products linked
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {rule.categories || "Catalogue"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {commVal}
                        </TableCell>
                        <TableCell className="text-right font-bold text-purple-700">
                          {discVal}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={
                              rule.is_active !== false
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                                : "border-border text-muted-foreground"
                            }
                          >
                            {rule.is_active !== false ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {rule.effective_from ? rule.effective_from.slice(0, 10) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {rule.effective_until ? rule.effective_until.slice(0, 10) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {rule.updated_at ? rule.updated_at.slice(0, 10) : "Today"}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditRuleModal(rule)}
                              className="h-7 px-2 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete rule "${rule.rule_name}"?`)) {
                                  deleteRule.mutate(rule.id);
                                }
                              }}
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. TAB: FRAUD & RISK AUDIT (SELF-REFERRAL PROTECTION)         */}
      {/* ============================================================ */}
      {activeTab === "fraud" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="font-heading font-bold text-lg">Self-Referral & Abuse Prevention Audit</h3>
            <p className="text-xs text-muted-foreground">
              Automated heuristics detecting suspicious duplicate phone numbers, matching shipping addresses, and
              self-referral attribution attempts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm">
                <ShieldAlert className="h-4 w-4" /> Self-Referral Prevention Rules
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">
                <li>Referrer cannot attribute an order made by their own user account or phone number.</li>
                <li>Attribution cookies are locked to initial touch attribution and validated server-side.</li>
                <li>Cancelled or returned orders trigger automatic commission reversal ledger records.</li>
                <li>Withdrawal requests re-verify wallet ledger balance integrity against all settled orders.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4" /> Immutable Financial Ledger
              </div>
              <p className="text-xs text-muted-foreground">
                Every rupee in Refer & Earn flows through the double-entry `wallet_ledger` collection. Balances cannot
                be mutated directly without a corresponding transaction (`COMMISSION_PENDING`, `COMMISSION_APPROVED`,
                `WITHDRAWAL_RESERVED`, `PAYOUT_PAID`).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* REFERRER DETAIL MODAL (SECTION 7-9 OF SPEC)                  */}
      {/* ============================================================ */}
      {selectedUserId && referrerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Referrer Profile</span>
                <h2 className="font-heading font-bold text-2xl">{referrerDetail.profile.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>Code: <strong className="font-mono text-foreground">{referrerDetail.profile.referral_code}</strong></span>
                  <span>•</span>
                  <span>{referrerDetail.profile.email}</span>
                  <span>•</span>
                  <span>Phone: {referrerDetail.profile.phone || "—"}</span>
                  <span>•</span>
                  <span>Joined: {referrerDetail.profile.date_joined ? referrerDetail.profile.date_joined.slice(0, 10) : "—"}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Performance Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 bg-muted/40 p-3 rounded-xl text-xs">
              <div>
                <span className="text-muted-foreground">Leads</span>
                <div className="font-bold text-sm mt-0.5">{referrerDetail.performance.total_leads}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Sales</span>
                <div className="font-bold text-sm mt-0.5 text-emerald-700">{referrerDetail.performance.total_sales}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Sales Val</span>
                <div className="font-bold text-sm mt-0.5">{inr(referrerDetail.performance.sales_value)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Conv. Rate</span>
                <div className="font-bold text-sm mt-0.5">{referrerDetail.performance.conversion_rate}%</div>
              </div>
              <div>
                <span className="text-muted-foreground">Pending</span>
                <div className="font-bold text-sm mt-0.5 text-amber-700">{inr(referrerDetail.performance.pending_commission)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Available</span>
                <div className="font-bold text-sm mt-0.5 text-emerald-700">{inr(referrerDetail.performance.available_commission)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Earned</span>
                <div className="font-bold text-sm mt-0.5">{inr(referrerDetail.performance.total_earned)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Paid</span>
                <div className="font-bold text-sm mt-0.5">{inr(referrerDetail.performance.total_paid)}</div>
              </div>
            </div>

            {/* KYC & Bank Verification Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* KYC Card */}
              <div className="rounded-xl border border-border p-4 bg-background space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" /> PAN Details (KYC)
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      referrerDetail.kyc.status === "VERIFIED"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-amber-500 bg-amber-50 text-amber-800"
                    }
                  >
                    {referrerDetail.kyc.status}
                  </Badge>
                </div>
                <div>Masked PAN: <span className="font-mono font-bold">{referrerDetail.kyc.pan_masked || "Not Submitted"}</span></div>
                <div>Name on PAN: <span className="font-medium">{referrerDetail.kyc.name_as_per_pan || "—"}</span></div>
                {referrerDetail.kyc.status !== "VERIFIED" && referrerDetail.kyc.pan_masked && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => verifyKYC.mutate({ userId: selectedUserId, action: "VERIFY" })}
                      disabled={verifyKYC.isPending}
                      className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      Verify PAN
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setKycRejectModal({ open: true, userId: selectedUserId, reason: "" })}
                      className="h-7 px-3 border-rose-300 text-rose-800 text-xs"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>

              {/* Bank Card */}
              <div className="rounded-xl border border-border p-4 bg-background space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Building className="h-4 w-4 text-primary" /> Bank Account Details
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      referrerDetail.bank.status === "VERIFIED"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-amber-500 bg-amber-50 text-amber-800"
                    }
                  >
                    {referrerDetail.bank.status}
                  </Badge>
                </div>
                <div>Holder: <span className="font-medium">{referrerDetail.bank.account_holder_name || "—"}</span></div>
                <div>Account: <span className="font-mono font-bold">{referrerDetail.bank.account_number_masked || "Not Added"}</span></div>
                <div>IFSC: <span className="font-mono">{referrerDetail.bank.ifsc_code || "—"}</span> ({referrerDetail.bank.bank_name || "Bank"})</div>
                {referrerDetail.bank.status !== "VERIFIED" && referrerDetail.bank.account_number_masked && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => verifyBank.mutate({ userId: selectedUserId, action: "VERIFY" })}
                      disabled={verifyBank.isPending}
                      className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      Verify Bank
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBankRejectModal({ open: true, userId: selectedUserId, reason: "" })}
                      className="h-7 px-3 border-rose-300 text-rose-800 text-xs"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Subtabs inside Detail Modal */}
            <div className="border-b border-border pb-2 flex items-center gap-2">
              <Button
                variant={detailActiveTab === "leads" ? "default" : "outline"}
                size="sm"
                onClick={() => setDetailActiveTab("leads")}
                className="h-8 text-xs"
              >
                Leads ({referrerDetail.leads.length})
              </Button>
              <Button
                variant={detailActiveTab === "sales" ? "default" : "outline"}
                size="sm"
                onClick={() => setDetailActiveTab("sales")}
                className="h-8 text-xs"
              >
                Sales ({referrerDetail.sales.length})
              </Button>
              <Button
                variant={detailActiveTab === "ledger" ? "default" : "outline"}
                size="sm"
                onClick={() => setDetailActiveTab("ledger")}
                className="h-8 text-xs"
              >
                Commission Ledger ({referrerDetail.commission_ledger.length})
              </Button>
              <Button
                variant={detailActiveTab === "withdrawals" ? "default" : "outline"}
                size="sm"
                onClick={() => setDetailActiveTab("withdrawals")}
                className="h-8 text-xs"
              >
                Withdrawals ({referrerDetail.withdrawals.length})
              </Button>
            </div>

            {/* DETAIL SUBTAB: LEADS */}
            {detailActiveTab === "leads" && (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Customer</TableHead>
                      <TableHead>Masked Email</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Converted?</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Sale Val</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrerDetail.leads.map((l) => (
                      <TableRow key={l.id} className="text-xs">
                        <TableCell className="font-medium">{l.customer_name || "Lead"}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{l.customer_email_masked}</TableCell>
                        <TableCell>{l.attributed_date ? l.attributed_date.slice(0, 10) : "—"}</TableCell>
                        <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                        <TableCell>{l.converted ? "Yes" : "No"}</TableCell>
                        <TableCell className="font-mono">{l.order_number || "—"}</TableCell>
                        <TableCell className="text-right">{l.sale_value ? inr(l.sale_value) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* DETAIL SUBTAB: SALES */}
            {detailActiveTab === "sales" && (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Sale Value</TableHead>
                      <TableHead>Commission Rule</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrerDetail.sales.map((s) => (
                      <TableRow key={s.order_id || s.order_number} className="text-xs">
                        <TableCell className="font-mono font-medium">{s.order_number}</TableCell>
                        <TableCell>{s.order_date ? s.order_date.slice(0, 10) : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{inr(s.eligible_sale_value)}</TableCell>
                        <TableCell className="text-muted-foreground">{s.commission_rule}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{inr(s.commission_amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="uppercase text-[10px]">{s.commission_status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* DETAIL SUBTAB: COMMISSION LEDGER */}
            {detailActiveTab === "ledger" && (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Order #</TableHead>
                      <TableHead className="text-right">Sale Amount</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Rule Snapshot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrerDetail.commission_ledger.map((c) => (
                      <TableRow key={c.id} className="text-xs">
                        <TableCell className="font-mono font-medium">{c.order_number}</TableCell>
                        <TableCell className="text-right">{inr(c.eligible_sale_amount)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{inr(c.commission_amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{c.rule_name} ({c.rule_value}%)</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.status}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{c.created_at ? c.created_at.slice(0, 10) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.approved_at ? c.approved_at.slice(0, 10) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* DETAIL SUBTAB: WITHDRAWALS */}
            {detailActiveTab === "withdrawals" && (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-xs">
                      <TableHead>Request #</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">TDS</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>UTR / Ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrerDetail.withdrawals.map((w) => (
                      <TableRow key={w.id} className="text-xs">
                        <TableCell className="font-mono font-medium">{w.request_number || w.id}</TableCell>
                        <TableCell className="text-right">{inr(w.amount)}</TableCell>
                        <TableCell className="text-right text-rose-700">−{inr(w.tds_amount)} ({w.tds_rate}%)</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{inr(w.net_payable)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{w.status}</Badge></TableCell>
                        <TableCell>{w.created_at ? w.created_at.slice(0, 10) : "—"}</TableCell>
                        <TableCell className="font-mono">{w.payout_details?.utr_number || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: MARK WITHDRAWAL AS PAID (REQUIRES UTR & DATE)         */}
      {/* ============================================================ */}
      {markPaidModal.open && markPaidModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h3 className="font-heading font-bold text-lg">Mark Payout as PAID</h3>
              </div>
              <button
                onClick={() => setMarkPaidModal({ open: false, item: null, utr: "", method: "NEFT", date: "" })}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-muted/60 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Referrer:</span>
                <span className="font-semibold">{markPaidModal.item.user_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Requested Gross:</span>
                <span>{inr(markPaidModal.item.amount)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>TDS Withheld ({markPaidModal.item.tds_rate}%):</span>
                <span>−{inr(markPaidModal.item.tds_amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700 text-sm border-t border-border pt-1">
                <span>Net Amount Paid:</span>
                <span>{inr(markPaidModal.item.net_payable)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Bank Account:</span>
                <span className="font-mono">{markPaidModal.item.bank_account_masked}</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!markPaidModal.utr.trim()) {
                  toast.error("Payment Reference / UTR Number is required");
                  return;
                }
                markWithdrawalPaid.mutate({
                  wid: markPaidModal.item!.id,
                  utr: markPaidModal.utr.trim(),
                  method: markPaidModal.method,
                  date: markPaidModal.date,
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="pay-utr">Bank UTR / Transaction Reference Number *</Label>
                <Input
                  id="pay-utr"
                  placeholder="e.g. UTR20260928001928"
                  value={markPaidModal.utr}
                  onChange={(e) => setMarkPaidModal({ ...markPaidModal, utr: e.target.value })}
                  className="font-mono mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pay-method">Payment Method</Label>
                  <select
                    id="pay-method"
                    value={markPaidModal.method}
                    onChange={(e) => setMarkPaidModal({ ...markPaidModal, method: e.target.value })}
                    className="w-full h-10 mt-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="IMPS">IMPS</option>
                    <option value="RTGS">RTGS</option>
                    <option value="UPI">UPI</option>
                    <option value="DIRECT_TRANSFER">Direct Transfer</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="pay-date">Disbursed Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={markPaidModal.date}
                    onChange={(e) => setMarkPaidModal({ ...markPaidModal, date: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMarkPaidModal({ open: false, item: null, utr: "", method: "NEFT", date: "" })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={markWithdrawalPaid.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {markWithdrawalPaid.isPending ? "Confirming..." : "Confirm Payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: HOLD WITHDRAWAL (REQUIRES REASON)                      */}
      {/* ============================================================ */}
      {holdModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-amber-800">Place Withdrawal Request On Hold</h3>
            <p className="text-xs text-muted-foreground">
              The requested amount will remain reserved in the referrer's wallet while under review. Please specify a
              clear reason for the referrer and finance team.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!holdModal.reason.trim()) {
                  toast.error("Reason is required to place on hold");
                  return;
                }
                reviewWithdrawal.mutate({ wid: holdModal.wid, action: "HOLD", reason: holdModal.reason.trim() });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="hold-reason">Hold Reason *</Label>
                <Textarea
                  id="hold-reason"
                  placeholder="e.g. Account name mismatch with KYC document. Pending clarification..."
                  value={holdModal.reason}
                  onChange={(e) => setHoldModal({ ...holdModal, reason: e.target.value })}
                  className="mt-1 h-24 text-xs"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setHoldModal({ open: false, wid: "", reason: "" })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={reviewWithdrawal.isPending}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Confirm Hold
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: REJECT WITHDRAWAL (RESTORES RESERVED AMOUNT)          */}
      {/* ============================================================ */}
      {rejectWithdrawalModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-rose-800">Reject Withdrawal Request</h3>
            <p className="text-xs text-muted-foreground">
              Upon rejection, the reserved funds will automatically be released back to the Referrer's Available
              Wallet Balance via an immutable ledger transaction.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!rejectWithdrawalModal.reason.trim()) {
                  toast.error("Rejection reason is required");
                  return;
                }
                reviewWithdrawal.mutate({
                  wid: rejectWithdrawalModal.wid,
                  action: "REJECT",
                  reason: rejectWithdrawalModal.reason.trim(),
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="reject-reason">Rejection Reason *</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="e.g. Bank IFSC code does not match customer's state or account details incomplete..."
                  value={rejectWithdrawalModal.reason}
                  onChange={(e) => setRejectWithdrawalModal({ ...rejectWithdrawalModal, reason: e.target.value })}
                  className="mt-1 h-24 text-xs"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectWithdrawalModal({ open: false, wid: "", reason: "" })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={reviewWithdrawal.isPending}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Reject & Release Funds
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: KYC REJECT                                            */}
      {/* ============================================================ */}
      {kycRejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-rose-800">Reject PAN Verification</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyKYC.mutate({
                  userId: kycRejectModal.userId,
                  action: "REJECT",
                  reason: kycRejectModal.reason.trim(),
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="kyc-rej-reason">Correction Note / Reason</Label>
                <Textarea
                  id="kyc-rej-reason"
                  placeholder="e.g. Name does not match PAN record..."
                  value={kycRejectModal.reason}
                  onChange={(e) => setKycRejectModal({ ...kycRejectModal, reason: e.target.value })}
                  className="mt-1 h-20 text-xs"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setKycRejectModal({ open: false, userId: "", reason: "" })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={verifyKYC.isPending} className="flex-1 bg-rose-600 text-white">
                  Reject
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: BANK REJECT                                           */}
      {/* ============================================================ */}
      {bankRejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-rose-800">Reject Bank Details</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyBank.mutate({
                  userId: bankRejectModal.userId,
                  action: "REJECT",
                  reason: bankRejectModal.reason.trim(),
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="bank-rej-reason">Correction Note / Reason</Label>
                <Textarea
                  id="bank-rej-reason"
                  placeholder="e.g. Account number could not be validated..."
                  value={bankRejectModal.reason}
                  onChange={(e) => setBankRejectModal({ ...bankRejectModal, reason: e.target.value })}
                  className="mt-1 h-20 text-xs"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBankRejectModal({ open: false, userId: "", reason: "" })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={verifyBank.isPending} className="flex-1 bg-rose-600 text-white">
                  Reject
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE / EDIT PRODUCT-LEVEL REFERRAL RULE (REQ 3)     */}
      {/* ============================================================ */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-heading font-bold text-lg">
                  {editingRule ? "Edit Referral Rule" : "CREATE REFERRAL RULE"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select products from the authoritative catalogue and define independent commission & discount rules.
                </p>
              </div>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (ruleProductIds.length === 0) {
                  toast.error("Please select at least one catalogue product");
                  return;
                }
                const commNum = parseFloat(ruleCommissionValue) || 0;
                if (commNum <= 0) {
                  toast.error("Referrer commission must be greater than zero");
                  return;
                }
                const discNum = parseFloat(ruleDiscountValue) || 0;
                if (discNum < 0) {
                  toast.error("Customer referral discount cannot be negative");
                  return;
                }

                saveRule.mutate({
                  rule_name: ruleName.trim() || `Rule: ${ruleProductIds.length} Products`,
                  product_ids: ruleProductIds,
                  commission_type: ruleCommissionType,
                  commission_value: commNum,
                  commission_basis: ruleCommissionBasis,
                  discount_type: ruleDiscountType,
                  discount_value: discNum,
                  is_active: ruleIsActive,
                  effective_from: ruleValidFrom || null,
                  effective_until: ruleValidUntil || null,
                  notes: ruleNotes || null,
                });
              }}
              className="space-y-4 text-xs"
            >
              {/* Product Multi-Select Picker from Authoritative Catalogue */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">Products * (Select multiple)</Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {ruleProductIds.length} selected
                  </span>
                </div>

                {/* Search Catalogue input */}
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search catalogue products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                {/* Selected Products Badges */}
                {ruleProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-lg bg-muted/40 max-h-24 overflow-y-auto">
                    {ruleProductIds.map((pid) => {
                      const found = catalogProducts.find((p) => p.id === pid);
                      return (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-medium"
                        >
                          {found?.name || pid}
                          <button
                            type="button"
                            onClick={() => setRuleProductIds(ruleProductIds.filter((id) => id !== pid))}
                            className="hover:text-destructive text-[12px] font-bold leading-none"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Scrollable Catalogue Selection Box */}
                <div className="border border-border rounded-lg max-h-44 overflow-y-auto divide-y divide-border/60 bg-background">
                  {catalogProducts
                    .filter((p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase())))
                    .map((p) => {
                      const isChecked = ruleProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition text-xs ${isChecked ? "bg-muted/20" : ""}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRuleProductIds([...ruleProductIds, p.id]);
                                } else {
                                  setRuleProductIds(ruleProductIds.filter((id) => id !== p.id));
                                }
                              }}
                              className="rounded border-border text-primary cursor-pointer"
                            />
                            <span className="font-medium text-foreground">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">{p.category || "General"}</Badge>
                            <span className="text-[11px] text-muted-foreground">{p.price ? inr(p.price) : ""}</span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Rule Name */}
              <div>
                <Label htmlFor="rule-name-input" className="text-xs">Rule Name *</Label>
                <Input
                  id="rule-name-input"
                  placeholder="e.g. Ortho Therapy Referral Incentive"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              {/* REFERRER COMMISSION SECTION */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs uppercase tracking-wider">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-700" /> Referrer Commission *
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Commission Type *</Label>
                    <div className="flex gap-2 mt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="commissionType"
                          checked={ruleCommissionType === "PERCENTAGE"}
                          onChange={() => setRuleCommissionType("PERCENTAGE")}
                        />
                        <span>Percentage (%)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="commissionType"
                          checked={ruleCommissionType === "FLAT"}
                          onChange={() => setRuleCommissionType("FLAT")}
                        />
                        <span>Flat Amount (₹)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="comm-val-input" className="text-[11px] text-muted-foreground">Commission Value *</Label>
                    <Input
                      id="comm-val-input"
                      type="number"
                      step="0.1"
                      placeholder={ruleCommissionType === "PERCENTAGE" ? "5" : "500"}
                      value={ruleCommissionValue}
                      onChange={(e) => setRuleCommissionValue(e.target.value)}
                      className="mt-1 h-8 text-xs font-semibold bg-white"
                      required
                    />
                  </div>
                </div>
                {ruleCommissionType === "PERCENTAGE" && (
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Calculation Price Basis</Label>
                    <select
                      value={ruleCommissionBasis}
                      onChange={(e: any) => setRuleCommissionBasis(e.target.value)}
                      className="w-full h-8 mt-1 rounded-md border border-input bg-white px-2 text-xs"
                    >
                      <option value="selling_price">Product Selling Price (before customer referral discount)</option>
                      <option value="net_price">Net Product Amount (after customer referral discount)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* CUSTOMER REFERRAL DISCOUNT SECTION */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs uppercase tracking-wider">
                  <Tag className="h-3.5 w-3.5 text-purple-700" /> Customer Referral Discount *
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Discount Type *</Label>
                    <div className="flex gap-2 mt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="discountType"
                          checked={ruleDiscountType === "PERCENTAGE"}
                          onChange={() => setRuleDiscountType("PERCENTAGE")}
                        />
                        <span>Percentage (%)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="discountType"
                          checked={ruleDiscountType === "FLAT"}
                          onChange={() => setRuleDiscountType("FLAT")}
                        />
                        <span>Flat Amount (₹)</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="disc-val-input" className="text-[11px] text-muted-foreground">Discount Value *</Label>
                    <Input
                      id="disc-val-input"
                      type="number"
                      step="0.1"
                      placeholder={ruleDiscountType === "PERCENTAGE" ? "3" : "250"}
                      value={ruleDiscountValue}
                      onChange={(e) => setRuleDiscountValue(e.target.value)}
                      className="mt-1 h-8 text-xs font-semibold bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Status and Validity Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <select
                    value={ruleIsActive ? "active" : "inactive"}
                    onChange={(e) => setRuleIsActive(e.target.value === "active")}
                    className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Valid From (Optional)</Label>
                  <Input
                    type="date"
                    value={ruleValidFrom}
                    onChange={(e) => setRuleValidFrom(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Valid Until (Optional)</Label>
                  <Input
                    type="date"
                    value={ruleValidUntil}
                    onChange={(e) => setRuleValidUntil(e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveRule.isPending}
                  className="flex-1 bg-primary text-primary-foreground font-semibold"
                >
                  {saveRule.isPending ? "Saving..." : "SAVE RULE"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: REFERRAL STACKING & BUSINESS LOGIC SETTINGS (REQ 22) */}
      {/* ============================================================ */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-heading font-bold text-lg">Referral Stacking & Calculation Rules</h3>
                <p className="text-xs text-muted-foreground">
                  Authoritative engine settings for promotion stacking, commission pricing basis, and self-referral protection.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateReferralSettings.mutate(settingsForm);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <Label className="font-semibold text-xs">Referral Discount Stacking (with 40% OFF Promotion)</Label>
                <select
                  value={settingsForm.promotion_stacking_mode}
                  onChange={(e: any) => setSettingsForm({ ...settingsForm, promotion_stacking_mode: e.target.value })}
                  className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="combine">Referral discount can combine with active product promotions (Default)</option>
                  <option value="better_discount">Use the better discount (whichever is higher)</option>
                  <option value="exclusive">Referral discount unavailable when another promotion applies</option>
                </select>
              </div>

              <div>
                <Label className="font-semibold text-xs">Coupon + Referral Code Compatibility</Label>
                <select
                  value={settingsForm.coupon_stacking_mode}
                  onChange={(e: any) => setSettingsForm({ ...settingsForm, coupon_stacking_mode: e.target.value })}
                  className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="disallow">Do not allow coupons and referral codes together (Default)</option>
                  <option value="allow">Allow coupons to stack on top of referral discount</option>
                  <option value="better_discount">Use the better discount between coupon and referral</option>
                </select>
              </div>

              <div>
                <Label className="font-semibold text-xs">Authoritative Commission Price Basis</Label>
                <select
                  value={settingsForm.commission_price_basis}
                  onChange={(e: any) => setSettingsForm({ ...settingsForm, commission_price_basis: e.target.value })}
                  className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="selling_price">Product Selling Price before customer referral discount (Standard)</option>
                  <option value="net_price">Net Product Amount after customer referral discount</option>
                </select>
              </div>

              <div>
                <Label className="font-semibold text-xs">Flat Amount Quantity Semantics</Label>
                <select
                  value={settingsForm.flat_quantity_semantics}
                  onChange={(e: any) => setSettingsForm({ ...settingsForm, flat_quantity_semantics: e.target.value })}
                  className="w-full h-8 mt-1 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="per_unit">Flat per eligible unit (₹ amount × quantity, capped at line total)</option>
                  <option value="per_line">Flat per eligible line/order item</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
                <div>
                  <span className="font-semibold block text-xs">Self-Referral Safeguard</span>
                  <span className="text-[11px] text-muted-foreground">Block referrers from earning commission on their own purchases.</span>
                </div>
                <input
                  type="checkbox"
                  checked={!settingsForm.allow_self_referral}
                  onChange={(e) => setSettingsForm({ ...settingsForm, allow_self_referral: !e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateReferralSettings.isPending}
                  className="flex-1 bg-primary text-primary-foreground font-semibold"
                >
                  {updateReferralSettings.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
