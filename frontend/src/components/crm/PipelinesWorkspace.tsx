import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GitBranch,
  Layers,
  Plus,
  Users,
  Package,
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FolderPlus,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pipeline, Campaign } from "@/lib/crmTypes";

export default function PipelinesWorkspace() {
  const qc = useQueryClient();
  const [newPipelineModal, setNewPipelineModal] = useState(false);
  const [newCampaignModal, setNewCampaignModal] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineProduct, setPipelineProduct] = useState("Ortho Therapy Mattress");
  const [campaignName, setCampaignName] = useState("");
  const [campaignCode, setCampaignCode] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");

  const { data: pipelines, isLoading } = useQuery<Pipeline[]>({
    queryKey: ["crm-pipelines-all"],
    queryFn: () => apiGet<Pipeline[]>("/crm/dispositions/pipelines"),
  });

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ["crm-campaigns-all"],
    queryFn: () => apiGet<Campaign[]>("/crm/dispositions/campaigns"),
  });

  const createPipeline = useMutation({
    mutationFn: () =>
      apiPost("/crm/dispositions/pipelines", {
        name: pipelineName,
        code: pipelineName.toLowerCase().replace(/\s+/g, "_"),
        kind: "sales",
        stages: [
          { code: "new", label: "New Lead", sort: 10, is_won: false, is_lost: false },
          { code: "contacted", label: "Contacted", sort: 20, is_won: false, is_lost: false },
          { code: "interested", label: "Interested", sort: 30, is_won: false, is_lost: false },
          { code: "follow_up", label: "Follow-up", sort: 40, is_won: false, is_lost: false },
          { code: "order_initiated", label: "Order Initiated", sort: 50, is_won: false, is_lost: false },
          { code: "converted", label: "Converted", sort: 60, is_won: true, is_lost: false },
          { code: "lost", label: "Lost", sort: 70, is_won: false, is_lost: true },
        ],
      }),
    onSuccess: () => {
      toast.success("Pipeline created successfully with default stage sequence");
      setNewPipelineModal(false);
      setPipelineName("");
      qc.invalidateQueries({ queryKey: ["crm-pipelines-all"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create pipeline"),
  });

  const createCampaign = useMutation({
    mutationFn: () =>
      apiPost("/crm/dispositions/campaigns", {
        name: campaignName,
        code: campaignCode.toUpperCase() || `CMP-${Date.now().toString().slice(-4)}`,
        pipeline_id: selectedPipelineId || (pipelines && pipelines[0]?.id) || null,
        source_kind: "website_inquiry",
      }),
    onSuccess: () => {
      toast.success("Campaign created and linked to pipeline");
      setNewCampaignModal(false);
      setCampaignName("");
      setCampaignCode("");
      qc.invalidateQueries({ queryKey: ["crm-campaigns-all"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to create campaign"),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading Pipelines & Campaign Workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[#7C9C59]" />
            <h2 className="font-heading text-xl font-bold">Pipelines & Campaigns</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organized around Kotson mattress families · Authoritative stage definitions and campaign scopes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setNewCampaignModal(true)}
            className="h-8 gap-1.5 text-xs border-[#7C9C59]/40 text-[#467065] hover:bg-[#7C9C59]/10"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Campaign
          </Button>
          <Button
            size="sm"
            onClick={() => setNewPipelineModal(true)}
            className="h-8 gap-1.5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Pipeline
          </Button>
        </div>
      </div>

      {/* Pipelines List */}
      <div className="grid gap-6">
        {pipelines && pipelines.length > 0 ? (
          pipelines.map((pipe) => {
            const pipeCampaigns = campaigns?.filter((c) => c.pipeline_id === pipe.id) || [];
            return (
              <div key={pipe.id} className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C9C59]/15 text-[#467065]">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-lg font-bold">{pipe.name}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {pipe.code}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Kind: <span className="uppercase font-semibold">{pipe.kind}</span> · {pipe.stages.length} Stages Defined
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#7C9C59]/20 text-[#467065] border-none font-semibold">
                      {pipeCampaigns.length} Active Campaigns
                    </Badge>
                  </div>
                </div>

                {/* Stage Steps Visualizer */}
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Stage Pipeline Flow:
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {pipe.stages.map((st, i) => (
                      <div key={st.code} className="flex items-center gap-1.5">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium border ${
                            st.is_won
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : st.is_lost
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : "bg-muted/40 text-foreground border-border"
                          }`}
                        >
                          {st.label}
                        </span>
                        {i < pipe.stages.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Associated Campaigns */}
                {pipeCampaigns.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Associated Campaigns:
                    </span>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {pipeCampaigns.map((c) => (
                        <div key={c.id} className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">{c.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {c.code}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Source: {c.source_kind}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No pipelines configured yet. Click "Create Pipeline" to initialize.
          </div>
        )}
      </div>

      {/* New Pipeline Modal */}
      {newPipelineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-lg font-bold">Create Product Pipeline</h3>
            <p className="text-xs text-muted-foreground">
              Define a sales funnel mapped to Kotson Mattress product offerings.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Pipeline Name</Label>
                <Input
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder="e.g. Ortho Therapy Sales"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Target Mattress Line</Label>
                <Select value={pipelineProduct} onValueChange={setPipelineProduct}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ortho Therapy Mattress">Ortho Therapy Mattress</SelectItem>
                    <SelectItem value="Posture Luxe Spring">Posture Luxe Pocket Spring</SelectItem>
                    <SelectItem value="Natural Latex Hybrid">Natural Latex Hybrid</SelectItem>
                    <SelectItem value="Memory Relief">Memory Relief Ergonomic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setNewPipelineModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!pipelineName.trim() || createPipeline.isPending}
                onClick={() => createPipeline.mutate()}
                className="bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
              >
                {createPipeline.isPending ? "Creating..." : "Save Pipeline"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Campaign Modal */}
      {newCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-heading text-lg font-bold">New Campaign</h3>
            <p className="text-xs text-muted-foreground">
              Launch a marketing/sales campaign attached to an authoritative pipeline.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Campaign Name</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Bengaluru Monsoon Sleep Promo"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Campaign Code (Unique ID)</Label>
                <Input
                  value={campaignCode}
                  onChange={(e) => setCampaignCode(e.target.value)}
                  placeholder="e.g. MONSOON2026"
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Attach to Pipeline</Label>
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select Pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setNewCampaignModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!campaignName.trim() || createCampaign.isPending}
                onClick={() => createCampaign.mutate()}
                className="bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold"
              >
                {createCampaign.isPending ? "Creating..." : "Save Campaign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
