import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Layers, Search, ChevronRight, Users, TrendingUp, Clock, Filter } from "lucide-react";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-[#7C9C59] text-white",
  paused:    "bg-amber-100 text-amber-700",
  completed: "bg-[#467065]/20 text-[#467065]",
  archived:  "bg-muted text-muted-foreground",
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [search, setSearch]               = useState("");
  const [filterPipeline, setFilterPipeline] = useState("");
  const [filterStatus, setFilterStatus]   = useState("");

  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: ["crm-campaigns-all"],
    queryFn: () => apiGet<any[]>("/crm/campaigns"),
  });

  const { data: pipelines } = useQuery<any[]>({
    queryKey: ["crm-pipelines-list"],
    queryFn: () => apiGet<any[]>("/crm/pipelines"),
  });

  const pipelineMap = Object.fromEntries((pipelines ?? []).map(p => [p.id, p.name]));

  const filtered = (campaigns ?? []).filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPipeline && c.pipeline_id !== filterPipeline) return false;
    if (filterStatus && (c.status ?? "active") !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#7C9C59]" />
            <h1 className="font-heading text-2xl font-bold text-[#16241C]">Campaigns</h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All campaigns across all pipelines. Each campaign is a batch of leads inside a pipeline.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 min-h-10" placeholder="Search campaigns…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          value={filterPipeline}
          onChange={e => setFilterPipeline(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
        >
          <option value="">All Pipelines</option>
          {(pipelines ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Column headers */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Campaign</span><span>Pipeline</span><span>Status</span>
          <span>Leads</span><span>Unassigned</span><span>Converted</span><span>Members</span><span></span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading campaigns…</div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border">
          <Layers className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || filterPipeline || filterStatus ? "No campaigns match your filters." : "No campaigns yet. Create campaigns from within a pipeline."}
          </p>
          {!search && !filterPipeline && !filterStatus && (
            <Button variant="outline" onClick={() => navigate("/crm/pipelines")}>Go to Pipelines →</Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/crm/campaigns/${c.id}`)}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center rounded-xl border border-border bg-card px-4 py-3 hover:border-[#7C9C59]/50 cursor-pointer transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-[#16241C] truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.lead_source?.replace(/_/g, " ") ?? "—"}</p>
              </div>
              <p className="text-xs text-muted-foreground truncate">{pipelineMap[c.pipeline_id] ?? "—"}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${STATUS_COLORS[c.status ?? "active"]}`}>
                {c.status ?? "active"}
              </span>
              <div className="text-center">
                <p className="text-sm font-bold">{c.total_leads ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Leads</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-amber-600">{c.unassigned_leads ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Unassigned</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#467065]">{c.converted_leads ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Converted</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold">{(c.manager_ids?.length ?? 0) + (c.employee_ids?.length ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">Members</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
