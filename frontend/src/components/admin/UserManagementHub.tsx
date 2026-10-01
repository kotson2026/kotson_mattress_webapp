import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  Calendar,
  Eye,
  Edit3,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  IndianRupee,
  Clock,
  X,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  UserX,
  Trash2,
  AlertCircle,
  Package,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";

interface CustomerItem {
  id: string;
  supabase_auth_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  account_status?: "ACTIVE" | "ON_HOLD" | "DEACTIVATED";
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  orders_count?: number;
  total_purchase_paise?: number;
  addresses_count?: number;
  addresses?: Array<{
    id: string;
    label?: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    is_default?: boolean;
  }>;
  orders?: Array<{
    id: string;
    order_number?: string;
    payable_amount_paise?: number;
    order_status?: string;
    payment_status?: string;
    created_at: string;
  }>;
}

interface CustomersApiResponse {
  metrics: {
    total_signups: number;
    today_signups: number;
    new_customers_30d: number;
    total_customers: number;
  };
  users: CustomerItem[];
  total: number;
  page: number;
  limit: number;
}

type DatePreset =
  | "ALL"
  | "TODAY"
  | "YESTERDAY"
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "CUSTOM";

export default function UserManagementHub() {
  const qc = useQueryClient();

  // Search, Status, & Pagination state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ON_HOLD" | "DEACTIVATED">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Date Filters
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Modals state
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Customer Form State (Permitted details only: name, email, phone)
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Calculate Date Range based on Preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (datePreset) {
      case "TODAY":
        return { startDate: startOfToday.toISOString(), endDate: endOfToday.toISOString() };
      case "YESTERDAY": {
        const yStart = new Date(startOfToday.getTime() - 86400000);
        const yEnd = new Date(endOfToday.getTime() - 86400000);
        return { startDate: yStart.toISOString(), endDate: yEnd.toISOString() };
      }
      case "LAST_7_DAYS": {
        const start = new Date(now.getTime() - 7 * 86400000);
        return { startDate: start.toISOString(), endDate: now.toISOString() };
      }
      case "LAST_30_DAYS": {
        const start = new Date(now.getTime() - 30 * 86400000);
        return { startDate: start.toISOString(), endDate: now.toISOString() };
      }
      case "THIS_MONTH": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: start.toISOString(), endDate: now.toISOString() };
      }
      case "LAST_MONTH": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case "CUSTOM": {
        return {
          startDate: customStartDate ? new Date(customStartDate).toISOString() : undefined,
          endDate: customEndDate ? new Date(customEndDate + "T23:59:59").toISOString() : undefined,
        };
      }
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [datePreset, customStartDate, customEndDate]);

  // Query Customers with Real Supabase Data (Customers only, server-side pagination & filters)
  const { data, isLoading, isFetching, refetch } = useQuery<CustomersApiResponse>({
    queryKey: ["admin-users", startDate, endDate, search, statusFilter, page, pageSize],
    queryFn: () => {
      const p = new URLSearchParams();
      if (startDate) p.set("start_date", startDate);
      if (endDate) p.set("end_date", endDate);
      if (search.trim()) p.set("search", search.trim());
      if (statusFilter !== "ALL") p.set("status", statusFilter);
      p.set("page", String(page));
      p.set("limit", String(pageSize));
      return apiGet<CustomersApiResponse>(`/admin/users?${p.toString()}`);
    },
  });

  const customers = data?.users || [];
  const totalCount = data?.total || 0;
  const metrics = data?.metrics || {
    total_signups: 0,
    today_signups: 0,
    new_customers_30d: 0,
    total_customers: 0,
  };

  // Actions mutation (edit, hold, deactivate, reactivate, safe delete)
  const customerActionMutation = useMutation({
    mutationFn: async ({
      userId,
      action,
      payload,
    }: {
      userId: string;
      action: "edit" | "hold" | "deactivate" | "reactivate" | "delete";
      payload?: any;
    }) => {
      return apiPost(`/admin/users/${userId}/action`, { action, payload });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(res?.message || "Customer updated successfully");
      setIsEditModalOpen(false);
      setEditingCustomer(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to execute customer action");
    },
  });

  // Create customer mutation (customer role only)
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formName.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
      };
      return apiPost("/admin/users", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Customer account registered successfully");
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create customer");
    },
  });

  const openCreateModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setIsCreateModalOpen(true);
  };

  const openEditModal = (c: CustomerItem) => {
    setEditingCustomer(c);
    setFormName(c.name || "");
    setFormEmail(c.email || "");
    setFormPhone(c.phone || "");
    setIsEditModalOpen(true);
  };

  const handleAction = (
    c: CustomerItem,
    action: "hold" | "deactivate" | "reactivate" | "delete"
  ) => {
    if (action === "delete") {
      const hasOrders = (c.orders_count || 0) > 0;
      const confirmMsg = hasOrders
        ? `Customer "${c.name || c.id}" has ${c.orders_count} past orders. To preserve financial audit trails, this account will be safely deactivated instead of deleted. Proceed?`
        : `Are you sure you want to permanently delete customer "${c.name || c.id}"?`;
      if (!window.confirm(confirmMsg)) return;
    }
    customerActionMutation.mutate({ userId: c.id, action });
  };

  const renderStatusBadge = (status?: string, isActive?: boolean) => {
    const effStatus = status || (isActive ? "ACTIVE" : "DEACTIVATED");
    if (effStatus === "ACTIVE") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    if (effStatus === "ON_HOLD") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          On Hold
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Deactivated
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#11291F]">Customer Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Authoritative customer accounts, verified orders, and customer account governance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs h-9"
            title="Refresh customer data"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={openCreateModal}
            className="bg-[#11291F] hover:bg-[#1E3A2C] text-white font-medium flex items-center gap-2 shadow-xs text-xs h-9"
          >
            <UserPlus size={15} />
            <span>Add Customer</span>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users size={15} className="text-[#11291F]" />
            <span>Total Customers</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{metrics.total_signups}</p>
          <p className="text-[11px] text-muted-foreground mt-1">All registered customer accounts</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <UserCheck size={15} className="text-emerald-600" />
            <span>Today's Sign-ups</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{metrics.today_signups}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Joined in last 24 hours</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Clock size={15} className="text-blue-600" />
            <span>New Customers (30d)</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{metrics.new_customers_30d}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Acquired in last 30 days</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <ShoppingBag size={15} className="text-amber-600" />
            <span>Transacting Customers</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{metrics.total_customers}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Customers with ≥ 1 placed order</p>
        </div>
      </div>

      {/* Date Filters Ribbon */}
      <div className="flex flex-wrap items-center gap-2 bg-card p-2.5 rounded-xl border border-border text-xs">
        <span className="font-semibold text-muted-foreground flex items-center gap-1.5 px-2">
          <Calendar size={14} /> Filter Date:
        </span>
        {(
          [
            ["ALL", "All Time"],
            ["TODAY", "Today"],
            ["YESTERDAY", "Yesterday"],
            ["LAST_7_DAYS", "Last 7 Days"],
            ["LAST_30_DAYS", "Last 30 Days"],
            ["THIS_MONTH", "This Month"],
            ["LAST_MONTH", "Last Month"],
            ["CUSTOM", "Custom Range"],
          ] as [DatePreset, string][]
        ).map(([preset, label]) => (
          <button
            key={preset}
            onClick={() => {
              setDatePreset(preset);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              datePreset === preset
                ? "bg-[#11291F] text-white shadow-xs"
                : "bg-muted/40 text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}

        {datePreset === "CUSTOM" && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setPage(1);
              }}
              className="h-8 text-xs w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setPage(1);
              }}
              className="h-8 text-xs w-36"
            />
          </div>
        )}
      </div>

      {/* Search & Status Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e: any) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">All Account Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="DEACTIVATED">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Customer</TableHead>
              <TableHead className="font-semibold text-xs">Contact</TableHead>
              <TableHead className="font-semibold text-xs">Joined</TableHead>
              <TableHead className="font-semibold text-xs">Orders & Spend</TableHead>
              <TableHead className="font-semibold text-xs">Account Status</TableHead>
              <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  Loading customers directory from Supabase...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  No customer records found matching your query.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => {
                const ordersCount = c.orders_count || 0;
                const spendRupees = (c.total_purchase_paise || 0) / 100;
                const effStatus = c.account_status || (c.is_active ? "ACTIVE" : "DEACTIVATED");

                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-foreground">
                        {c.name || "Customer Account"}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
                        ID: {c.id.substring(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground flex items-center gap-1.5">
                        <Mail size={12} className="text-muted-foreground" />
                        <span>{c.email || "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Phone size={12} className="text-muted-foreground" />
                        <span>{c.phone || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground">
                        {fmtDateTime(c.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                        <IndianRupee size={12} className="text-emerald-700" />
                        <span>{inr(spendRupees)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ordersCount} {ordersCount === 1 ? "order" : "orders"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderStatusBadge(c.account_status, c.is_active)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="View Customer Details & History"
                          onClick={() => setViewingCustomer(c)}
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit Customer Profile"
                          onClick={() => openEditModal(c)}
                        >
                          <Edit3 size={14} />
                        </Button>

                        {/* Status Change Buttons */}
                        {effStatus === "ACTIVE" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              title="Put On Hold"
                              onClick={() => handleAction(c, "hold")}
                            >
                              <PauseCircle size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              title="Deactivate Account"
                              onClick={() => handleAction(c, "deactivate")}
                            >
                              <UserX size={14} />
                            </Button>
                          </>
                        )}

                        {effStatus === "ON_HOLD" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              title="Reactivate Account"
                              onClick={() => handleAction(c, "reactivate")}
                            >
                              <PlayCircle size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              title="Deactivate Account"
                              onClick={() => handleAction(c, "deactivate")}
                            >
                              <UserX size={14} />
                            </Button>
                          </>
                        )}

                        {effStatus === "DEACTIVATED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Reactivate Account"
                            onClick={() => handleAction(c, "reactivate")}
                          >
                            <PlayCircle size={14} />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Customer"
                          onClick={() => handleAction(c, "delete")}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Reusable Server-Side Pagination */}
        <div className="border-t border-border px-4 bg-muted/10">
          <DataTablePagination
            totalItems={totalCount}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      </div>

      {/* View Customer Details Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl border border-border my-8 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <span>{viewingCustomer.name || "Customer Details"}</span>
                  {renderStatusBadge(viewingCustomer.account_status, viewingCustomer.is_active)}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customer ID: <span className="font-mono">{viewingCustomer.id}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setViewingCustomer(null)}
              >
                <X size={16} />
              </Button>
            </div>

            {/* Customer Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Account Status</span>
                <p className="font-semibold text-xs mt-1">
                  {viewingCustomer.account_status || (viewingCustomer.is_active ? "Active" : "Deactivated")}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Joined Date</span>
                <p className="font-semibold text-xs mt-1">{fmtDateTime(viewingCustomer.created_at)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Historical Orders</span>
                <p className="font-semibold text-xs mt-1">{viewingCustomer.orders_count || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Authoritative Spend</span>
                <p className="font-semibold text-xs mt-1 text-emerald-700">
                  {inr((viewingCustomer.total_purchase_paise || 0) / 100)}
                </p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2">
              <h4 className="text-xs font-bold text-foreground">Contact & Identity</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-muted-foreground" />
                  <span className="text-foreground">{viewingCustomer.email || "No email on record"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-muted-foreground" />
                  <span className="text-foreground">{viewingCustomer.phone || "No phone on record"}</span>
                </div>
              </div>
            </div>

            {/* Saved Delivery Addresses */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin size={13} /> Saved Delivery Addresses ({viewingCustomer.addresses?.length || 0})
              </h4>
              {viewingCustomer.addresses && viewingCustomer.addresses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {viewingCustomer.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3 rounded-xl border border-border bg-card text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{addr.label || "Address"}</span>
                        {addr.is_default && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">{addr.line1}</p>
                      {addr.line2 && <p className="text-muted-foreground">{addr.line2}</p>}
                      <p className="font-medium text-foreground">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No addresses saved yet.</p>
              )}
            </div>

            {/* Historical Orders */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Package size={13} /> Placed Orders & Invoices ({viewingCustomer.orders?.length || 0})
              </h4>
              {viewingCustomer.orders && viewingCustomer.orders.length > 0 ? (
                <div className="border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[11px] h-8 font-semibold">Order #</TableHead>
                        <TableHead className="text-[11px] h-8 font-semibold">Date</TableHead>
                        <TableHead className="text-[11px] h-8 font-semibold">Status</TableHead>
                        <TableHead className="text-[11px] h-8 font-semibold text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingCustomer.orders.map((ord) => (
                        <TableRow key={ord.id} className="text-xs">
                          <TableCell className="font-mono font-medium">{ord.order_number || ord.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-muted-foreground">{fmtDateTime(ord.created_at)}</TableCell>
                          <TableCell>
                            <span className="capitalize">{ord.order_status || "confirmed"}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {inr((ord.payable_amount_paise || 0) / 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No historical orders found.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button variant="outline" onClick={() => setViewingCustomer(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal (Permitted Details Only: Name, Email, Phone) */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-base text-foreground">Edit Customer Details</h3>
                <p className="text-xs text-muted-foreground">ID: {editingCustomer.id.slice(0, 8)}...</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                customerActionMutation.mutate({
                  userId: editingCustomer.id,
                  action: "edit",
                  payload: {
                    name: formName.trim(),
                    email: formEmail.trim() || null,
                    phone: formPhone.trim() || null,
                  },
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <Label className="text-xs font-semibold">Customer Full Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 h-10"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>

              <div className="p-3 bg-muted/40 rounded-xl border border-border text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground mb-0.5">Customer Directory Policy</p>
                Staff or administrative role assignment is prohibited in the Customer Directory to protect system boundaries.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={customerActionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={customerActionMutation.isPending}
                  className="bg-[#11291F] hover:bg-[#1E3A2C] text-white"
                >
                  {customerActionMutation.isPending ? "Saving..." : "Save Customer Details"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground">Add New Customer Account</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X size={16} />
              </Button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 h-10"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="mt-1 h-10"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-[#11291F] hover:bg-[#1E3A2C] text-white"
                >
                  {createMutation.isPending ? "Registering..." : "Register Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
