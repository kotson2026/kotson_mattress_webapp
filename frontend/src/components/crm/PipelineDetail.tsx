import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Users, TrendingUp, Target, Layers,
  CheckCircle2, XCircle, Clock, ChevronRight, BarChart3,
  Settings, PhoneCall, Search, RefreshCw, UserCheck
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr, fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ────────── Funnel bar ──────────────────────────────────────────── */
function FunnelBar({ stage, maxCount }: { stage: any; maxCount: number }) {
  const width = maxCount > 0 ? Math.max(4, (stage.count / maxCount) * 100) : 4;
  const bucketColors: Record<string, string> = {
    IN_PROGRESS: "#7C9C59",
    CONVERTED:   "#467065",
    LOST:        "#EF4444",
  };
  const color = bucketColors[stage.bucket] ?? "#7C9C59";

  return (
    <div className="group flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium text-[#16241C] truncate">{stage.label}</p>
        <p className="text-[10px] uppercase tracking-wider" style={{ color }}>{stage.bucket.replace("_", " ")}</p>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-5 bg-muted/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${width}%`, background: color, opacity: 0.85 }}
          />
        </div>
        <span className="w-14 shrink-0 text-right text-sm font-bold text-[#16241C]">{stage.count}</span>
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{stage.pct}%</span>
      </div>
    </div>
  );
}

/* ────────── Campaign row ────────────────────────────────────────── */
function CampaignRow({ campaign, pipelineId }: { campaign: any; pipelineId: string }) {
  const navigate = useNavigate();
  const statusColors: Record<string, string> = {
    active: "bg-[#7C9C59] text-white",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-[#467065]/20 text-[#467065]",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <div
      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center rounded-lg border border-border bg-card px-4 py-3 hover:border-[#7C9C59]/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/crm/campaigns/${campaign.id}`)}
    >
      <div>
        <p className="text-sm font-semibold text-[#16241C]">{campaign.name}</p>
        <p className="text-xs text-muted-foreground">{campaign.lead_source || "—"}</p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${statusColors[campaign.status] ?? statusColors.active}`}>
        {campaign.status ?? "active"}
      </span>
      <div className="text-center">
        <p className="text-sm font-bold text-[#16241C]">{campaign.total_leads ?? 0}</p>
        <p className="text-[10px] text-muted-foreground">Leads</p>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-[#16241C]">{campaign.unassigned_leads ?? 0}</p>
        <p className="text-[10px] text-muted-foreground">Unassigned</p>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-[#467065]">{campaign.converted_leads ?? 0}</p>
        <p className="text-[10px] text-muted-foreground">Converted</p>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-[#16241C]">{(campaign.manager_ids ?? []).length + (campaign.employee_ids ?? []).length}</p>
        <p className="text-[10px] text-muted-foreground">Members</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

/* ────────── Create Campaign Modal ───────────────────────────────── */
function CreateCampaignModal({ pipelineId, pipelineName, onClose }: {
  pipelineId: string; pipelineName: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadSource, setLeadSource] = useState("website");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");

  const { data: employees } = useQuery({
    queryKey: ["crm-employees"],
    queryFn: () => apiGet<any[]>("/crm/workforce/employees"),
  });

  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const createCampaign = useMutation({
    mutationFn: () =>
      apiPost("/crm/campaigns", {
        name,
        code: `${name.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}-${Date.now().toString().slice(-4)}`,
        description,
        pipeline_id: pipelineId,
        lead_source: leadSource,
        start_date: startDate || null,
        end_date: endDate || null,
        manager_ids: selectedManagers,
        employee_ids: selectedEmployees,
        status,
      }),
    onSuccess: () => {
      toast.success(`Campaign "${name}" created`);
      qc.invalidateQueries({ queryKey: ["crm-pipeline-campaigns", pipelineId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create campaign"),
  });

  const SOURCES = ["website", "walk_in", "instagram", "referral", "google_ads", "facebook_ads", "import", "manual"];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-10 overflow-auto">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading font-bold text-[#16241C]">Create Campaign</h2>
            <p className="text-xs text-muted-foreground">Pipeline: <strong>{pipelineName}</strong></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label>Campaign Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="September Hyderabad Mattress Leads" className="mt-1.5" />
          </div>
          <div>
            <Label>Description</Label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16"
              placeholder="Inbound website leads for September Hyderabad campaign…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Lead Source</Label>
              <select value={leadSource} onChange={e => setLeadSource(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          {employees && employees.length > 0 && (
            <div className="rounded-lg bg-[#FAF8F5] p-3 text-xs text-muted-foreground border border-border">
              <p className="font-semibold text-[#16241C] mb-1">Assign Team Members</p>
              <p>Managers and employees can be assigned after campaign creation from the Campaign Workspace.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-[#467065] hover:bg-[#16241C] text-white"
              onClick={() => createCampaign.mutate()}
              disabled={name.trim().length < 2 || createCampaign.isPending}
            >
              {createCampaign.isPending ? "Creating…" : "Create Campaign"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── Main Pipeline Detail Page ───────────────────────────── */
export default function PipelineDetail() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

  const { data: pipeline, isLoading: loadingPipeline } = useQuery<any>({
    queryKey: ["crm-pipeline", pipelineId],
    queryFn: () => apiGet<any>(`/crm/pipelines/${pipelineId}`),
    enabled: !!pipelineId,
  });

  const { data: funnel, isLoading: loadingFunnel } = useQuery<any>({
    queryKey: ["crm-pipeline-funnel", pipelineId],
    queryFn: () => apiGet<any>(`/crm/pipelines/${pipelineId}/funnel`),
    enabled: !!pipelineId,
  });

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery<any[]>({
    queryKey: ["crm-pipeline-campaigns", pipelineId],
    queryFn: () => apiGet<any[]>(`/crm/pipelines/${pipelineId}/campaigns`),
    enabled: !!pipelineId,
  });

  if (loadingPipeline) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading pipeline…</div>;
  }
  if (!pipeline) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Pipeline not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/crm/pipelines")}>← Back to Pipelines</Button>
      </div>
    );
  }

  const maxCount = Math.max(...(funnel?.stages ?? []).map((s: any) => s.count), 1);
  const inProgressStages = (funnel?.stages ?? []).filter((s: any) => s.bucket === "IN_PROGRESS");
  const convertedStages  = (funnel?.stages ?? []).filter((s: any) => s.bucket === "CONVERTED");
  const lostStages       = (funnel?.stages ?? []).filter((s: any) => s.bucket === "LOST");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/crm/pipelines")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#467065] transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Pipelines
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-[#16241C]">{pipeline.name}</h1>
            <Badge className={pipeline.is_active ? "bg-[#7C9C59] text-white" : "bg-muted text-muted-foreground"}>
              {pipeline.is_active ? "Active" : "Inactive"}
            </Badge>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{pipeline.pipeline_type}</span>
          </div>
          {pipeline.description && <p className="mt-1 text-sm text-muted-foreground">{pipeline.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-10" onClick={() => navigate(`/crm/pipelines/${pipelineId}/settings`)}>
            <Settings className="mr-1.5 h-3.5 w-3.5" /> Pipeline Settings
          </Button>
          <Button className="bg-[#467065] hover:bg-[#16241C] text-white min-h-10" onClick={() => setShowCreateCampaign(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create Campaign
          </Button>
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Leads",    value: funnel?.total_leads ?? 0,  icon: Users,         color: "text-[#16241C]" },
          { label: "In Progress",    value: funnel?.in_progress ?? 0,  icon: Clock,         color: "text-[#7C9C59]" },
          { label: "Converted",      value: funnel?.converted ?? 0,    icon: CheckCircle2,  color: "text-[#467065]" },
          { label: "Lost",           value: funnel?.lost ?? 0,         icon: XCircle,       color: "text-red-500"   },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            </div>
            <p className={`font-heading text-3xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="funnel">
        <TabsList className="mb-4">
          <TabsTrigger value="funnel"><BarChart3 className="mr-1.5 h-3.5 w-3.5" />Lead Funnel</TabsTrigger>
          <TabsTrigger value="campaigns"><Layers className="mr-1.5 h-3.5 w-3.5" />Campaigns ({campaigns?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* ── Funnel tab ── */}
        <TabsContent value="funnel" className="space-y-4">
          {loadingFunnel ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading funnel…</div>
          ) : (
            <>
              {/* All stages funnel */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-heading font-bold text-[#16241C] mb-4">Lead Funnel by Stage</h2>
                <div className="space-y-1">
                  {(funnel?.stages ?? []).map((s: any) => (
                    <FunnelBar key={s.code} stage={s} maxCount={maxCount} />
                  ))}
                  {(funnel?.stages ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No stages defined for this pipeline yet.</p>
                  )}
                </div>
              </div>

              {/* Bucket breakdown */}
              <div className="grid gap-4 sm:grid-cols-3">
                {/* IN PROGRESS */}
                <div className="rounded-2xl border border-[#7C9C59]/30 bg-[#7C9C59]/5 p-4">
                  <h3 className="font-semibold text-[#7C9C59] text-sm mb-3 uppercase tracking-wider">In Progress</h3>
                  <div className="space-y-2">
                    {inProgressStages.map((s: any) => (
                      <div key={s.code} className="flex items-center justify-between text-sm">
                        <span className="text-[#16241C]">{s.label}</span>
                        <span className="font-bold text-[#16241C]">{s.count}</span>
                      </div>
                    ))}
                    {inProgressStages.length === 0 && <p className="text-xs text-muted-foreground">No stages</p>}
                  </div>
                </div>

                {/* CONVERTED */}
                <div className="rounded-2xl border border-[#467065]/30 bg-[#467065]/5 p-4">
                  <h3 className="font-semibold text-[#467065] text-sm mb-3 uppercase tracking-wider">Converted</h3>
                  <div className="space-y-2">
                    {convertedStages.map((s: any) => (
                      <div key={s.code} className="flex items-center justify-between text-sm">
                        <span className="text-[#16241C]">{s.label}</span>
                        <span className="font-bold text-[#467065]">{s.count}</span>
                      </div>
                    ))}
                    {convertedStages.length === 0 && <p className="text-xs text-muted-foreground">No stages</p>}
                  </div>
                </div>

                {/* LOST */}
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <h3 className="font-semibold text-red-600 text-sm mb-3 uppercase tracking-wider">Lost</h3>
                  <div className="space-y-2">
                    {lostStages.map((s: any) => (
                      <div key={s.code} className="flex items-center justify-between text-sm">
                        <span className="text-[#16241C]">{s.label}</span>
                        <span className="font-bold text-red-600">{s.count}</span>
                      </div>
                    ))}
                    {lostStages.length === 0 && <p className="text-xs text-muted-foreground">No stages</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Campaigns tab ── */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{campaigns?.length ?? 0} campaigns in this pipeline</p>
            <Button className="bg-[#467065] hover:bg-[#16241C] text-white" size="sm" onClick={() => setShowCreateCampaign(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Campaign
            </Button>
          </div>

          {/* Column headers */}
          {(campaigns?.length ?? 0) > 0 && (
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>Campaign</span><span>Status</span><span>Leads</span>
              <span>Unassigned</span><span>Converted</span><span>Members</span><span></span>
            </div>
          )}

          {loadingCampaigns ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading campaigns…</div>
          ) : (campaigns?.length ?? 0) === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border">
              <Layers className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No campaigns yet. Create the first campaign for this pipeline.</p>
              <Button variant="outline" size="sm" onClick={() => setShowCreateCampaign(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Create Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns!.map(c => <CampaignRow key={c.id} campaign={c} pipelineId={pipelineId!} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showCreateCampaign && (
        <CreateCampaignModal
          pipelineId={pipelineId!}
          pipelineName={pipeline.name}
          onClose={() => setShowCreateCampaign(false)}
        />
      )}
    </div>
  );
}
