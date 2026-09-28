import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  PhoneCall,
  Layers,
  Users,
  CalendarCheck,
  ClipboardList,
  BarChart3,
  Clock,
  UserPlus,
  ArrowRight,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  PhoneForwarded,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WorkdayStatus } from "@/lib/crmTypes";
import WalkInLeadDialog from "./WalkInLeadDialog";

export default function EmployeeDashboard() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Authoritative Attendance Status
  const { data: workday, isLoading: workdayLoading } = useQuery<WorkdayStatus>({
    queryKey: ["crm-workday-status"],
    queryFn: () => apiGet<WorkdayStatus>("/crm/workforce/workday-status"),
    refetchInterval: 15000,
  });

  // Calculate live elapsed seconds from authoritative server clock_in_at
  useEffect(() => {
    if (workday?.status === "clocked_in" && workday.clock_in_at) {
      const startMs = new Date(workday.clock_in_at).getTime();
      const update = () => {
        const nowMs = Date.now();
        setElapsedSec(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSec(0);
    }
  }, [workday?.status, workday?.clock_in_at]);

  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatClockTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(new Date(iso));
    } catch {
      return "—";
    }
  };

  // Clock In / Clock Out Mutations
  const clockIn = useMutation({
    mutationFn: () => apiPost<{ message: string }>("/crm/workforce/clock-in"),
    onSuccess: (data) => {
      toast.success(data.message || "Clocked in successfully. Workday started!");
      qc.invalidateQueries({ queryKey: ["crm-workday-status"] });
    },
    onError: (err: any) => toast.error(err.message || "Clock-in failed"),
  });

  const clockOut = useMutation({
    mutationFn: () => apiPost<{ message: string }>("/crm/workforce/clock-out"),
    onSuccess: (data) => {
      toast.success(data.message || "Clocked out successfully. Good job today!");
      qc.invalidateQueries({ queryKey: ["crm-workday-status"] });
    },
    onError: (err: any) => toast.error(err.message || "Clock-out failed"),
  });

  // Start Calling Mutation
  const [startingCall, setStartingCall] = useState(false);
  const handleStartCalling = async () => {
    setStartingCall(true);
    try {
      const res = await apiGet<{ has_lead: boolean; lead_id?: string; queue_reason?: string; message?: string }>(
        "/crm/leads/next-call"
      );
      if (res.has_lead && res.lead_id) {
        toast.info(res.queue_reason ? `Next Lead: ${res.queue_reason}` : "Connecting to next callable lead...");
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

  // Authoritative employee summary metrics
  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["crm-campaigns-all"],
    queryFn: () => apiGet<any[]>("/crm/campaigns"),
  });

  const { data: myLeads } = useQuery<{ total: number }>({
    queryKey: ["crm-my-leads-count"],
    queryFn: () => apiGet<{ total: number }>("/crm/leads?page=1&page_size=1"),
  });

  const { data: followUps } = useQuery<{ rows: any[] }>({
    queryKey: ["crm-followups-due"],
    queryFn: () => apiGet<{ rows: any[] }>("/crm/follow-ups?limit=50"),
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["crm-analytics-today"],
    queryFn: () => apiGet<any>("/crm/analytics/dashboard-kpis?range=today"),
  });

  const isClockedIn = workday?.status === "clocked_in" || workday?.status === "on_break";
  const assignedCampaignsCount = campaigns?.length ?? 0;
  const assignedLeadsCount = myLeads?.total ?? 0;
  const pendingFollowupsCount = followUps?.rows?.filter((f) => f.status === "pending")?.length ?? 0;
  const todayCallsCount = analytics?.kpi_row_2?.calls_made ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Top Header: Welcome & Quick Action ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-[#E8EDE7] bg-white p-5 sm:p-6 shadow-xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#467065]">
            Employee CRM Workspace
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#11291F] tracking-tight">
            Welcome, {me?.name || "Consultant"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6B716C]">
            Manage assigned campaigns, call verified prospects, log outcomes, and track progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setWalkInOpen(true)}
            variant="outline"
            className="border-[#D8DDD7] text-[#11291F] hover:bg-[#F7F4EE] font-semibold text-xs h-10 px-3"
          >
            <UserPlus className="mr-1.5 size-3.5 text-[#467065]" />
            Add Walk-in Lead
          </Button>
        </div>
      </div>

      {/* ── Workday Attendance & Status Bar ── */}
      <div className="rounded-2xl border border-[#E8EDE7] bg-[#F7F4EE]/60 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-11 items-center justify-center rounded-xl ${
                isClockedIn ? "bg-[#11291F] text-[#7C9C59]" : "bg-white border border-[#D8DDD7] text-[#6B716C]"
              }`}
            >
              <Clock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B716C]">
                  Today's Attendance
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    workday?.status === "clocked_in"
                      ? "bg-[#7C9C59]/20 text-[#11291F]"
                      : workday?.status === "clocked_out"
                      ? "bg-slate-200 text-slate-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {workday?.status === "clocked_in"
                    ? "Active Shift"
                    : workday?.status === "clocked_out"
                    ? "Shift Finished"
                    : "Not Clocked In"}
                </span>
              </div>
              <p className="text-xs text-[#2D2D2D] mt-0.5">
                {isClockedIn ? (
                  <>
                    Clocked in: <strong className="text-[#11291F]">{formatClockTime(workday?.clock_in_at)}</strong>
                    {" · "}
                    Working Time: <strong className="font-mono text-[#11291F]">{formatElapsed(elapsedSec)}</strong>
                  </>
                ) : workday?.status === "clocked_out" ? (
                  <>
                    Clocked out: <strong>{formatClockTime(workday?.clock_out_at)}</strong> (Total:{" "}
                    <strong>{Math.round(workday?.net_minutes ?? 0)} mins</strong>)
                  </>
                ) : (
                  "Clock in to commence your active calling and consultation shift."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isClockedIn ? (
              <Button
                onClick={() => clockIn.mutate()}
                disabled={clockIn.isPending}
                className="bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] text-xs font-bold uppercase tracking-wider h-10 px-5 shadow-xs"
              >
                <Play className="mr-1.5 size-3.5 fill-current text-[#7C9C59]" />
                Clock In
              </Button>
            ) : (
              <Button
                onClick={() => clockOut.mutate()}
                disabled={clockOut.isPending}
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-bold uppercase tracking-wider h-10 px-4"
              >
                <Square className="mr-1.5 size-3.5 fill-current" />
                Clock Out
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Primary Hero Action: START CALLING ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#11291F] via-[#1a3d2e] to-[#467065] p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7C9C59]/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#A5C882]">
              <Sparkles className="size-3" /> Prioritized Smart Queue
            </span>
            <h2 className="mt-2 font-heading text-xl sm:text-2xl font-bold tracking-tight">
              Ready to contact your next customer?
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#F7F4EE]/80">
              The CRM will prioritize overdue follow-ups, then uncontacted leads assigned across your authorized
              campaigns.
            </p>
          </div>

          <Button
            onClick={handleStartCalling}
            disabled={startingCall}
            className="h-12 px-6 bg-[#7C9C59] text-[#11291F] hover:bg-[#8eb366] font-bold text-sm tracking-wide uppercase transition-all shadow-lg shrink-0 cursor-pointer"
          >
            <PhoneCall className="mr-2 size-4 text-[#11291F]" />
            {startingCall ? "Finding Lead…" : "Start Calling"}
          </Button>
        </div>
      </div>

      {/* ── Today's Core Workload Summary ── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B716C] mb-3">
          Today's Activity & Queue
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#E8EDE7] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B716C]">Assigned Leads</span>
              <Users className="size-4 text-[#467065]" />
            </div>
            <p className="mt-2 font-heading text-2xl font-extrabold text-[#11291F]">
              {assignedLeadsCount}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B716C]">In your authorized scope</p>
          </div>

          <div className="rounded-xl border border-[#E8EDE7] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B716C]">Follow-ups Due</span>
              <CalendarCheck className="size-4 text-[#7C9C59]" />
            </div>
            <p className="mt-2 font-heading text-2xl font-extrabold text-[#11291F]">
              {pendingFollowupsCount}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B716C]">Scheduled calls to complete</p>
          </div>

          <div className="rounded-xl border border-[#E8EDE7] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6B716C]">Calls Logged Today</span>
              <PhoneForwarded className="size-4 text-[#11291F]" />
            </div>
            <p className="mt-2 font-heading text-2xl font-extrabold text-[#11291F]">
              {todayCallsCount}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B716C]">Dispositions recorded today</p>
          </div>
        </div>
      </div>

      {/* ── Quick Access Modules (Kotson Styled Cards) ── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B716C] mb-3">
          Quick Access Modules
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* My Campaigns */}
          <div
            onClick={() => navigate("/crm/campaigns")}
            className="group rounded-xl border border-[#E8EDE7] bg-white p-4 hover:border-[#7C9C59] hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#11291F] group-hover:bg-[#11291F] group-hover:text-[#F7F4EE] transition-colors">
                <Layers className="size-5" />
              </div>
              <ArrowRight className="size-4 text-[#6B716C] group-hover:text-[#11291F] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="mt-3 font-heading text-sm font-bold text-[#11291F]">My Campaigns</h4>
            <p className="text-xs text-[#6B716C] mt-0.5">
              {assignedCampaignsCount} active campaign{assignedCampaignsCount === 1 ? "" : "s"} assigned
            </p>
          </div>

          {/* My Leads */}
          <div
            onClick={() => navigate("/crm/leads")}
            className="group rounded-xl border border-[#E8EDE7] bg-white p-4 hover:border-[#7C9C59] hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#11291F] group-hover:bg-[#11291F] group-hover:text-[#F7F4EE] transition-colors">
                <Users className="size-5" />
              </div>
              <ArrowRight className="size-4 text-[#6B716C] group-hover:text-[#11291F] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="mt-3 font-heading text-sm font-bold text-[#11291F]">My Leads</h4>
            <p className="text-xs text-[#6B716C] mt-0.5">
              View lead list, stage filters, and customer cards
            </p>
          </div>

          {/* My Tasks / Follow-ups */}
          <div
            onClick={() => navigate("/crm/follow-ups")}
            className="group rounded-xl border border-[#E8EDE7] bg-white p-4 hover:border-[#7C9C59] hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#11291F] group-hover:bg-[#11291F] group-hover:text-[#F7F4EE] transition-colors">
                <ClipboardList className="size-5" />
              </div>
              <ArrowRight className="size-4 text-[#6B716C] group-hover:text-[#11291F] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="mt-3 font-heading text-sm font-bold text-[#11291F]">My Tasks & Follow-ups</h4>
            <p className="text-xs text-[#6B716C] mt-0.5">
              {pendingFollowupsCount} reminder{pendingFollowupsCount === 1 ? "" : "s"} scheduled
            </p>
          </div>

          {/* Call Logs */}
          <div
            onClick={() => navigate("/crm/calls")}
            className="group rounded-xl border border-[#E8EDE7] bg-white p-4 hover:border-[#7C9C59] hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#11291F] group-hover:bg-[#11291F] group-hover:text-[#F7F4EE] transition-colors">
                <PhoneCall className="size-5" />
              </div>
              <ArrowRight className="size-4 text-[#6B716C] group-hover:text-[#11291F] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="mt-3 font-heading text-sm font-bold text-[#11291F]">Call Logs</h4>
            <p className="text-xs text-[#6B716C] mt-0.5">
              Authoritative call connectivity & outcomes history
            </p>
          </div>

          {/* My Reports */}
          <div
            onClick={() => navigate("/crm/reports")}
            className="group rounded-xl border border-[#E8EDE7] bg-white p-4 hover:border-[#7C9C59] hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#11291F] group-hover:bg-[#11291F] group-hover:text-[#F7F4EE] transition-colors">
                <BarChart3 className="size-5" />
              </div>
              <ArrowRight className="size-4 text-[#6B716C] group-hover:text-[#11291F] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="mt-3 font-heading text-sm font-bold text-[#11291F]">My Reports</h4>
            <p className="text-xs text-[#6B716C] mt-0.5">
              Connect rate, call duration, and disposition breakdown
            </p>
          </div>

          {/* Attendance & Leave */}
          <div
            onClick={() => navigate("/crm/attendance")}
            className="group rounded-xl border border-[#E8EDE7] bg-white p-4 hover:border-[#7C9C59] hover:shadow-sm cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#11291F] group-hover:bg-[#11291F] group-hover:text-[#F7F4EE] transition-colors">
                <Clock className="size-5" />
              </div>
              <ArrowRight className="size-4 text-[#6B716C] group-hover:text-[#11291F] group-hover:translate-x-0.5 transition-all" />
            </div>
            <h4 className="mt-3 font-heading text-sm font-bold text-[#11291F]">Attendance & Shifts</h4>
            <p className="text-xs text-[#6B716C] mt-0.5">
              Monthly calendar, shift timestamps, and corrections
            </p>
          </div>
        </div>
      </div>

      {/* ── Walk-in Lead Dialog ── */}
      <WalkInLeadDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        onSuccessLead={(lead) => navigate(`/crm/leads/${lead.id}`)}
      />
    </div>
  );
}
