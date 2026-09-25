import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDateTime, inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import CallForm from "@/components/crm/CallForm";
import TestDataBanner from "@/components/crm/TestDataBanner";
import WorkdayGate from "@/components/crm/WorkdayGate";
import MasterAdminDashboard from "@/components/crm/MasterAdminDashboard";
import PipelinesWorkspace from "@/components/crm/PipelinesWorkspace";
import PipelinesPage from "@/components/crm/PipelinesPage";
import PipelineDetail from "@/components/crm/PipelineDetail";
import CampaignsPage from "@/components/crm/CampaignsPage";
import CampaignWorkspace from "@/components/crm/CampaignWorkspace";
import LeadsContactsHub from "@/components/crm/LeadsContactsHub";
import AttendanceHub from "@/components/crm/AttendanceHub";
import LeaveManagementHub from "@/components/crm/LeaveManagementHub";
import PayrollHub from "@/components/crm/PayrollHub";
import TrendsAnalyticsHub from "@/components/crm/TrendsAnalyticsHub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CallConfig,
  CrmOverview,
  DispositionOpt,
  FollowUpRow,
  LeadPage,
  LeadWorkspace,
  Pipeline,
  ServiceCase,
  TeamReportRow,
} from "@/lib/crmTypes";

const NAV = [
  { to: "/crm", label: "Dashboard" },
  { to: "/crm/leads", label: "Leads & Contacts" },
  { to: "/crm/pipelines", label: "Pipelines" },
  { to: "/crm/campaigns", label: "Campaigns" },
  { to: "/crm/follow-ups", label: "Follow-ups" },
  { to: "/crm/calls", label: "Calls Log" },
  { to: "/crm/customers", label: "Customers" },
  { to: "/crm/conversions", label: "Sales & Conversions" },
  { to: "/crm/team", label: "Managers & Employees" },
  { to: "/crm/attendance", label: "Attendance" },
  { to: "/crm/leave", label: "Leave Management" },
  { to: "/crm/payroll", label: "Payroll" },
  { to: "/crm/trends", label: "Reports & Analytics" },
  { to: "/crm/intake", label: "Intake Queue" },
  { to: "/crm/cases", label: "Service Cases" },
  { to: "/crm/dispositions", label: "Call Configuration" },
];

const CRM_ROLES = ["owner", "admin", "crm_master", "crm_manager", "crm_employee"];

function Panel({ title, children, testId, note }: { title: string; children: React.ReactNode; testId?: string; note?: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid={testId}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint, testId }: { label: string; value: string | number; hint?: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-black" data-testid={testId}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function qualBadge(q: string) {
  const map: Record<string, string> = {
    registered: "bg-muted text-foreground",
    cart_intent: "bg-brand-sand text-brand-charcoal",
    sales_qualified: "bg-brand-leaf/20 text-brand-deep",
    converted: "bg-brand-deep text-white",
    disqualified: "bg-destructive/10 text-destructive",
  };
  return map[q] ?? "bg-muted";
}

// ------------------------------------------------------------------ dashboard

function DashboardView() {
  const { data: o } = useQuery({ queryKey: ["crm-overview"], queryFn: () => apiGet<CrmOverview>("/crm/reports/overview") });
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="crm-stats">
        <Stat label="Registrations" value={o?.registrations ?? "—"} hint="signups — not sales-qualified" testId="crm-stat-registrations" />
        <Stat label="Cart opportunities" value={o?.cart_opportunities ?? "—"} hint="one open per customer" testId="crm-stat-cart" />
        <Stat label="Sales qualified" value={o?.sales_qualified ?? "—"} testId="crm-stat-qualified" />
        <Stat label="Converted (paid)" value={o?.converted_paid_orders ?? "—"} hint="verified payment only" testId="crm-stat-converted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Attributed revenue" value={o ? inr(o.attributed_revenue_paise) : "—"} hint={o?.revenue_basis} testId="crm-stat-revenue" />
        <Stat label="Conversion rate" value={o ? `${o.conversion_rate_pct}%` : "—"} hint={o?.conversion_denominator} testId="crm-stat-conv" />
        <Stat label="Follow-ups due" value={o?.follow_ups_due ?? "—"} hint={`${o?.follow_ups_overdue ?? 0} overdue`} testId="crm-stat-due" />
        <Stat
          label="Calls logged"
          value={o?.calls_logged ?? "—"}
          hint={`${o?.calls_connected ?? 0} connected · ${o?.unique_leads_contacted ?? 0} unique leads`}
          testId="crm-stat-calls"
        />
      </div>
      <Panel
        title="External ad performance"
        testId="crm-ad-metrics"
        note="Spend, impressions and ROAS require a real ad data source. Nothing is estimated here."
      >
        <div className="flex flex-wrap gap-3">
          {(["ad_spend", "impressions", "roas"] as const).map((k) => (
            <Badge key={k} variant="outline" className="border-dashed" data-testid={`crm-metric-${k}`}>
              {k.replace("_", " ")}: Not connected
            </Badge>
          ))}
        </div>
      </Panel>
      <p className="text-xs text-muted-foreground" data-testid="crm-timezone-note">
        All day-based figures use {o?.timezone ?? "Asia/Kolkata"}. Call records are manually logged — telephony is not
        integrated, so no duration or recording is claimed.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ leads

function LeadsView() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [qualification, setQualification] = useState("");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (kind) params.set("kind", kind);
  if (qualification) params.set("qualification", qualification);
  const { data, isLoading } = useQuery({
    queryKey: ["crm-leads", q, kind, qualification],
    queryFn: () => apiGet<LeadPage>(`/crm/leads?${params.toString()}`),
  });

  return (
    <div className="grid gap-6">
      <Panel title="Search & filter" testId="crm-lead-filters" note="Search and paging run on the server — never a table-wide client load.">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Input
            placeholder="Name, email, phone or lead number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="crm-lead-search-input"
            className="min-h-11"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            data-testid="crm-lead-kind-filter"
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All kinds</option>
            <option value="registration">Registration</option>
            <option value="cart_opportunity">Cart opportunity</option>
            <option value="sales">Sales</option>
            <option value="dealer">Dealer</option>
          </select>
          <select
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            data-testid="crm-lead-qual-filter"
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All qualifications</option>
            <option value="registered">Registered</option>
            <option value="cart_intent">Cart intent</option>
            <option value="sales_qualified">Sales qualified</option>
            <option value="converted">Converted</option>
          </select>
        </div>
      </Panel>

      <Panel title={`Leads (${data?.total ?? 0})`} testId="crm-leads-panel">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading leads…</p>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="crm-leads-empty">
            No leads match these filters yet.
          </p>
        ) : (
          <Table data-testid="crm-leads-table">
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((l) => (
                <TableRow key={l.id} data-testid={`crm-lead-${l.lead_number}`}>
                  <TableCell>
                    <Link to={`/crm/leads/${l.id}`} className="font-semibold text-brand-deep underline" data-testid={`crm-lead-open-${l.lead_number}`}>
                      {l.lead_number}
                    </Link>
                    <div className="text-xs text-muted-foreground">{l.name}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.email ?? "—"}
                    <br />
                    {l.phone ?? ""}
                  </TableCell>
                  <TableCell className="text-xs">{l.kind.replace("_", " ")}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-1 text-xs ${qualBadge(l.qualification)}`}>{l.qualification.replace("_", " ")}</span>
                  </TableCell>
                  <TableCell className="text-xs">{l.stage_code}</TableCell>
                  <TableCell className="text-xs">{l.product_interest ?? "—"}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(l.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ lead workspace

function LeadWorkspaceView() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-lead", id],
    queryFn: () => apiGet<LeadWorkspace>(`/crm/leads/${id}`),
  });
  const { data: pipelines } = useQuery({ queryKey: ["crm-pipelines"], queryFn: () => apiGet<Pipeline[]>("/crm/pipelines") });
  const [stage, setStage] = useState("");
  const [reason, setReason] = useState("");

  const changeStage = useMutation({
    mutationFn: () => apiPost(`/crm/leads/${id}/stage`, { stage_code: stage, reason }),
    onSuccess: () => {
      toast.success("Stage updated");
      setReason("");
      qc.invalidateQueries({ queryKey: ["crm-lead", id] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Stage change rejected"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading lead…</p>;
  if (error || !data)
    return (
      <Panel title="Lead unavailable" testId="crm-lead-denied">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "This lead is not in your scope."}
        </p>
      </Panel>
    );

  const { lead } = data;
  const pipeline = pipelines?.find((p) => p.id === lead.pipeline_id);

  return (
    <div className="grid gap-6">
      <Panel title={`${lead.lead_number} · ${lead.name}`} testId="crm-lead-header">
        <div className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Qualification</p>
            <span className={`rounded-full px-2 py-1 text-xs ${qualBadge(lead.qualification)}`} data-testid="crm-lead-qualification">
              {lead.qualification.replace("_", " ")}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stage</p>
            <p className="font-semibold" data-testid="crm-lead-stage">{lead.stage_code}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <p data-testid="crm-lead-source">{lead.source_kind}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contact</p>
            <p className="text-xs">{lead.email ?? "—"}</p>
            <p className="text-xs">{lead.phone ?? ""}</p>
          </div>
        </div>
        {lead.converted_order_id && (
          <Badge className="mt-3 bg-brand-deep text-white" data-testid="crm-lead-converted-badge">
            Converted on a verified paid order — stage locked
          </Badge>
        )}
      </Panel>

      <Tabs defaultValue="call">
        <TabsList data-testid="crm-lead-tabs">
          <TabsTrigger value="call">Log a call</TabsTrigger>
          <TabsTrigger value="stage">Change stage</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="orders">Order context</TabsTrigger>
        </TabsList>

        <TabsContent value="call" className="mt-4">
          <CallForm leadId={id} />
        </TabsContent>

        <TabsContent value="stage" className="mt-4">
          <Panel
            title="Change lead stage"
            testId="crm-stage-panel"
            note="This is the only manual way a stage moves. Saving a call or completing a follow-up never changes it."
          >
            {lead.converted_order_id ? (
              <p className="text-sm text-muted-foreground">This lead converted on a paid order — its stage is locked.</p>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="stage-select">New stage</Label>
                  <select
                    id="stage-select"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    data-testid="crm-stage-select"
                    className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select a stage…</option>
                    {(pipeline?.stages ?? []).map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stage-reason">Reason (recorded in history)</Label>
                  <Textarea
                    id="stage-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    data-testid="crm-stage-reason-input"
                    placeholder="Why is the stage moving?"
                  />
                </div>
                <Button
                  onClick={() => changeStage.mutate()}
                  disabled={!stage || reason.trim().length < 3 || changeStage.isPending}
                  className="min-h-11 w-fit"
                  data-testid="crm-stage-submit"
                >
                  {changeStage.isPending ? "Saving…" : "Change stage"}
                </Button>
              </div>
            )}
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Stage history</h3>
              {lead.stage_history.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No stage changes yet.</p>
              ) : (
                <ol className="mt-2 grid gap-2" data-testid="crm-stage-history">
                  {lead.stage_history.map((h, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-xs">
                      <strong>
                        {h.from} → {h.to}
                      </strong>{" "}
                      · {h.actor} · {fmtDateTime(h.at)}
                      <div className="text-muted-foreground">{h.reason}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="grid gap-6">
            <Panel title={`Calls (${data.calls.length})`} testId="crm-calls-panel">
              {data.calls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No calls logged.</p>
              ) : (
                <ol className="grid gap-2" data-testid="crm-calls-list">
                  {data.calls.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border p-3 text-xs" data-testid={`crm-call-${c.id}`}>
                      <strong>{c.connectivity_label} · {c.disposition_label}</strong>
                      {c.outcome_label && <> → {c.outcome_label}</>}
                      <div className="text-muted-foreground">
                        {c.agent_email} · {fmtDateTime(c.created_at)} · manually logged (no recording/duration)
                      </div>
                      {c.summary && <div className="mt-1">{c.summary}</div>}
                      {Object.keys(c.form_answers).length > 0 && (
                        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                          {c.form_snapshot.map((f) => (
                            <div key={f.code} className="flex gap-1">
                              <dt className="text-muted-foreground">{f.label}:</dt>
                              <dd>{String(c.form_answers[f.code] ?? "—")}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title={`Follow-ups (${data.follow_ups.length})`} testId="crm-lead-followups">
              {data.follow_ups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <ul className="grid gap-2">
                  {data.follow_ups.map((f) => (
                    <li key={f.id} className="rounded-lg border border-border p-3 text-xs">
                      {fmtDateTime(f.due_at)} · {f.reason} · <strong>{f.status}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title={`Source events (${data.source_events.length})`} testId="crm-source-events" note="Deduplicated intake history.">
              <ul className="grid gap-2">
                {data.source_events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-border p-3 text-xs">
                    <strong>{e.kind}</strong> · {fmtDateTime(e.created_at)}
                    <div className="text-muted-foreground">{e.event_key}</div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Panel title="Canonical order context" testId="crm-order-context" note="Read-only. CRM never owns order, payment or stock truth.">
            {data.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders for this contact.</p>
            ) : (
              <Table data-testid="crm-order-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Fulfilment</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((o) => (
                    <TableRow key={o.order_number}>
                      <TableCell>{o.order_number}</TableCell>
                      <TableCell>{o.payment_status}</TableCell>
                      <TableCell>{o.fulfilment_status}</TableCell>
                      <TableCell>{inr(o.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ intake queue

function IntakeQueueView() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["crm-intake"], queryFn: () => apiGet<{ total: number; rows: LeadPage["rows"] }>("/crm/intake-queue") });
  const { data: staff } = useQuery({
    queryKey: ["crm-staff-options"],
    queryFn: () => apiGet<TeamReportRow[]>("/crm/reports/team").then((r) => r).catch(() => [] as TeamReportRow[]),
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  const assign = useMutation({
    mutationFn: () => apiPost("/crm/leads/assign", { lead_ids: selected, employee_id: employeeId, reason: "Allocated from owner intake queue" }),
    onSuccess: (r: unknown) => {
      const res = r as { assigned: number };
      toast.success(`${res.assigned} lead(s) assigned`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["crm-intake"] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Assignment failed"),
  });

  const employees = ((staff as unknown as { rows?: TeamReportRow[] })?.rows ?? []).filter((s) => s.roles.includes("crm_employee"));

  return (
    <Panel
      title={`Owner intake queue (${data?.total ?? 0})`}
      testId="crm-intake-panel"
      note="Leads captured from signup, cart intent and contact forms that no employee owns yet."
    >
      {!data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="crm-intake-empty">
          Nothing waiting — every captured lead has an owner.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="assign-emp">Assign selected to</Label>
              <select
                id="assign-emp"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                data-testid="crm-assign-employee-select"
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose a CRM employee…</option>
                {employees.map((s) => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.name} ({s.assigned_leads} assigned)
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => assign.mutate()}
              disabled={!employeeId || selected.length === 0 || assign.isPending}
              className="min-h-11"
              data-testid="crm-assign-submit"
            >
              {assign.isPending ? "Assigning…" : `Assign ${selected.length || ""}`}
            </Button>
          </div>
          <Table data-testid="crm-intake-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"> </TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Captured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((l) => (
                <TableRow key={l.id} data-testid={`crm-intake-${l.lead_number}`}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${l.lead_number}`}
                      checked={selected.includes(l.id)}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))}
                      data-testid={`crm-intake-check-${l.lead_number}`}
                      className="size-5"
                    />
                  </TableCell>
                  <TableCell>
                    <Link to={`/crm/leads/${l.id}`} className="font-semibold text-brand-deep underline">
                      {l.lead_number}
                    </Link>
                    <div className="text-xs text-muted-foreground">{l.name}</div>
                  </TableCell>
                  <TableCell className="text-xs">{l.kind.replace("_", " ")}</TableCell>
                  <TableCell className="text-xs">{l.qualification.replace("_", " ")}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(l.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ follow-ups

function FollowUpsView() {
  const qc = useQueryClient();
  const [bucket, setBucket] = useState<"due_today" | "overdue" | "upcoming" | "completed">("due_today");
  const { data } = useQuery({
    queryKey: ["crm-followups", bucket],
    queryFn: () => apiGet<{ bucket: string; total: number; rows: FollowUpRow[] }>(`/crm/follow-ups?bucket=${bucket}`),
  });
  const complete = useMutation({
    mutationFn: (fid: string) => apiPost(`/crm/follow-ups/${fid}/complete`, { note: "Completed from queue" }),
    onSuccess: () => {
      toast.success("Follow-up completed — the lead stage is unchanged");
      qc.invalidateQueries({ queryKey: ["crm-followups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not complete"),
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2" data-testid="crm-followup-buckets">
        {(["due_today", "overdue", "upcoming", "completed"] as const).map((b) => (
          <Button
            key={b}
            variant={bucket === b ? "default" : "outline"}
            onClick={() => setBucket(b)}
            className="min-h-11"
            data-testid={`crm-followup-bucket-${b}`}
          >
            {b.replace("_", " ")}
          </Button>
        ))}
      </div>
      <Panel title={`${bucket.replace("_", " ")} (${data?.total ?? 0})`} testId="crm-followups-panel" note="Times shown in IST. Completing a follow-up never changes a CRM stage.">
        {!data || data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="crm-followups-empty">
            Nothing in this bucket.
          </p>
        ) : (
          <Table data-testid="crm-followups-table">
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Due (IST)</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((f) => (
                <TableRow key={f.id} data-testid={`crm-followup-${f.id}`}>
                  <TableCell>
                    {f.lead ? (
                      <Link to={`/crm/leads/${f.lead.id}`} className="font-semibold text-brand-deep underline">
                        {f.lead.lead_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="text-xs text-muted-foreground">{f.lead?.name}</div>
                  </TableCell>
                  <TableCell className="text-xs">{f.lead?.phone ?? f.lead?.email ?? "—"}</TableCell>
                  <TableCell className="text-xs" data-testid={`crm-followup-due-${f.id}`}>{f.due_at_ist}</TableCell>
                  <TableCell className="text-xs">{f.reason}</TableCell>
                  <TableCell className="text-xs">{f.lead?.stage_code ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {f.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => complete.mutate(f.id)}
                        disabled={complete.isPending}
                        data-testid={`crm-followup-complete-${f.id}`}
                      >
                        Complete
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{f.status}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ customers (existing directory)

interface DirectoryRow {
  id: string;
  email: string;
  name: string;
  verified_purchases: number;
  lifetime_spend_paise: number;
  last_order_at: string | null;
}

function CustomersView() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["crm-customers", q],
    queryFn: () => apiGet<DirectoryRow[]>(`/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  return (
    <Panel title="Customer directory" testId="crm-customers-panel" note="Verified purchases and lifetime spend come from paid orders only.">
      <Input
        placeholder="Search name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 min-h-11 max-w-sm"
        data-testid="crm-customer-search-input"
      />
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="crm-customers-empty">
          No customers in your scope.
        </p>
      ) : (
        <Table data-testid="crm-customers-table">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Verified purchases</TableHead>
              <TableHead>Lifetime spend</TableHead>
              <TableHead>Last order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id} data-testid={`crm-customer-${c.id}`}>
                <TableCell>
                  {c.name}
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </TableCell>
                <TableCell>{c.verified_purchases}</TableCell>
                <TableCell>{inr(c.lifetime_spend_paise)}</TableCell>
                <TableCell className="text-xs">{c.last_order_at ? fmtDateTime(c.last_order_at) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ cases

function CasesView() {
  const { data } = useQuery({ queryKey: ["crm-cases"], queryFn: () => apiGet<ServiceCase[]>("/crm/cases") });
  return (
    <Panel
      title={`Service cases (${data?.length ?? 0})`}
      testId="crm-cases-panel"
      note="A case never changes payment, fulfilment or refund status — CRM can only raise a traceable request."
    >
      {!data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="crm-cases-empty">
          No cases in your scope.
        </p>
      ) : (
        <Table data-testid="crm-cases-table">
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id} data-testid={`crm-case-${c.case_number}`}>
                <TableCell>{c.case_number}</TableCell>
                <TableCell className="text-xs">{c.subject}</TableCell>
                <TableCell className="text-xs">{c.order_number ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.status}</TableCell>
                <TableCell className="text-xs">{c.priority}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ disposition config

function DispositionsView() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canConfigure = !!me?.roles.some((r) => ["owner", "crm_master"].includes(r));
  const { data } = useQuery({ queryKey: ["crm-call-config"], queryFn: () => apiGet<CallConfig>("/crm/dispositions/config") });

  const toggle = useMutation({
    mutationFn: ({ coll, id, is_active }: { coll: string; id: string; is_active: boolean }) =>
      apiPatch(`/crm/dispositions/${coll}/${id}`, { is_active }),
    onSuccess: () => {
      toast.success("Configuration updated");
      qc.invalidateQueries({ queryKey: ["crm-call-config"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });
  const activateForm = useMutation({
    mutationFn: (fid: string) => apiPost(`/crm/dispositions/forms/${fid}/activate`, {}),
    onSuccess: () => {
      toast.success("Form activated");
      qc.invalidateQueries({ queryKey: ["crm-call-config"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Activation failed"),
  });

  const Row = ({ label, active, onToggle, testId, extra }: { label: string; active: boolean; onToggle: () => void; testId: string; extra?: string }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3" data-testid={testId}>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {extra && <p className="text-xs text-muted-foreground">{extra}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={active ? "default" : "outline"} className={active ? "bg-brand-leaf" : "border-dashed"}>
          {active ? "Active" : "Draft"}
        </Badge>
        {canConfigure && (
          <Button size="sm" variant="outline" className="min-h-11" onClick={onToggle} data-testid={`${testId}-toggle`}>
            {active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6">
      {!data?.configured && (
        <div className="rounded-2xl border border-dashed border-brand-leaf/50 bg-brand-sand/40 p-5" data-testid="crm-config-pending-banner">
          <p className="text-sm font-semibold text-brand-deep">Call logging is not yet available to agents</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every option below is an unapproved draft. Until a connectivity and at least one disposition are activated,
            saving a call is correctly rejected rather than storing unapproved wording.
          </p>
        </div>
      )}
      <Tabs defaultValue="connectivity">
        <TabsList data-testid="crm-config-tabs">
          <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
          <TabsTrigger value="dispositions">Dispositions</TabsTrigger>
          <TabsTrigger value="outcomes">Call Outcomes</TabsTrigger>
          <TabsTrigger value="forms">Engagement Form</TabsTrigger>
        </TabsList>
        <TabsContent value="connectivity" className="mt-4">
          <Panel title="Connectivity" testId="crm-config-connectivity">
            <div className="grid gap-2">
              {(data?.connectivities ?? []).map((c) => (
                <Row
                  key={c.id}
                  label={c.label}
                  extra={`code: ${c.code}`}
                  active={c.is_active}
                  testId={`crm-config-conn-${c.code}`}
                  onToggle={() => toggle.mutate({ coll: "connectivities", id: c.id, is_active: !c.is_active })}
                />
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="dispositions" className="mt-4">
          <Panel title="Dispositions" testId="crm-config-dispositions" note="Each disposition belongs to one connectivity — the server rejects mismatched pairs.">
            <div className="grid gap-2">
              {(data?.dispositions ?? []).map((d: DispositionOpt) => (
                <Row
                  key={d.id}
                  label={d.label}
                  extra={`under ${d.connectivity_code}${d.requires_outcome ? " · requires an outcome" : ""}`}
                  active={d.is_active}
                  testId={`crm-config-disp-${d.code}`}
                  onToggle={() => toggle.mutate({ coll: "dispositions", id: d.id, is_active: !d.is_active })}
                />
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="outcomes" className="mt-4">
          <Panel title="Call outcomes" testId="crm-config-outcomes" note="A 'Purchase Commitment' outcome is a conversation result — never a purchase.">
            <div className="grid gap-2">
              {(data?.outcomes ?? []).map((o) => (
                <Row
                  key={o.id}
                  label={o.label}
                  active={o.is_active}
                  testId={`crm-config-outcome-${o.code}`}
                  onToggle={() => toggle.mutate({ coll: "outcomes", id: o.id, is_active: !o.is_active })}
                />
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="forms" className="mt-4">
          <Panel title="Engagement forms" testId="crm-config-forms" note="Exactly one version is active; each saved call stores a snapshot of the fields used.">
            <div className="grid gap-2">
              {(data?.forms ?? []).map((f) => (
                <div key={f.id} className="rounded-lg border border-border p-3" data-testid={`crm-config-form-${f.code}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {f.name} <span className="text-xs text-muted-foreground">v{f.version}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{f.fields.length} fields · summary {f.summary_field}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={f.is_active ? "default" : "outline"} className={f.is_active ? "bg-brand-leaf" : "border-dashed"}>
                        {f.is_active ? "Active" : "Draft"}
                      </Badge>
                      {canConfigure && !f.is_active && (
                        <Button size="sm" variant="outline" className="min-h-11" onClick={() => activateForm.mutate(f.id)} data-testid={`crm-config-form-activate-${f.code}`}>
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                  <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {f.fields.map((fl) => (
                      <li key={fl.code}>
                        {fl.label} · {fl.type}
                        {fl.required && " · required"}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------ reports

function ReportsView() {
  const { data: me } = useMe();
  const canSeeTeam = !!me?.roles.some((r) => ["owner", "crm_master", "crm_manager"].includes(r));
  const { data, error } = useQuery({
    queryKey: ["crm-team-report"],
    queryFn: () => apiGet<{ total: number; rows: TeamReportRow[] }>("/crm/reports/team"),
    enabled: canSeeTeam,
  });
  if (!canSeeTeam) {
    return (
      <Panel title="Team performance" testId="crm-reports-denied">
        <p className="text-sm text-muted-foreground">
          Team-wide reporting is limited to CRM managers and above. Your dashboard shows your own performance.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      title={`Team performance (${data?.total ?? 0})`}
      testId="crm-team-report-panel"
      note="Call volume and unique leads contacted are reported separately; conversions count verified paid orders only."
    >
      {error ? (
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unavailable"}</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="crm-team-empty">
          No CRM staff in your scope yet.
        </p>
      ) : (
        <Table data-testid="crm-team-table">
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>Connect rate</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead>Conversions</TableHead>
              <TableHead>Cases resolved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.staff_id} data-testid={`crm-team-${r.staff_id}`}>
                <TableCell>
                  {r.name}
                  <div className="text-xs text-muted-foreground">{r.roles.join(", ")}</div>
                </TableCell>
                <TableCell>{r.assigned_leads}</TableCell>
                <TableCell>{r.calls_logged}</TableCell>
                <TableCell>{r.connect_rate_pct}%</TableCell>
                <TableCell>{r.follow_ups_overdue}</TableCell>
                <TableCell>{r.conversions}</TableCell>
                <TableCell>{r.cases_resolved}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

export default function CRMConsole() {
  const { data: me } = useMe();
  const [showWorkforceGate, setShowWorkforceGate] = useState(true);

  // Attendance gating applies ONLY to crm_manager and crm_employee.
  // CRM Master Admin and Owner access CRM immediately — no clock-in required.
  const needsWorkdayGate = !!me?.roles.some((r) =>
    ["crm_manager", "crm_employee"].includes(r) &&
    !me.roles.some((rr) => ["owner", "crm_master"].includes(rr))
  );

  return (
    <ConsoleLayout area="The CRM workspace" title="Kotson CRM" allowedRoles={CRM_ROLES} nav={NAV}>
      <div className="space-y-6">
        <TestDataBanner />
        {needsWorkdayGate && showWorkforceGate && (
          <WorkdayGate
            allowBypass={true}
            onBypass={() => setShowWorkforceGate(false)}
          />
        )}

        <Routes>
          <Route index element={<MasterAdminDashboard />} />
          <Route path="leads" element={<LeadsContactsHub />} />
          <Route path="leads/:id" element={<LeadWorkspaceView />} />
          {/* ── Pipeline & Campaign — separate pages ── */}
          <Route path="pipelines" element={<PipelinesPage />} />
          <Route path="pipelines/:pipelineId" element={<PipelineDetail />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:campaignId" element={<CampaignWorkspace />} />
          {/* ── Legacy workspace (kept for call-config) ── */}
          <Route path="pipeline-config" element={<PipelinesWorkspace />} />
          <Route path="attendance" element={<AttendanceHub />} />
          <Route path="leave" element={<LeaveManagementHub />} />
          <Route path="payroll" element={<PayrollHub />} />
          <Route path="trends" element={<TrendsAnalyticsHub />} />
          <Route path="reports" element={<TrendsAnalyticsHub />} />
          <Route path="team" element={<ReportsView />} />
          <Route path="conversions" element={<LeadsContactsHub />} />
          <Route path="calls" element={<TrendsAnalyticsHub />} />
          <Route path="intake" element={<IntakeQueueView />} />
          <Route path="follow-ups" element={<FollowUpsView />} />
          <Route path="customers" element={<CustomersView />} />
          <Route path="cases" element={<CasesView />} />
          <Route path="dispositions" element={<DispositionsView />} />
          <Route path="call-configuration" element={<DispositionsView />} />
        </Routes>
      </div>
    </ConsoleLayout>
  );
}

