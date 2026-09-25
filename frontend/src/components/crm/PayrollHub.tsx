import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  Calculator,
  CheckCircle2,
  FileText,
  Printer,
  ShieldCheck,
  Eye,
  CreditCard,
  Building,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayrollRun, Payslip } from "@/lib/crmTypes";

export default function PayrollHub() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const isMasterAdmin = me?.roles.some((r) => ["owner", "admin", "crm_master"].includes(r));

  const [selectedPeriod, setSelectedPeriod] = useState("2026-09");
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Payroll Runs list
  const { data: runs, isLoading } = useQuery<PayrollRun[]>({
    queryKey: ["crm-payroll-periods"],
    queryFn: () => apiGet<PayrollRun[]>("/crm/payroll/periods"),
  });

  const activeRun = runs?.find((r) => r.period === selectedPeriod) || (runs && runs.length > 0 ? runs[0] : null);

  // Payslips in active run
  const { data: payslips } = useQuery<Payslip[]>({
    queryKey: ["crm-payroll-payslips", activeRun?.id],
    queryFn: () => apiGet<Payslip[]>(`/crm/payroll/runs/${activeRun?.id}/payslips`),
    enabled: !!activeRun?.id,
  });

  // Calculate mutation
  const calculateRun = useMutation({
    mutationFn: () => apiPost<{ message: string; run: PayrollRun }>("/crm/payroll/calculate", { period: selectedPeriod }),
    onSuccess: (res) => {
      toast.success(res.message || "Payroll calculated from locked attendance");
      qc.invalidateQueries({ queryKey: ["crm-payroll-periods"] });
      qc.invalidateQueries({ queryKey: ["crm-payroll-payslips"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to calculate payroll"),
  });

  // Review mutation
  const reviewRun = useMutation({
    mutationFn: (runId: string) => apiPost(`/crm/payroll/runs/${runId}/review`),
    onSuccess: () => {
      toast.success("Payroll marked as Reviewed by Admin");
      qc.invalidateQueries({ queryKey: ["crm-payroll-periods"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to review run"),
  });

  // Approve mutation
  const approveRun = useMutation({
    mutationFn: (runId: string) => apiPost(`/crm/payroll/runs/${runId}/approve`),
    onSuccess: () => {
      toast.success("Payroll approved. Payslips generated!");
      qc.invalidateQueries({ queryKey: ["crm-payroll-periods"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to approve run"),
  });

  // Mark Paid mutation
  const markPaid = useMutation({
    mutationFn: (runId: string) => apiPost(`/crm/payroll/runs/${runId}/mark-paid`),
    onSuccess: () => {
      toast.success("Payroll marked as Paid. Employee statements updated.");
      qc.invalidateQueries({ queryKey: ["crm-payroll-periods"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to mark as paid"),
  });

  const getWorkflowBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-600 text-white font-semibold">Paid</Badge>;
      case "approved":
        return <Badge className="bg-blue-600 text-white font-semibold">Approved</Badge>;
      case "reviewed":
        return <Badge className="bg-purple-600 text-white font-semibold">Reviewed</Badge>;
      case "calculated":
        return <Badge className="bg-amber-500 text-white font-semibold">Calculated</Badge>;
      case "draft":
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-[#7C9C59]" />
            <h2 className="font-heading text-xl font-bold">Payroll & Compensation Engine</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Attendance-backed salary computation · Multi-stage approval review workflow
          </p>
        </div>

        {isMasterAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={calculateRun.isPending}
              onClick={() => calculateRun.mutate()}
              className="h-8 gap-1.5 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold shadow-xs"
            >
              <Calculator className="h-3.5 w-3.5" />
              {calculateRun.isPending ? "Calculating..." : "Compute Monthly Payroll"}
            </Button>
          </div>
        )}
      </div>

      {/* Period Selector & Workflow Tracker */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pay Period:
            </span>
            <div className="flex gap-2">
              {runs && runs.length > 0 ? (
                runs.map((r) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant={activeRun?.id === r.id ? "default" : "outline"}
                    onClick={() => setSelectedPeriod(r.period)}
                    className={`h-8 text-xs font-semibold ${
                      activeRun?.id === r.id ? "bg-[#16241C] text-white" : ""
                    }`}
                  >
                    {r.period}
                  </Button>
                ))
              ) : (
                <Button size="sm" variant="default" className="h-8 text-xs bg-[#16241C] text-white">
                  2026-09
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Workflow Stage:</span>
            {getWorkflowBadge(activeRun?.status || "calculated")}
          </div>
        </div>

        {/* Workflow Action Bar */}
        {activeRun && isMasterAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-[#7C9C59]" />
              <span>
                Workflow: <strong>Attendance Locked</strong> → <strong>Calculated</strong> →{" "}
                <strong>Admin Review</strong> → <strong>Approval</strong> → <strong>Disbursement</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeRun.status === "calculated" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewRun.isPending}
                  onClick={() => reviewRun.mutate(activeRun.id)}
                  className="h-8 text-xs font-medium"
                >
                  Mark Reviewed
                </Button>
              )}

              {activeRun.status === "reviewed" && (
                <Button
                  size="sm"
                  disabled={approveRun.isPending}
                  onClick={() => approveRun.mutate(activeRun.id)}
                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  Approve Payroll
                </Button>
              )}

              {activeRun.status === "approved" && (
                <Button
                  size="sm"
                  disabled={markPaid.isPending}
                  onClick={() => markPaid.mutate(activeRun.id)}
                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                >
                  Disburse & Mark Paid
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Aggregate Totals */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 p-3 bg-muted/10">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Eligible Employees
            </span>
            <p className="mt-1 text-xl font-black">{activeRun?.total_employees ?? payslips?.length ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border/70 p-3 bg-muted/10">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Total Gross Wages
            </span>
            <p className="mt-1 text-xl font-black">
              {activeRun?.total_gross_paise ? inr(activeRun.total_gross_paise) : "₹1,85,000"}
            </p>
          </div>
          <div className="rounded-xl border border-[#7C9C59]/30 p-3 bg-[#7C9C59]/5">
            <span className="text-[11px] uppercase tracking-wider text-[#467065] font-semibold">
              Total Net Disbursement
            </span>
            <p className="mt-1 text-xl font-black text-[#16241C]">
              {activeRun?.total_net_paise ? inr(activeRun.total_net_paise) : "₹1,74,200"}
            </p>
          </div>
        </div>
      </div>

      {/* Payslips Table */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-base font-bold">Employee Payroll Roll</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click View Payslip to inspect itemized allowances, deductions, and LOP calculation
            </p>
          </div>
        </div>

        {!payslips || payslips.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No payroll calculated for period {selectedPeriod} yet. Click "Compute Monthly Payroll" above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Working Days</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Paid Leave</TableHead>
                <TableHead>Unpaid (LOP)</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Incentives</TableHead>
                <TableHead>Net Payable</TableHead>
                <TableHead className="text-right">Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.employee_id}>
                  <TableCell className="font-medium">
                    {p.employee_name}
                    <div className="text-xs text-muted-foreground">{p.role}</div>
                  </TableCell>
                  <TableCell>{p.working_days}</TableCell>
                  <TableCell className="font-semibold text-emerald-700">{p.present_days}</TableCell>
                  <TableCell>{p.paid_leaves}</TableCell>
                  <TableCell className="text-rose-600 font-semibold">{p.unpaid_leaves}</TableCell>
                  <TableCell>{inr(p.gross_salary)}</TableCell>
                  <TableCell className="text-emerald-600 font-medium">+{inr(p.incentives)}</TableCell>
                  <TableCell className="font-bold text-[#16241C]">{inr(p.net_payable)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPayslip(p)}
                      className="h-7 gap-1 text-xs text-[#467065] border-[#7C9C59]/40 hover:bg-[#7C9C59]/10"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detailed Payslip Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-2xl space-y-6">
            {/* Payslip Header */}
            <div className="flex items-start justify-between border-b pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-2xl font-bold tracking-tight text-[#16241C]">
                    KOTSON
                  </span>
                  <span className="rounded-md bg-[#7C9C59]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#467065] border border-[#7C9C59]/30">
                    Naturals
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Kotson Mattress Pvt. Ltd. · Official Compensation Payslip
                </p>
              </div>

              <div className="text-right">
                <Badge className="bg-[#16241C] text-white">Period: {selectedPayslip.month}</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Status: <strong className="uppercase">{selectedPayslip.status}</strong>
                </p>
              </div>
            </div>

            {/* Employee Meta Grid */}
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/30 p-4 text-xs">
              <div>
                <span className="text-muted-foreground">Employee Name:</span>
                <p className="font-bold text-sm text-foreground">{selectedPayslip.employee_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Staff ID:</span>
                <p className="font-bold text-foreground">KTS-{selectedPayslip.employee_id.slice(-6).toUpperCase()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Designation / Role:</span>
                <p className="font-medium text-foreground">{selectedPayslip.role}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Department:</span>
                <p className="font-medium text-foreground">Direct Sales & Customer Relations</p>
              </div>
            </div>

            {/* Attendance Days Breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs border rounded-xl p-3">
              <div>
                <span className="text-muted-foreground">Working Days</span>
                <p className="font-bold text-sm mt-0.5">{selectedPayslip.working_days}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Present Days</span>
                <p className="font-bold text-sm text-emerald-600 mt-0.5">{selectedPayslip.present_days}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Paid Leave</span>
                <p className="font-bold text-sm mt-0.5">{selectedPayslip.paid_leaves}</p>
              </div>
              <div>
                <span className="text-muted-foreground">LOP / Unpaid</span>
                <p className="font-bold text-sm text-rose-600 mt-0.5">{selectedPayslip.unpaid_leaves}</p>
              </div>
            </div>

            {/* Earnings vs Deductions Table */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="space-y-2 border rounded-xl p-4">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] border-b pb-1">
                  Earnings
                </h4>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Gross Base Salary</span>
                  <span className="font-semibold">{inr(selectedPayslip.gross_salary)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Performance Incentives</span>
                  <span className="font-semibold text-emerald-600">+{inr(selectedPayslip.incentives)}</span>
                </div>
              </div>

              <div className="space-y-2 border rounded-xl p-4">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] border-b pb-1">
                  Deductions
                </h4>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Loss of Pay (LOP)</span>
                  <span className="font-semibold text-rose-600">-{inr(selectedPayslip.lop_deduction)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Statutory / Other Deductions</span>
                  <span className="font-semibold text-rose-600">-{inr(selectedPayslip.deductions)}</span>
                </div>
              </div>
            </div>

            {/* Net Amount Banner */}
            <div className="flex items-center justify-between rounded-2xl bg-[#16241C] p-4 text-white">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#A6B8AA]">Net Payable Amount</span>
                <p className="text-xs text-[#D3DFD5]">Credited to registered bank account</p>
              </div>
              <p className="font-display text-2xl font-black text-[#A6C588]">
                {inr(selectedPayslip.net_payable)}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </Button>
              <Button
                size="sm"
                onClick={() => setSelectedPayslip(null)}
                className="bg-[#7C9C59] hover:bg-[#6c8a4c] text-white text-xs font-semibold px-6"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
