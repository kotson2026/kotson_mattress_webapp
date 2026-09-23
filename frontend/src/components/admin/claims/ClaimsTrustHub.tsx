import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  FileCheck,
  Clock,
  Sparkles,
  X,
  Search,
  Filter,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClaimsTrustHub() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"certs" | "claims">("certs");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals state
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<any>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [editingClaim, setEditingClaim] = useState<any>(null);

  // Queries
  const { data: overview } = useQuery({
    queryKey: ["claims-trust-overview"],
    queryFn: () => apiGet<any>("/admin/claims-trust/overview"),
  });

  const { data: certs = [], isLoading: certsLoading } = useQuery({
    queryKey: ["admin-certifications", statusFilter, q],
    queryFn: () =>
      apiGet<any[]>(
        `/admin/claims-trust/certifications?status=${statusFilter}&q=${encodeURIComponent(q)}`
      ),
    enabled: activeTab === "certs",
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ["admin-claims-list", statusFilter, q],
    queryFn: () =>
      apiGet<any[]>(
        `/admin/claims-trust/claims?status=${statusFilter}&q=${encodeURIComponent(q)}`
      ),
    enabled: activeTab === "claims",
  });

  // Mutations
  const deleteCert = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/claims-trust/certifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certifications"] });
      qc.invalidateQueries({ queryKey: ["claims-trust-overview"] });
      toast.success("Certification deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete certification"),
  });

  const deleteClaim = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/claims-trust/claims/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-claims-list"] });
      qc.invalidateQueries({ queryKey: ["claims-trust-overview"] });
      toast.success("Claim deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete claim"),
  });

  const toggleClaimStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiPost(`/admin/claims-trust/claims/${id}/verify?status=${status}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-claims-list"] });
      qc.invalidateQueries({ queryKey: ["claims-trust-overview"] });
      toast.success("Claim status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update claim"),
  });

  return (
    <div className="space-y-6" data-testid="claims-trust-hub">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Claims & Trust Verification</h1>
          <p className="text-sm text-muted-foreground">
            Manage ISO, CertiPUR-US, and OEKO-TEX certifications alongside verified laboratory product claims.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "certs" ? (
            <Button
              onClick={() => {
                setEditingCert(null);
                setIsCertModalOpen(true);
              }}
              className="bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Certification
            </Button>
          ) : (
            <Button
              onClick={() => {
                setEditingClaim(null);
                setIsClaimModalOpen(true);
              }}
              className="bg-primary text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Tested Claim
            </Button>
          )}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Certs</span>
            <Award className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_certifications ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Official credentials</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verified Certs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.verified_certifications ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Live trust badges</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Renewal Due</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{overview?.pending_certifications ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Pending lab renewal</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Product Claims</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_claims ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Evidence statements</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verified Claims</span>
            <FileCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.verified_claims ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Backing live claims</div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-border bg-card rounded-t-xl px-4 pt-2">
        <button
          onClick={() => {
            setActiveTab("certs");
            setStatusFilter("ALL");
          }}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "certs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Award className="w-4 h-4" />
          Official Certifications ({overview?.total_certifications ?? 0})
        </button>

        <button
          onClick={() => {
            setActiveTab("claims");
            setStatusFilter("ALL");
          }}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "claims"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Tested Product Claims ({overview?.total_claims ?? 0})
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              activeTab === "certs"
                ? "Search by certificate title, issuer or cert #…"
                : "Search by claim statement or proof criteria…"
            }
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground font-semibold">Filter Status:</Label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs font-medium"
          >
            <option value="ALL">All Statuses</option>
            {activeTab === "certs" ? (
              <>
                <option value="VERIFIED">Verified</option>
                <option value="PENDING_RENEWAL">Pending Renewal</option>
                <option value="EXPIRED">Expired</option>
                <option value="DRAFT">Draft</option>
              </>
            ) : (
              <>
                <option value="VERIFIED">Verified</option>
                <option value="DRAFT">Draft</option>
                <option value="EXPIRED">Expired</option>
                <option value="HIDDEN">Hidden</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === "certs" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16">Badge</TableHead>
                <TableHead>Certification Title & Issuer</TableHead>
                <TableHead>Cert Number</TableHead>
                <TableHead>Validity Period</TableHead>
                <TableHead>Products Covered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading certifications…
                  </TableCell>
                </TableRow>
              ) : certs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No certifications registered.
                  </TableCell>
                </TableRow>
              ) : (
                certs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
                        {c.badge_image_url ? (
                          <img src={c.badge_image_url} alt={c.title} className="w-full h-full object-contain p-1" />
                        ) : (
                          <Award className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.issuer}</div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono font-medium">{c.cert_number}</code>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>From: {c.issue_date || "—"}</div>
                      <div className="text-muted-foreground">Exp: {c.expiry_date || "Continuous"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {c.applicable_products?.join(", ") || "ALL"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${
                          c.status === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.status === "PENDING_RENEWAL"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.verification_url && (
                          <a
                            href={c.verification_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-muted-foreground hover:text-primary transition-colors"
                            title="Verify externally"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          onClick={() => {
                            setEditingCert(c);
                            setIsCertModalOpen(true);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm(`Delete certification "${c.title}"?`)) {
                              deleteCert.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Claim Statement</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Measurable Proof / Lab Result</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Verification & Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claimsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Loading claims…
                  </TableCell>
                </TableRow>
              ) : claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No claims registered.
                  </TableCell>
                </TableRow>
              ) : (
                claims.map((cl) => (
                  <TableRow key={cl.id}>
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{cl.title}</div>
                      <div className="text-xs text-muted-foreground">Display Order: #{cl.display_order}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {cl.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-xs text-muted-foreground leading-relaxed">{cl.metric_proof}</p>
                      {cl.evidence_doc_url && (
                        <a
                          href={cl.evidence_doc_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                        >
                          View Clinical Report <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${
                          cl.verification_status === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : cl.verification_status === "DRAFT"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {cl.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-semibold"
                          onClick={() =>
                            toggleClaimStatus.mutate({
                              id: cl.id,
                              status: cl.verification_status === "VERIFIED" ? "DRAFT" : "VERIFIED",
                            })
                          }
                        >
                          {cl.verification_status === "VERIFIED" ? "Set Draft" : "Verify Live"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary"
                          onClick={() => {
                            setEditingClaim(cl);
                            setIsClaimModalOpen(true);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                          onClick={() => {
                            if (confirm(`Delete claim "${cl.title}"?`)) {
                              deleteClaim.mutate(cl.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Certification Modal */}
      {isCertModalOpen && (
        <CertificationModal
          cert={editingCert}
          onClose={() => setIsCertModalOpen(false)}
          onSuccess={() => {
            setIsCertModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-certifications"] });
            qc.invalidateQueries({ queryKey: ["claims-trust-overview"] });
          }}
        />
      )}

      {/* Claim Modal */}
      {isClaimModalOpen && (
        <ClaimModal
          claim={editingClaim}
          onClose={() => setIsClaimModalOpen(false)}
          onSuccess={() => {
            setIsClaimModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-claims-list"] });
            qc.invalidateQueries({ queryKey: ["claims-trust-overview"] });
          }}
        />
      )}
    </div>
  );
}

function CertificationModal({ cert, onClose, onSuccess }: { cert: any; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: cert?.title || "",
    issuer: cert?.issuer || "",
    cert_number: cert?.cert_number || "",
    issue_date: cert?.issue_date || "",
    expiry_date: cert?.expiry_date || "",
    verification_url: cert?.verification_url || "",
    badge_image_url: cert?.badge_image_url || "",
    status: cert?.status || "VERIFIED",
  });

  const saveCert = useMutation({
    mutationFn: () => {
      if (cert) {
        return apiPut(`/admin/claims-trust/certifications/${cert.id}`, formData);
      }
      return apiPost("/admin/claims-trust/certifications", formData);
    },
    onSuccess: () => {
      toast.success(cert ? "Certification updated" : "Certification added");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save certification"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-heading text-lg font-bold">
            {cert ? "Edit Certification" : "Add New Official Certification"}
          </h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Certification Name *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. ISO 9001:2015 Quality Management"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Issuing Authority / Testing Body *</Label>
            <Input
              value={formData.issuer}
              onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
              placeholder="e.g. CertiPUR-US Testing Laboratories"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Certificate / License # *</Label>
              <Input
                value={formData.cert_number}
                onChange={(e) => setFormData({ ...formData, cert_number: e.target.value })}
                placeholder="CPUS-2026-KT98"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="VERIFIED">Verified & Active</option>
                <option value="PENDING_RENEWAL">Pending Renewal</option>
                <option value="EXPIRED">Expired</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue Date</Label>
              <Input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>External Verification URL (Public Authority Link)</Label>
            <Input
              value={formData.verification_url}
              onChange={(e) => setFormData({ ...formData, verification_url: e.target.value })}
              placeholder="https://certipur.us/verify/..."
              className="mt-1"
            />
          </div>

          <div>
            <Label>Badge Image / Seal URL</Label>
            <Input
              value={formData.badge_image_url}
              onChange={(e) => setFormData({ ...formData, badge_image_url: e.target.value })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveCert.mutate()} disabled={saveCert.isPending || !formData.title || !formData.issuer}>
            {saveCert.isPending ? "Saving…" : "Save Certification"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClaimModal({ claim, onClose, onSuccess }: { claim: any; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: claim?.title || "",
    category: claim?.category || "Ergonomics",
    metric_proof: claim?.metric_proof || "",
    evidence_doc_url: claim?.evidence_doc_url || "",
    verification_status: claim?.verification_status || "VERIFIED",
  });

  const saveClaim = useMutation({
    mutationFn: () => {
      if (claim) {
        return apiPut(`/admin/claims-trust/claims/${claim.id}`, formData);
      }
      return apiPost("/admin/claims-trust/claims", formData);
    },
    onSuccess: () => {
      toast.success(claim ? "Claim updated" : "Claim registered");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save claim"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-heading text-lg font-bold">
            {claim ? "Edit Tested Claim" : "Add Tested Product Claim"}
          </h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Claim Headline *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Zero Motion Partner Isolation 99.4%"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="Ergonomics">Ergonomics & Posture</option>
                <option value="Durability">Durability & Sag-Proof</option>
                <option value="Materials">Materials & Purity</option>
                <option value="Trial & Warranty">Trial & Guarantee</option>
                <option value="Safety">Non-Toxic & Safety</option>
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={formData.verification_status}
                onChange={(e) => setFormData({ ...formData, verification_status: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="VERIFIED">Verified (Live)</option>
                <option value="DRAFT">Draft (Under Review)</option>
                <option value="EXPIRED">Expired</option>
                <option value="HIDDEN">Hidden</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Measurable Proof & Laboratory Sensor Data *</Label>
            <Textarea
              value={formData.metric_proof}
              onChange={(e) => setFormData({ ...formData, metric_proof: e.target.value })}
              placeholder="Specify sample size, machine testing cycles, and measured percentage change…"
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Clinical Report / PDF Document URL</Label>
            <Input
              value={formData.evidence_doc_url}
              onChange={(e) => setFormData({ ...formData, evidence_doc_url: e.target.value })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => saveClaim.mutate()} disabled={saveClaim.isPending || !formData.title}>
            {saveClaim.isPending ? "Saving…" : "Save Claim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
