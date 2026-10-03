import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { fmtDateTime, inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DataTablePagination from "@/components/ui/DataTablePagination";
import { 
  BarChart3, Link as LinkIcon, Users, DollarSign, MousePointerClick, 
  UserCheck, ShoppingCart, TrendingUp, Copy, ExternalLink, Plus, RefreshCw,
  Download, UserPlus, Filter, Search, Calendar, ChevronRight, CheckCircle, XCircle
} from "lucide-react";

export type DateFilterRange = "today" | "yesterday" | "7days" | "30days" | "this_month" | "last_month" | "all";

const CAMPAIGN_TYPES = [
  "Influencer", "Meta Ads", "Google Ads", "YouTube", "Instagram", "Partner", "Offline/QR", "Other"
];

interface DashboardKPIs {
  total_campaigns: number;
  total_links: number;
  total_clicks: number;
  unique_visitors: number;
  signups: number;
  purchasers: number;
  orders: number;
  revenue: number;
  click_to_signup_pct: number;
  signup_to_purchase_pct: number;
  click_to_purchase_pct: number;
  revenue_per_campaign: number;
}

interface CampaignItem {
  id: string;
  code: string;
  name: string;
  campaign_type: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  influencer_name?: string;
  destination_url: string;
  status: "active" | "inactive";
  created_at: string;
  clicks: number;
  unique_visitors: number;
  signups: number;
  purchasers: number;
  orders: number;
  revenue: number;
  signup_pct: number;
  purchase_pct: number;
}

interface LeadAttribution {
  attribution_id: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  email: string;
  signup_date: string;
  first_touch_source: string;
  first_touch_medium: string;
  first_touch_campaign: string;
  first_touch_timestamp: string;
  last_touch_source: string;
  last_touch_medium: string;
  last_touch_campaign: string;
  last_touch_timestamp: string;
  lead_status: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  total_orders: number;
  total_revenue: number;
  last_purchase_date?: string;
}

export default function MarketingCampaignsHub() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "campaigns" | "leads" | "report">("overview");
  const [dateRange, setDateRange] = useState<DateFilterRange>("30days");
  
  // Create Campaign Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    campaign_type: "Influencer",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    influencer_name: "",
    destination_url: "https://www.kotsonbeds.com/",
  });

  // Leads Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [leadPage, setLeadPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  // Customer Journey Drawer State
  const [journeyLead, setJourneyLead] = useState<LeadAttribution | null>(null);

  // Sorting for Campaign Performance table
  const [sortField, setSortField] = useState<keyof CampaignItem>("clicks");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Calculate Start & End Timestamps based on dateRange
  const getDateBounds = () => {
    const now = new Date();
    let start: Date | null = new Date();
    let end: Date = now;

    if (dateRange === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (dateRange === "yesterday") {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateRange === "7days") {
      start.setDate(now.getDate() - 7);
    } else if (dateRange === "30days") {
      start.setDate(now.getDate() - 30);
    } else if (dateRange === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else {
      start = null;
    }

    return {
      startDate: start ? start.toISOString() : null,
      endDate: end.toISOString(),
    };
  };

  const { startDate, endDate } = getDateBounds();

  // 1. Fetch Dashboard KPIs
  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = useQuery<DashboardKPIs>({
    queryKey: ["marketing-dashboard-kpis", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kotson_get_marketing_dashboard", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return data as DashboardKPIs;
    },
  });

  // 2. Fetch Campaign Performance List
  const { data: campaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<CampaignItem[]>({
    queryKey: ["marketing-campaigns-list", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("kotson_get_campaign_performance", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data || []) as CampaignItem[];
    },
  });

  // 3. Fetch Staff Users for Telecaller / Manager Lead Assignment
  const { data: staffMembers } = useQuery({
    queryKey: ["marketing-staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, roles, department")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch Leads & Attribution Report
  const { data: leadsReport, isLoading: leadsLoading, refetch: refetchLeads } = useQuery<{
    total: number;
    leads: LeadAttribution[];
  }>({
    queryKey: ["marketing-leads-report", searchQuery, sourceFilter, leadPage, pageSize],
    queryFn: async () => {
      const offset = (leadPage - 1) * pageSize;
      const { data, error } = await supabase.rpc("kotson_get_attribution_report", {
        p_source: sourceFilter === "all" ? null : sourceFilter,
        p_search: searchQuery.trim() || null,
        p_limit: pageSize,
        p_offset: offset,
      });
      if (error) throw error;
      return data as { total: number; leads: LeadAttribution[] };
    },
  });

  // Mutation: Create Campaign
  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("kotson_create_campaign", {
        p_name: form.name,
        p_campaign_type: form.campaign_type,
        p_utm_source: form.utm_source,
        p_utm_medium: form.utm_medium,
        p_utm_campaign: form.utm_campaign,
        p_utm_content: form.utm_content || null,
        p_utm_term: form.utm_term || null,
        p_influencer_name: form.influencer_name || null,
        p_destination_url: form.destination_url,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      toast.success("Campaign & trackable link generated successfully!");
      setCreateOpen(false);
      setForm({
        name: "",
        campaign_type: "Influencer",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        utm_content: "",
        utm_term: "",
        influencer_name: "",
        destination_url: "https://www.kotsonbeds.com/",
      });
      qc.invalidateQueries({ queryKey: ["marketing-dashboard-kpis"] });
      qc.invalidateQueries({ queryKey: ["marketing-campaigns-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create campaign");
    },
  });

  // Mutation: Assign Leads to Staff
  const assignLeadsMutation = useMutation({
    mutationFn: async () => {
      if (selectedLeads.length === 0 || !selectedAssignee) {
        throw new Error("Select at least one lead and an employee to assign.");
      }
      const { data, error } = await supabase.rpc("kotson_assign_lead", {
        p_customer_ids: selectedLeads,
        p_new_assignee_id: selectedAssignee,
        p_notes: assignNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      toast.success(`Assigned ${res.assigned_count} lead(s) successfully.`);
      setAssignModalOpen(false);
      setSelectedLeads([]);
      setSelectedAssignee("");
      setAssignNotes("");
      qc.invalidateQueries({ queryKey: ["marketing-leads-report"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign lead(s)");
    },
  });

  // Toggle Campaign Active/Inactive
  const toggleCampaignStatus = async (id: string, currentStatus: "active" | "inactive") => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("marketing_campaigns")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Could not update campaign status");
    } else {
      toast.success(`Campaign marked as ${newStatus}`);
      refetchCampaigns();
    }
  };

  // Copy Link to Clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Trackable URL copied to clipboard!");
  };

  // CSV Exporter for Attribution Report
  const exportLeadsCSV = () => {
    const leads = leadsReport?.leads || [];
    if (leads.length === 0) {
      toast.error("No lead attribution data available to export.");
      return;
    }

    const headers = [
      "Customer Name",
      "Phone",
      "Email",
      "Signup Date",
      "First Source",
      "First Medium",
      "First Campaign",
      "Last Source",
      "Last Medium",
      "Last Campaign",
      "Orders",
      "Revenue (INR)",
      "Last Purchase Date",
      "Assigned Employee",
      "Lead Status",
    ];

    const rows = leads.map((l) => [
      `"${l.customer_name || ''}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${fmtDateTime(l.signup_date)}"`,
      `"${l.first_touch_source || ''}"`,
      `"${l.first_touch_medium || ''}"`,
      `"${l.first_touch_campaign || ''}"`,
      `"${l.last_touch_source || ''}"`,
      `"${l.last_touch_medium || ''}"`,
      `"${l.last_touch_campaign || ''}"`,
      l.total_orders || 0,
      l.total_revenue || 0,
      `"${l.last_purchase_date ? fmtDateTime(l.last_purchase_date) : 'N/A'}"`,
      `"${l.assigned_employee_name || 'Unassigned'}"`,
      `"${l.lead_status || 'NEW'}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kotson_marketing_attribution_report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported marketing attribution report to CSV.");
  };

  // Sorting logic for Campaigns table
  const sortedCampaigns = [...(campaigns || [])].sort((a, b) => {
    const valA = a[sortField] ?? 0;
    const valB = b[sortField] ?? 0;
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof CampaignItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading text-foreground">Marketing Campaigns & Attribution</h1>
            <Badge className="bg-[#1B365D] text-white hover:bg-[#1B365D]/90 text-xs px-2 py-0.5 font-sans">
              Authoritative Supabase Core
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full-funnel first-party click tracking, immutable first-touch & last-touch attribution, and order snapshots.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#1B365D] hover:bg-[#1B365D]/90 text-white gap-2 font-medium text-xs px-4 py-2 h-9 rounded-xl shadow-xs"
          >
            <Plus className="h-4 w-4" /> Create Campaign
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchKpis();
              refetchCampaigns();
              refetchLeads();
            }}
            className="gap-2 h-9 text-xs rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs & Date Range Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border/50">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "overview"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 inline mr-1.5" /> Overview & KPIs
          </button>

          <button
            onClick={() => setActiveTab("campaigns")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "campaigns"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5 inline mr-1.5" /> Campaigns & Links
          </button>

          <button
            onClick={() => setActiveTab("leads")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "leads"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5 inline mr-1.5" /> Leads & Telecallers
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "report"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 inline mr-1.5" /> Attribution Report
          </button>
        </div>

        {/* Date Filter Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(val) => setDateRange(val as DateFilterRange)}>
            <SelectTrigger className="w-[150px] h-9 text-xs rounded-xl border-border/80 bg-background">
              <SelectValue placeholder="Date filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {(activeTab === "overview" || activeTab === "campaigns") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Campaigns</span>
            <p className="text-xl font-bold font-heading text-foreground">{kpis?.total_campaigns ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Links</span>
            <p className="text-xl font-bold font-heading text-foreground">{kpis?.total_links ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Total Clicks</span>
            <p className="text-xl font-bold font-heading text-foreground">{kpis?.total_clicks ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Unique Visitors</span>
            <p className="text-xl font-bold font-heading text-foreground">{kpis?.unique_visitors ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Signups</span>
            <p className="text-xl font-bold font-heading text-foreground text-emerald-600">{kpis?.signups ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Purchasers</span>
            <p className="text-xl font-bold font-heading text-foreground text-indigo-600">{kpis?.purchasers ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Paid Orders</span>
            <p className="text-xl font-bold font-heading text-foreground">{kpis?.orders ?? 0}</p>
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Revenue</span>
            <p className="text-xl font-bold font-heading text-emerald-700">{inr(kpis?.revenue ?? 0)}</p>
          </div>
        </div>
      )}

      {/* CONVERSION METRICS CARDS */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-100 p-5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Click → Signup %</span>
              <MousePointerClick className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold font-heading text-blue-950 mt-2">
              {kpis?.click_to_signup_pct ?? 0}%
            </p>
            <p className="text-[11px] text-blue-700 mt-1">Visitors converting to registered accounts</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-100 p-5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Signup → Purchase %</span>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold font-heading text-emerald-950 mt-2">
              {kpis?.signup_to_purchase_pct ?? 0}%
            </p>
            <p className="text-[11px] text-emerald-700 mt-1">Leads placing paid orders</p>
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50/40 border border-violet-100 p-5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-900 uppercase tracking-wider">Click → Purchase %</span>
              <ShoppingCart className="h-4 w-4 text-violet-600" />
            </div>
            <p className="text-2xl font-bold font-heading text-violet-950 mt-2">
              {kpis?.click_to_purchase_pct ?? 0}%
            </p>
            <p className="text-[11px] text-violet-700 mt-1">Overall click-to-sale funnel efficiency</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-yellow-50/40 border border-amber-100 p-5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Revenue / Campaign</span>
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold font-heading text-amber-950 mt-2">
              {inr(kpis?.revenue_per_campaign ?? 0)}
            </p>
            <p className="text-[11px] text-amber-700 mt-1">Average yield per active campaign</p>
          </div>
        </div>
      )}

      {/* CAMPAIGNS TABLE */}
      {(activeTab === "overview" || activeTab === "campaigns") && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-lg text-foreground">Campaign Performance Breakdown</h2>
            <span className="text-xs text-muted-foreground">Click headers to sort table</span>
          </div>

          <div className="rounded-xl border border-border/80 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Code & Campaign Name</TableHead>
                  <TableHead className="font-bold text-xs">Type</TableHead>
                  <TableHead className="font-bold text-xs">Source / Medium</TableHead>
                  <TableHead className="font-bold text-xs text-right cursor-pointer hover:underline" onClick={() => handleSort("clicks")}>
                    Clicks {sortField === "clicks" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </TableHead>
                  <TableHead className="font-bold text-xs text-right cursor-pointer hover:underline" onClick={() => handleSort("unique_visitors")}>
                    Uniques {sortField === "unique_visitors" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </TableHead>
                  <TableHead className="font-bold text-xs text-right cursor-pointer hover:underline" onClick={() => handleSort("signups")}>
                    Signups {sortField === "signups" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </TableHead>
                  <TableHead className="font-bold text-xs text-right cursor-pointer hover:underline" onClick={() => handleSort("orders")}>
                    Orders {sortField === "orders" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </TableHead>
                  <TableHead className="font-bold text-xs text-right cursor-pointer hover:underline" onClick={() => handleSort("revenue")}>
                    Revenue {sortField === "revenue" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </TableHead>
                  <TableHead className="font-bold text-xs text-right">Conv %</TableHead>
                  <TableHead className="font-bold text-xs text-center">Status</TableHead>
                  <TableHead className="font-bold text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-sm text-muted-foreground">
                      No campaigns found. Click "Create Campaign" to add your first trackable marketing campaign.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCampaigns.map((c) => {
                    const fullTrackableUrl = `${c.destination_url}${c.destination_url.includes("?") ? "&" : "?"}utm_source=${c.utm_source}&utm_medium=${c.utm_medium}&utm_campaign=${c.utm_campaign}&kt_campaign=${c.code.toLowerCase()}`;
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-xs">
                          <div>
                            <p className="font-bold text-foreground text-sm">{c.name}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{c.code} {c.influencer_name ? `• ${c.influencer_name}` : ''}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px] bg-secondary/40 font-normal">
                            {c.campaign_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {c.utm_source} / {c.utm_medium}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-right">{c.clicks}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{c.unique_visitors}</TableCell>
                        <TableCell className="text-xs font-bold text-right text-emerald-600">{c.signups}</TableCell>
                        <TableCell className="text-xs font-bold text-right text-indigo-600">{c.orders}</TableCell>
                        <TableCell className="text-xs font-bold text-right text-emerald-700">{inr(c.revenue)}</TableCell>
                        <TableCell className="text-xs text-right">
                          <div className="text-[11px] font-medium">
                            <span className="text-emerald-700">{c.signup_pct}% S</span> |{" "}
                            <span className="text-indigo-700">{c.purchase_pct}% P</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={c.status === "active" ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100" : "bg-zinc-100 text-zinc-700 border-zinc-200"}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Copy Trackable Link"
                              onClick={() => copyToClipboard(fullTrackableUrl)}
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <a
                              href={fullTrackableUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Open Link"
                              className="p-1.5 hover:bg-secondary rounded-md"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              title={c.status === "active" ? "Deactivate Campaign" : "Reactivate Campaign"}
                              onClick={() => toggleCampaignStatus(c.id, c.status)}
                              className="h-8 w-8 p-0"
                            >
                              {c.status === "active" ? (
                                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              )}
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

      {/* LEADS & TELECALLERS TAB / ATTRIBUTION REPORT */}
      {(activeTab === "leads" || activeTab === "report") && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">
                {activeTab === "leads" ? "Marketing Leads & Telecaller Assignment" : "Attribution Report"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Filter customer leads, inspect first-touch vs last-touch marketing sources, and assign telecallers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedLeads.length > 0 && (
                <Button
                  onClick={() => setAssignModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 text-xs rounded-xl"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Bulk Assign ({selectedLeads.length})
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={exportLeadsCSV}
                className="gap-2 h-9 text-xs rounded-xl"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLeadPage(1);
                }}
                placeholder="Search by customer name, phone, email…"
                className="pl-9 h-9 text-xs rounded-xl border-border/80"
              />
            </div>

            <Select
              value={sourceFilter}
              onValueChange={(val) => {
                setSourceFilter(val);
                setLeadPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-background">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="influencer">Influencer</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="Direct / Organic">Direct / Organic</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center justify-end text-xs text-muted-foreground font-medium">
              Total Leads: {leadsReport?.total ?? 0}
            </div>
          </div>

          {/* Leads Table */}
          <div className="rounded-xl border border-border/80 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        (leadsReport?.leads?.length ?? 0) > 0 &&
                        selectedLeads.length === (leadsReport?.leads?.length ?? 0)
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeads((leadsReport?.leads || []).map((l) => l.customer_id));
                        } else {
                          setSelectedLeads([]);
                        }
                      }}
                      className="rounded border-border"
                    />
                  </TableHead>
                  <TableHead className="font-bold text-xs">Customer Name</TableHead>
                  <TableHead className="font-bold text-xs">Phone</TableHead>
                  <TableHead className="font-bold text-xs">Email</TableHead>
                  <TableHead className="font-bold text-xs">Signup Date</TableHead>
                  <TableHead className="font-bold text-xs">First Source / Campaign</TableHead>
                  <TableHead className="font-bold text-xs">Last Source / Campaign</TableHead>
                  <TableHead className="font-bold text-xs text-right">Orders</TableHead>
                  <TableHead className="font-bold text-xs text-right">Revenue</TableHead>
                  <TableHead className="font-bold text-xs">Assigned Employee</TableHead>
                  <TableHead className="font-bold text-xs text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-xs text-muted-foreground">
                      Loading attribution leads…
                    </TableCell>
                  </TableRow>
                ) : (leadsReport?.leads?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-xs text-muted-foreground">
                      No matching leads found for active filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  leadsReport?.leads?.map((l) => {
                    const isSelected = selectedLeads.includes(l.customer_id);
                    return (
                      <TableRow key={l.attribution_id} className="hover:bg-muted/30">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads([...selectedLeads, l.customer_id]);
                              } else {
                                setSelectedLeads(selectedLeads.filter((id) => id !== l.customer_id));
                              }
                            }}
                            className="rounded border-border"
                          />
                        </TableCell>
                        <TableCell className="font-medium text-xs text-foreground">{l.customer_name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{l.phone}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDateTime(l.signup_date)}</TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="font-bold text-emerald-800">{l.first_touch_source}</span>
                            <p className="text-[11px] text-muted-foreground font-mono">{l.first_touch_campaign}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            <span className="font-bold text-indigo-800">{l.last_touch_source}</span>
                            <p className="text-[11px] text-muted-foreground font-mono">{l.last_touch_campaign}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-right">{l.total_orders}</TableCell>
                        <TableCell className="text-xs font-bold text-right text-emerald-700">{inr(l.total_revenue)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="font-normal text-[11px]">
                            {l.assigned_employee_name || "Unassigned"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setJourneyLead(l)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Journey <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DataTablePagination
            currentPage={leadPage}
            pageSize={pageSize}
            totalItems={leadsReport?.total ?? 0}
            onPageChange={setLeadPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setLeadPage(1);
            }}
          />
        </div>
      )}

      {/* CREATE CAMPAIGN DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-heading">Create Marketing Campaign & Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div>
              <Label className="text-xs font-semibold">Campaign Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Kranthi October Mattress Reel"
                className="mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Campaign Type *</Label>
              <Select
                value={form.campaign_type}
                onValueChange={(val) => setForm({ ...form, campaign_type: val })}
              >
                <SelectTrigger className="mt-1 h-9 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">UTM Source *</Label>
                <Input
                  value={form.utm_source}
                  onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                  placeholder="e.g. kranthi"
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">UTM Medium *</Label>
                <Input
                  value={form.utm_medium}
                  onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                  placeholder="e.g. influencer"
                  className="mt-1 h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">UTM Campaign *</Label>
                <Input
                  value={form.utm_campaign}
                  onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                  placeholder="e.g. october_mattress"
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">UTM Content (Optional)</Label>
                <Input
                  value={form.utm_content}
                  onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                  placeholder="e.g. reel1"
                  className="mt-1 h-9"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Influencer / Partner Name (Optional)</Label>
              <Input
                value={form.influencer_name}
                onChange={(e) => setForm({ ...form, influencer_name: e.target.value })}
                placeholder="e.g. Kranthi Kumar"
                className="mt-1 h-9"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Destination URL</Label>
              <Input
                value={form.destination_url}
                onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                placeholder="https://www.kotsonbeds.com/"
                className="mt-1 h-9 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCampaignMutation.mutate()}
              disabled={!form.name || !form.utm_source || !form.utm_medium || !form.utm_campaign || createCampaignMutation.isPending}
              className="bg-[#1B365D] text-white"
            >
              {createCampaignMutation.isPending ? "Generating..." : "Generate Trackable Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK ASSIGN LEADS DIALOG */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-heading">Assign Leads to Telecaller / Manager</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              Selected <strong>{selectedLeads.length}</strong> lead(s) for telecaller assignment.
            </p>

            <div>
              <Label className="text-xs font-semibold">Select Employee / Telecaller *</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="mt-1 h-9 bg-background">
                  <SelectValue placeholder="Choose employee..." />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Assignment Notes (Optional)</Label>
              <Input
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="e.g. Follow up regarding October Mattress Campaign"
                className="mt-1 h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => assignLeadsMutation.mutate()}
              disabled={!selectedAssignee || assignLeadsMutation.isPending}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {assignLeadsMutation.isPending ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CUSTOMER MARKETING JOURNEY DIALOG */}
      {journeyLead && (
        <Dialog open={!!journeyLead} onOpenChange={() => setJourneyLead(null)}>
          <DialogContent className="max-w-lg rounded-2xl p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold font-heading">Customer Marketing Journey</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="bg-secondary/40 p-3 rounded-xl space-y-1">
                <p className="font-bold text-foreground text-sm">{journeyLead.customer_name}</p>
                <p className="text-muted-foreground">{journeyLead.phone} • {journeyLead.email}</p>
                <p className="text-[11px] text-muted-foreground">Signup Date: {fmtDateTime(journeyLead.signup_date)}</p>
              </div>

              {/* FIRST TOUCH */}
              <div className="border border-emerald-200 bg-emerald-50/40 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">FIRST TOUCH (Acquisition Source)</span>
                <p className="text-sm font-bold text-emerald-950">{journeyLead.first_touch_source}</p>
                <p className="text-xs text-emerald-800 font-mono">Medium: {journeyLead.first_touch_medium} | Campaign: {journeyLead.first_touch_campaign}</p>
                <p className="text-[11px] text-emerald-700">{fmtDateTime(journeyLead.first_touch_timestamp)}</p>
              </div>

              {/* LAST TOUCH */}
              <div className="border border-indigo-200 bg-indigo-50/40 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">LAST TOUCH (Purchase Attribution Source)</span>
                <p className="text-sm font-bold text-indigo-950">{journeyLead.last_touch_source}</p>
                <p className="text-xs text-indigo-800 font-mono">Medium: {journeyLead.last_touch_medium} | Campaign: {journeyLead.last_touch_campaign}</p>
                <p className="text-[11px] text-indigo-700">{fmtDateTime(journeyLead.last_touch_timestamp)}</p>
              </div>

              {/* Captured Journey Timeline */}
              <div className="space-y-2 pt-2">
                <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Captured Timeline</p>
                <div className="border-l-2 border-[#1B365D] pl-4 space-y-3 ml-1">
                  <div>
                    <p className="font-semibold text-foreground">First Attributable Visit</p>
                    <p className="text-[11px] text-muted-foreground">Arrived via {journeyLead.first_touch_source} ({journeyLead.first_touch_campaign})</p>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">Account Created (Signup)</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDateTime(journeyLead.signup_date)}</p>
                  </div>

                  {journeyLead.total_orders > 0 && (
                    <div>
                      <p className="font-semibold text-emerald-700">Paid Order Placed ({journeyLead.total_orders} order(s))</p>
                      <p className="text-[11px] text-muted-foreground">Total Revenue: {inr(journeyLead.total_revenue)} • Last: {journeyLead.last_purchase_date ? fmtDateTime(journeyLead.last_purchase_date) : 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setJourneyLead(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
