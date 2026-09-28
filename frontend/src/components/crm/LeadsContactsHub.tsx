import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Users,
  Search,
  Filter,
  Download,
  Upload,
  UserCheck,
  PhoneCall,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpDown,
  CheckCircle2,
  FileSpreadsheet,
  Shuffle,
  Phone,
  Tag,
  Clock,
  Layers,
  X,
  UserPlus,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Lead, LeadPage } from "@/lib/crmTypes";
import WalkInLeadDialog from "./WalkInLeadDialog";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "uncontacted", label: "Uncontacted" },
  { id: "in_progress", label: "In-Progress" },
  { id: "follow_up", label: "Follow-up" },
  { id: "not_connected", label: "Not Connected" },
];

export default function LeadsContactsHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { data: me } = useMe();

  const isPureEmployee =
    !!me?.roles.includes("crm_employee") &&
    !me.roles.some((r) => ["owner", "admin", "crm_master", "crm_manager"].includes(r));

  // Search & Filters
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("ALL");
  const [qualification, setQualification] = useState("ALL");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const urlCampaign = searchParams.get("campaign_code") || "";

  // Selected lead IDs for bulk actions
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Modals state
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [convertModalLead, setConvertModalLead] = useState<Lead | null>(null);

  // Import form
  const [csvContent, setCsvContent] = useState("");

  // Distribution form
  const [distStrategy, setDistStrategy] = useState<"round_robin" | "percentage">("round_robin");

  // Order conversion form
  const [orderProduct, setOrderProduct] = useState("Ortho Therapy Mattress");
  const [orderQty, setOrderQty] = useState(1);
  const [orderPrice, setOrderPrice] = useState(74000); // rupees
  const [orderAddressLine, setOrderAddressLine] = useState("123 Green Valley Road");
  const [orderCity, setOrderCity] = useState("Bengaluru");
  const [orderPincode, setOrderPincode] = useState("560001");
  const [orderPayment, setOrderPayment] = useState("upi");

  // Build query string
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    ...(search && { q: search }),
    ...(stage !== "ALL" && { stage_code: stage }),
    ...(qualification !== "ALL" && { qualification }),
    ...(category !== "all" && { category }),
    ...(urlCampaign && { campaign_code: urlCampaign }),
  });

  const { data: pageData, isLoading } = useQuery<LeadPage>({
    queryKey: ["crm-leads-paginated", page, pageSize, search, stage, qualification, category, urlCampaign],
    queryFn: () => apiGet<LeadPage>(`/crm/leads?${queryParams.toString()}`),
  });

  // Start Calling Action
  const [startingCall, setStartingCall] = useState(false);
  const handleStartCalling = async () => {
    setStartingCall(true);
    try {
      const endpoint = urlCampaign
        ? `/crm/leads/next-call?campaign_code=${encodeURIComponent(urlCampaign)}`
        : "/crm/leads/next-call";
      const res = await apiGet<{ has_lead: boolean; lead_id?: string; queue_reason?: string; message?: string }>(
        endpoint
      );
      if (res.has_lead && res.lead_id) {
        toast.info(res.queue_reason ? `Next Lead: ${res.queue_reason}` : "Connecting to next lead...");
        navigate(`/crm/leads/${res.lead_id}?start_call=true`);
      } else {
        toast.success(res.message || "Queue clear! No pending leads in your queue.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch next callable lead");
    } finally {
      setStartingCall(false);
    }
  };

  // Export CSV handler
  const handleExportCsv = () => {
    window.open("/api/crm/leads/export", "_blank");
    toast.success("Downloading authoritative CRM Leads CSV");
  };

  // Bulk Import mutation
  const importCsv = useMutation({
    mutationFn: () => {
      const rows = csvContent
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const items = rows.slice(1).map((row) => {
        const [name, phone, email, product_interest, city] = row.split(",").map((s) => s?.trim());
        return { name: name || "Web Prospect", phone, email, product_interest, city };
      });
      return apiPost<{ message: string; imported_count: number }>("/crm/leads/bulk-import", { leads: items });
    },
    onSuccess: (data) => {
      toast.success(data.message || `Imported ${data.imported_count} leads successfully`);
      setImportModalOpen(false);
      setCsvContent("");
      qc.invalidateQueries({ queryKey: ["crm-leads-paginated"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to import leads"),
  });

  // Bulk Distribute mutation
  const distributeLeads = useMutation({
    mutationFn: () =>
      apiPost<{ message: string; distributed_count: number }>("/crm/leads/distribute", {
        lead_ids: selectedLeads,
        strategy: distStrategy,
      }),
    onSuccess: (data) => {
      toast.success(data.message || `Assigned ${data.distributed_count} leads`);
      setDistributeModalOpen(false);
      setSelectedLeads([]);
      qc.invalidateQueries({ queryKey: ["crm-leads-paginated"] });
    },
    onError: (err: any) => toast.error(err.message || "Lead assignment failed"),
  });

  // Direct Order Conversion Mutation
  const convertOrder = useMutation({
    mutationFn: (lead: Lead) =>
      apiPost<{ message: string; order_id: string; order_number: string }>(
        `/crm/leads/${lead.id}/convert-order`,
        {
          product_name: orderProduct,
          quantity: orderQty,
          unit_price_paise: orderPrice * 100,
          shipping_address: {
            full_name: lead.name,
            phone: lead.phone || "9999999999",
            email: lead.email || "customer@kotson.local",
            line1: orderAddressLine,
            city: orderCity,
            state: "Karnataka",
            pincode: orderPincode,
          },
          payment_method: orderPayment,
          notes: "Converted via Kotson CRM Sales Desk",
        }
      ),
    onSuccess: (data) => {
      toast.success(`Converted to Order ${data.order_number} successfully! Attributed to CRM.`);
      setConvertModalLead(null);
      qc.invalidateQueries({ queryKey: ["crm-leads-paginated"] });
      qc.invalidateQueries({ queryKey: ["crm-dashboard-kpis"] });
    },
    onError: (err: any) => toast.error(err.message || "Order conversion failed"),
  });

  const leads = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map((l) => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const clearCampaignFilter = () => {
    searchParams.delete("campaign_code");
    setSearchParams(searchParams);
  };

  return (
    <div className="space-y-5">
      {/* ── Header & Primary Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#7C9C59]" />
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#11291F]">
              {isPureEmployee ? "My Leads" : "Leads & Contacts Hub"}
            </h2>
          </div>
          <p className="text-xs text-[#6B716C] mt-0.5">
            {isPureEmployee
              ? "All qualified sales prospects and customer consultations assigned to you."
              : "Server-paginated CRM database · Direct connection to Kotson customer identities"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Start Calling Primary Action */}
          <Button
            onClick={handleStartCalling}
            disabled={startingCall}
            className="h-9 px-4 gap-1.5 bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5 text-[#7C9C59]" />
            {startingCall ? "Queueing…" : "Start Calling"}
          </Button>

          {/* Add Walk-in Lead */}
          <Button
            onClick={() => setWalkInOpen(true)}
            variant="outline"
            className="h-9 px-3 gap-1.5 border-[#D8DDD7] text-[#11291F] hover:bg-[#F7F4EE] text-xs font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5 text-[#467065]" />
            Add Walk-in
          </Button>

          {selectedLeads.length > 0 && !isPureEmployee && (
            <Button
              size="sm"
              onClick={() => setDistributeModalOpen(true)}
              className="h-9 gap-1.5 bg-[#467065] hover:bg-[#395c53] text-white text-xs font-semibold shadow-xs"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Assign ({selectedLeads.length})
            </Button>
          )}

          {!isPureEmployee && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                className="h-9 gap-1.5 text-xs border-[#D8DDD7] text-[#467065] hover:bg-[#F7F4EE]"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportModalOpen(true)}
                className="h-9 gap-1.5 text-xs border-[#D8DDD7] text-[#467065] hover:bg-[#F7F4EE]"
              >
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Active Campaign Filter Badge (if applicable) ── */}
      {urlCampaign && (
        <div className="flex items-center justify-between rounded-xl border border-[#7C9C59]/40 bg-[#7C9C59]/10 px-4 py-2">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[#467065]" />
            <span className="text-xs text-[#11291F]">
              Filtered by Campaign: <strong>{urlCampaign}</strong>
            </span>
          </div>
          <button
            onClick={clearCampaignFilter}
            className="text-xs text-[#467065] hover:text-[#11291F] font-semibold flex items-center gap-1 cursor-pointer"
          >
            Clear Filter <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Category Filter Tabs (Inspired by Screenshot 5: All, Uncontacted, In-Progress, Follow-up, Not Connected) ── */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 border-b border-[#E8EDE7]">
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setCategory(cat.id);
                setPage(1);
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-[#11291F] text-[#F7F4EE] shadow-2xs"
                  : "bg-white border border-[#D8DDD7] text-[#6B716C] hover:border-[#467065] hover:text-[#11291F]"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8EDE7] bg-white p-4 shadow-2xs">
        <div className="flex flex-1 min-w-[240px] items-center gap-2 rounded-xl border border-[#D8DDD7] bg-[#F7F4EE]/40 px-3 py-1.5">
          <Search className="h-4 w-4 text-[#6B716C]" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search leads by name, phone, email, lead #..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-[#6B716C] text-[#2D2D2D]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={stage}
            onValueChange={(val) => {
              setStage(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-36 text-xs bg-white border-[#D8DDD7]">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Stages</SelectItem>
              <SelectItem value="new">New Lead</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={qualification}
            onValueChange={(val) => {
              setQualification(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-40 text-xs bg-white border-[#D8DDD7]">
              <SelectValue placeholder="All Qualifications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Qualifications</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="cart_intent">Cart Intent</SelectItem>
              <SelectItem value="sales_qualified">Sales Qualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Leads Data Display ── */}
      <div className="rounded-2xl border border-[#E8EDE7] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B716C]">
            Showing {leads.length} of <strong>{total}</strong> leads in scope
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#6B716C] py-12 text-center">Loading leads…</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-[#6B716C] py-12 text-center">No leads found matching criteria.</p>
        ) : (
          <>
            {/* ── Desktop & Tablet: Dense Kotson Table ── */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-[#D8DDD7]"
                      />
                    </TableHead>
                    <TableHead>Lead Info</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>Product Interest</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id} className="hover:bg-[#F7F4EE]/40 transition-colors">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(l.id)}
                          onChange={() => toggleSelectLead(l.id)}
                          className="rounded border-[#D8DDD7]"
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          onClick={() => navigate(`/crm/leads/${l.id}`)}
                          className="cursor-pointer font-bold text-[#11291F] hover:text-[#467065] transition-colors"
                        >
                          {l.name}
                        </span>
                        <div className="text-[11px] font-mono text-[#6B716C]">{l.lead_number}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-[#2D2D2D]">{l.phone || "—"}</div>
                        <div className="text-[11px] text-[#6B716C]">{l.email || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs border-[#D8DDD7]">
                          {(l.stage_code ?? "—").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            l.qualification === "converted"
                              ? "bg-emerald-600 text-white"
                              : l.qualification === "sales_qualified"
                              ? "bg-[#7C9C59] text-white"
                              : l.qualification === "cart_intent"
                              ? "bg-amber-500 text-white"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {l.qualification.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-[#2D2D2D]">
                        {l.product_interest || "Ortho Therapy Mattress"}
                      </TableCell>
                      <TableCell className="text-xs text-[#6B716C]">
                        {l.source_kind.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/crm/leads/${l.id}?start_call=true`)}
                            className="h-7 px-2.5 gap-1 bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] text-xs font-semibold"
                          >
                            <PhoneCall className="h-3 w-3 text-[#7C9C59]" />
                            Call
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/crm/leads/${l.id}`)}
                            className="h-7 px-2 text-xs text-[#467065] hover:bg-[#7C9C59]/10"
                          >
                            Details
                          </Button>
                          {!isPureEmployee && (
                            <Button
                              size="sm"
                              onClick={() => setConvertModalLead(l)}
                              className="h-7 px-2.5 gap-1 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
                            >
                              <ShoppingBag className="h-3 w-3" />
                              Convert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ── Mobile Layout: Compact Kotson Lead Cards (Inspired by Screenshot 3) ── */}
            <div className="block sm:hidden space-y-3">
              {leads.map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-[#E8EDE7] bg-white p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4
                        onClick={() => navigate(`/crm/leads/${l.id}`)}
                        className="font-heading text-sm font-bold text-[#11291F] hover:text-[#467065] cursor-pointer"
                      >
                        {l.name}
                      </h4>
                      <p className="text-xs font-mono text-[#6B716C] mt-0.5">
                        {l.phone || "No phone"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize border-[#D8DDD7]">
                      {(l.stage_code ?? "new").replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6B716C] pt-2 border-t border-[#E8EDE7]">
                    <span>Source: <strong className="text-[#2D2D2D]">{l.source_kind}</strong></span>
                    <span>Status: <strong className="text-[#2D2D2D]">{l.qualification.replace("_", " ")}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/crm/leads/${l.id}?start_call=true`)}
                      className="flex-1 h-9 bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] text-xs font-bold uppercase tracking-wider"
                    >
                      <PhoneCall className="mr-1.5 size-3.5 text-[#7C9C59]" />
                      Call Lead
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/crm/leads/${l.id}`)}
                      className="h-9 px-3 border-[#D8DDD7] text-xs font-semibold text-[#11291F]"
                    >
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Pagination Controls ── */}
        <div className="flex items-center justify-between border-t border-[#E8EDE7] pt-4">
          <span className="text-xs text-[#6B716C]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 gap-1 text-xs border-[#D8DDD7]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 gap-1 text-xs border-[#D8DDD7]"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Walk-in Lead Dialog ── */}
      <WalkInLeadDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        defaultCampaignId={urlCampaign}
      />

      {/* ── Convert to Order Modal (Admin/Manager) ── */}
      {convertModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E8EDE7] pb-3">
              <ShoppingBag className="h-5 w-5 text-[#7C9C59]" />
              <div>
                <h3 className="font-heading text-lg font-bold text-[#11291F]">Convert Lead to Order</h3>
                <p className="text-xs text-[#6B716C]">
                  Creates a verified order in Kotson Order Engine with sales attribution to CRM
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-[#F7F4EE] p-3 text-xs">
                <span className="text-[#6B716C]">Customer:</span>{" "}
                <strong className="text-[#11291F]">{convertModalLead.name}</strong> ({convertModalLead.phone || "No phone"})
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#11291F]">Selected Mattress Product</Label>
                <Select value={orderProduct} onValueChange={setOrderProduct}>
                  <SelectTrigger className="mt-1 h-9 text-xs border-[#D8DDD7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ortho Therapy Mattress">Ortho Therapy Mattress</SelectItem>
                    <SelectItem value="Posture Luxe Pocket Spring">Posture Luxe Pocket Spring</SelectItem>
                    <SelectItem value="Natural Latex Hybrid">Natural Latex Hybrid</SelectItem>
                    <SelectItem value="Dual Comfort Memory Foam">Dual Comfort Memory Foam</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-[#11291F]">Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={orderQty}
                    onChange={(e) => setOrderQty(parseInt(e.target.value) || 1)}
                    className="mt-1 h-9 text-xs border-[#D8DDD7]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#11291F]">Price per Unit (₹)</Label>
                  <Input
                    type="number"
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(parseInt(e.target.value) || 0)}
                    className="mt-1 h-9 text-xs border-[#D8DDD7]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#11291F]">Delivery Address</Label>
                <Input
                  value={orderAddressLine}
                  onChange={(e) => setOrderAddressLine(e.target.value)}
                  placeholder="Street / House address"
                  className="mt-1 h-9 text-xs border-[#D8DDD7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-[#11291F]">City</Label>
                  <Input
                    value={orderCity}
                    onChange={(e) => setOrderCity(e.target.value)}
                    className="mt-1 h-9 text-xs border-[#D8DDD7]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#11291F]">Pincode</Label>
                  <Input
                    value={orderPincode}
                    onChange={(e) => setOrderPincode(e.target.value)}
                    className="mt-1 h-9 text-xs border-[#D8DDD7]"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#11291F]">Payment Method</Label>
                <Select value={orderPayment} onValueChange={setOrderPayment}>
                  <SelectTrigger className="mt-1 h-9 text-xs border-[#D8DDD7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI / QR Code</SelectItem>
                    <SelectItem value="card">Credit / Debit Card</SelectItem>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer / NEFT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-[#7C9C59]/30 bg-[#7C9C59]/10 p-3 text-xs flex justify-between items-center">
                <span>Total Order Amount:</span>
                <strong className="text-base text-[#11291F]">{inr(orderPrice * orderQty * 100)}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EDE7]">
              <Button variant="ghost" size="sm" onClick={() => setConvertModalLead(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={convertOrder.isPending}
                onClick={() => convertOrder.mutate(convertModalLead)}
                className="gap-1.5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
              >
                {convertOrder.isPending ? "Generating Order..." : "Confirm Conversion"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Assign Modal ── */}
      {distributeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-lg font-bold text-[#11291F]">Distribute Selected Leads</h3>
            <p className="text-xs text-[#6B716C]">
              Assign {selectedLeads.length} selected leads to active sales representatives.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-[#11291F]">Distribution Strategy</Label>
                <Select
                  value={distStrategy}
                  onValueChange={(val: any) => setDistStrategy(val)}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs border-[#D8DDD7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round-Robin (Equal Share)</SelectItem>
                    <SelectItem value="percentage">Quota Weighted / Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDistributeModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={distributeLeads.isPending}
                onClick={() => distributeLeads.mutate()}
                className="bg-[#467065] hover:bg-[#395c53] text-white text-xs font-semibold"
              >
                {distributeLeads.isPending ? "Assigning..." : "Assign Leads"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Bulk Import Modal ── */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-lg font-bold text-[#11291F]">Import Leads from CSV</h3>
            <p className="text-xs text-[#6B716C]">
              Paste CSV text formatted as: <code>Name, Phone, Email, Product Interest, City</code>
            </p>

            <Textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={`Name,Phone,Email,Product Interest,City\nRajesh Kumar,9876543210,rajesh@example.com,Ortho Therapy,Bengaluru\nSneha Patel,9123456789,sneha@example.com,Posture Luxe,Mumbai`}
              rows={8}
              className="text-xs font-mono border-[#D8DDD7]"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setImportModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!csvContent.trim() || importCsv.isPending}
                onClick={() => importCsv.mutate()}
                className="bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
              >
                {importCsv.isPending ? "Importing..." : "Import Leads"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
