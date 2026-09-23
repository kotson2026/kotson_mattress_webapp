import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { AssetSlot, AuditEntry, Claim, CMSBlock, Dashboard, Dealer, DealerOrder, Order, Product, ReferralRule, RewardEntry, SiteSettings, User } from "@/lib/types";
import { fmtDateTime, inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import { AnnouncementEditor, HeroVideoEditor } from "@/components/admin/SiteMediaEditors";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import OwnerDashboard from "@/components/admin/OwnerDashboard";
import OrdersCentralHub from "@/components/admin/OrdersCentralHub";
import SalesRevenueDashboard from "@/components/admin/SalesRevenueDashboard";
import AuditLogView from "@/components/admin/AuditLogView";
import WebsiteEditStudio from "@/components/admin/WebsiteEditStudio";
import ClaimsView from "@/components/admin/ClaimsView";
import TestDataManager from "@/components/admin/TestDataManager";
import DispatchReturnsHub from "@/components/admin/DispatchReturnsHub";
import CatalogCentralHub from "@/components/admin/catalog/CatalogCentralHub";
import ClaimsTrustHub from "@/components/admin/claims/ClaimsTrustHub";
import AssetLibraryHub from "@/components/admin/assets/AssetLibraryHub";
import ReferEarnHub from "@/components/admin/referrals/ReferEarnHub";
import DealerManagementHub from "@/components/admin/dealers/DealerManagementHub";
import StaffAccessHub from "@/components/admin/staff/StaffAccessHub";
import DataTablePagination from "@/components/ui/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/sales", label: "Sales & Revenue" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/dispatch", label: "Dispatch & Returns" },
  { to: "/admin/catalog", label: "Catalog" },
  { to: "/admin/website-edit", label: "Website Edit" },
  { to: "/admin/claims", label: "Claims & Trust" },
  { to: "/admin/assets", label: "Assets" },
  { to: "/admin/referrals", label: "Refer & Earn" },
  { to: "/admin/dealers", label: "Dealers" },
  { to: "/admin/staff", label: "Staff" },
  { to: "/admin/audit", label: "Audit Log" },
  { to: "/admin/settings", label: "Settings" },
];

function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6" data-testid={testId}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CatalogView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: () => apiGet<Product[]>("/admin/products") });
  const [adjust, setAdjust] = useState<{ variant_id: string; delta: string; reason: string }>({ variant_id: "", delta: "", reason: "" });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/products/${id}/deactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Product deactivated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not deactivate"),
  });

  const adjustStock = useMutation({
    mutationFn: () => apiPost("/admin/inventory/adjust", { variant_id: adjust.variant_id, delta: Number(adjust.delta), reason: adjust.reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setAdjust({ variant_id: "", delta: "", reason: "" });
      toast.success("Inventory adjusted and logged");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Adjustment rejected"),
  });

  const filtered = (products ?? []).filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.category_slug.toLowerCase().includes(q.toLowerCase()) ||
      p.slug.toLowerCase().includes(q.toLowerCase())
  );
  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Filter catalog by product name, slug or category…"
          className="max-w-sm min-h-11 border-border/80 bg-background"
          data-testid="admin-catalog-search"
        />
        <div className="text-xs font-medium text-muted-foreground">
          Showing {paginated.length} of {total} products
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No products match the filter.
        </p>
      ) : (
        paginated.map((p) => (
          <Panel key={p.id} title={`${p.name}${p.is_active ? "" : " (inactive)"}`} testId={`admin-product-${p.slug}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-brand-forest/20 text-brand-forest font-semibold">{p.category_slug}</Badge>
              {p.is_seed && <Badge variant="secondary">seed data</Badge>}
              <Button variant="ghost" size="xs" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => deactivate.mutate(p.id)} data-testid={`admin-product-deactivate-${p.slug}`}>
                Deactivate
              </Button>
            </div>
            <Table className="mt-3">
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Variant</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reserved</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {p.variants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                    <TableCell className="text-xs">{[v.size, v.thickness, v.firmness].filter(Boolean).join(" · ")}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(v.price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.stock}</TableCell>
                    <TableCell className="text-right tabular-nums">{v.reserved}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="xs" className="hover:border-brand-forest hover:text-brand-forest" onClick={() => setAdjust((a) => ({ ...a, variant_id: v.id }))} data-testid={`admin-variant-select-${v.sku}`}>
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        ))
      )}

      {total > 0 && (
        <div className="rounded-2xl border border-border bg-card p-2 shadow-xs">
          <DataTablePagination
            totalItems={total}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>
      )}

      <Panel title="Inventory adjustment (audited)" testId="admin-inventory-adjust">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto]">
          <div><Label>Variant id</Label><Input value={adjust.variant_id} onChange={(e) => setAdjust((a) => ({ ...a, variant_id: e.target.value }))} className="mt-1.5 min-h-11" data-testid="adjust-variant-input" /></div>
          <div><Label>Delta</Label><Input value={adjust.delta} onChange={(e) => setAdjust((a) => ({ ...a, delta: e.target.value }))} inputMode="numeric" placeholder="+5" className="mt-1.5 min-h-11" data-testid="adjust-delta-input" /></div>
          <div><Label>Reason</Label><Input value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} className="mt-1.5 min-h-11" data-testid="adjust-reason-input" /></div>
          <Button className="self-end min-h-11 bg-brand-forest hover:bg-brand-forest/90 text-white font-medium" onClick={() => adjustStock.mutate()} disabled={!adjust.variant_id || !adjust.delta || adjust.reason.length < 3} data-testid="adjust-submit-button">
            Apply
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Records old/new value, actor, time and reason. Active reservations are never bypassed.</p>
      </Panel>
    </div>
  );
}

function CMSView() {
  const qc = useQueryClient();
  const { data: blocks } = useQuery({ queryKey: ["admin-cms"], queryFn: () => apiGet<CMSBlock[]>("/admin/cms/blocks") });
  const { data: claims } = useQuery({ queryKey: ["admin-claims"], queryFn: () => apiGet<Claim[]>("/admin/claims") });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (p: { key: string; value: string }) => apiPut(`/admin/cms/blocks/${p.key}`, { value: p.value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms"] }); toast.success("Draft saved"); },
  });
  const publish = useMutation({
    mutationFn: (key: string) => apiPost(`/admin/cms/blocks/${key}/publish`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms"] }); qc.invalidateQueries({ queryKey: ["blocks"] }); toast.success("Published"); },
  });
  const rollback = useMutation({
    mutationFn: (p: { key: string; index: number }) => apiPost(`/admin/cms/blocks/${p.key}/rollback?revision_index=${p.index}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-cms"] }); qc.invalidateQueries({ queryKey: ["blocks"] }); toast.success("Rolled back"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No revision to roll back to"),
  });
  const patchClaim = useMutation({
    mutationFn: (p: { key: string; body: Record<string, string> }) => apiPatch(`/admin/claims/${p.key}`, p.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-claims"] }); qc.invalidateQueries({ queryKey: ["claims"] }); toast.success("Claim updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Claims need approved evidence before publishing"),
  });

  return (
    <div className="grid gap-6">
      <HeroVideoEditor />
      <AnnouncementEditor />
      <Panel title="Trust claims — evidence gated" testId="admin-claims-panel">
        <p className="mb-4 text-xs text-muted-foreground">
          A claim can only be published after its evidence is marked approved. Unpublished claims render on the storefront as
          “owner verification pending”.
        </p>
        <div className="grid gap-3">
          {(claims ?? []).map((c) => (
            <div key={c.key} className="rounded-xl border border-border p-4" data-testid={`admin-claim-${c.key}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{c.label}</p>
                <Badge variant={c.status === "published" ? "default" : "outline"}>{c.status}</Badge>
                <Badge variant={c.evidence_status === "approved" ? "secondary" : "outline"}>evidence: {c.evidence_status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Input
                  defaultValue={c.evidence_url}
                  placeholder="Proof URL"
                  className="max-w-xs min-h-11"
                  onBlur={(e) => e.target.value !== c.evidence_url && patchClaim.mutate({ key: c.key, body: { evidence_url: e.target.value } })}
                  data-testid={`admin-claim-${c.key}-evidence-input`}
                />
                <Button variant="outline" size="sm" onClick={() => patchClaim.mutate({ key: c.key, body: { evidence_status: "approved" } })} data-testid={`admin-claim-${c.key}-approve`}>
                  Approve evidence
                </Button>
                <Button size="sm" onClick={() => patchClaim.mutate({ key: c.key, body: { status: "published" } })} data-testid={`admin-claim-${c.key}-publish`}>
                  Publish
                </Button>
                <Button variant="ghost" size="sm" onClick={() => patchClaim.mutate({ key: c.key, body: { status: "draft" } })} data-testid={`admin-claim-${c.key}-unpublish`}>
                  Unpublish
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Content blocks — draft / publish / rollback" testId="admin-cms-blocks">
        <div className="grid gap-4">
          {(blocks ?? []).map((b) => (
            <div key={b.key} className="rounded-xl border border-border p-4" data-testid={`admin-block-${b.key}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-xs">{b.key}</p>
                <Badge variant="outline">{b.page}</Badge>
                <Badge variant={b.status === "published" ? "default" : "outline"}>{b.status}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{b.revisions.length} revision(s)</span>
              </div>
              <Textarea
                className="mt-3 font-mono text-xs"
                rows={b.type === "json" ? 4 : 2}
                value={drafts[b.key] ?? b.value}
                onChange={(e) => setDrafts((d) => ({ ...d, [b.key]: e.target.value }))}
                data-testid={`admin-block-${b.key}-input`}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => save.mutate({ key: b.key, value: drafts[b.key] ?? b.value })} data-testid={`admin-block-${b.key}-save`}>
                  Save draft
                </Button>
                <Button size="sm" onClick={() => publish.mutate(b.key)} data-testid={`admin-block-${b.key}-publish`}>
                  Publish
                </Button>
                {b.revisions.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => rollback.mutate({ key: b.key, index: b.revisions.length - 1 })} data-testid={`admin-block-${b.key}-rollback`}>
                    Roll back
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AssetsView() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data: assets } = useQuery({ queryKey: ["admin-assets"], queryFn: () => apiGet<AssetSlot[]>("/admin/assets") });
  const patch = useMutation({
    mutationFn: (p: { slot: string; body: Record<string, string> }) => apiPatch(`/admin/assets/${p.slot}`, p.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-assets"] }); toast.success("Asset slot updated"); },
  });

  const total = assets?.length ?? 0;
  const paginated = (assets ?? []).slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="grid gap-6">
      <Panel title="Asset registry" testId="admin-assets-panel">
        <p className="mb-4 text-xs text-muted-foreground">
          Every named slot exists with a labelled placeholder. Paste a URL and publish to go live; placeholders keep identical aspect ratios
          so layouts never shift. No logo has been fabricated — upload the official files into the logo slots.
        </p>
        <Table>
          <TableHeader><TableRow><TableHead>Slot</TableHead><TableHead>Section</TableHead><TableHead>File URL</TableHead><TableHead>Alt text</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {paginated.map((a) => (
              <TableRow key={a.slot} data-testid={`admin-asset-${a.slot}`}>
                <TableCell className="font-mono text-xs">{a.slot}</TableCell>
                <TableCell className="text-xs">{a.section}</TableCell>
                <TableCell>
                  <Input defaultValue={a.file_url} placeholder="https://…" className="min-h-11 min-w-48" onBlur={(e) => e.target.value !== a.file_url && patch.mutate({ slot: a.slot, body: { file_url: e.target.value } })} data-testid={`admin-asset-${a.slot}-url`} />
                </TableCell>
                <TableCell>
                  <Input defaultValue={a.alt_text} placeholder="Alt text" className="min-h-11 min-w-40" onBlur={(e) => e.target.value !== a.alt_text && patch.mutate({ slot: a.slot, body: { alt_text: e.target.value } })} data-testid={`admin-asset-${a.slot}-alt`} />
                </TableCell>
                <TableCell><Badge variant={a.status === "published" ? "default" : "outline"}>{a.status}</Badge></TableCell>
                <TableCell>
                  <Button variant="outline" size="xs" onClick={() => patch.mutate({ slot: a.slot, body: { status: a.status === "published" ? "placeholder" : "published" } })} data-testid={`admin-asset-${a.slot}-toggle`}>
                    {a.status === "published" ? "Revert" : "Publish"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {total > 0 && (
          <div className="mt-4 border-t border-border pt-2">
            <DataTablePagination
              totalItems={total}
              currentPage={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReferralsView() {
  const qc = useQueryClient();
  const [rulePage, setRulePage] = useState(1);
  const [rulePageSize, setRulePageSize] = useState(10);
  const [rewardPage, setRewardPage] = useState(1);
  const [rewardPageSize, setRewardPageSize] = useState(10);
  const { data: rules } = useQuery({ queryKey: ["admin-rules"], queryFn: () => apiGet<ReferralRule[]>("/admin/referral-rules") });
  const { data: rewards } = useQuery({ queryKey: ["admin-rewards"], queryFn: () => apiGet<RewardEntry[]>("/admin/rewards") });
  const [form, setForm] = useState({ name: "", reward_type: "referee_discount", value_type: "percent", value: "5", min_spend_paise: "0", first_order_only: true });

  const create = useMutation({
    mutationFn: () => apiPost("/admin/referral-rules", { ...form, value: Number(form.value), min_spend_paise: Number(form.min_spend_paise) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rules"] }); toast.success("Rule created as draft"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create rule"),
  });
  const patchRule = useMutation({
    mutationFn: (p: { id: string; status: string }) => apiPatch(`/admin/referral-rules/${p.id}`, { status: p.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rules"] }); toast.success("Rule updated"); },
  });
  const patchReward = useMutation({
    mutationFn: (p: { id: string; status: string }) => apiPatch(`/admin/rewards/${p.id}`, { status: p.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rewards"] }); toast.success("Reward updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update reward"),
  });

  const totalRules = rules?.length ?? 0;
  const paginatedRules = (rules ?? []).slice((rulePage - 1) * rulePageSize, rulePage * rulePageSize);

  const totalRewards = rewards?.length ?? 0;
  const paginatedRewards = (rewards ?? []).slice((rewardPage - 1) * rewardPageSize, rewardPage * rewardPageSize);

  return (
    <div className="grid gap-6">
      <Panel title="Referral rule engine" testId="admin-rules-panel">
        <p className="mb-4 text-xs text-muted-foreground">
          Safe default is zero: until a rule is <strong>published</strong>, referral codes record attribution only and grant no discount or
          commission. Only referral-linked discounts exist in v1 — general coupons are a later phase.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div><Label>Rule name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 min-h-11" data-testid="rule-name-input" /></div>
          <div><Label>Value (% or paise)</Label><Input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} inputMode="numeric" className="mt-1.5 min-h-11" data-testid="rule-value-input" /></div>
          <div><Label>Min spend (paise)</Label><Input value={form.min_spend_paise} onChange={(e) => setForm((f) => ({ ...f, min_spend_paise: e.target.value }))} inputMode="numeric" className="mt-1.5 min-h-11" data-testid="rule-minspend-input" /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["referee_discount", "referrer_reward"] as const).map((t) => (
            <Button key={t} variant={form.reward_type === t ? "default" : "outline"} size="sm" onClick={() => setForm((f) => ({ ...f, reward_type: t }))} data-testid={`rule-type-${t}`}>
              {t.replace("_", " ")}
            </Button>
          ))}
          {(["percent", "fixed"] as const).map((t) => (
            <Button key={t} variant={form.value_type === t ? "default" : "outline"} size="sm" onClick={() => setForm((f) => ({ ...f, value_type: t }))} data-testid={`rule-valuetype-${t}`}>
              {t}
            </Button>
          ))}
          <Button className="min-h-11 bg-brand-forest hover:bg-brand-forest/90 text-white font-medium" onClick={() => create.mutate()} disabled={form.name.length < 2} data-testid="rule-create-button">Create draft rule</Button>
        </div>

        <Table className="mt-6">
          <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {totalRules === 0 && <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No rules — referral value is zero.</TableCell></TableRow>}
            {paginatedRules.map((r) => (
              <TableRow key={r.id} data-testid={`admin-rule-${r.id}`}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-xs">{r.reward_type.replace("_", " ")}</TableCell>
                <TableCell className="text-xs">{r.value_type === "percent" ? `${r.value}%` : inr(r.value)}{r.first_order_only ? " · first order" : ""}</TableCell>
                <TableCell><Badge variant={r.status === "published" ? "default" : "outline"}>{r.status}</Badge></TableCell>
                <TableCell>
                  <Button variant="outline" size="xs" onClick={() => patchRule.mutate({ id: r.id, status: r.status === "published" ? "draft" : "published" })} data-testid={`admin-rule-${r.id}-toggle`}>
                    {r.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalRules > 0 && (
          <div className="mt-4 border-t border-border pt-2">
            <DataTablePagination
              totalItems={totalRules}
              currentPage={rulePage}
              pageSize={rulePageSize}
              onPageChange={setRulePage}
              onPageSizeChange={setRulePageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </Panel>

      <Panel title="Reward ledger (append-only)" testId="admin-rewards-panel">
        {totalRewards === 0 ? (
          <p className="text-sm text-muted-foreground">No accruals yet. Commission accrues only on server-verified paid orders.</p>
        ) : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Code</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {paginatedRewards.map((r) => (
                  <TableRow key={r.id} data-testid={`admin-reward-${r.id}`}>
                    <TableCell>{r.order_number}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(r.amount)}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={() => patchReward.mutate({ id: r.id, status: "approved" })}>approve</Button>
                        <Button variant="ghost" size="xs" onClick={() => patchReward.mutate({ id: r.id, status: "paid" })}>mark paid</Button>
                        <Button variant="ghost" size="xs" onClick={() => patchReward.mutate({ id: r.id, status: "reversed" })}>reverse</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 border-t border-border pt-2">
              <DataTablePagination
                totalItems={totalRewards}
                currentPage={rewardPage}
                pageSize={rewardPageSize}
                onPageChange={setRewardPage}
                onPageSizeChange={setRewardPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          “Mark paid” records a manual bank transfer confirmation only — no payout provider is integrated, and no transfer is ever simulated.
        </p>
      </Panel>
    </div>
  );
}

function DealersView() {
  const qc = useQueryClient();
  const [dealerPage, setDealerPage] = useState(1);
  const [dealerPageSize, setDealerPageSize] = useState(10);
  const [quotePage, setQuotePage] = useState(1);
  const [quotePageSize, setQuotePageSize] = useState(10);
  const { data: dealers } = useQuery({ queryKey: ["admin-dealers"], queryFn: () => apiGet<Dealer[]>("/admin/dealers") });
  const { data: dOrders } = useQuery({ queryKey: ["admin-dealer-orders"], queryFn: () => apiGet<DealerOrder[]>("/admin/dealer-orders") });

  const patch = useMutation({
    mutationFn: (p: { id: string; body: Record<string, string> }) => apiPatch(`/admin/dealers/${p.id}`, p.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-dealers"] }); toast.success("Dealer updated"); },
  });
  const patchOrder = useMutation({
    mutationFn: (p: { id: string; status: string }) => apiPatch(`/admin/dealer-orders/${p.id}`, { status: p.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-dealer-orders"] }); toast.success("Dealer order updated"); },
  });

  const totalDealers = dealers?.length ?? 0;
  const paginatedDealers = (dealers ?? []).slice((dealerPage - 1) * dealerPageSize, dealerPage * dealerPageSize);

  const totalQuotes = dOrders?.length ?? 0;
  const paginatedQuotes = (dOrders ?? []).slice((quotePage - 1) * quotePageSize, quotePage * quotePageSize);

  return (
    <div className="grid gap-6">
      <Panel title="Dealer applications" testId="admin-dealers-panel">
        {totalDealers === 0 ? (
          <p className="text-sm text-muted-foreground">No dealer applications yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Organisation</TableHead><TableHead>GSTIN</TableHead><TableHead>Territory</TableHead><TableHead>Status</TableHead><TableHead>Terms</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {paginatedDealers.map((d) => (
                  <TableRow key={d.id} data-testid={`admin-dealer-${d.id}`}>
                    <TableCell className="font-medium text-brand-forest">{d.org_name}</TableCell>
                    <TableCell className="font-mono text-xs">{d.gstin}</TableCell>
                    <TableCell className="text-xs">{d.territory}</TableCell>
                    <TableCell><Badge variant={d.status === "approved" ? "default" : "outline"} className={d.status === "approved" ? "bg-brand-leaf text-brand-forest font-semibold" : ""}>{d.status}</Badge></TableCell>
                    <TableCell className="text-xs">{d.terms_status.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" className="hover:border-brand-forest hover:text-brand-forest" onClick={() => patch.mutate({ id: d.id, body: { status: "approved" } })} data-testid={`admin-dealer-${d.id}-approve`}>approve</Button>
                        <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive" onClick={() => patch.mutate({ id: d.id, body: { status: "rejected" } })}>reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 border-t border-border pt-2">
              <DataTablePagination
                totalItems={totalDealers}
                currentPage={dealerPage}
                pageSize={dealerPageSize}
                onPageChange={setDealerPage}
                onPageSizeChange={setDealerPageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Dealer margins, credit limits and tax terms are never assumed — until configured, every dealer line stays quote-only.
        </p>
      </Panel>

      <Panel title="Dealer quote requests" testId="admin-dealer-orders-panel">
        {totalQuotes === 0 ? (
          <p className="text-sm text-muted-foreground">No dealer quote requests yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader><TableRow><TableHead>Organisation</TableHead><TableHead>Lines</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {paginatedQuotes.map((o) => (
                  <TableRow key={o.id} data-testid={`admin-dealer-order-${o.id}`}>
                    <TableCell className="font-medium text-brand-forest">{o.org_name}</TableCell>
                    <TableCell className="text-xs">{o.items.map((i) => `${i.sku} ×${i.qty}`).join(", ")}</TableCell>
                    <TableCell><Badge variant="outline">{o.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" className="hover:border-brand-forest hover:text-brand-forest" onClick={() => patchOrder.mutate({ id: o.id, status: "quoted" })}>quote</Button>
                        <Button variant="ghost" size="xs" className="hover:bg-brand-leaf/20 text-brand-forest font-medium" onClick={() => patchOrder.mutate({ id: o.id, status: "approved" })}>approve</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 border-t border-border pt-2">
              <DataTablePagination
                totalItems={totalQuotes}
                currentPage={quotePage}
                pageSize={quotePageSize}
                onPageChange={setQuotePage}
                onPageSizeChange={setQuotePageSize}
                pageSizeOptions={[10, 25, 50]}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function StaffView() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isOwner = !!me?.roles.includes("owner");
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(10);
  const { data: staff } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => apiGet<User[]>("/admin/staff"),
    enabled: isOwner, // owner-only endpoint — don't fire a request that can only 403
  });
  const [form, setForm] = useState({ email: "", name: "", roles: "manager" });

  const invite = useMutation({
    mutationFn: () => apiPost<{ one_time_password: string; email: string; note: string }>("/admin/staff/invite", { email: form.email, name: form.name, roles: form.roles.split(",").map((r) => r.trim()) }),
    onSuccess: (out) => {
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      toast.success(`Invited ${out.email} — one-time password: ${out.one_time_password}`, { duration: 20000 });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not invite"),
  });
  const patch = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) => apiPatch(`/admin/staff/${p.id}`, p.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-staff"] }); toast.success("Staff updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Owner only"),
  });

  const totalStaff = staff?.length ?? 0;
  const paginatedStaff = (staff ?? []).slice((staffPage - 1) * staffPageSize, staffPage * staffPageSize);

  if (!isOwner) {
    return (
      <Panel title="Staff & roles" testId="admin-staff-denied">
        <p className="text-sm text-muted-foreground" data-testid="admin-staff-owner-only-note">
          Staff accounts and role grants are restricted to the <strong>owner</strong>. Your admin role covers catalog,
          inventory, orders, CMS and operational settings. Ask the owner to invite staff or change role grants.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6">
      <Panel title="Invite staff (owner only)" testId="admin-staff-invite">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5 min-h-11" data-testid="staff-email-input" /></div>
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 min-h-11" data-testid="staff-name-input" /></div>
          <div><Label>Roles (comma-separated)</Label><Input value={form.roles} onChange={(e) => setForm((f) => ({ ...f, roles: e.target.value }))} className="mt-1.5 min-h-11" data-testid="staff-roles-input" /></div>
          <Button className="self-end min-h-11 bg-brand-forest hover:bg-brand-forest/90 text-white font-medium" onClick={() => invite.mutate()} disabled={!form.email || form.name.length < 2} data-testid="staff-invite-button">Invite</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Roles: owner, admin, manager, crm_master, crm_manager, crm_employee. A one-time password is generated (no hardcoded defaults);
          email delivery is pending a mail provider, so share it securely and have the staff member rotate it.
        </p>
      </Panel>

      <Panel title="Staff accounts" testId="admin-staff-list">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Roles</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {paginatedStaff.map((s) => (
              <TableRow key={s.id} data-testid={`admin-staff-${s.email}`}>
                <TableCell className="font-medium text-brand-forest">{s.name}</TableCell>
                <TableCell className="text-xs">{s.email}</TableCell>
                <TableCell className="text-xs">{s.roles.join(", ")}</TableCell>
                <TableCell><Badge variant={s.is_active ? "default" : "outline"} className={s.is_active ? "bg-brand-leaf text-brand-forest" : ""}>{s.is_active ? "active" : "disabled"}</Badge></TableCell>
                <TableCell>
                  <Button variant="outline" size="xs" onClick={() => patch.mutate({ id: s.id, body: { is_active: !s.is_active } })} data-testid={`admin-staff-${s.email}-toggle`}>
                    {s.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalStaff > 0 && (
          <div className="mt-4 border-t border-border pt-2">
            <DataTablePagination
              totalItems={totalStaff}
              currentPage={staffPage}
              pageSize={staffPageSize}
              onPageChange={setStaffPage}
              onPageSizeChange={setStaffPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingsView() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => apiGet<SiteSettings>("/admin/settings") });
  const [form, setForm] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      apiPut("/admin/settings", {
        support_email: form.support_email,
        support_phone: form.support_phone,
        address: form.address,
        gst_rate: form.gst_rate ? Number(form.gst_rate) : undefined,
        shipping_flat_paise: form.shipping_flat_paise ? Number(form.shipping_flat_paise) : undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-settings"] }); toast.success("Settings saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <div className="grid gap-6">
      <Panel title="Integration state (secrets are never shown)" testId="admin-integrations">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Razorpay</p><Badge variant="outline" className="mt-2" data-testid="settings-razorpay-state">{settings?.razorpay_state ?? "—"}</Badge></div>
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Mail provider</p><Badge variant="outline" className="mt-2">{settings?.mail_state ?? "—"}</Badge></div>
          <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Analytics</p><Badge variant="outline" className="mt-2">{settings?.analytics_consent ?? "—"}</Badge></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          No role — including owner — can view payment secrets in the UI. Keys live only in server environment configuration; this panel
          reflects masked state only.
        </p>
      </Panel>

      <Panel title="Company, tax & shipping" testId="admin-settings-form">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Support email</Label><Input defaultValue={settings?.support_email} onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))} className="mt-1.5 min-h-11" data-testid="settings-email-input" /></div>
          <div><Label>Support phone</Label><Input defaultValue={settings?.support_phone} onChange={(e) => setForm((f) => ({ ...f, support_phone: e.target.value }))} className="mt-1.5 min-h-11" data-testid="settings-phone-input" /></div>
          <div className="sm:col-span-2"><Label>Registered address</Label><Input defaultValue={settings?.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="mt-1.5 min-h-11" data-testid="settings-address-input" /></div>
          <div>
            <Label>GST rate % (explicit — never inferred)</Label>
            <Input defaultValue={settings?.gst_rate ?? ""} placeholder="e.g. 18" onChange={(e) => setForm((f) => ({ ...f, gst_rate: e.target.value }))} className="mt-1.5 min-h-11" data-testid="settings-gst-input" />
            <p className="mt-1 text-xs text-muted-foreground">Current: {settings?.gst_status?.replace(/_/g, " ")}</p>
          </div>
          <div>
            <Label>Flat shipping (paise)</Label>
            <Input defaultValue={settings?.shipping_flat_paise ?? ""} placeholder="e.g. 0" onChange={(e) => setForm((f) => ({ ...f, shipping_flat_paise: e.target.value }))} className="mt-1.5 min-h-11" data-testid="settings-shipping-input" />
            <p className="mt-1 text-xs text-muted-foreground">Current: {settings?.shipping_status?.replace(/_/g, " ")}</p>
          </div>
        </div>
        <Button className="mt-4 min-h-11" onClick={() => save.mutate()} data-testid="settings-save-button">Save settings</Button>
      </Panel>
    </div>
  );
}

export default function AdminConsole() {
  const { data: me } = useMe();
  const isOwner = !!me && me.roles.includes("owner");
  const isCrmMasterOnly =
    !!me &&
    me.roles.includes("crm_master") &&
    !me.roles.includes("owner") &&
    !me.roles.includes("admin");

  const baseNav = isOwner
    ? [
        ...NAV.slice(0, NAV.length - 1),
        { to: "/admin/test-data", label: "Test Data" },
        NAV[NAV.length - 1],
      ]
    : NAV;

  const effectiveNav = isCrmMasterOnly
    ? [
        { to: "/admin/sales", label: "Sales & Revenue" },
        { to: "/admin/orders", label: "Orders" },
        { to: "/crm", label: "CRM Workspace" },
        { to: "/crm/leads", label: "Leads" },
      ]
    : baseNav;

  const title = isCrmMasterOnly ? "CRM Master Admin console" : "Owner / Admin console";

  return (
    <ConsoleLayout area="Admin" title={title} allowedRoles={["owner", "admin", "crm_master"]} nav={effectiveNav}>
      <Routes>
        <Route index element={isCrmMasterOnly ? <SalesRevenueDashboard /> : <OwnerDashboard />} />
        <Route path="sales" element={<SalesRevenueDashboard />} />
        <Route path="orders" element={<OrdersCentralHub />} />
        <Route path="dispatch/*" element={<DispatchReturnsHub />} />
        {!isCrmMasterOnly && (
          <>
            <Route path="catalog" element={<CatalogCentralHub />} />
            <Route path="website-edit" element={<WebsiteEditStudio />} />
            <Route path="cms" element={<WebsiteEditStudio />} />
            <Route path="claims" element={<ClaimsTrustHub />} />
            <Route path="assets" element={<AssetLibraryHub />} />
            <Route path="referrals" element={<ReferEarnHub />} />
            <Route path="dealers" element={<DealerManagementHub />} />
            <Route path="staff" element={<StaffAccessHub />} />
            <Route path="audit" element={<AuditLogView />} />
            <Route path="test-data" element={<TestDataManager />} />
            <Route path="settings" element={<SettingsView />} />
          </>
        )}
      </Routes>
    </ConsoleLayout>
  );
}
