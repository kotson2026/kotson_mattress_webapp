import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Send,
  Check,
  X,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LeaveType, LeaveRequest, LeaveBalance } from "@/lib/crmTypes";

export default function LeaveManagementHub() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const isMasterOrManager = me?.roles.some((r) => ["owner", "admin", "crm_master", "crm_manager"].includes(r));

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("CL");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  // Leave balances
  const { data: balance } = useQuery<LeaveBalance>({
    queryKey: ["crm-leave-balance"],
    queryFn: () => apiGet<LeaveBalance>("/crm/leave/balance"),
  });

  // Leave types
  const { data: types } = useQuery<LeaveType[]>({
    queryKey: ["crm-leave-types"],
    queryFn: () => apiGet<LeaveType[]>("/crm/leave/types"),
  });

  // Leave requests queue
  const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["crm-leave-requests"],
    queryFn: () => apiGet<LeaveRequest[]>("/crm/leave/requests"),
  });

  // Apply mutation
  const applyLeave = useMutation({
    mutationFn: () =>
      apiPost("/crm/leave/apply", {
        type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
      }),
    onSuccess: () => {
      toast.success("Leave request submitted for approval");
      setApplyModalOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["crm-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["crm-leave-balance"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to apply for leave"),
  });

  // Approve / Reject action
  const actionLeave = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      apiPost(`/crm/leave/requests/${id}/action`, { action }),
    onSuccess: (_, vars) => {
      toast.success(`Leave request ${vars.action}d successfully`);
      qc.invalidateQueries({ queryKey: ["crm-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["crm-leave-balance"] });
      qc.invalidateQueries({ queryKey: ["crm-workforce-stats"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to process leave action"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#7C9C59]" />
            <h2 className="font-heading text-xl font-bold">Leave Management</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Leave balance tracking, requests and supervisory approval workflow
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setApplyModalOpen(true)}
          className="h-8 gap-1.5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Apply for Leave
        </Button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Casual Leave (CL)</span>
            <Badge variant="outline" className="border-[#7C9C59]/40 text-[#467065]">
              Annual 12 Days
            </Badge>
          </div>
          <p className="mt-3 text-3xl font-black text-[#16241C]">{balance?.casual ?? 10}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available balance</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Sick Leave (SL)</span>
            <Badge variant="outline" className="border-blue-400/40 text-blue-700">
              Annual 10 Days
            </Badge>
          </div>
          <p className="mt-3 text-3xl font-black text-[#16241C]">{balance?.sick ?? 8}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available balance</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider">Privilege / Earned (PL)</span>
            <Badge variant="outline" className="border-amber-400/40 text-amber-700">
              Annual 15 Days
            </Badge>
          </div>
          <p className="mt-3 text-3xl font-black text-[#16241C]">{balance?.privilege ?? 15}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available balance</p>
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-base font-bold">Leave Requests</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review submission details, dates, and approval status
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading leave requests...</p>
        ) : !requests || requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No leave applications on file.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {isMasterOrManager && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.type}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.start_date} → {r.end_date}
                  </TableCell>
                  <TableCell className="font-semibold">{r.days} day(s)</TableCell>
                  <TableCell className="text-xs max-w-xs">{r.reason}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        r.status === "approved"
                          ? "bg-emerald-600 text-white"
                          : r.status === "rejected"
                          ? "bg-rose-600 text-white"
                          : "bg-amber-500 text-white"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  {isMasterOrManager && (
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={actionLeave.isPending}
                            onClick={() => actionLeave.mutate({ id: r.id, action: "approve" })}
                            className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={actionLeave.isPending}
                            onClick={() => actionLeave.mutate({ id: r.id, action: "reject" })}
                            className="h-7 px-2.5 text-xs gap-1"
                          >
                            <X className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Apply Leave Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-lg font-bold">Apply for Leave</h3>
            <p className="text-xs text-muted-foreground">
              Submit your leave dates for supervisory review. Approved leave adjusts monthly attendance.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Leave Category</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CL">Casual Leave (CL)</SelectItem>
                    <SelectItem value="SL">Sick Leave (SL)</SelectItem>
                    <SelectItem value="PL">Privilege / Annual (PL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Reason for Leave</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Family medical emergency / Personal travel"
                  className="mt-1 text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setApplyModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!reason.trim() || applyLeave.isPending}
                onClick={() => applyLeave.mutate()}
                className="gap-1.5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
              >
                <Send className="h-3 w-3" />
                {applyLeave.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
