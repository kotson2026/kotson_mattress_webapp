import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Users, CheckCircle2, XCircle, Clock, UserCheck,
  AlertCircle, PhoneCall, TrendingUp, UserX, Shuffle, ChevronRight
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ────────── KPI Card ────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color = "text-[#16241C]", icon: Icon }: {
  label: string; value: number | string; sub?: string; color?: string; icon: any;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={`font-heading text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ────────── Assign Modal ────────────────────────────────────────── */
function AssignModal({ campaignId, employees, onClose }: {
  campaignId: string; employees: any[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [strategy, setStrategy] = useState("round_robin");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const assign = useMutation({
    mutationFn: () => apiPost(`/crm/campaigns/${campaignId}/assign`, {
      strategy,
      employee_ids: selectedEmployees,
    }),
    onSuccess: (res: any) => {
      toast.success(res.message || "Leads assigned");
      qc.invalidateQueries({ queryKey: ["crm-campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["crm-campaign-leads", campaignId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Assignment failed"),
  });

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-heading font-bold text-[#16241C]">Assign Leads</h3>
          <button onClick={onClose} className="hover:text-destructive">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Strategy</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="round_robin">Round Robin</option>
              <option value="equal">Equal Distribution</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Select Employees</label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {employees.map(e => (
                <label key={e.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(e.id)}
                    onChange={() => toggleEmployee(e.id)}
                    className="h-4 w-4"
                  />
                  {e.name}
                </label>
              ))}
              {employees.length === 0 && <p className="text-xs text-muted-foreground">No employees assigned to this campaign yet.</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-[#467065] hover:bg-[#16241C] text-white"
              onClick={() => assign.mutate()}
              disabled={selectedEmployees.length === 0 || assign.isPending}
            >
              {assign.isPending ? "Assigning…" : "Assign Unassigned Leads"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── Lead Row ────────────────────────────────────────────── */
function LeadRow({ lead }: { lead: any }) {
  const navigate = useNavigate();
  const bucketColors: Record<string, string> = {
    IN_PROGRESS: "bg-[#7C9C59]/10 text-[#7C9C59]",
    CONVERTED:   "bg-[#467065]/10 text-[#467065]",
    LOST:        "bg-red-50 text-red-600",
  };

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/40"
      onClick={() => navigate(`/crm/leads/${lead.id}`)}
    >
      <TableCell className="font-mono text-xs text-[#467065]">{lead.lead_number}</TableCell>
      <TableCell>
        <p className="text-sm font-medium">{lead.name}</p>
        <p className="text-xs text-muted-foreground">{lead.phone ?? lead.email ?? "—"}</p>
      </TableCell>
      <TableCell className="text-xs">{lead.product_interest ?? "—"}</TableCell>
      <TableCell className="text-xs">{lead.source_kind?.replace(/_/g, " ") ?? "—"}</TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-xs">
          {(lead.stage_code ?? "—").replace(/_/g, " ")}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{lead.assigned_name ?? "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{lead.updated_at ? fmtDateTime(lead.updated_at) : "—"}</TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

/* ────────── Main Campaign Workspace ─────────────────────────────── */
export default function CampaignWorkspace() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [showAssign, setShowAssign] = useState(false);
  const [stageFilter, setStageFilter] = useState("");
  const [bucketFilter, setBucketFilter] = useState("");

  const { data: campaign, isLoading } = useQuery<any>({
    queryKey: ["crm-campaign", campaignId],
    queryFn: () => apiGet<any>(`/crm/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });

  const { data: leadsData } = useQuery<any>({
    queryKey: ["crm-campaign-leads", campaignId, stageFilter, bucketFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (stageFilter) params.set("stage", stageFilter);
      if (bucketFilter) params.set("bucket", bucketFilter);
      params.set("page_size", "100");
      return apiGet<any>(`/crm/campaigns/${campaignId}/leads?${params}`);
    },
    enabled: !!campaignId,
  });

  const { data: pipeline } = useQuery<any>({
    queryKey: ["crm-pipeline", campaign?.pipeline_id],
    queryFn: () => apiGet<any>(`/crm/pipelines/${campaign?.pipeline_id}`),
    enabled: !!campaign?.pipeline_id,
  });

  if (isLoading) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading campaign…</div>;
  if (!campaign) return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-muted-foreground">Campaign not found or you don't have access.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/crm/campaigns")}>← Back to Campaigns</Button>
    </div>
  );

  const stages = pipeline?.stages?.filter((s: any) => !s.is_archived) ?? [];
  const employees: any[] = campaign.employees ?? [];
  const leads: any[] = leadsData?.rows ?? [];

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-[#7C9C59] text-white",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-[#467065]/20 text-[#467065]",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => campaign.pipeline_id ? navigate(`/crm/pipelines/${campaign.pipeline_id}`) : navigate("/crm/campaigns")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#467065] transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {pipeline?.name ?? "Campaigns"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-xl font-bold text-[#16241C]">{campaign.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[campaign.status ?? "active"]}`}>
              {campaign.status ?? "active"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {pipeline && (
              <Link to={`/crm/pipelines/${campaign.pipeline_id}`} className="hover:text-[#467065]">
                Pipeline: <strong>{pipeline.name}</strong>
              </Link>
            )}
            <span>Lead Source: <strong>{campaign.lead_source?.replace(/_/g, " ") ?? "—"}</strong></span>
            {campaign.managers?.length > 0 && (
              <span>Managers: <strong>{campaign.managers.map((m: any) => m.name).join(", ")}</strong></span>
            )}
          </div>
        </div>
        <Button className="bg-[#467065] hover:bg-[#16241C] text-white min-h-10" onClick={() => setShowAssign(true)}>
          <Shuffle className="mr-1.5 h-4 w-4" /> Assign Leads
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Total Leads"   value={campaign.total_leads ?? 0}    icon={Users}        />
        <KpiCard label="Assigned"      value={campaign.assigned_leads ?? 0}  icon={UserCheck}    color="text-[#7C9C59]" />
        <KpiCard label="Unassigned"    value={campaign.unassigned_leads ?? 0} icon={UserX}       color="text-amber-600" />
        <KpiCard label="In Progress"   value={campaign.in_progress_leads ?? 0} icon={Clock}      color="text-[#467065]" />
        <KpiCard label="Converted"     value={campaign.converted_leads ?? 0}  icon={CheckCircle2} color="text-[#467065]" />
        <KpiCard label="Lost"          value={campaign.lost_leads ?? 0}      icon={XCircle}      color="text-red-500" />
        <KpiCard label="Employees"     value={employees.length}              icon={Users}        />
      </div>

      {/* Employees breakdown */}
      {employees.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading font-bold text-[#16241C] mb-3">Team Members</h2>
          <div className="flex flex-wrap gap-2">
            {employees.map((e: any) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-[#467065]/20 flex items-center justify-center text-xs font-bold text-[#467065]">
                  {e.name?.[0] ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#16241C]">{e.name}</p>
                  <p className="text-[10px] text-muted-foreground">Employee</p>
                </div>
              </div>
            ))}
            {campaign.managers?.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-[#467065]/30 bg-[#467065]/5 px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-[#467065]/30 flex items-center justify-center text-xs font-bold text-[#467065]">
                  {m.name?.[0] ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#16241C]">{m.name}</p>
                  <p className="text-[10px] text-[#467065] font-medium">Manager</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leads table */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-heading font-bold text-[#16241C]">
            Leads ({leadsData?.total ?? 0})
          </h2>
          <div className="flex gap-2">
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">All Stages</option>
              {stages.map((s: any) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
            <select value={bucketFilter} onChange={e => setBucketFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs">
              <option value="">All Buckets</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No leads in this campaign yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead #</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map(l => <LeadRow key={l.id} lead={l} />)}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {showAssign && (
        <AssignModal
          campaignId={campaignId!}
          employees={employees}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
