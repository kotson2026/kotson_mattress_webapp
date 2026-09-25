import { useState, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  GitBranch, Plus, Search, ChevronRight, Layers,
  Users, TrendingUp, Target, ArrowRight, X, Trash2, GripVertical,
  CheckCircle2, AlertCircle, Package
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Pipeline } from "@/lib/crmTypes";

/* ────────── Bucket config ───────────────────────────────────────── */
const BUCKET_OPTS = [
  { value: "IN_PROGRESS", label: "In Progress", color: "#7C9C59" },
  { value: "CONVERTED",   label: "Converted",   color: "#467065" },
  { value: "LOST",        label: "Lost",         color: "#EF4444" },
];

const PIPELINE_TYPES = [
  "Product Sales", "Product Category", "Abandoned Cart",
  "Dealer Sales", "Referral Sales", "Website Leads", "Custom",
];

const DEFAULT_STAGES = [
  { code: "fresh_lead",      label: "Fresh Lead",      bucket: "IN_PROGRESS", sort: 10, is_terminal: false, is_won: false, is_lost: false, is_archived: false, color: "#7C9C59", require_follow_up: false, require_note: false },
  { code: "contacted",       label: "Contacted",       bucket: "IN_PROGRESS", sort: 20, is_terminal: false, is_won: false, is_lost: false, is_archived: false, color: "#7C9C59", require_follow_up: false, require_note: false },
  { code: "interested",      label: "Interested",      bucket: "IN_PROGRESS", sort: 30, is_terminal: false, is_won: false, is_lost: false, is_archived: false, color: "#467065", require_follow_up: true,  require_note: false },
  { code: "follow_up",       label: "Follow-up",       bucket: "IN_PROGRESS", sort: 40, is_terminal: false, is_won: false, is_lost: false, is_archived: false, color: "#467065", require_follow_up: true,  require_note: false },
  { code: "hot_lead",        label: "Hot Lead",        bucket: "IN_PROGRESS", sort: 50, is_terminal: false, is_won: false, is_lost: false, is_archived: false, color: "#16241C", require_follow_up: true,  require_note: false },
  { code: "order_initiated", label: "Order Initiated", bucket: "IN_PROGRESS", sort: 60, is_terminal: false, is_won: false, is_lost: false, is_archived: false, color: "#16241C", require_follow_up: false, require_note: true  },
  { code: "converted",       label: "Converted",       bucket: "CONVERTED",   sort: 70, is_terminal: true,  is_won: true,  is_lost: false, is_archived: false, color: "#467065", require_follow_up: false, require_note: false },
  { code: "not_interested",  label: "Not Interested",  bucket: "LOST",        sort: 80, is_terminal: true,  is_won: false, is_lost: true,  is_archived: false, color: "#EF4444", require_follow_up: false, require_note: true  },
  { code: "unreachable",     label: "Unreachable",     bucket: "LOST",        sort: 90, is_terminal: true,  is_won: false, is_lost: true,  is_archived: false, color: "#EF4444", require_follow_up: false, require_note: false },
];

type StageRow = typeof DEFAULT_STAGES[0];

/* ────────── Stage Builder row ───────────────────────────────────── */
function StageBuilderRow({
  stage, idx, total,
  onChange, onRemove, onMove,
}: {
  stage: StageRow; idx: number; total: number;
  onChange: (s: StageRow) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const bucket = BUCKET_OPTS.find(b => b.value === stage.bucket)!;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-1 pt-1">
        <button onClick={() => onMove("up")}   disabled={idx === 0}           className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">▲</button>
        <button onClick={() => onMove("down")} disabled={idx === total - 1}   className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">▼</button>
      </div>
      <span className="mt-3 min-w-[20px] text-xs font-mono text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>

      <div className="flex flex-1 flex-wrap gap-3">
        <div className="min-w-[160px] flex-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Stage Name*</Label>
          <Input
            value={stage.label}
            onChange={e => onChange({ ...stage, label: e.target.value, code: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })}
            className="mt-1 h-8 text-sm"
            placeholder="e.g. Hot Lead"
          />
        </div>

        <div className="w-40">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Bucket*</Label>
          <select
            value={stage.bucket}
            onChange={e => onChange({
              ...stage,
              bucket: e.target.value as StageRow["bucket"],
              is_won: e.target.value === "CONVERTED",
              is_lost: e.target.value === "LOST",
              is_terminal: e.target.value !== "IN_PROGRESS",
            })}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {BUCKET_OPTS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        <div className="flex items-end gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={stage.require_follow_up} onChange={e => onChange({ ...stage, require_follow_up: e.target.checked })} className="h-3 w-3" />
            Req. Follow-up
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={stage.require_note} onChange={e => onChange({ ...stage, require_note: e.target.checked })} className="h-3 w-3" />
            Req. Note
          </label>
        </div>
      </div>

      <span className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${bucket.color}20`, color: bucket.color }}>
        {bucket.label}
      </span>

      <button onClick={onRemove} className="mt-2 p-1 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ────────── Create Pipeline Modal ───────────────────────────────── */
function CreatePipelineModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1); // 1=basic, 2=stages
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pipelineType, setPipelineType] = useState("Product Sales");
  const [stages, setStages] = useState<StageRow[]>(DEFAULT_STAGES);

  const createPipeline = useMutation({
    mutationFn: () =>
      apiPost("/crm/pipelines", {
        name,
        description,
        pipeline_type: pipelineType,
        kind: "sales",
        stages: stages.map((s, i) => ({ ...s, sort: (i + 1) * 10 })),
      }),
    onSuccess: () => {
      toast.success(`Pipeline "${name}" created successfully`);
      qc.invalidateQueries({ queryKey: ["crm-pipelines-list"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create pipeline"),
  });

  const addStage = () => {
    const newStage: StageRow = {
      code: `stage_${Date.now()}`, label: "", bucket: "IN_PROGRESS", sort: (stages.length + 1) * 10,
      is_terminal: false, is_won: false, is_lost: false, is_archived: false,
      color: "#7C9C59", require_follow_up: false, require_note: false,
    };
    setStages([...stages, newStage]);
  };

  const moveStage = (idx: number, dir: "up" | "down") => {
    const s = [...stages];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= s.length) return;
    [s[idx], s[target]] = [s[target], s[idx]];
    setStages(s);
  };

  const hasConverted = stages.some(s => s.bucket === "CONVERTED");
  const hasLost = stages.some(s => s.bucket === "LOST");
  const canSave = name.trim().length >= 2 && stages.length > 0 && hasConverted && hasLost;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 overflow-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-[#16241C]">Create Pipeline</h2>
            <p className="text-xs text-muted-foreground">Step {step} of 2 — {step === 1 ? "Basic Information" : "Funnel Stages"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Step indicators */}
        <div className="flex border-b border-border">
          {["Basic Info", "Funnel Stages"].map((t, i) => (
            <button key={t} onClick={() => i === 0 ? setStep(1) : (name.trim() && setStep(2))}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${step === i + 1 ? "border-b-2 border-[#467065] text-[#467065]" : "text-muted-foreground"}`}>
              {i + 1}. {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Pipeline Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mattress Sales" className="mt-1.5" />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Sales pipeline for all mattress enquiries and campaigns."
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20"
                />
              </div>
              <div>
                <Label>Pipeline Type</Label>
                <select value={pipelineType} onChange={e => setPipelineType(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {PIPELINE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="rounded-lg bg-[#FAF8F5] p-3 text-xs text-muted-foreground border border-border">
                <p className="font-semibold text-[#16241C] mb-1">Next: Define your sales funnel stages</p>
                A default 9-stage funnel is pre-loaded. You can customize it in Step 2.
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={name.trim().length < 2}
                  className="bg-[#467065] hover:bg-[#16241C] text-white">
                  Next: Funnel Stages <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Bucket legend */}
              <div className="flex gap-3">
                {BUCKET_OPTS.map(b => (
                  <span key={b.value} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: b.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                    {b.label}
                  </span>
                ))}
              </div>

              {/* Validation warnings */}
              <div className="flex gap-3">
                <span className={`flex items-center gap-1 text-xs ${hasConverted ? "text-[#467065]" : "text-amber-600"}`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${!hasConverted && "opacity-40"}`} />
                  {hasConverted ? "CONVERTED stage ✓" : "Need a CONVERTED stage"}
                </span>
                <span className={`flex items-center gap-1 text-xs ${hasLost ? "text-[#467065]" : "text-amber-600"}`}>
                  <CheckCircle2 className={`h-3.5 w-3.5 ${!hasLost && "opacity-40"}`} />
                  {hasLost ? "LOST stage ✓" : "Need a LOST stage"}
                </span>
              </div>

              {/* Stage list */}
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {stages.map((s, i) => (
                  <StageBuilderRow
                    key={s.code + i}
                    stage={s}
                    idx={i}
                    total={stages.length}
                    onChange={updated => setStages(stages.map((ss, ii) => ii === i ? updated : ss))}
                    onRemove={() => setStages(stages.filter((_, ii) => ii !== i))}
                    onMove={dir => moveStage(i, dir)}
                  />
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addStage} className="w-full border-dashed">
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Stage
              </Button>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => createPipeline.mutate()} disabled={!canSave || createPipeline.isPending}>
                    Save Draft
                  </Button>
                  <Button className="bg-[#467065] hover:bg-[#16241C] text-white" onClick={() => createPipeline.mutate()} disabled={!canSave || createPipeline.isPending}>
                    {createPipeline.isPending ? "Creating…" : "Create & Activate Pipeline"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────── Pipeline Card ───────────────────────────────────────── */
function PipelineCard({ pipeline }: { pipeline: any }) {
  const navigate = useNavigate();
  const inProgressStages = pipeline.stages?.filter((s: any) => s.bucket === "IN_PROGRESS" && !s.is_archived) ?? [];
  const convertedStages = pipeline.stages?.filter((s: any) => s.bucket === "CONVERTED" && !s.is_archived) ?? [];
  const lostStages = pipeline.stages?.filter((s: any) => s.bucket === "LOST" && !s.is_archived) ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 hover:border-[#7C9C59]/50 transition-colors cursor-pointer group"
      onClick={() => navigate(`/crm/pipelines/${pipeline.id}`)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#7C9C59]" />
            <h3 className="font-heading font-bold text-[#16241C] text-base">{pipeline.name}</h3>
            <Badge className={pipeline.is_active ? "bg-[#7C9C59] text-white text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>
              {pipeline.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {pipeline.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{pipeline.description}</p>
          )}
          <p className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">{pipeline.pipeline_type || "Sales"}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#467065] transition-colors shrink-0 mt-1" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Campaigns",  value: pipeline.campaign_count ?? 0,  icon: Layers },
          { label: "Total Leads", value: pipeline.total_leads ?? 0,     icon: Users },
          { label: "Converted",  value: pipeline.converted_leads ?? 0,  icon: TrendingUp },
          { label: "Stages",     value: (pipeline.stages ?? []).filter((s: any) => !s.is_archived).length, icon: Target },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold text-[#16241C]">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bucket summary */}
      <div className="flex gap-2 text-[10px]">
        <span className="rounded-full bg-[#7C9C59]/10 px-2 py-0.5 text-[#7C9C59] font-medium">{inProgressStages.length} In Progress</span>
        <span className="rounded-full bg-[#467065]/10 px-2 py-0.5 text-[#467065] font-medium">{convertedStages.length} Converted</span>
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600 font-medium">{lostStages.length} Lost</span>
      </div>
    </div>
  );
}

/* ────────── Main Pipelines Page ─────────────────────────────────── */
export default function PipelinesPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: pipelines, isLoading } = useQuery<any[]>({
    queryKey: ["crm-pipelines-list"],
    queryFn: () => apiGet<any[]>("/crm/pipelines"),
  });

  const filtered = (pipelines ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[#7C9C59]" />
            <h1 className="font-heading text-2xl font-bold text-[#16241C]">Pipelines</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Sales funnels with custom stages. Each pipeline contains multiple campaigns.
          </p>
        </div>
        <Button className="bg-[#467065] hover:bg-[#16241C] text-white min-h-11" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Pipeline
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 min-h-10"
          placeholder="Search pipelines…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading pipelines…</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border">
          <GitBranch className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{search ? "No pipelines match your search." : "No pipelines yet. Create your first pipeline."}</p>
          {!search && (
            <Button variant="outline" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-3.5 w-3.5" /> Create Pipeline</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p => <PipelineCard key={p.id} pipeline={p} />)}
        </div>
      )}

      {showCreate && <CreatePipelineModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
