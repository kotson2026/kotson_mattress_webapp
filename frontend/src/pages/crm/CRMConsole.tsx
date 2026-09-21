import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { CrmCustomer, CrmCustomerDetail, Inquiry } from "@/lib/types";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import ConsoleLayout from "@/components/layout/ConsoleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NAV = [
  { to: "/crm", label: "Customer directory" },
  { to: "/crm/inbox", label: "Support inbox" },
];

function DirectoryView() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data: customers } = useQuery({
    queryKey: ["crm-customers", q],
    queryFn: () => apiGet<CrmCustomer[]>(`/crm/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  return (
    <div className="grid gap-6">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="max-w-sm min-h-11" data-testid="crm-search-input" />
      {(customers ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground" data-testid="crm-customers-empty">
          No customers in your authorized scope.
        </p>
      ) : (
        <Table data-testid="crm-customers-table">
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Verified purchases</TableHead><TableHead className="text-right">Lifetime spend</TableHead><TableHead>Last order</TableHead></TableRow></TableHeader>
          <TableBody>
            {(customers ?? []).map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/crm/customers/${c.id}`)} data-testid={`crm-customer-${c.email}`}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-xs">{c.email}</TableCell>
                <TableCell className="text-right tabular-nums">{c.verified_purchases}</TableCell>
                <TableCell className="text-right tabular-nums">{inr(c.lifetime_spend_paise)}</TableCell>
                <TableCell className="text-xs">{c.last_order_at ? fmtDate(c.last_order_at) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">
        Lifetime spend counts server-verified paid orders only. Payment card details are never stored or shown. CRM employees see only
        customers linked to their assigned cases.
      </p>
    </div>
  );
}

function CustomerDetailView() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const { data, isError } = useQuery({
    queryKey: ["crm-customer", id],
    queryFn: () => apiGet<CrmCustomerDetail>(`/crm/customers/${id}`),
    retry: false,
  });

  const addNote = useMutation({
    mutationFn: () => apiPost(`/crm/customers/${id}/notes`, { body: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customer", id] });
      setNote("");
      toast.success("Note added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Not permitted"),
  });

  if (isError) {
    return <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm" data-testid="crm-customer-denied">This customer is not in your authorized scope.</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-border bg-card p-6" data-testid="crm-customer-detail">
        <h2 className="font-heading text-xl font-bold">{data?.customer.name}</h2>
        <p className="text-sm text-muted-foreground">{data?.customer.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Referral code: {data?.customer.referral_code ?? "—"} · Referred by: {data?.customer.referred_by ?? "—"} · Joined{" "}
          {data ? fmtDate(data.customer.created_at) : "—"}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6" data-testid="crm-customer-orders">
        <h3 className="font-heading text-lg font-bold">Order history (read-only)</h3>
        {(data?.orders ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No orders.</p>
        ) : (
          <Table className="mt-4">
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Payment</TableHead><TableHead>Fulfilment</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.orders ?? []).map((o) => (
                <TableRow key={o.order_number}>
                  <TableCell>{o.order_number}<p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p></TableCell>
                  <TableCell><Badge variant={o.payment_status === "paid" ? "default" : "outline"}>{o.payment_status}</Badge></TableCell>
                  <TableCell className="text-xs">{o.fulfilment_status.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right tabular-nums">{inr(o.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6" data-testid="crm-customer-notes">
        <h3 className="font-heading text-lg font-bold">Notes & interactions</h3>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a timestamped note…" className="mt-3" data-testid="crm-note-input" />
        <Button className="mt-2 min-h-11" onClick={() => addNote.mutate()} disabled={note.length < 2 || addNote.isPending} data-testid="crm-note-submit">Add note</Button>
        <ul className="mt-4 space-y-2 text-sm">
          {(data?.notes ?? []).map((n) => (
            <li key={n.id} className="rounded-xl border border-border p-3">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.author_email} · {fmtDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InboxView() {
  const qc = useQueryClient();
  const { data: inquiries } = useQuery({ queryKey: ["crm-inquiries"], queryFn: () => apiGet<Inquiry[]>("/crm/inquiries") });

  const patch = useMutation({
    mutationFn: (p: { id: string; body: Record<string, string> }) => apiPatch(`/crm/inquiries/${p.id}`, p.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm-inquiries"] }); toast.success("Inquiry updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Not permitted"),
  });

  return (
    <div className="grid gap-4">
      {(inquiries ?? []).length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground" data-testid="crm-inbox-empty">
          No inquiries in your scope. Messages from the contact form land here.
        </p>
      )}
      {(inquiries ?? []).map((i) => (
        <section key={i.id} className="rounded-2xl border border-border bg-card p-6" data-testid={`crm-inquiry-${i.id}`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-lg font-bold">{i.subject}</p>
            <Badge variant="outline">{i.issue_type}</Badge>
            <Badge variant={i.status === "resolved" ? "default" : "secondary"}>{i.status.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">{i.priority}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(i.created_at)}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{i.name} · {i.email}{i.phone ? ` · ${i.phone}` : ""}</p>
          <p className="mt-3 text-sm">{i.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["in_progress", "resolved"].map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => patch.mutate({ id: i.id, body: { status: s } })} data-testid={`crm-inquiry-${i.id}-${s}`}>
                {s.replace(/_/g, " ")}
              </Button>
            ))}
            {["high", "normal", "low"].map((p) => (
              <Button key={p} variant="ghost" size="sm" onClick={() => patch.mutate({ id: i.id, body: { priority: p } })} data-testid={`crm-inquiry-${i.id}-priority-${p}`}>
                {p}
              </Button>
            ))}
          </div>
          {i.notes.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {i.notes.map((n, x) => (
                <li key={x}>{n.body} — {n.author_email} · {fmtDateTime(n.at)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default function CRMConsole() {
  return (
    <ConsoleLayout
      area="CRM"
      title="Customer experience workspace"
      allowedRoles={["owner", "crm_master", "crm_manager", "crm_employee"]}
      nav={NAV}
    >
      <Routes>
        <Route index element={<DirectoryView />} />
        <Route path="customers/:id" element={<CustomerDetailView />} />
        <Route path="inbox" element={<InboxView />} />
      </Routes>
    </ConsoleLayout>
  );
}
