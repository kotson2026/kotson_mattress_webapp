import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";
import DataTablePagination from "@/components/ui/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  Clock,
  UserCheck,
  FileText,
  Filter,
  Eye,
  CheckCircle2,
} from "lucide-react";

export default function AuditLogView() {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryParams = new URLSearchParams({
    limit: "250",
    ...(search ? { q: search } : {}),
    ...(filterAction !== "all" ? { action: filterAction } : {}),
  }).toString();

  const { data: entries, isLoading, isFetching, refetch } = useQuery<AuditEntry[]>({
    queryKey: ["admin-audit-full", search, filterAction],
    queryFn: () => apiGet<AuditEntry[]>(`/admin/audit?${queryParams}`),
  });

  const categories = [
    { id: "all", label: "All Events" },
    { id: "staff", label: "Staff & Roles" },
    { id: "cms", label: "Website & Content" },
    { id: "inventory", label: "Inventory" },
    { id: "dealer", label: "Dealers" },
    { id: "settings", label: "Settings & Config" },
    { id: "order", label: "Orders" },
  ];

  const getActionColor = (action: string) => {
    if (action.startsWith("staff")) return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200";
    if (action.startsWith("settings")) return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200";
    if (action.startsWith("dealer")) return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200";
    if (action.startsWith("inventory")) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200";
    if (action.startsWith("cms")) return "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200";
    return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-200";
  };

  const exportCsv = () => {
    if (!entries || entries.length === 0) return;
    const headers = ["ID", "Timestamp", "Actor Email", "Action", "Entity", "Entity ID", "Detail"];
    const rows = entries.map((e) => [
      e.id,
      `"${e.created_at}"`,
      `"${e.actor_email ?? 'system'}"`,
      `"${e.action}"`,
      `"${e.entity}"`,
      `"${e.entity_id}"`,
      `"${(e.detail ?? '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kotson_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header description */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-brand-deep" />
            Audit Log Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete, immutable system event log tracking all privileged mutations, role grants, inventory adjustments, and content publications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9">
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!entries || entries.length === 0} className="h-9">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-deep/10 p-2.5 text-brand-deep">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Events Loaded</p>
              <p className="font-heading text-2xl font-black">{entries?.length ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unique Staff Actors</p>
              <p className="font-heading text-2xl font-black">
                {new Set(entries?.map((e) => e.actor_email).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance Status</p>
              <p className="font-heading text-lg font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="h-4 w-4" /> Immutable Record
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, action, entity or ID…"
            className="pl-9 min-h-10 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground mr-1">
            <Filter className="h-3 w-3" /> Filter:
          </span>
          {categories.map((c) => (
            <Button
              key={c.id}
              variant={filterAction === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterAction(c.id)}
              className="text-xs h-8"
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">Loading audit events…</div>
        ) : (entries ?? []).length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No audit log entries found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[180px]">Actor</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                  <TableHead className="w-[140px]">Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[80px] text-right">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entries ?? [])
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((e) => (
                  <TableRow key={e.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {fmtDateTime(e.created_at)}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      <div className="truncate max-w-[160px]" title={e.actor_email ?? "system"}>
                        {e.actor_email ?? "system"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[11px] font-mono font-medium ${getActionColor(e.action)}`}>
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      <span className="font-semibold text-foreground">{e.entity}</span>
                      <span className="text-[11px] opacity-70 ml-1">/{e.entity_id?.slice(0, 8)}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="line-clamp-2 max-w-xl font-mono text-[11px] bg-muted/30 px-2 py-1 rounded">
                        {e.detail || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setSelectedEntry(e)}
                        title="View Full Entry"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {(entries ?? []).length > 0 && (
          <div className="border-t border-border px-4 py-1 bg-muted/10">
            <DataTablePagination
              totalItems={entries?.length ?? 0}
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </div>

      {/* Selected Entry Modal / Inspection Drawer */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-brand-deep" />
                <h3 className="font-heading text-lg font-bold">Audit Entry Details</h3>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {selectedEntry.action}
              </Badge>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border/50 text-xs">
                <span className="font-semibold text-muted-foreground">Event ID</span>
                <span className="col-span-2 font-mono">{selectedEntry.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border/50 text-xs">
                <span className="font-semibold text-muted-foreground">Timestamp</span>
                <span className="col-span-2">{fmtDateTime(selectedEntry.created_at)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border/50 text-xs">
                <span className="font-semibold text-muted-foreground">Actor</span>
                <span className="col-span-2 font-medium">{selectedEntry.actor_email ?? "system"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 border-b border-border/50 text-xs">
                <span className="font-semibold text-muted-foreground">Entity Target</span>
                <span className="col-span-2 font-mono">{selectedEntry.entity} (ID: {selectedEntry.entity_id})</span>
              </div>
              <div className="pt-2">
                <span className="text-xs font-semibold text-muted-foreground">Payload / Mutation Detail:</span>
                <pre className="mt-1.5 max-h-48 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs text-foreground whitespace-pre-wrap break-all">
                  {selectedEntry.detail || "No additional payload recorded."}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
