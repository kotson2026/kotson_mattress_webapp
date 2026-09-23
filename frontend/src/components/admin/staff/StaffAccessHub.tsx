import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  UserCog,
  Plus,
  Edit3,
  Check,
  CheckCircle2,
  X,
  Lock,
  Phone,
  Mail,
  Briefcase,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StaffOverview {
  total_staff: number;
  active_staff: number;
  managers: number;
  employees: number;
  inactive: number;
}

interface CapabilityItem {
  key: string;
  name: string;
  category: string;
  description: string;
}

export default function StaffAccessHub() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [q, setQ] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaffPerms, setSelectedStaffPerms] = useState<any>(null);

  // Queries
  const { data: overview } = useQuery<StaffOverview>({
    queryKey: ["staff-overview"],
    queryFn: () => apiGet("/admin/staff/overview"),
  });

  const { data: capabilities = [] } = useQuery<CapabilityItem[]>({
    queryKey: ["staff-capabilities-catalog"],
    queryFn: () => apiGet("/admin/staff/capabilities-catalog"),
  });

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["admin-staff", roleFilter, q],
    queryFn: () =>
      apiGet<any[]>(`/admin/staff?role=${roleFilter}&q=${encodeURIComponent(q)}`),
  });

  // Mutations
  const toggleStatus = useMutation({
    mutationFn: (uid: string) => apiPost(`/admin/staff/${uid}/toggle-status`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      qc.invalidateQueries({ queryKey: ["staff-overview"] });
      toast.success(data?.message || "Staff status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to toggle status"),
  });

  const updateCapabilities = useMutation({
    mutationFn: ({ uid, capabilities }: { uid: string; capabilities: string[] }) =>
      apiPut(`/admin/staff/${uid}`, { capabilities }),
    onSuccess: () => {
      setSelectedStaffPerms(null);
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      toast.success("Staff capabilities updated successfully");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update capabilities"),
  });

  return (
    <div className="space-y-6" data-testid="staff-access-hub">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Staff & Access Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Manage internal employees, dual authentication (Phone / Email), and granular capability access control.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Staff Member
          </Button>
        </div>
      </div>

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Staff</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_staff ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Directory headcount</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Staff</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.active_staff ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Authorized access</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Managers</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.managers ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Operational leadership</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employees</span>
            <Briefcase className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.employees ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Specialists & advisors</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deactivated</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{overview?.inactive ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Historical orders kept</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff by name, email, phone, or department…"
            className="bg-background"
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground font-semibold">Filter Role:</Label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
          >
            <option value="ALL">All Roles</option>
            <option value="owner">Owner / Admin</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee / Specialist</option>
          </select>
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Contact (Dual Login)</TableHead>
              <TableHead>Role & Department</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Capabilities Assigned</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead className="text-right">Access Control</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Loading staff directory…
                </TableCell>
              </TableRow>
            ) : staffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No staff members found matching query.
                </TableCell>
              </TableRow>
            ) : (
              staffList.map((s) => {
                const isOwner = s.roles?.includes("owner");
                const isManager = s.roles?.includes("manager");
                const roleLabel = isOwner ? "Owner Admin" : isManager ? "Manager" : "Employee";
                const capsCount = s.capabilities?.length || (isOwner ? capabilities.length : 0);

                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">ID: {s.id.slice(0, 8)}…</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {s.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {s.phone || "No phone added"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${
                          isOwner
                            ? "bg-purple-100 text-purple-800 border-purple-300 font-bold"
                            : isManager
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-slate-100 text-slate-800 border-slate-300"
                        }`}
                      >
                        {roleLabel}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">{s.department || "Operations"}</div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{s.designation || "Sleep Advisor"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-semibold"
                        onClick={() => setSelectedStaffPerms(s)}
                      >
                        <UserCog className="w-3.5 h-3.5 mr-1" />
                        {isOwner ? "Full Master Access" : `${capsCount} Capability Grants`}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${
                          s.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {s.is_active ? "ACTIVE" : "DEACTIVATED"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!isOwner && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 text-xs font-semibold ${
                            s.is_active
                              ? "text-rose-700 hover:bg-rose-50 border-rose-200"
                              : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                          }`}
                          onClick={() => toggleStatus.mutate(s.id)}
                        >
                          {s.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Staff Modal */}
      {isAddModalOpen && (
        <AddStaffModal
          capabilities={capabilities}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-staff"] });
            qc.invalidateQueries({ queryKey: ["staff-overview"] });
          }}
        />
      )}

      {/* Permissions Matrix Drawer */}
      {selectedStaffPerms && (
        <CapabilitiesDrawer
          staff={selectedStaffPerms}
          capabilities={capabilities}
          onClose={() => setSelectedStaffPerms(null)}
          onSave={(newCaps) =>
            updateCapabilities.mutate({
              uid: selectedStaffPerms.id,
              capabilities: newCaps,
            })
          }
        />
      )}
    </div>
  );
}

function AddStaffModal({
  capabilities,
  onClose,
  onSuccess,
}: {
  capabilities: CapabilityItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "EMPLOYEE",
    department: "Customer Experience",
    designation: "Sleep Specialist",
    password: "",
    capabilities: [
      "orders.view",
      "catalog.view",
      "crm.view",
    ],
  });

  const [initialPasswordReturned, setInitialPasswordReturned] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => apiPost("/admin/staff", formData),
    onSuccess: (data: any) => {
      toast.success("Staff account registered");
      if (data?.initial_password) {
        setInitialPasswordReturned(data.initial_password);
      } else {
        onSuccess();
      }
    },
    onError: (e: any) => toast.error(e.message || "Failed to create staff member"),
  });

  const toggleCap = (key: string) => {
    if (formData.capabilities.includes(key)) {
      setFormData({
        ...formData,
        capabilities: formData.capabilities.filter((k) => k !== key),
      });
    } else {
      setFormData({
        ...formData,
        capabilities: [...formData.capabilities, key],
      });
    }
  };

  if (initialPasswordReturned) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
            <h3 className="font-heading text-lg font-bold">Staff Account Ready</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Account created for <strong>{formData.email}</strong>. Share these initial credentials securely:
          </p>

          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
            <div className="text-xs">
              <span className="text-muted-foreground">Login (Phone or Email):</span>{" "}
              <strong className="font-mono">{formData.phone || formData.email}</strong>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Initial Password:</span>{" "}
              <code className="bg-background px-2 py-0.5 rounded font-mono font-bold text-sm text-primary">
                {initialPasswordReturned}
              </code>
            </div>
          </div>

          <Button onClick={onSuccess} className="w-full">
            Done & Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-heading text-lg font-bold">Add Staff Member</h3>
            <p className="text-xs text-muted-foreground">Dual authentication with Email OR Phone + Password</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Anand Varma"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Phone Number (Supports Dual Login) *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 00000"
                className="mt-1 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="anand@kotsonmattress.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>System Role *</Label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="EMPLOYEE">Employee / Specialist</option>
                <option value="MANAGER">Operations Manager</option>
                <option value="CRM_MASTER_ADMIN">CRM Master Admin</option>
                <option value="OWNER_ADMIN">Executive Owner Admin</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Operations / Logistics / Sales"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Sleep Specialist"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Custom Password (Optional - leave blank to auto-generate)</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              className="mt-1 font-mono"
            />
          </div>

          {/* Interactive Capabilities Matrix Checkboxes */}
          <div className="pt-3 border-t border-border">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Granular Capability Permissions Matrix:
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto p-1 border border-border rounded-xl bg-muted/20">
              {capabilities.map((cap) => {
                const isChecked = formData.capabilities.includes(cap.key);
                return (
                  <label
                    key={cap.key}
                    className="flex items-start gap-2 p-2 rounded-lg bg-card border border-border cursor-pointer hover:bg-muted/30 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCap(cap.key)}
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <div className="font-semibold text-foreground">{cap.name}</div>
                      <div className="text-[10px] text-muted-foreground">{cap.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !formData.name || !formData.email || !formData.phone}
          >
            {save.isPending ? "Creating…" : "Register Staff Member"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CapabilitiesDrawer({
  staff,
  capabilities,
  onClose,
  onSave,
}: {
  staff: any;
  capabilities: CapabilityItem[];
  onClose: () => void;
  onSave: (caps: string[]) => void;
}) {
  const [selectedCaps, setSelectedCaps] = useState<string[]>(staff.capabilities || []);

  const toggle = (key: string) => {
    if (selectedCaps.includes(key)) {
      setSelectedCaps(selectedCaps.filter((k) => k !== key));
    } else {
      setSelectedCaps([...selectedCaps, key]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
      <div className="bg-card w-full max-w-md h-full border-l border-border p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-heading text-lg font-bold">Access Permissions</h3>
              <p className="text-xs text-muted-foreground">{staff.name} ({staff.email})</p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Check or uncheck granular capabilities to control access across Console sections.
          </p>

          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {capabilities.map((cap) => {
              const checked = selectedCaps.includes(cap.key);
              return (
                <div
                  key={cap.key}
                  onClick={() => toggle(cap.key)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                    checked
                      ? "bg-primary/5 border-primary/40 text-foreground"
                      : "bg-card border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">{cap.name}</span>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center ${
                        checked ? "bg-primary text-primary-foreground" : "border border-border"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{cap.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-border flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => onSave(selectedCaps)} className="flex-1">
            Save Permissions
          </Button>
        </div>
      </div>
    </div>
  );
}
