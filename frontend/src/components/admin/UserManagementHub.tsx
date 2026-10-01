import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Calendar,
  Filter,
  Eye,
  Edit3,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  IndianRupee,
  ShieldCheck,
  Clock,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
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

interface UserItem {
  id: string;
  supabase_auth_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
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

interface UsersApiResponse {
  metrics: {
    total_signups: number;
    today_signups: number;
    new_customers_30d: number;
    total_customers: number;
  };
  users: UserItem[];
  total: number;
}

type DatePreset = "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";

export default function UserManagementHub() {
  const qc = useQueryClient();

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Modals state
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("customer");
  const [formIsActive, setFormIsActive] = useState(true);

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

  // Query Users with Real Supabase Data
  const { data, isLoading } = useQuery<UsersApiResponse>({
    queryKey: ["admin-users", startDate, endDate, search, roleFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (startDate) p.set("start_date", startDate);
      if (endDate) p.set("end_date", endDate);
      if (search) p.set("search", search);
      if (roleFilter !== "ALL") p.set("role", roleFilter);
      return apiGet<UsersApiResponse>(`/admin/users?${p.toString()}`);
    },
  });

  const users = data?.users || [];
  const metrics = data?.metrics || {
    total_signups: 0,
    today_signups: 0,
    new_customers_30d: 0,
    total_customers: 0,
  };

  // Filter users by client-side status (active/inactive)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === "ACTIVE" && !u.is_active) return false;
      if (statusFilter === "INACTIVE" && u.is_active) return false;
      return true;
    });
  }, [users, statusFilter]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formName.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        role: formRole,
      };
      return apiPost("/admin/users", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User created successfully");
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create user");
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const payload = {
        name: formName.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        role: formRole,
        is_active: formIsActive,
      };
      return apiPut(`/admin/users/${editingUser.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated successfully");
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update user");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!is_active) {
        // Safe soft-deactivate (protects financial history)
        return apiDelete(`/admin/users/${id}`);
      } else {
        return apiPut(`/admin/users/${id}`, { is_active: true });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  const openCreateModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("customer");
    setFormIsActive(true);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setFormName(u.name || "");
    setFormEmail(u.email || "");
    setFormPhone(u.phone || "");
    setFormRole(u.role || "customer");
    setFormIsActive(u.is_active);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#11291F]">Customer & User Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real Supabase user records, signup velocity, purchase metrics, and profile governance.
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-[#11291F] hover:bg-[#1E3A2C] text-white font-medium flex items-center gap-2 shadow-xs"
        >
          <UserPlus size={16} />
          <span>Add User</span>
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users size={15} className="text-[#11291F]" />
            <span>Total Sign-ups</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{metrics.total_signups}</p>
          <p className="text-[11px] text-muted-foreground mt-1">All registered accounts</p>
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
          <p className="text-[11px] text-muted-foreground mt-1">Recent acquisition rate</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <ShoppingBag size={15} className="text-amber-600" />
            <span>Transacting Customers</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{metrics.total_customers}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Users with ≥ 1 placed order</p>
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
            onClick={() => setDatePreset(preset)}
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
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
        )}
      </div>

      {/* Search & Role / Status Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="ALL">All Roles</option>
            <option value="customer">Customers</option>
            <option value="dealer">Dealers</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Deactivated</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Customer / User</TableHead>
              <TableHead className="font-semibold text-xs">Contact</TableHead>
              <TableHead className="font-semibold text-xs">Role</TableHead>
              <TableHead className="font-semibold text-xs">Joined</TableHead>
              <TableHead className="font-semibold text-xs">Orders & Spend</TableHead>
              <TableHead className="font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  Loading users directory from Supabase...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  No users found matching your search or filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => {
                const ordersCount = u.orders_count || 0;
                const spendRupees = (u.total_purchase_paise || 0) / 100;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-semibold text-xs text-foreground">
                        {u.name || "Unnamed User"}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
                        ID: {u.id.substring(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground flex items-center gap-1.5">
                        <Mail size={12} className="text-muted-foreground" />
                        <span>{u.email || "No email"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Phone size={12} className="text-muted-foreground" />
                        <span>{u.phone || "No phone"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] uppercase font-semibold tracking-wider ${
                          u.role === "owner" || u.role === "admin"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : u.role === "dealer"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {u.role || "customer"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground">
                        {fmtDateTime(u.created_at)}
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
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          u.is_active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            : "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.is_active ? "bg-emerald-600" : "bg-rose-500"
                          }`}
                        />
                        {u.is_active ? "Active" : "Deactivated"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="View Details"
                          onClick={() => setViewingUser(u)}
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Edit User"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit3 size={14} />
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

      {/* View User Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl border border-border my-8 max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <span>{viewingUser.name || "Customer Details"}</span>
                  <Badge variant="outline" className="text-[11px] uppercase">
                    {viewingUser.role || "customer"}
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ID: <span className="font-mono">{viewingUser.id}</span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setViewingUser(null)}
              >
                <X size={16} />
              </Button>
            </div>

            {/* User Overview Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <p className="font-semibold text-xs mt-1">
                  {viewingUser.is_active ? "Active" : "Deactivated"}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Signed Up</span>
                <p className="font-semibold text-xs mt-1">{fmtDateTime(viewingUser.created_at)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Total Orders</span>
                <p className="font-semibold text-xs mt-1">{viewingUser.orders_count || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-[11px] text-muted-foreground">Total Spend</span>
                <p className="font-semibold text-xs mt-1 text-emerald-700">
                  {inr((viewingUser.total_purchase_paise || 0) / 100)}
                </p>
              </div>
            </div>

            {/* Contact Details */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <h4 className="text-xs font-bold text-foreground">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium text-foreground">{viewingUser.email || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="font-medium text-foreground">{viewingUser.phone || "Not specified"}</span>
                </div>
              </div>
            </div>

            {/* Saved Addresses */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin size={14} className="text-[#11291F]" /> Saved Delivery Addresses (
                {viewingUser.addresses?.length || 0})
              </h4>
              {(!viewingUser.addresses || viewingUser.addresses.length === 0) ? (
                <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-lg">
                  No saved addresses on file for this user.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {viewingUser.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3 rounded-lg border border-border bg-card text-xs space-y-1 relative"
                    >
                      {addr.is_default && (
                        <Badge variant="secondary" className="text-[10px] absolute top-2 right-2">
                          Default
                        </Badge>
                      )}
                      <div className="font-semibold text-foreground">{addr.label || "Home"}</div>
                      <div className="text-muted-foreground">{addr.line1}</div>
                      {addr.line2 && <div className="text-muted-foreground">{addr.line2}</div>}
                      {addr.landmark && (
                        <div className="text-muted-foreground text-[11px]">Landmark: {addr.landmark}</div>
                      )}
                      <div className="font-medium text-foreground">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order History */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-[#11291F]" /> Order History (
                {viewingUser.orders?.length || 0})
              </h4>
              {(!viewingUser.orders || viewingUser.orders.length === 0) ? (
                <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded-lg">
                  No orders placed yet.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden text-xs">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs font-semibold">Order</TableHead>
                        <TableHead className="text-xs font-semibold">Date</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingUser.orders.map((ord) => (
                        <TableRow key={ord.id}>
                          <TableCell className="font-mono font-medium">
                            {ord.order_number || ord.id.substring(0, 8)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {fmtDateTime(ord.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {ord.order_status || "confirmed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {inr((ord.payable_amount_paise || 0) / 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setViewingUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground">Edit User Profile</h3>
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
                editMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <Label className="text-xs font-semibold">Full Name *</Label>
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

              <div>
                <Label className="text-xs font-semibold">System Role</Label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="customer">Customer</option>
                  <option value="dealer">Dealer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="accent-[#11291F] rounded"
                />
                <span>Account is Active</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="bg-[#11291F] hover:bg-[#1E3A2C] text-white"
                >
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base text-foreground">Add New User</h3>
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

              <div>
                <Label className="text-xs font-semibold">Role</Label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="customer">Customer</option>
                  <option value="dealer">Dealer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
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
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
