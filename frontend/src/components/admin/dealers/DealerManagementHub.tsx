import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Clock,
  ShoppingBag,
  DollarSign,
  TrendingDown,
  Briefcase,
  Search,
  Plus,
  Edit3,
  Check,
  X,
  MapPin,
  FileText,
  CreditCard,
  Truck,
  Percent,
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

export default function DealerManagementHub() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"dealers" | "rules" | "orders">("dealers");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals state
  const [selectedDealerDecision, setSelectedDealerDecision] = useState<any>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);

  // 1. Overview 7 KPIs
  const { data: overview } = useQuery({
    queryKey: ["dealers-overview"],
    queryFn: () => apiGet<any>("/admin/dealers/overview"),
  });

  // 2. Dealers List
  const { data: dealersData, isLoading: dealersLoading } = useQuery({
    queryKey: ["admin-dealers", statusFilter, q, page, pageSize],
    queryFn: () =>
      apiGet<{ total: number; dealers: any[] }>(
        `/admin/dealers?status=${statusFilter}&q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`
      ),
    enabled: activeTab === "dealers",
  });
  const dealers = dealersData?.dealers || [];
  const dealersTotal = dealersData?.total || 0;

  // 3. Pricing Rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["dealer-pricing-rules"],
    queryFn: () => apiGet<any[]>("/admin/dealers/pricing-rules"),
    enabled: activeTab === "rules",
  });

  // 4. Dealer Orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["dealer-orders", q, page, pageSize],
    queryFn: () =>
      apiGet<{ total: number; orders: any[] }>(
        `/admin/dealers/orders?q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`
      ),
    enabled: activeTab === "orders",
  });
  const orders = ordersData?.orders || [];
  const ordersTotal = ordersData?.total || 0;

  // Mutations
  const dealerDecision = useMutation({
    mutationFn: ({
      did,
      action,
      territory,
      credit_limit,
      credit_days,
      note,
    }: {
      did: string;
      action: string;
      territory: string;
      credit_limit: number;
      credit_days: number;
      note: string;
    }) =>
      apiPost(`/admin/dealers/${did}/decision`, {
        action,
        territory,
        credit_limit,
        credit_days,
        note,
      }),
    onSuccess: () => {
      setSelectedDealerDecision(null);
      qc.invalidateQueries({ queryKey: ["admin-dealers"] });
      qc.invalidateQueries({ queryKey: ["dealers-overview"] });
      toast.success("Dealer application decision saved successfully");
    },
    onError: (e: any) => toast.error(e.message || "Failed to submit decision"),
  });

  return (
    <div className="space-y-6" data-testid="dealers-management-hub">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">B2B Dealer Partner Management</h1>
          <p className="text-sm text-muted-foreground">
            Approve retail stockists, configure tiered wholesale margin overrides, and track wholesale deliveries.
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
            <Plus className="w-4 h-4 mr-2" /> Add Pricing Rule
          </Button>
        </div>
      </div>

      {/* 7 Executive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Dealers</span>
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_dealers ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Partner network</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.approved_dealers ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Authorized stockists</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Apps</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{overview?.pending_dealers ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Awaiting review</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dealer Orders</span>
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.orders_count ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Wholesale orders</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross Sales</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-bold">
            {overview?.gross_sales ? inr(overview.gross_sales) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Retail catalogue val</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Concession</span>
            <TrendingDown className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-orange-700">
            {overview?.total_discount ? inr(overview.total_discount) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Wholesale discounts</div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Realized</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {overview?.net_sales ? inr(overview.net_sales) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Net cash collected</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border bg-card rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab("dealers")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "dealers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Authorized Dealers & Applications
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "rules"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Percent className="w-4 h-4" />
          Commercial Pricing Rules & Overrides
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Dealer Orders & Fulfilment
        </button>
      </div>

      {/* Sub-Tab 1: Dealers List */}
      {activeTab === "dealers" && (
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
                placeholder="Search by company, GSTIN, contact name, or city…"
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
                <option value="ALL">All Applications</option>
                <option value="approved">Approved & Active</option>
                <option value="pending">Pending Approval</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Organization / Store</TableHead>
                  <TableHead>Contact & Phone</TableHead>
                  <TableHead>Location & Territory</TableHead>
                  <TableHead>GSTIN / Tax ID</TableHead>
                  <TableHead>Credit Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealersLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Loading dealers…
                    </TableCell>
                  </TableRow>
                ) : dealers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No dealers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  dealers.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-semibold text-sm">{d.org_name}</div>
                        <div className="text-xs text-muted-foreground">Type: Authorized Stockist</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{d.contact_name || "—"}</div>
                        <div className="text-muted-foreground">{d.phone || d.email || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{d.city || d.state || "India"}</div>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {d.territory || "Territory: Unassigned"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{d.gstin || "—"}</code>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>Limit: {inr(d.credit_limit || 0)}</div>
                        <div className="text-muted-foreground">{d.credit_days || 30} Days Net</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            d.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : d.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {d.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold"
                          onClick={() => setSelectedDealerDecision(d)}
                        >
                          {d.status === "pending" ? "Review & Approve" : "Edit Terms"}
                        </Button>
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
              totalItems={dealersTotal}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Pricing Rules */}
      {activeTab === "rules" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product Scope</TableHead>
                <TableHead>Dealer Scope</TableHead>
                <TableHead>Rule Formula</TableHead>
                <TableHead>Min Order Qty</TableHead>
                <TableHead>Credit Window</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rulesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading commercial rules…
                  </TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No pricing rules configured.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((r) => {
                  const isOverride = Boolean(r.dealer_id || r.product_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold text-sm">{r.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.dealer_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-foreground">
                          {r.rule_type === "PERCENTAGE"
                            ? `${r.discount_value}% Off MRP`
                            : `Flat ${inr(r.discount_value)} Off`}
                        </span>
                      </TableCell>
                      <TableCell>{r.min_order_qty || 1} units</TableCell>
                      <TableCell>{r.credit_days || 30} Days</TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            isOverride
                              ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isOverride ? "Specific Override" : "Global Default"}
                        </Badge>
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
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sub-Tab 3: Dealer Orders */}
      {activeTab === "orders" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Dealer Organization</TableHead>
                <TableHead>Items / Units</TableHead>
                <TableHead>Order Amount (₹)</TableHead>
                <TableHead>Order Status</TableHead>
                <TableHead>Fulfilment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading dealer orders…
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No dealer orders placed yet.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs font-semibold">{o.order_number}</TableCell>
                    <TableCell className="font-semibold text-sm">{o.org_name}</TableCell>
                    <TableCell className="text-xs">
                      {o.items?.length || 0} line(s) (
                      {o.items?.reduce((acc: number, it: any) => acc + (it.qty || 1), 0)} total units)
                    </TableCell>
                    <TableCell className="font-bold text-sm text-foreground">{inr(o.subtotal || 0)}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                        {o.status || "APPROVED"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {o.fulfilment_status || "PROCESSING"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dealer Decision Drawer */}
      {selectedDealerDecision && (
        <DealerDecisionDrawer
          dealer={selectedDealerDecision}
          onClose={() => setSelectedDealerDecision(null)}
          onConfirm={(action, territory, credit_limit, credit_days, note) =>
            dealerDecision.mutate({
              did: selectedDealerDecision.id,
              action,
              territory,
              credit_limit,
              credit_days,
              note,
            })
          }
        />
      )}

      {/* Pricing Rule Modal */}
      {isRuleModalOpen && (
        <DealerRuleModal
          rule={editingRule}
          dealers={dealers}
          onClose={() => setIsRuleModalOpen(false)}
          onSuccess={() => {
            setIsRuleModalOpen(false);
            qc.invalidateQueries({ queryKey: ["dealer-pricing-rules"] });
          }}
        />
      )}
    </div>
  );
}

function DealerDecisionDrawer({
  dealer,
  onClose,
  onConfirm,
}: {
  dealer: any;
  onClose: () => void;
  onConfirm: (action: string, territory: string, credit_limit: number, credit_days: number, note: string) => void;
}) {
  const [territory, setTerritory] = useState(dealer.territory || "Telangana & AP");
  const [creditLimit, setCreditLimit] = useState(dealer.credit_limit || 250000);
  const [creditDays, setCreditDays] = useState(dealer.credit_days || 30);
  const [note, setNote] = useState(dealer.admin_note || "");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
      <div className="bg-card w-full max-w-md h-full border-l border-border p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-heading text-lg font-bold">Dealer Account Review</h3>
              <p className="text-xs text-muted-foreground">{dealer.org_name}</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact:</span>
              <span className="font-semibold">{dealer.contact_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span>{dealer.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span>{dealer.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GSTIN:</span>
              <span className="font-mono">{dealer.gstin}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Assigned Exclusive Territory *</Label>
              <Input
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                placeholder="e.g. Hyderabad Metro & Secunderabad"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Credit Limit (₹)</Label>
                <Input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value))}
                  className="mt-1 font-bold"
                />
              </div>
              <div>
                <Label>Credit Window (Days)</Label>
                <Input
                  type="number"
                  value={creditDays}
                  onChange={(e) => setCreditDays(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Approval Note / Internal Memo</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Details of agreement, security deposit, or verification notes…"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col gap-2">
          <Button
            className="bg-emerald-700 hover:bg-emerald-800 text-white w-full"
            onClick={() => onConfirm("approve", territory, creditLimit, creditDays, note)}
          >
            <Check className="w-4 h-4 mr-2" /> Approve Dealer Application
          </Button>

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => onConfirm("reject", territory, creditLimit, creditDays, note)}
          >
            Reject Application
          </Button>

          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function DealerRuleModal({
  rule,
  dealers,
  onClose,
  onSuccess,
}: {
  rule: any;
  dealers: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    rule_type: rule?.rule_type || "PERCENTAGE",
    discount_value: rule?.discount_value || 25.0,
    min_order_qty: rule?.min_order_qty || 1,
    credit_days: rule?.credit_days || 30,
    dealer_id: rule?.dealer_id || "",
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...formData,
        dealer_id: formData.dealer_id || null,
      };
      if (rule) {
        return apiPut(`/admin/dealers/pricing-rules/${rule.id}`, payload);
      }
      return apiPost("/admin/dealers/pricing-rules", payload);
    },
    onSuccess: () => {
      toast.success(rule ? "Pricing rule updated" : "Pricing rule registered");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save rule"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-heading text-lg font-bold">
            {rule ? "Edit Commercial Terms" : "Add Dealer Pricing Rule"}
          </h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Target Dealer Scope</Label>
            <select
              value={formData.dealer_id}
              onChange={(e) => setFormData({ ...formData, dealer_id: e.target.value })}
              className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">All Authorized Dealers (Global Default)</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.org_name} (Specific Override)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Concession Model</Label>
              <select
                value={formData.rule_type}
                onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <Label>{formData.rule_type === "PERCENTAGE" ? "Discount % Off MRP" : "Flat ₹ Off MRP"}</Label>
              <Input
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                className="mt-1 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Minimum Order Qty</Label>
              <Input
                type="number"
                value={formData.min_order_qty}
                onChange={(e) => setFormData({ ...formData, min_order_qty: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Credit Window (Days)</Label>
              <Input
                type="number"
                value={formData.credit_days}
                onChange={(e) => setFormData({ ...formData, credit_days: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Commercial Rule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
