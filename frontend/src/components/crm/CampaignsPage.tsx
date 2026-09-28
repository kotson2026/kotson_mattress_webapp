import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Layers,
  Search,
  ChevronRight,
  Users,
  TrendingUp,
  Clock,
  Filter,
  LayoutGrid,
  List,
  PhoneCall,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { useMe } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[#7C9C59] text-white",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-[#467065]/20 text-[#467065]",
  archived: "bg-muted text-muted-foreground",
};

export default function CampaignsPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [search, setSearch] = useState("");
  const [filterPipeline, setFilterPipeline] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const isPureEmployee =
    !!me?.roles.includes("crm_employee") &&
    !me.roles.some((r) => ["owner", "admin", "crm_master", "crm_manager"].includes(r));

  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: ["crm-campaigns-all"],
    queryFn: () => apiGet<any[]>("/crm/campaigns"),
  });

  const { data: pipelines } = useQuery<any[]>({
    queryKey: ["crm-pipelines-list"],
    queryFn: () => apiGet<any[]>("/crm/pipelines"),
  });

  const pipelineMap = Object.fromEntries((pipelines ?? []).map((p) => [p.id, p.name]));

  const filtered = (campaigns ?? []).filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPipeline && c.pipeline_id !== filterPipeline) return false;
    if (filterStatus && (c.status ?? "active") !== filterStatus) return false;
    return true;
  });

  const handleCampaignClick = (c: any) => {
    if (isPureEmployee) {
      // Direct jump to leads list for this campaign
      navigate(`/crm/leads?campaign_code=${c.id}`);
    } else {
      navigate(`/crm/campaigns/${c.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#7C9C59]" />
            <h1 className="font-heading text-2xl font-bold text-[#11291F]">
              {isPureEmployee ? "My Campaigns" : "Campaigns"}
            </h1>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-[#6B716C]">
            {isPureEmployee
              ? "Campaigns assigned to you for consultation and sales outreach."
              : "All sales campaigns across pipelines with authoritative lead distribution counts."}
          </p>
        </div>

        {/* View mode toggle (hidden on very small screens) */}
        <div className="hidden sm:flex items-center rounded-lg border border-[#D8DDD7] bg-white p-0.5 shadow-2xs">
          <button
            onClick={() => setViewMode("cards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === "cards" ? "bg-[#11291F] text-white" : "text-[#6B716C] hover:text-[#11291F]"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            Cards
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === "table" ? "bg-[#11291F] text-white" : "text-[#6B716C] hover:text-[#11291F]"
            }`}
          >
            <List className="size-3.5" />
            Table
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B716C]" />
          <Input
            className="pl-9 min-h-10 border-[#D8DDD7] focus:border-[#467065] focus:ring-[#467065]"
            placeholder="Search campaign name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!isPureEmployee && (
          <select
            value={filterPipeline}
            onChange={(e) => setFilterPipeline(e.target.value)}
            className="h-10 rounded-md border border-[#D8DDD7] bg-white px-3 text-sm min-w-[180px] text-[#2D2D2D] focus:border-[#467065] focus:outline-none"
          >
            <option value="">All Pipelines</option>
            {(pipelines ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-10 rounded-md border border-[#D8DDD7] bg-white px-3 text-sm text-[#2D2D2D] focus:border-[#467065] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-sm text-[#6B716C]">
          Loading campaigns…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#D8DDD7] bg-white">
          <Layers className="h-8 w-8 text-[#6B716C]/40" />
          <p className="text-sm text-[#6B716C]">
            {search || filterPipeline || filterStatus
              ? "No campaigns match your filters."
              : isPureEmployee
              ? "No campaigns are currently assigned to you."
              : "No campaigns yet. Create campaigns from within a pipeline."}
          </p>
          {!isPureEmployee && !search && !filterPipeline && !filterStatus && (
            <Button
              variant="outline"
              onClick={() => navigate("/crm/pipelines")}
              className="border-[#D8DDD7] text-[#11291F]"
            >
              Go to Pipelines →
            </Button>
          )}
        </div>
      ) : viewMode === "cards" ? (
        /* ── Compact Cards View (Inspired by Mobile Reference, Kotson Styled) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const assigned = c.assigned_leads ?? 0;
            const uncontacted = c.uncontacted_leads ?? 0;
            const inProgress = c.in_progress_leads ?? 0;
            const closed = c.closed_leads ?? 0;
            const unassigned = c.unassigned_leads ?? 0;

            return (
              <div
                key={c.id}
                onClick={() => handleCampaignClick(c)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E8EDE7] bg-white p-5 shadow-2xs hover:border-[#7C9C59] hover:shadow-md transition-all cursor-pointer"
              >
                {/* Card Top / Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#467065] truncate block">
                        {pipelineMap[c.pipeline_id] || "Sales Pipeline"}
                      </span>
                      <h3 className="font-heading text-base font-bold text-[#11291F] group-hover:text-[#467065] transition-colors truncate mt-0.5">
                        {c.name}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        STATUS_COLORS[c.status ?? "active"]
                      }`}
                    >
                      {c.status ?? "active"}
                    </span>
                  </div>

                  {c.description && (
                    <p className="text-xs text-[#6B716C] line-clamp-2 mt-2">
                      {c.description}
                    </p>
                  )}
                </div>

                {/* Card Metric Grid (Matches Reference Workflow in Kotson Design System) */}
                <div className="mt-5 rounded-xl border border-[#E8EDE7] bg-[#F7F4EE]/50 p-3">
                  <div className="grid grid-cols-2 gap-2 text-center divide-x divide-[#E8EDE7]">
                    <div className="pr-1">
                      <p className="text-[11px] font-medium text-[#6B716C]">Assigned</p>
                      <p className="font-heading text-lg font-extrabold text-[#11291F]">
                        {assigned}
                      </p>
                    </div>
                    <div className="pl-1">
                      <p className="text-[11px] font-medium text-[#6B716C]">Uncontacted</p>
                      <p className="font-heading text-lg font-extrabold text-amber-700">
                        {uncontacted}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-[#E8EDE7] grid grid-cols-2 gap-2 text-center divide-x divide-[#E8EDE7]">
                    <div className="pr-1">
                      <p className="text-[11px] font-medium text-[#6B716C]">In-Progress</p>
                      <p className="font-heading text-lg font-extrabold text-[#467065]">
                        {inProgress}
                      </p>
                    </div>
                    <div className="pl-1">
                      <p className="text-[11px] font-medium text-[#6B716C]">Closed</p>
                      <p className="font-heading text-lg font-extrabold text-[#7C9C59]">
                        {closed}
                      </p>
                    </div>
                  </div>

                  {!isPureEmployee && (
                    <div className="mt-2 pt-1.5 border-t border-[#E8EDE7] text-center">
                      <p className="text-[10px] text-[#6B716C]">
                        Un-Assigned: <strong className="text-[#11291F]">{unassigned}</strong>
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#467065] group-hover:text-[#11291F] transition-colors">
                  <span>{isPureEmployee ? "View Campaign Leads" : "Manage Campaign"}</span>
                  <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Denser Desktop Table View ── */
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 text-[10px] uppercase tracking-widest text-[#6B716C]">
            <span>Campaign</span>
            <span>Pipeline</span>
            <span>Status</span>
            <span className="text-center">Assigned</span>
            <span className="text-center">Uncontacted</span>
            <span className="text-center">In-Progress</span>
            <span className="text-center">Closed</span>
            <span></span>
          </div>

          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => handleCampaignClick(c)}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-center rounded-xl border border-[#E8EDE7] bg-white px-4 py-3 hover:border-[#7C9C59] cursor-pointer transition-colors shadow-2xs"
            >
              <div>
                <p className="text-sm font-semibold text-[#11291F] truncate">{c.name}</p>
                <p className="text-xs text-[#6B716C]">{c.lead_source?.replace(/_/g, " ") ?? "—"}</p>
              </div>
              <p className="text-xs text-[#6B716C] truncate">{pipelineMap[c.pipeline_id] ?? "—"}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${
                  STATUS_COLORS[c.status ?? "active"]
                }`}
              >
                {c.status ?? "active"}
              </span>
              <div className="text-center">
                <p className="text-sm font-bold text-[#11291F]">{c.assigned_leads ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-amber-700">{c.uncontacted_leads ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#467065]">{c.in_progress_leads ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#7C9C59]">{c.closed_leads ?? 0}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#6B716C]" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
