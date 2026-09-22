import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CallConfig, FormFieldDef } from "@/lib/crmTypes";

// Agent call form. The save order (connectivity -> disposition -> outcome -> form) is enforced
// server-side too; this UI only mirrors it. Nothing here claims a recording or a duration.
export default function CallForm({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ["crm-call-config-active"],
    queryFn: () => apiGet<CallConfig>("/crm/dispositions/config?active_only=true"),
  });

  const [conn, setConn] = useState("");
  const [disp, setDisp] = useState("");
  const [outcome, setOutcome] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [summary, setSummary] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [dueReason, setDueReason] = useState("");
  // A stable key per compose session: retrying the same save must not duplicate anything.
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  const dispositions = useMemo(() => (cfg?.dispositions ?? []).filter((d) => d.connectivity_code === conn), [cfg, conn]);
  const selectedDisp = dispositions.find((d) => d.code === disp);
  const form = cfg?.forms?.find((f) => f.is_active);
  const needsOutcome = !!selectedDisp?.requires_outcome;

  const save = useMutation({
    mutationFn: () =>
      apiPost(`/crm/leads/${leadId}/calls`, {
        connectivity_code: conn,
        disposition_code: disp,
        outcome_code: needsOutcome || outcome ? outcome || null : null,
        form_answers: answers,
        summary: summary || null,
        idempotency_key: idemKey,
        follow_up_due_at: dueAt ? new Date(dueAt).toISOString() : null,
        follow_up_reason: dueAt ? dueReason || "Follow-up scheduled with call" : null,
      }),
    onSuccess: () => {
      toast.success("Call saved — the lead stage is unchanged");
      setConn("");
      setDisp("");
      setOutcome("");
      setAnswers({});
      setSummary("");
      setDueAt("");
      setDueReason("");
      setIdemKey(crypto.randomUUID());
      qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
      qc.invalidateQueries({ queryKey: ["crm-followups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The call was rejected"),
  });

  if (!cfg?.configured) {
    return (
      <section className="rounded-2xl border border-dashed border-brand-leaf/50 bg-brand-sand/40 p-5" data-testid="call-form-not-configured">
        <h2 className="font-heading text-lg font-bold text-brand-deep">Call logging is not configured yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No connectivity or disposition has been approved and activated. Rather than store unapproved wording, saving a
          call stays disabled until the owner activates the options in Call Configuration.
        </p>
      </section>
    );
  }

  const renderField = (f: FormFieldDef) => {
    const val = answers[f.code];
    const set = (v: unknown) => setAnswers((a) => ({ ...a, [f.code]: v }));
    const id = `call-field-${f.code}`;
    const common = { id, "data-testid": id };
    return (
      <div key={f.code} className="grid gap-2">
        <Label htmlFor={id}>
          {f.label}
          {f.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        {f.type === "textarea" ? (
          <Textarea {...common} value={String(val ?? "")} onChange={(e) => set(e.target.value)} />
        ) : f.type === "number" ? (
          <Input
            {...common}
            type="number"
            className="min-h-11"
            value={val === undefined || val === null ? "" : String(val)}
            // 0 is a valid answer — only an empty string counts as missing.
            onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
          />
        ) : f.type === "checkbox" ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              {...common}
              type="checkbox"
              className="size-5"
              checked={val === true}
              // false is a valid stored answer, not a missing one.
              onChange={(e) => set(e.target.checked)}
            />
            Yes
          </label>
        ) : f.type === "radio" ? (
          <div className="flex flex-wrap gap-3" data-testid={id}>
            {f.options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={f.code}
                  className="size-4"
                  checked={val === o}
                  onChange={() => set(o)}
                  data-testid={`${id}-${o.replace(/\s+/g, "-").toLowerCase()}`}
                />
                {o}
              </label>
            ))}
          </div>
        ) : f.type === "multiselect" ? (
          <div className="flex flex-wrap gap-3" data-testid={id}>
            {f.options.map((o) => {
              const arr = Array.isArray(val) ? (val as string[]) : [];
              return (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={arr.includes(o)}
                    onChange={(e) => set(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                    data-testid={`${id}-${o.replace(/\s+/g, "-").toLowerCase()}`}
                  />
                  {o}
                </label>
              );
            })}
          </div>
        ) : f.type === "select" ? (
          <select
            {...common}
            value={String(val ?? "")}
            onChange={(e) => set(e.target.value || null)}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select…</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <Input {...common} className="min-h-11" value={String(val ?? "")} onChange={(e) => set(e.target.value)} />
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5" data-testid="call-form">
      <h2 className="font-heading text-lg font-bold">Log a call</h2>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="call-form-manual-note">
        Manually logged — no telephony provider is connected, so no recording or duration is recorded. Saving a call
        never changes the lead stage.
      </p>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="call-connectivity">Connectivity *</Label>
            <select
              id="call-connectivity"
              data-testid="call-connectivity-select"
              value={conn}
              onChange={(e) => {
                setConn(e.target.value);
                setDisp("");
                setOutcome("");
              }}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {(cfg.connectivities ?? []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="call-disposition">Disposition *</Label>
            <select
              id="call-disposition"
              data-testid="call-disposition-select"
              value={disp}
              disabled={!conn}
              onChange={(e) => {
                setDisp(e.target.value);
                setOutcome("");
              }}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">{conn ? "Select…" : "Choose connectivity first"}</option>
              {dispositions.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {needsOutcome && (
          <div className="grid gap-2">
            <Label htmlFor="call-outcome">Call outcome * (required by “{selectedDisp?.label}”)</Label>
            <select
              id="call-outcome"
              data-testid="call-outcome-select"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {(cfg.outcomes ?? []).map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              A “Purchase Commitment” outcome records what the customer said — it is not a purchase.
            </p>
          </div>
        )}

        {form && (
          <fieldset className="grid gap-3 rounded-xl border border-border p-4" data-testid="call-engagement-form">
            <legend className="px-1 text-sm font-semibold">
              {form.name} <span className="text-xs text-muted-foreground">v{form.version}</span>
            </legend>
            {form.fields.map(renderField)}
            {form.summary_field !== "off" && (
              <div className="grid gap-2">
                <Label htmlFor="call-summary">
                  Discussion summary{form.summary_field === "required" && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <Textarea id="call-summary" data-testid="call-summary-input" value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
            )}
          </fieldset>
        )}

        <fieldset className="grid gap-3 rounded-xl border border-dashed border-border p-4">
          <legend className="px-1 text-sm font-semibold">Schedule a follow-up (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="call-followup-due">Due (your local time, stored in IST)</Label>
              <Input
                id="call-followup-due"
                data-testid="call-followup-due-input"
                type="datetime-local"
                className="min-h-11"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="call-followup-reason">Reason</Label>
              <Input
                id="call-followup-reason"
                data-testid="call-followup-reason-input"
                className="min-h-11"
                value={dueReason}
                onChange={(e) => setDueReason(e.target.value)}
                placeholder="Confirm quote decision"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A follow-up is a separate reminder; it does not move the stage.</p>
        </fieldset>

        <Button
          onClick={() => save.mutate()}
          disabled={!conn || !disp || (needsOutcome && !outcome) || save.isPending}
          className="min-h-12 w-fit"
          data-testid="call-save-button"
        >
          {save.isPending ? "Saving…" : "Save call"}
        </Button>
      </div>
    </section>
  );
}
