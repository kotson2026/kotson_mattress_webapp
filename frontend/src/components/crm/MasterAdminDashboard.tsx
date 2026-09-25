import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  UserX,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  ShoppingBag,
  TrendingUp,
  Clock,
  Coffee,
  Calendar,
  AlertCircle,
  Filter,
  ArrowUpRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardKPIs } from "@/lib/crmTypes";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
];

export default function MasterAdminDashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState("last_30_days");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("ALL");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("ALL");

  const queryParams = new URLSearchParams({
    range,
    ...(selectedPipeline !== "ALL" && { pipeline_id: selectedPipeline }),
    ...(selectedCampaign !== "ALL" && { campaign_code: selectedCampaign }),
  });

  const { data: kpis, isLoading } = useQuery<DashboardKPIs>({
    queryKey: ["crm-dashboard-kpis", range, selectedPipeline, selectedCampaign],
    queryFn: () => apiGet<DashboardKPIs>(`/crm/analytics/dashboard-kpis?${queryParams.toString()}`),
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        Loading CRM Command Center...
      </div>
    );
  }

  const r1 = kpis?.kpi_row_1 ?? {
    total_leads: 0,
    unassigned_leads: 0,
    assigned_leads: 0,
    new_leads: 0,
    follow_ups_due: 0,
    overdue_follow_ups: 0,
  };

  const r2 = kpis?.kpi_row_2 ?? {
    calls_made: 0,
    connected_calls: 0,
    not_connected: 0,
    conversions: 0,
    crm_sales_paise: 0,
    conversion_rate_pct: 0,
  };

  const r3 = kpis?.kpi_row_3 ?? {
    managers_active: 0,
    employees_active: 0,
    clocked_in: 0,
    on_break: 0,
    absent: 0,
    on_leave: 0,
  };

  const stages = kpis?.leads_by_stage ?? [];

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-2">
            <Filter className="h-3.5 w-3.5 text-[#7C9C59]" />
            <span>Scope:</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant={range === r.value ? "default" : "ghost"}
                onClick={() => setRange(r.value)}
                className={`h-8 text-xs font-medium rounded-lg ${
                  range === r.value
                    ? "bg-[#16241C] text-white hover:bg-[#25382B]"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {kpis?.pipelines && kpis.pipelines.length > 0 && (
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="h-8 w-44 text-xs bg-background">
                <SelectValue placeholder="All Pipelines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Pipelines</SelectItem>
                {kpis.pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/crm/leads")}
            className="h-8 gap-1.5 text-xs font-semibold text-[#467065] border-[#7C9C59]/40 hover:bg-[#7C9C59]/10"
          >
            <span>View All Leads</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI ROW 1: Lead Pipeline & Attention */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pipeline Volume & Attention
          </h3>
          <span className="text-[11px] text-muted-foreground">Click card for filtered list</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div
            onClick={() => navigate("/crm/leads")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Total Leads</span>
              <Users className="h-4 w-4 text-[#7C9C59] group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r1.total_leads}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Active records in scope</p>
          </div>

          <div
            onClick={() => navigate("/crm/leads?filter=unassigned")}
            className="cursor-pointer rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4 transition-all hover:border-amber-400 hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-xs font-medium">Unassigned</span>
              <UserX className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-950 tracking-tight">{r1.unassigned_leads}</p>
            <p className="mt-1 text-[11px] text-amber-700">Needs agent distribution</p>
          </div>

          <div
            onClick={() => navigate("/crm/leads?filter=assigned")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Assigned</span>
              <UserCheck className="h-4 w-4 text-[#467065] group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r1.assigned_leads}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">With active sales agent</p>
          </div>

          <div
            onClick={() => navigate("/crm/leads?stage=new")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">New Leads</span>
              <Sparkles className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r1.new_leads}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Fresh registrations/cart</p>
          </div>

          <div
            onClick={() => navigate("/crm/follow-ups?tab=due")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Follow-ups Due</span>
              <Clock className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r1.follow_ups_due}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Scheduled for today</p>
          </div>

          <div
            onClick={() => navigate("/crm/follow-ups?tab=overdue")}
            className="cursor-pointer rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4 transition-all hover:border-rose-400 hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-rose-800">
              <span className="text-xs font-medium">Overdue</span>
              <AlertCircle className="h-4 w-4 text-rose-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black text-rose-950 tracking-tight">{r1.overdue_follow_ups}</p>
            <p className="mt-1 text-[11px] text-rose-700">Missed follow-up timeline</p>
          </div>
        </div>
      </div>

      {/* KPI ROW 2: Calls & Sales Conversions */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Calls & Sales Conversions
          </h3>
          <span className="text-[11px] text-muted-foreground">Connected to authoritative orders</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div
            onClick={() => navigate("/crm/calls")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Calls Logged</span>
              <PhoneCall className="h-4 w-4 text-[#7C9C59] group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r2.calls_made}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Agent calls recorded</p>
          </div>

          <div
            onClick={() => navigate("/crm/calls?status=connected")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-emerald-400 hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-xs font-medium">Connected</span>
              <PhoneForwarded className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-950 tracking-tight">{r2.connected_calls}</p>
            <p className="mt-1 text-[11px] text-emerald-700">Spoke with buyer</p>
          </div>

          <div
            onClick={() => navigate("/crm/calls?status=unconnected")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-slate-400 hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Not Connected</span>
              <PhoneOff className="h-4 w-4 text-muted-foreground group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r2.not_connected}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Busy / Unreachable</p>
          </div>

          <div
            onClick={() => navigate("/crm/conversions")}
            className="cursor-pointer rounded-2xl border border-[#7C9C59]/30 bg-[#7C9C59]/5 p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-[#467065]">
              <span className="text-xs font-medium">Conversions</span>
              <ShoppingBag className="h-4 w-4 text-[#7C9C59] group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black text-[#16241C] tracking-tight">{r2.conversions}</p>
            <p className="mt-1 text-[11px] text-[#467065]">Verified paid orders</p>
          </div>

          <div
            onClick={() => navigate("/crm/conversions")}
            className="cursor-pointer rounded-2xl border border-[#7C9C59]/30 bg-[#7C9C59]/5 p-4 transition-all hover:border-[#7C9C59] hover:shadow-md group"
          >
            <div className="flex items-center justify-between text-[#467065]">
              <span className="text-xs font-medium">Attributed Sales</span>
              <TrendingUp className="h-4 w-4 text-[#7C9C59] group-hover:scale-110 transition-transform" />
            </div>
            <p className="mt-2 text-2xl font-black text-[#16241C] tracking-tight">
              {inr(r2.crm_sales_paise)}
            </p>
            <p className="mt-1 text-[11px] text-[#467065]">CRM order total</p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Conversion Rate</span>
              <span className="text-xs font-bold text-[#7C9C59]">%</span>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r2.conversion_rate_pct}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Conversions / Leads</p>
          </div>
        </div>
      </div>

      {/* KPI ROW 3: Workforce & Attendance Pulse */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Workforce & Attendance Pulse
          </h3>
          <span className="text-[11px] text-muted-foreground">Server-verified live status</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div
            onClick={() => navigate("/crm/team")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Managers Active</span>
              <Users className="h-4 w-4 text-[#467065]" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r3.managers_active}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Supervisory team</p>
          </div>

          <div
            onClick={() => navigate("/crm/team")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-[#7C9C59] hover:shadow-md"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Employees Active</span>
              <Users className="h-4 w-4 text-[#7C9C59]" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r3.employees_active}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Sales force staff</p>
          </div>

          <div
            onClick={() => navigate("/crm/attendance")}
            className="cursor-pointer rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 transition-all hover:border-emerald-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-xs font-medium">Clocked In</span>
              <Clock className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-950 tracking-tight">{r3.clocked_in}</p>
            <p className="mt-1 text-[11px] text-emerald-700">Currently on duty</p>
          </div>

          <div
            onClick={() => navigate("/crm/attendance")}
            className="cursor-pointer rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 transition-all hover:border-amber-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-xs font-medium">On Break</span>
              <Coffee className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-950 tracking-tight">{r3.on_break}</p>
            <p className="mt-1 text-[11px] text-amber-700">Rest period pause</p>
          </div>

          <div
            onClick={() => navigate("/crm/attendance")}
            className="cursor-pointer rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-slate-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Absent</span>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight">{r3.absent}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Not clocked in today</p>
          </div>

          <div
            onClick={() => navigate("/crm/leave")}
            className="cursor-pointer rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-xs font-medium">On Leave</span>
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-blue-950 tracking-tight">{r3.on_leave}</p>
            <p className="mt-1 text-[11px] text-blue-700">Approved leave request</p>
          </div>
        </div>
      </div>

      {/* LEADS BY STAGE FUNNEL VISUALIZER */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#7C9C59]" />
              <h3 className="font-heading text-base font-bold">Leads by Pipeline Stage</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live funnel breakdown · Configured per pipeline (Not globally hardcoded)
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/crm/pipelines")}
            className="h-8 text-xs border-[#7C9C59]/40 text-[#467065] hover:bg-[#7C9C59]/10"
          >
            Configure Pipelines & Stages
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No leads recorded in this scope yet.
            </p>
          ) : (
            stages.map((st) => (
              <div
                key={st.stage_code}
                onClick={() => navigate(`/crm/leads?stage=${st.stage_code}`)}
                className="group cursor-pointer rounded-xl p-2 transition-all hover:bg-muted/50"
              >
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                  <span className="group-hover:text-[#467065] transition-colors">{st.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{st.count} leads</span>
                    <span className="text-muted-foreground">({st.pct}%)</span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7C9C59] to-[#467065] transition-all duration-500"
                    style={{ width: `${Math.max(st.pct, st.count > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
