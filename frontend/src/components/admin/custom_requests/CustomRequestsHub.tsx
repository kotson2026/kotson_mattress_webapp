import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Ruler,
  Phone,
  Mail,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  MessageSquare,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import { fmtDateTime, inr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomRequestItem {
  id: string;
  request_number: string;
  customer_name: string;
  mobile: string;
  email?: string;
  city?: string;
  pincode?: string;
  product_id?: string;
  product_name: string;
  product_slug?: string;
  category?: string;
  product_image?: string;
  size_mode: string;
  standard_size_label?: string;
  length: string | number;
  breadth: string | number;
  height_or_thickness: string | number;
  measurement_unit: string;
  dimensions_display: string;
  status: "NEW" | "UNDER_REVIEW" | "CONTACTED" | "QUOTE_PROVIDED" | "CONVERTED" | "CLOSED" | "CANCELLED";
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  customer_remarks?: string;
  internal_remarks?: string;
  quoted_price?: number;
  quote_notes?: string;
  quote_date?: string;
  created_at: string;
  formatted_date: string;
  updated_at: string;
}

interface CustomRequestsResponse {
  items: CustomRequestItem[];
  total: number;
  page: number;
  page_size: number;
  counters: {
    new_count: number;
    under_review_count: number;
    contacted_count: number;
    quote_provided_count: number;
    converted_count: number;
    total_count: number;
  };
}

export default function CustomRequestsHub() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Selected request for detail modal
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Editable fields in detail modal
  const [modalStatus, setModalStatus] = useState<string>("");
  const [modalAssignedName, setModalAssignedName] = useState<string>("");
  const [modalInternalRemarks, setModalInternalRemarks] = useState<string>("");
  const [modalQuotedPrice, setModalQuotedPrice] = useState<string>("");
  const [modalQuoteNotes, setModalQuoteNotes] = useState<string>("");

  // Fetch Requests
  const { data, isLoading } = useQuery<CustomRequestsResponse>({
    queryKey: ["admin-custom-requests", statusFilter, q, page],
    queryFn: () =>
      apiGet<CustomRequestsResponse>(
        `/admin/custom-requests?status=${statusFilter}&q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`
      ),
  });

  // Fetch Selected Request Detail
  const { data: detailData, isLoading: isDetailLoading } = useQuery<CustomRequestItem>({
    queryKey: ["admin-custom-request-detail", selectedRequestId],
    queryFn: () => apiGet<CustomRequestItem>(`/admin/custom-requests/${selectedRequestId}`),
    enabled: !!selectedRequestId,
  });

  // Initialize modal state when detail is loaded
  React.useEffect(() => {
    if (detailData) {
      setModalStatus(detailData.status || "NEW");
      setModalAssignedName(detailData.assigned_to_name === "Unassigned" ? "" : detailData.assigned_to_name || "");
      setModalInternalRemarks(detailData.internal_remarks || "");
      setModalQuotedPrice(detailData.quoted_price ? String(detailData.quoted_price) : "");
      setModalQuoteNotes(detailData.quote_notes || "");
    }
  }, [detailData]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      apiPatch(`/admin/custom-requests/${selectedRequestId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-custom-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-custom-request-detail", selectedRequestId] });
      toast.success("Custom request updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update custom request");
    },
  });

  const handleSaveModal = (extraStatus?: string) => {
    if (!selectedRequestId) return;
    const payload: any = {
      status: extraStatus || modalStatus,
      assigned_to_name: modalAssignedName.trim() || null,
      internal_remarks: modalInternalRemarks.trim() || null,
    };
    if (modalQuotedPrice) {
      const num = parseFloat(modalQuotedPrice);
      if (!isNaN(num) && num > 0) {
        payload.quoted_price = num;
        payload.quote_notes = modalQuoteNotes.trim() || null;
      }
    }
    updateMutation.mutate(payload);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold">NEW</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold">UNDER REVIEW</Badge>;
      case "CONTACTED":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold">CONTACTED</Badge>;
      case "QUOTE_PROVIDED":
        return <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold">QUOTE PROVIDED</Badge>;
      case "CONVERTED":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">CONVERTED</Badge>;
      case "CLOSED":
        return <Badge variant="outline" className="text-gray-600 border-gray-400 font-medium">CLOSED</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive" className="font-medium">CANCELLED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const counters = data?.counters || {
    new_count: 0,
    under_review_count: 0,
    contacted_count: 0,
    quote_provided_count: 0,
    converted_count: 0,
    total_count: 0,
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Custom Product Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative queue for bespoke mattress dimensions, quotation reviews, and customer follow-up.
          </p>
        </div>
      </div>

      {/* ── Top 5 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => { setStatusFilter("NEW"); setPage(1); }}
          className={`p-4 rounded-2xl border bg-card cursor-pointer transition-all shadow-xs ${
            statusFilter === "NEW" ? "border-blue-500 ring-2 ring-blue-500/20" : "hover:border-border/80"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            New Requests
          </span>
          <p className="font-heading text-2xl font-black mt-1 text-foreground">
            {counters.new_count}
          </p>
        </div>

        <div
          onClick={() => { setStatusFilter("UNDER_REVIEW"); setPage(1); }}
          className={`p-4 rounded-2xl border bg-card cursor-pointer transition-all shadow-xs ${
            statusFilter === "UNDER_REVIEW" ? "border-amber-500 ring-2 ring-amber-500/20" : "hover:border-border/80"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
            Under Review
          </span>
          <p className="font-heading text-2xl font-black mt-1 text-foreground">
            {counters.under_review_count}
          </p>
        </div>

        <div
          onClick={() => { setStatusFilter("CONTACTED"); setPage(1); }}
          className={`p-4 rounded-2xl border bg-card cursor-pointer transition-all shadow-xs ${
            statusFilter === "CONTACTED" ? "border-purple-500 ring-2 ring-purple-500/20" : "hover:border-border/80"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">
            Contacted
          </span>
          <p className="font-heading text-2xl font-black mt-1 text-foreground">
            {counters.contacted_count}
          </p>
        </div>

        <div
          onClick={() => { setStatusFilter("QUOTE_PROVIDED"); setPage(1); }}
          className={`p-4 rounded-2xl border bg-card cursor-pointer transition-all shadow-xs ${
            statusFilter === "QUOTE_PROVIDED" ? "border-cyan-500 ring-2 ring-cyan-500/20" : "hover:border-border/80"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 block">
            Quote Provided
          </span>
          <p className="font-heading text-2xl font-black mt-1 text-foreground">
            {counters.quote_provided_count}
          </p>
        </div>

        <div
          onClick={() => { setStatusFilter("CONVERTED"); setPage(1); }}
          className={`p-4 rounded-2xl border bg-card cursor-pointer transition-all shadow-xs ${
            statusFilter === "CONVERTED" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "hover:border-border/80"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
            Converted
          </span>
          <p className="font-heading text-2xl font-black mt-1 text-foreground">
            {counters.converted_count}
          </p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search request ID, customer name, mobile, or product..."
            className="pl-9 h-10 text-sm bg-background border-border"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">Status:</span>
          {["ALL", "NEW", "UNDER_REVIEW", "CONTACTED", "QUOTE_PROVIDED", "CONVERTED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? "bg-[#467065] text-white shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Requests Table ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold text-xs uppercase">Request ID</TableHead>
              <TableHead className="font-bold text-xs uppercase">Date & Time</TableHead>
              <TableHead className="font-bold text-xs uppercase">Customer</TableHead>
              <TableHead className="font-bold text-xs uppercase">Mobile</TableHead>
              <TableHead className="font-bold text-xs uppercase">Product</TableHead>
              <TableHead className="font-bold text-xs uppercase">Dimensions</TableHead>
              <TableHead className="font-bold text-xs uppercase">Status</TableHead>
              <TableHead className="font-bold text-xs uppercase">Assigned To</TableHead>
              <TableHead className="font-bold text-xs uppercase text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-[#467065] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading custom requests...
                </TableCell>
              </TableRow>
            ) : !data?.items || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                  No custom requests found matching the current criteria.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono font-bold text-xs text-[#467065]">
                    {item.request_number}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {item.formatted_date}
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-foreground">
                    {item.customer_name}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{item.mobile}</span>
                      <a
                        href={`https://wa.me/91${item.mobile.replace(/[^0-9]/g, "").slice(-10)}?text=${encodeURIComponent(
                          `Hi ${item.customer_name}, regards your Kotson custom request ${item.request_number}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700"
                        title="Chat on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium max-w-[160px] truncate" title={item.product_name}>
                    {item.product_name}
                  </TableCell>
                  <TableCell className="text-xs font-mono font-semibold whitespace-nowrap">
                    {item.dimensions_display}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.assigned_to_name || "Unassigned"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRequestId(item.id)}
                      className="h-8 text-xs font-bold rounded-lg border-border hover:bg-muted"
                    >
                      VIEW
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.total > pageSize && (
          <div className="flex items-center justify-between p-4 border-t border-border text-xs text-muted-foreground">
            <span>
              Showing {data.items.length} of {data.total} requests
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <span className="px-2">
                Page {page} of {Math.ceil(data.total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(data.total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          DETAIL & ACTION MODAL
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedRequestId} onOpenChange={(open) => !open && setSelectedRequestId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-3xl p-5 sm:p-7 md:p-8">
          <DialogHeader>
            <div className="flex items-center justify-between border-b border-border pb-4 gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Custom Request Details
                </span>
                <DialogTitle className="font-mono text-xl sm:text-2xl font-black text-[#467065] mt-0.5 truncate">
                  {detailData?.request_number || "..."}
                </DialogTitle>
              </div>
              <div className="shrink-0">{detailData && getStatusBadge(detailData.status)}</div>
            </div>
          </DialogHeader>

          {isDetailLoading || !detailData ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading details...</div>
          ) : (
            <div className="space-y-5 pt-2 min-w-0">
              {/* Customer & Product Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
                {/* 1. Customer Info */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5 min-w-0">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Customer Information
                  </h4>
                  <div className="space-y-1.5 text-xs min-w-0">
                    <p className="font-bold text-sm text-foreground break-words">{detailData.customer_name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Phone className="w-3.5 h-3.5 text-[#467065] shrink-0" />
                        <span className="font-semibold text-foreground">{detailData.mobile}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`tel:${detailData.mobile}`}
                          className="text-xs text-[#467065] font-semibold underline hover:text-[#467065]/80"
                        >
                          Call
                        </a>
                        <a
                          href={`https://wa.me/91${detailData.mobile.replace(/[^0-9]/g, "").slice(-10)}?text=${encodeURIComponent(
                            `Hi ${detailData.customer_name}, regards your Kotson custom quotation for ${detailData.product_name}.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 font-semibold underline hover:text-emerald-700"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                    {detailData.email && (
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{detailData.email}</span>
                      </div>
                    )}
                    {(detailData.city || detailData.pincode) && (
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {[detailData.city, detailData.pincode].filter(Boolean).join(" - ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Product Info */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5 min-w-0">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Product Information
                  </h4>
                  <div className="flex items-start gap-3 min-w-0">
                    {detailData.product_image ? (
                      <img
                        src={detailData.product_image}
                        alt={detailData.product_name}
                        className="w-14 h-14 rounded-xl object-contain bg-background border border-border p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                        <Ruler className="w-6 h-6 text-[#467065]" />
                      </div>
                    )}
                    <div className="space-y-1 text-xs min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground break-words">{detailData.product_name}</p>
                      <p className="text-muted-foreground capitalize">
                        Category: {detailData.category || "Mattress"}
                      </p>
                      <Badge variant="outline" className="text-[10px] font-semibold whitespace-normal text-left inline-block">
                        {detailData.size_mode === "custom" ? "Custom Made-To-Size" : "Standard Size"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Custom Measurements Section */}
              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-[#467065]" />
                  <span>Custom Measurements</span>
                </h4>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center min-w-0">
                  <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border/60 min-w-0">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium">Length</span>
                    <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                      {detailData.length} in
                    </span>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border/60 min-w-0">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium">Breadth</span>
                    <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                      {detailData.breadth} in
                    </span>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border/60 min-w-0">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium truncate">
                      Height / Thick
                    </span>
                    <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                      {detailData.height_or_thickness} in
                    </span>
                  </div>
                </div>

                {detailData.customer_remarks && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-950">
                    <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-800">
                      Customer Special Remarks:
                    </span>
                    <p className="mt-0.5 leading-relaxed">{detailData.customer_remarks}</p>
                  </div>
                )}
              </div>

              {/* 4. Operations & Quotation Controls */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-4 min-w-0">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Operational Workflow & Quotation
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                  {/* Status Dropdown */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Status</Label>
                    <select
                      value={modalStatus}
                      onChange={(e) => setModalStatus(e.target.value)}
                      className="w-full h-10 px-3 text-xs font-semibold rounded-xl bg-background border border-border outline-none focus:ring-2 focus:ring-[#467065]"
                    >
                      <option value="NEW">NEW</option>
                      <option value="UNDER_REVIEW">UNDER REVIEW</option>
                      <option value="CONTACTED">CONTACTED</option>
                      <option value="QUOTE_PROVIDED">QUOTE PROVIDED</option>
                      <option value="CONVERTED">CONVERTED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  {/* Assigned Manager */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Assigned Manager</Label>
                    <Input
                      value={modalAssignedName}
                      onChange={(e) => setModalAssignedName(e.target.value)}
                      placeholder="e.g. Vikram Malhotra"
                      className="h-10 text-xs bg-background border-border"
                    />
                  </div>

                  {/* Quoted Price */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      Business Quoted Price (₹)
                    </Label>
                    <Input
                      type="number"
                      value={modalQuotedPrice}
                      onChange={(e) => setModalQuotedPrice(e.target.value)}
                      placeholder="e.g. 38500"
                      className="h-10 text-xs bg-background border-border font-mono"
                    />
                  </div>

                  {/* Quote Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Quote Notes</Label>
                    <Input
                      value={modalQuoteNotes}
                      onChange={(e) => setModalQuoteNotes(e.target.value)}
                      placeholder="e.g. Includes 18% GST and custom 7-zone contour cut."
                      className="h-10 text-xs bg-background border-border"
                    />
                  </div>
                </div>

                {/* Internal Remarks */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    Internal Follow-up & Manufacturing Remarks
                  </Label>
                  <Textarea
                    value={modalInternalRemarks}
                    onChange={(e) => setModalInternalRemarks(e.target.value)}
                    placeholder="Record notes on slab availability, telephone conversations, customer timeline..."
                    className="min-h-[70px] text-xs bg-background border-border resize-none"
                  />
                </div>

                {/* Fast Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveModal("UNDER_REVIEW")}
                    disabled={updateMutation.isPending}
                    className="text-xs font-bold border-amber-500 text-amber-700 hover:bg-amber-50"
                  >
                    Mark Under Review
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveModal("CONTACTED")}
                    disabled={updateMutation.isPending}
                    className="text-xs font-bold border-purple-500 text-purple-700 hover:bg-purple-50"
                  >
                    Mark Contacted
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveModal("QUOTE_PROVIDED")}
                    disabled={updateMutation.isPending}
                    className="text-xs font-bold border-cyan-500 text-cyan-700 hover:bg-cyan-50"
                  >
                    Mark Quote Provided
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveModal("CONVERTED")}
                    disabled={updateMutation.isPending}
                    className="text-xs font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                  >
                    Mark Converted
                  </Button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequestId(null)}
                  className="rounded-xl text-xs font-bold"
                >
                  Close
                </Button>
                <Button
                  onClick={() => handleSaveModal()}
                  disabled={updateMutation.isPending}
                  className="rounded-xl text-xs font-bold bg-[#467065] text-white hover:bg-[#395c53]"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
