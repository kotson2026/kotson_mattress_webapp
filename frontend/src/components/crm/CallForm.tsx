import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  FileText,
  AlertCircle,
  HelpCircle,
  Play,
  Square,
  TrendingUp,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CallConfig, FormFieldDef } from "@/lib/crmTypes";

interface CallFormProps {
  leadId: string;
  leadPhone?: string | null;
  autoStartCall?: boolean;
}

export default function CallForm({ leadId, leadPhone, autoStartCall = false }: CallFormProps) {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({
    queryKey: ["crm-call-config-active"],
    queryFn: () => apiGet<CallConfig>("/crm/dispositions/config?active_only=true"),
  });

  // Call timer state
  const [callActive, setCallActive] = useState(autoStartCall);
  const [callStartMs, setCallStartMs] = useState<number | null>(autoStartCall ? Date.now() : null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (callActive && callStartMs) {
      const interval = setInterval(() => {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - callStartMs) / 1000)));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callActive, callStartMs]);

  const handleStartTimer = () => {
    setCallActive(true);
    setCallStartMs(Date.now());
    setElapsedSec(0);
    if (leadPhone) {
      // Trigger dialer if possible on mobile/device
      window.location.href = `tel:${leadPhone.replace(/\s+/g, "")}`;
    }
  };

  const handleEndTimer = () => {
    setCallActive(false);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const [conn, setConn] = useState("");
  const [disp, setDisp] = useState("");
  const [outcome, setOutcome] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [summary, setSummary] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [dueReason, setDueReason] = useState("");
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  // Filter dispositions based on selected connectivity
  const dispositions = useMemo(
    () => (cfg?.dispositions ?? []).filter((d) => d.connectivity_code === conn),
    [cfg, conn]
  );
  const selectedDisp = dispositions.find((d) => d.code === disp);
  const form = cfg?.forms?.find((f) => f.is_active);
  const needsOutcome = !!selectedDisp?.requires_outcome;

  const connectedConnCode = useMemo(() => {
    return (cfg?.connectivities ?? []).find((c) => c.code.toLowerCase().includes("connected") && !c.code.toLowerCase().includes("not"))?.code || "connected";
  }, [cfg]);

  const notConnectedConnCode = useMemo(() => {
    return (cfg?.connectivities ?? []).find((c) => c.code.toLowerCase().includes("not"))?.code || "not_connected";
  }, [cfg]);

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
      toast.success("Call disposition saved — authoritative record created");
      setCallActive(false);
      setCallStartMs(null);
      setElapsedSec(0);
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
      qc.invalidateQueries({ queryKey: ["crm-calls-all"] });
      qc.invalidateQueries({ queryKey: ["crm-analytics-today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The call was rejected"),
  });

  if (!cfg?.configured) {
    return (
      <section
        className="rounded-2xl border border-dashed border-[#7C9C59]/40 bg-[#F7F4EE]/50 p-5"
        data-testid="call-form-not-configured"
      >
        <h2 className="font-heading text-base font-bold text-[#11291F]">Call logging is pending configuration</h2>
        <p className="mt-1 text-xs text-[#6B716C]">
          No active connectivity or disposition is activated in Call Configuration. Activate options to begin logging.
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
      <div key={f.code} className="grid gap-1.5">
        <Label htmlFor={id} className="text-xs font-semibold text-[#11291F]">
          {f.label}
          {f.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        {f.type === "textarea" ? (
          <Textarea
            {...common}
            value={String(val ?? "")}
            onChange={(e) => set(e.target.value)}
            className="border-[#D8DDD7] text-xs min-h-[60px]"
          />
        ) : f.type === "number" ? (
          <Input
            {...common}
            type="number"
            className="min-h-10 text-xs border-[#D8DDD7]"
            value={val === undefined || val === null ? "" : String(val)}
            onChange={(e) => set(e.target.value === "" ? null : Number(e.target.value))}
          />
        ) : f.type === "checkbox" ? (
          <label className="flex items-center gap-2 text-xs text-[#2D2D2D]">
            <input
              {...common}
              type="checkbox"
              className="size-4 accent-[#467065]"
              checked={val === true}
              onChange={(e) => set(e.target.checked)}
            />
            Yes
          </label>
        ) : f.type === "radio" ? (
          <div className="flex flex-wrap gap-2" data-testid={id}>
            {f.options.map((o) => (
              <label
                key={o}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  val === o
                    ? "border-[#467065] bg-[#467065]/10 text-[#11291F] font-semibold"
                    : "border-[#D8DDD7] bg-white text-[#2D2D2D] hover:bg-[#F7F4EE]"
                }`}
              >
                <input
                  type="radio"
                  name={f.code}
                  className="sr-only"
                  checked={val === o}
                  onChange={() => set(o)}
                />
                {o}
              </label>
            ))}
          </div>
        ) : f.type === "multiselect" ? (
          <div className="flex flex-wrap gap-2" data-testid={id}>
            {f.options.map((o) => {
              const arr = Array.isArray(val) ? (val as string[]) : [];
              const isSelected = arr.includes(o);
              return (
                <label
                  key={o}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? "border-[#467065] bg-[#467065]/10 text-[#11291F] font-semibold"
                      : "border-[#D8DDD7] bg-white text-[#2D2D2D] hover:bg-[#F7F4EE]"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isSelected}
                    onChange={(e) => set(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
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
            className="min-h-10 rounded-md border border-[#D8DDD7] bg-white px-3 text-xs text-[#2D2D2D] focus:border-[#467065] focus:outline-none"
          >
            <option value="">Select…</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <Input
            {...common}
            className="min-h-10 text-xs border-[#D8DDD7]"
            value={String(val ?? "")}
            onChange={(e) => set(e.target.value)}
          />
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-[#E8EDE7] bg-white p-5 shadow-2xs" data-testid="call-form">
      {/* ── Active Call Timer Header (Inspired by Reference Screenshot) ── */}
      <div className="flex items-center justify-between border-b border-[#E8EDE7] pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-9 items-center justify-center rounded-lg ${
              callActive ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-[#11291F] text-[#F7F4EE]"
            }`}
          >
            <PhoneCall className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-[#11291F]">Customer Call Session</h2>
            <p className="text-[11px] text-[#6B716C]">
              {callActive ? "Call in progress with lead" : "Dial customer to begin consultation"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {callActive ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                Time elapsed | {formatTimer(elapsedSec)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEndTimer}
                className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
              >
                <Square className="mr-1 size-3 fill-current" />
                End Call
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleStartTimer}
              className="h-8 bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] text-xs font-semibold"
            >
              <Play className="mr-1.5 size-3 fill-current text-[#7C9C59]" />
              Start Call
            </Button>
          )}
        </div>
      </div>

      {/* ── Two-Path Workflow: "Was call connected?" (Exact Reference Workflow) ── */}
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B716C] block mb-2">
            Was call connected? <span className="text-destructive">*</span>
          </Label>

          <div className="grid grid-cols-2 gap-3">
            {/* NOT CONNECTED option */}
            <button
              type="button"
              onClick={() => {
                setConn(notConnectedConnCode);
                setDisp("");
                setOutcome("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl p-3 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                conn === notConnectedConnCode
                  ? "border-destructive bg-destructive/10 text-destructive shadow-xs"
                  : "border-[#E8EDE7] bg-white text-[#6B716C] hover:border-destructive/40 hover:bg-destructive/5"
              }`}
            >
              <PhoneOff className="size-4" />
              Not Connected
            </button>

            {/* YES CONNECTED option */}
            <button
              type="button"
              onClick={() => {
                setConn(connectedConnCode);
                setDisp("");
                setOutcome("");
              }}
              className={`flex items-center justify-center gap-2 rounded-xl p-3 border-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                conn === connectedConnCode
                  ? "border-[#467065] bg-[#467065]/10 text-[#11291F] shadow-xs"
                  : "border-[#E8EDE7] bg-white text-[#6B716C] hover:border-[#467065]/40 hover:bg-[#467065]/5"
              }`}
            >
              <PhoneCall className="size-4" />
              Yes Connected
            </button>
          </div>
        </div>

        {/* ── Dispositions Chips (Filtered Authoritatively by Connectivity) ── */}
        {conn && (
          <div className="space-y-2">
            <Label className="text-xs font-bold text-[#11291F] flex items-center justify-between">
              <span>Select Disposition Reason <span className="text-destructive">*</span></span>
              <span className="text-[10px] text-[#6B716C] font-normal">Configured by CRM Master</span>
            </Label>

            <div className="flex flex-wrap gap-2">
              {dispositions.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => {
                    setDisp(d.code);
                    setOutcome("");
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-medium border transition-all cursor-pointer ${
                    disp === d.code
                      ? "border-[#11291F] bg-[#11291F] text-[#F7F4EE] shadow-2xs font-semibold"
                      : "border-[#D8DDD7] bg-white text-[#2D2D2D] hover:bg-[#F7F4EE] hover:border-[#467065]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Call Outcome (if required by selected disposition) ── */}
        {needsOutcome && (
          <div className="space-y-1.5 rounded-xl border border-[#E8EDE7] bg-[#F7F4EE]/40 p-3">
            <Label htmlFor="call-outcome" className="text-xs font-bold text-[#11291F]">
              Call Outcome <span className="text-destructive">* (required by “{selectedDisp?.label}”)</span>
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(cfg.outcomes ?? []).map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setOutcome(o.code)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
                    outcome === o.code
                      ? "border-[#467065] bg-[#467065] text-white font-semibold"
                      : "border-[#D8DDD7] bg-white text-[#2D2D2D] hover:bg-[#F7F4EE]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Connected Form Questions (Primary Sleep Issue, Firmness, Size, etc.) ── */}
        {conn === connectedConnCode && form && (
          <fieldset className="grid gap-3 rounded-xl border border-[#E8EDE7] bg-[#F7F4EE]/30 p-4" data-testid="call-engagement-form">
            <legend className="px-1 text-xs font-bold text-[#11291F] uppercase tracking-wider">
              {form.name} <span className="text-[10px] text-[#6B716C] font-normal">v{form.version}</span>
            </legend>
            {form.fields.map(renderField)}
          </fieldset>
        )}

        {/* ── Discussion Summary ── */}
        <div className="space-y-1.5">
          <Label htmlFor="call-summary" className="text-xs font-semibold text-[#11291F]">
            Discussion Notes & Summary
          </Label>
          <Textarea
            id="call-summary"
            data-testid="call-summary-input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Key discussion points, customer firmness feedback, size requirement, or quote requested..."
            className="border-[#D8DDD7] text-xs min-h-[70px]"
          />
        </div>

        {/* ── Follow-Up Scheduler ── */}
        <fieldset className="grid gap-3 rounded-xl border border-dashed border-[#D8DDD7] p-3.5 bg-white">
          <legend className="px-1 text-xs font-semibold text-[#11291F] flex items-center gap-1.5">
            <Calendar className="size-3.5 text-[#467065]" />
            Schedule Follow-up Reminder (Optional)
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="call-followup-due" className="text-[11px] text-[#6B716C]">
                Due Date & Time (IST)
              </Label>
              <Input
                id="call-followup-due"
                data-testid="call-followup-due-input"
                type="datetime-local"
                className="min-h-9 text-xs border-[#D8DDD7]"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="call-followup-reason" className="text-[11px] text-[#6B716C]">
                Follow-up Reason
              </Label>
              <Input
                id="call-followup-reason"
                data-testid="call-followup-reason-input"
                className="min-h-9 text-xs border-[#D8DDD7]"
                value={dueReason}
                onChange={(e) => setDueReason(e.target.value)}
                placeholder="e.g. Call back after mattress firmness check"
              />
            </div>
          </div>
        </fieldset>

        {/* ── Save Action ── */}
        <div className="pt-2 flex items-center justify-between">
          <p className="text-[11px] text-[#6B716C]">
            Saving records authoritative call history. Stage moves independently.
          </p>
          <Button
            onClick={() => save.mutate()}
            disabled={!conn || !disp || (needsOutcome && !outcome) || save.isPending}
            className="min-h-10 px-5 bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs transition-colors"
            data-testid="call-save-button"
          >
            {save.isPending ? "Saving Call…" : "Save Call Record"}
          </Button>
        </div>
      </div>
    </section>
  );
}
