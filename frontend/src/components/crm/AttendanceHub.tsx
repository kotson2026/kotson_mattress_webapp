import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  Filter,
  UserCheck,
  UserX,
  FileEdit,
  Send,
  Check,
  X,
  ShieldCheck,
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
import type { AttendanceRecord, AttendanceStats, AttendanceCorrection } from "@/lib/crmTypes";

export default function AttendanceHub() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const isMasterOrManager = me?.roles.some((r) => ["owner", "admin", "crm_master", "crm_manager"].includes(r));

  const [activeTab, setActiveTab] = useState<"live" | "calendar" | "corrections">("live");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionDate, setCorrectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [correctionStatus, setCorrectionStatus] = useState("Present");
  const [correctionReason, setCorrectionReason] = useState("");

  // Live Workforce Stats
  const { data: stats } = useQuery<AttendanceStats>({
    queryKey: ["crm-workforce-stats"],
    queryFn: () => apiGet<AttendanceStats>("/crm/workforce/stats"),
    refetchInterval: 15000,
  });

  // Today's Live Attendance Records (for Admin/Manager)
  const { data: todayRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ["crm-attendance-today"],
    queryFn: () => apiGet<AttendanceRecord[]>("/crm/workforce/admin/today"),
    enabled: isMasterOrManager,
    refetchInterval: 20000,
  });

  // Monthly Calendar Records (for current user or selected employee)
  const { data: calendarRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ["crm-attendance-calendar", selectedMonth],
    queryFn: () => apiGet<AttendanceRecord[]>(`/crm/workforce/calendar?month=${selectedMonth}`),
  });

  // Attendance Correction Requests
  const { data: correctionRequests } = useQuery<AttendanceCorrection[]>({
    queryKey: ["crm-correction-requests"],
    queryFn: () => apiGet<AttendanceCorrection[]>("/crm/workforce/correction-requests"),
  });

  // Submit correction mutation
  const submitCorrection = useMutation({
    mutationFn: () =>
      apiPost("/crm/workforce/correction-request", {
        date: correctionDate,
        requested_status: correctionStatus,
        reason: correctionReason,
      }),
    onSuccess: () => {
      toast.success("Attendance correction request submitted for supervisor review");
      setCorrectionModalOpen(false);
      setCorrectionReason("");
      qc.invalidateQueries({ queryKey: ["crm-correction-requests"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit correction"),
  });

  // Action on correction mutation
  const actionCorrection = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      apiPost(`/crm/workforce/correction-requests/${id}/action`, { action }),
    onSuccess: (_, vars) => {
      toast.success(`Correction request ${vars.action}d successfully`);
      qc.invalidateQueries({ queryKey: ["crm-correction-requests"] });
      qc.invalidateQueries({ queryKey: ["crm-attendance-today"] });
      qc.invalidateQueries({ queryKey: ["crm-attendance-calendar"] });
    },
    onError: (err: any) => toast.error(err.message || "Action failed"),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Present</Badge>;
      case "Late":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Late</Badge>;
      case "Half Day":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">Half Day</Badge>;
      case "On Leave":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">On Leave</Badge>;
      case "Weekly Off":
        return <Badge variant="outline" className="text-muted-foreground border-dashed">Weekly Off</Badge>;
      case "Absent":
      default:
        return <Badge variant="destructive">Absent</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Live Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#7C9C59]" />
            <h2 className="font-heading text-xl font-bold">Workforce Attendance Hub</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Server-verified timekeeping · Standard shift: 09:30 AM – 06:30 PM IST
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCorrectionModalOpen(true)}
            className="h-8 gap-1.5 text-xs border-[#7C9C59]/40 text-[#467065] hover:bg-[#7C9C59]/10"
          >
            <FileEdit className="h-3.5 w-3.5" />
            Request Attendance Correction
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Staff</span>
            <UserCheck className="h-4 w-4 text-[#7C9C59]" />
          </div>
          <p className="mt-2 text-2xl font-black">{stats?.total_employees ?? 0}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Authorized staff count</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between text-emerald-800 text-xs">
            <span>Clocked In</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950">{stats?.clocked_in ?? 0}</p>
          <p className="mt-1 text-[11px] text-emerald-700">Currently active on duty</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between text-amber-800 text-xs">
            <span>On Break</span>
            <Coffee className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-950">{stats?.on_break ?? 0}</p>
          <p className="mt-1 text-[11px] text-amber-700">Rest break duration active</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Absent</span>
            <UserX className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black">{stats?.absent ?? 0}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Not clocked in today</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4">
          <div className="flex items-center justify-between text-blue-800 text-xs">
            <span>On Leave</span>
            <CalendarIcon className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-blue-950">{stats?.on_leave ?? 0}</p>
          <p className="mt-1 text-[11px] text-blue-700">Approved leave request</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={activeTab === "live" ? "default" : "ghost"}
          onClick={() => setActiveTab("live")}
          className={`h-8 text-xs font-semibold rounded-lg ${
            activeTab === "live" ? "bg-[#16241C] text-white" : "text-muted-foreground"
          }`}
        >
          Today's Live Roster
        </Button>
        <Button
          size="sm"
          variant={activeTab === "calendar" ? "default" : "ghost"}
          onClick={() => setActiveTab("calendar")}
          className={`h-8 text-xs font-semibold rounded-lg ${
            activeTab === "calendar" ? "bg-[#16241C] text-white" : "text-muted-foreground"
          }`}
        >
          Monthly Attendance Calendar
        </Button>
        <Button
          size="sm"
          variant={activeTab === "corrections" ? "default" : "ghost"}
          onClick={() => setActiveTab("corrections")}
          className={`h-8 text-xs font-semibold rounded-lg ${
            activeTab === "corrections" ? "bg-[#16241C] text-white" : "text-muted-foreground"
          }`}
        >
          Correction Requests ({correctionRequests?.filter((r) => r.status === "pending").length ?? 0})
        </Button>
      </div>

      {/* TAB 1: Live Today Roster */}
      {activeTab === "live" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-base font-bold">Today's Employee Attendance</h3>
            <span className="text-xs text-muted-foreground">Auto-updates every 20 seconds</span>
          </div>

          {!todayRecords || todayRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No staff records recorded for today yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Gross Hours</TableHead>
                    <TableHead>Break Mins</TableHead>
                    <TableHead>Net Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayRecords.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">
                        {rec.employee_name}
                        <div className="text-xs text-muted-foreground">ID: {rec.employee_id.slice(-6)}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(rec.status)}</TableCell>
                      <TableCell>
                        {rec.clock_in_at
                          ? new Date(rec.clock_in_at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {rec.clock_out_at
                          ? new Date(rec.clock_out_at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>{rec.gross_hours ? `${rec.gross_hours.toFixed(1)}h` : "—"}</TableCell>
                      <TableCell>{rec.break_minutes ? `${rec.break_minutes}m` : "0m"}</TableCell>
                      <TableCell className="font-bold text-[#467065]">
                        {rec.net_hours ? `${rec.net_hours.toFixed(1)}h` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Monthly Attendance Calendar */}
      {activeTab === "calendar" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-heading text-base font-bold">Monthly Timesheet View</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Attendance records for month {selectedMonth}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Month:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            {calendarRecords && calendarRecords.length > 0 ? (
              calendarRecords.map((day) => {
                const dayNum = day.date.slice(-2);
                return (
                  <div
                    key={day.date}
                    className={`rounded-xl border p-3 transition-all ${
                      day.status === "Present"
                        ? "border-emerald-200 bg-emerald-50/40"
                        : day.status === "Late"
                        ? "border-amber-200 bg-amber-50/40"
                        : day.status === "Half Day"
                        ? "border-orange-200 bg-orange-50/40"
                        : day.status === "On Leave"
                        ? "border-blue-200 bg-blue-50/40"
                        : day.status === "Weekly Off"
                        ? "border-border bg-muted/30"
                        : "border-rose-200 bg-rose-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-heading text-sm font-bold">{dayNum}</span>
                      {getStatusBadge(day.status)}
                    </div>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      <div>
                        In: {day.clock_in_at ? new Date(day.clock_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                      <div>
                        Out: {day.clock_out_at ? new Date(day.clock_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </div>
                      <div className="font-semibold text-foreground mt-1">
                        Net: {day.net_hours ? `${day.net_hours.toFixed(1)} hrs` : "0.0 hrs"}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                No attendance logs found for {selectedMonth}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Correction Requests Queue */}
      {activeTab === "corrections" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading text-base font-bold">Attendance Correction Requests</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit trail for attendance adjustments. All requests require supervisory approval.
              </p>
            </div>
          </div>

          {!correctionRequests || correctionRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No correction requests pending.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Requested Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  {isMasterOrManager && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {correctionRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.employee_name}</TableCell>
                    <TableCell>{req.date}</TableCell>
                    <TableCell>{getStatusBadge(req.requested_status)}</TableCell>
                    <TableCell className="text-xs max-w-xs">{req.reason}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          req.status === "approved"
                            ? "default"
                            : req.status === "rejected"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {req.status}
                      </Badge>
                    </TableCell>
                    {isMasterOrManager && (
                      <TableCell className="text-right">
                        {req.status === "pending" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              disabled={actionCorrection.isPending}
                              onClick={() => actionCorrection.mutate({ id: req.id, action: "approve" })}
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionCorrection.isPending}
                              onClick={() => actionCorrection.mutate({ id: req.id, action: "reject" })}
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
      )}

      {/* Modal: Submit Correction Request */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-lg font-bold">Request Attendance Correction</h3>
            <p className="text-xs text-muted-foreground">
              Employees cannot silently overwrite server records. Provide formal reason for adjustment.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Date of Attendance</Label>
                <Input
                  type="date"
                  value={correctionDate}
                  onChange={(e) => setCorrectionDate(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Requested Status</Label>
                <Select value={correctionStatus} onValueChange={setCorrectionStatus}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Present">Present (Full Day)</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Reason / Justification</Label>
                <Textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. System network glitch during biometric/clock-in check or on-site client visit"
                  className="mt-1 text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCorrectionModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!correctionReason.trim() || submitCorrection.isPending}
                onClick={() => submitCorrection.mutate()}
                className="gap-1.5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
              >
                <Send className="h-3 w-3" />
                {submitCorrection.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
