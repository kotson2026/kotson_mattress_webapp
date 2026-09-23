import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api";
import type { Claim } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Award,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  HelpCircle,
} from "lucide-react";

export default function ClaimsView() {
  const qc = useQueryClient();
  const { data: claims, isLoading } = useQuery<Claim[]>({
    queryKey: ["admin-claims"],
    queryFn: () => apiGet<Claim[]>("/admin/claims"),
  });

  const [editingProof, setEditingProof] = useState<Record<string, string>>({});

  const patchClaim = useMutation({
    mutationFn: (p: { key: string; body: Record<string, string> }) =>
      apiPatch(`/admin/claims/${p.key}`, p.body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-claims"] });
      qc.invalidateQueries({ queryKey: ["claims"] });
      toast.success(
        vars.body.status === "published"
          ? "Claim published on live website"
          : vars.body.status === "draft"
          ? "Claim moved to draft"
          : "Claim evidence updated"
      );
    },
    onError: (e) =>
      toast.error(
        e instanceof Error
          ? e.message
          : "Claims require verified approved evidence before they can be published."
      ),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
          <Award className="h-6 w-6 text-brand-deep" />
          Trust Claims & Evidence Compliance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Separated regulatory compliance manager. In accordance with Kotson policy, every organic or orthopedic claim must have approved third-party documentation before it is displayed on the storefront.
        </p>
      </div>

      {/* Compliance Rule Alert */}
      <div className="rounded-2xl border border-brand-deep/20 bg-brand-deep/5 p-4 text-sm text-brand-charcoal">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-brand-deep shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-brand-deep">Evidence Gated Publishing Rule</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Storefront visitors will see <span className="font-mono text-foreground font-semibold">“owner verification pending”</span> for any claim where evidence is not yet approved. Once you provide a verified audit certificate URL and click <strong>Approve Evidence</strong>, you can activate <strong>Publish</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Claims Grid */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {claims?.map((c) => {
            const currentProof = editingProof[c.key] ?? c.evidence_url ?? "";
            const isApproved = c.evidence_status === "approved";
            const isPublished = c.status === "published";

            return (
              <div
                key={c.key}
                className="rounded-2xl border border-border bg-card p-6 shadow-xs transition-all hover:border-brand-deep/30"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${isPublished ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-lg font-bold text-foreground">{c.label}</h3>
                      <p className="font-mono text-xs text-muted-foreground">Key: {c.key}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={isApproved ? "secondary" : "outline"}
                      className={`text-xs ${isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                    >
                      {isApproved ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Evidence Approved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Evidence Pending
                        </span>
                      )}
                    </Badge>

                    <Badge
                      variant={isPublished ? "default" : "outline"}
                      className={isPublished ? "bg-brand-deep text-white" : "text-muted-foreground"}
                    >
                      {isPublished ? "Live on Storefront" : "Draft / Hidden"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-center">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Evidence / Certification Audit Document URL</label>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        value={currentProof}
                        onChange={(e) => setEditingProof((prev) => ({ ...prev, [c.key]: e.target.value }))}
                        placeholder="https://gols-standards.org/certificate/… or drive/pdf link"
                        className="text-xs font-mono h-10"
                      />
                      {currentProof && (
                        <a
                          href={currentProof}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-xl border border-border bg-muted hover:bg-accent text-foreground"
                          title="Open Document Preview"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 pt-2 lg:pt-5">
                    {currentProof !== (c.evidence_url ?? "") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchClaim.mutate({ key: c.key, body: { evidence_url: currentProof } })}
                        disabled={patchClaim.isPending}
                        className="text-xs h-9"
                      >
                        Save Proof URL
                      </Button>
                    )}

                    {!isApproved ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          patchClaim.mutate({
                            key: c.key,
                            body: { evidence_url: currentProof, evidence_status: "approved" },
                          })
                        }
                        disabled={patchClaim.isPending || !currentProof}
                        className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Approve Evidence
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          patchClaim.mutate({
                            key: c.key,
                            body: { evidence_status: "pending" },
                          })
                        }
                        disabled={patchClaim.isPending}
                        className="text-xs h-9 text-amber-700 border-amber-200 hover:bg-amber-50"
                      >
                        Revoke Evidence Approval
                      </Button>
                    )}

                    {isPublished ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchClaim.mutate({ key: c.key, body: { status: "draft" } })}
                        disabled={patchClaim.isPending}
                        className="text-xs h-9 text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        Unpublish to Draft
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => patchClaim.mutate({ key: c.key, body: { status: "published" } })}
                        disabled={patchClaim.isPending || !isApproved}
                        className="text-xs h-9 bg-brand-deep text-white hover:bg-brand-deep/90"
                        title={!isApproved ? "Approve evidence first" : "Publish to live site"}
                      >
                        Publish Live
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
