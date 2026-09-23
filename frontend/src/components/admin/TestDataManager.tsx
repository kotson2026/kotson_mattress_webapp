import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Users,
  ShoppingBag,
  Building2,
  Truck,
  Sparkles,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

interface TestDataStatus {
  is_seeded: boolean;
  batch_id: string;
  seeded_at: string | null;
  counts: {
    customers: number;
    staff: number;
    orders: number;
    dealers: number;
    dealer_orders: number;
    carts: number;
    leads: number;
    pipelines: number;
    campaigns: number;
    shipments: number;
    returns: number;
    inventory_adjustments: number;
    audit_entries: number;
  };
}

export default function TestDataManager() {
  const qc = useQueryClient();
  const [confirmCleanOpen, setConfirmCleanOpen] = useState(false);

  const { data: status, isLoading, isFetching, refetch } = useQuery<TestDataStatus>({
    queryKey: ["admin-test-data-status"],
    queryFn: () => apiGet<TestDataStatus>("/admin/test-data/status"),
  });

  const seedMutation = useMutation({
    mutationFn: () => apiPost("/admin/test-data/seed", {}),
    onSuccess: () => {
      toast.success("Default test dataset seeded successfully!");
      invalidateAllAdmin();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to seed test data"),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiPost("/admin/test-data/reset", {}),
    onSuccess: () => {
      toast.success("Test dataset purged and cleanly re-seeded!");
      invalidateAllAdmin();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to reset test data"),
  });

  const cleanupMutation = useMutation({
    mutationFn: () => apiDelete("/admin/test-data/cleanup"),
    onSuccess: () => {
      toast.success("All seeded test data safely purged!");
      setConfirmCleanOpen(false);
      invalidateAllAdmin();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to cleanup test data"),
  });

  const invalidateAllAdmin = () => {
    qc.invalidateQueries({ queryKey: ["admin-test-data-status"] });
    qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-orders-central"] });
    qc.invalidateQueries({ queryKey: ["admin-sales-summary-phase2"] });
    qc.invalidateQueries({ queryKey: ["catalog-products"] });
    qc.invalidateQueries({ queryKey: ["admin-audit"] });
    refetch();
  };

  const counts = status?.counts;

  return (
    <div className="space-y-6" data-testid="test-data-manager">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-brand-leaf/10 p-2.5 text-brand-leaf">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold text-foreground">
                  Development & Test Data System
                </h2>
                {status?.is_seeded ? (
                  <Badge className="bg-brand-leaf/20 text-brand-leaf border-brand-leaf/40 text-xs font-mono font-bold">
                    TEST DATA ACTIVE
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    NO TEST DATA
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Batch ID: <span className="font-mono font-semibold">{status?.batch_id || "KOTSON_DEV_SEED_V1"}</span> · Restricted strictly to Owner Admin
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {!status?.is_seeded ? (
            <Button
              size="sm"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="h-9 gap-1.5 bg-brand-deep text-white hover:bg-brand-deep/90 text-xs shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {seedMutation.isPending ? "Seeding..." : "Seed Default Test Data"}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="h-9 gap-1.5 text-xs"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${resetMutation.isPending ? "animate-spin" : ""}`} />
                {resetMutation.isPending ? "Resetting..." : "Reset Test Data"}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmCleanOpen(true)}
                className="h-9 gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove All Test Data
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Safety & Architecture Notice */}
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-brand-leaf" />
          <span>Zero-Pollution Test Data Architecture</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Every generated test record is tagged with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">is_test_data = true</code> and <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">seed_batch_id = "KOTSON_DEV_SEED_V1"</code>.
          Transactions reference existing genuine Kotson products and catalog variants without duplicating master records.
          When clicking <strong>Remove All Test Data</strong>, the system cleans up in strict dependency order and guarantees <strong>zero orphaned records</strong> and leaves genuine data 100% untouched.
        </p>
      </div>

      {/* Seed Record Breakdown Counters */}
      <section className="space-y-3">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Current Seeded Dataset Metrics
        </h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {/* Orders */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5 text-brand-deep" /> Seeded Orders
            </span>
            <p className="mt-2 font-heading text-2xl font-extrabold text-foreground">
              {isLoading ? "—" : counts?.orders ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Across all 4 categories & channels</p>
          </div>

          {/* Customers */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-brand-leaf" /> Test Customers
            </span>
            <p className="mt-2 font-heading text-2xl font-extrabold text-foreground">
              {isLoading ? "—" : counts?.customers ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">With Telangana & AP locations</p>
          </div>

          {/* Dealers */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-amber-600" /> Dealers & Quotes
            </span>
            <p className="mt-2 font-heading text-2xl font-extrabold text-foreground">
              {isLoading ? "—" : counts?.dealers ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              5 approved · 5 pending · {counts?.dealer_orders ?? 0} B2B orders
            </p>
          </div>

          {/* CRM Leads */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-brand-deep" /> CRM Leads & Stages
            </span>
            <p className="mt-2 font-heading text-2xl font-extrabold text-foreground">
              {isLoading ? "—" : counts?.leads ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {counts?.pipelines ?? 0} pipelines · {counts?.campaigns ?? 0} campaigns
            </p>
          </div>

          {/* Shipments & Returns */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Truck className="h-3.5 w-3.5 text-blue-600" /> Logistics & Returns
            </span>
            <p className="mt-2 font-heading text-2xl font-extrabold text-foreground">
              {isLoading ? "—" : (counts?.shipments ?? 0) + (counts?.returns ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {counts?.shipments ?? 0} shipments · {counts?.returns ?? 0} sleep trials
            </p>
          </div>
        </div>
      </section>

      {/* Confirmation Modal for Cleanup */}
      {confirmCleanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-foreground">
                Remove All Test Data?
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This will safely purge all seeded test orders, test customers, dealer applications, CRM leads, and test inventory records belonging to batch <strong className="text-foreground">KOTSON_DEV_SEED_V1</strong>.
              <br /><br />
              Genuine store master data, products, site settings, and real customer accounts will remain untouched.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmCleanOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={cleanupMutation.isPending}
                onClick={() => cleanupMutation.mutate()}
                className="text-xs h-8"
              >
                {cleanupMutation.isPending ? "Purging..." : "Confirm & Remove Test Data"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
