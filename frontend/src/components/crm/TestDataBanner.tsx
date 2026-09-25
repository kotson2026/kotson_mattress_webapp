import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, AlertTriangle, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { TestDataStatus } from "@/lib/crmTypes";

export default function TestDataBanner() {
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery<TestDataStatus>({
    queryKey: ["crm-test-data-status"],
    queryFn: () => apiGet<TestDataStatus>("/crm/test-data/status"),
    staleTime: 5000,
  });

  const seed = useMutation({
    mutationFn: () => apiPost<{ message: string; leads_seeded: number }>("/crm/test-data/seed"),
    onSuccess: (data) => {
      toast.success(data.message || `Seeded ${data.leads_seeded} test leads successfully`);
      qc.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || "Failed to seed test data"),
  });

  const purge = useMutation({
    mutationFn: () => apiPost<{ message: string; deleted: Record<string, number> }>("/crm/test-data/purge"),
    onSuccess: (data) => {
      toast.success(data.message || "Cleaned up all CRM test data safely");
      qc.invalidateQueries();
    },
    onError: (err: any) => toast.error(err.message || "Failed to purge test data"),
  });

  if (isLoading || !status) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 shadow-xs transition-all ${
        status.is_test_data_active
          ? "border-amber-200 bg-amber-50/80 text-amber-950"
          : "border-[#7C9C59]/30 bg-[#7C9C59]/10 text-[#2D2D2D]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              status.is_test_data_active ? "bg-amber-100 text-amber-700" : "bg-[#7C9C59]/20 text-[#467065]"
            }`}
          >
            {status.is_test_data_active ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs uppercase tracking-wider">
                {status.is_test_data_active ? "Test Mode Active" : "Production Clean State"}
              </span>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-bold">
                is_test_data: {status.is_test_data_active ? "TRUE" : "NONE"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.is_test_data_active
                ? `Demo data active: ${status.counts?.leads ?? 0} leads · ${status.counts?.calls ?? 0} calls · ${status.counts?.attendance ?? 0} attendance records. Zero impact on real revenue.`
                : "No active test data in the CRM database. You can generate a full simulation suite for demonstration."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!status.is_test_data_active ? (
            <Button
              size="sm"
              variant="outline"
              disabled={seed.isPending}
              onClick={() => seed.mutate()}
              className="h-8 gap-1.5 border-[#7C9C59]/40 bg-white text-[#467065] hover:bg-[#7C9C59]/10 text-xs font-medium"
            >
              <Database className="h-3.5 w-3.5" />
              {seed.isPending ? "Seeding..." : "Load Demo Suite"}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={seed.isPending || purge.isPending}
                onClick={() => seed.mutate()}
                className="h-8 gap-1.5 border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs font-medium"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${seed.isPending ? "animate-spin" : ""}`} />
                Re-Seed
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={purge.isPending}
                onClick={() => {
                  if (window.confirm("Purge all test leads, calls, attendance, and payroll records marked with is_test_data=true? Real data will be preserved.")) {
                    purge.mutate();
                  }
                }}
                className="h-8 gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {purge.isPending ? "Purging..." : "Purge Test Data"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
