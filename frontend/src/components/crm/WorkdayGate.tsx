import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useMe } from "@/lib/session";
import { Button } from "@/components/ui/button";
import type { WorkdayStatus } from "@/lib/crmTypes";

interface WorkdayGateProps {
  onBypass?: () => void;
  allowBypass?: boolean;
}

export default function WorkdayGate({ onBypass, allowBypass = false }: WorkdayGateProps) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [localSeconds, setLocalSeconds] = useState(0);

  const { data: status, isLoading } = useQuery<WorkdayStatus>({
    queryKey: ["crm-workday-status"],
    queryFn: () => apiGet<WorkdayStatus>("/crm/workforce/workday-status"),
    refetchInterval: 15000,
  });

  const clockIn = useMutation({
    mutationFn: () => apiPost<{ message: string; record: any }>("/crm/workforce/clock-in"),
    onSuccess: (data) => {
      toast.success(data.message || "Clocked in successfully. Workday started!");
      qc.invalidateQueries({ queryKey: ["crm-workday-status"] });
      qc.invalidateQueries({ queryKey: ["crm-workforce-stats"] });
    },
    onError: (err: any) => toast.error(err.message || "Clock-in failed"),
  });

  const clockOut = useMutation({
    mutationFn: () => apiPost<{ message: string; record: any }>("/crm/workforce/clock-out"),
    onSuccess: (data) => {
      toast.success(data.message || "Clocked out successfully. Good job today!");
      qc.invalidateQueries({ queryKey: ["crm-workday-status"] });
      qc.invalidateQueries({ queryKey: ["crm-workforce-stats"] });
    },
    onError: (err: any) => toast.error(err.message || "Clock-out failed"),
  });

  const breakStart = useMutation({
    mutationFn: () => apiPost<{ message: string }>("/crm/workforce/break-start"),
    onSuccess: () => {
      toast.info("Break started. Enjoy your break!");
      qc.invalidateQueries({ queryKey: ["crm-workday-status"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to start break"),
  });

  const breakEnd = useMutation({
    mutationFn: () => apiPost<{ message: string }>("/crm/workforce/break-end"),
    onSuccess: () => {
      toast.success("Welcome back! Resumed active duty.");
      qc.invalidateQueries({ queryKey: ["crm-workday-status"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to end break"),
  });

  // Local ticker for smooth visual feedback between server polls
  useEffect(() => {
    if (status?.status === "clocked_in" || status?.status === "on_break") {
      const interval = setInterval(() => {
        setLocalSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status?.status]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Verifying server attendance timestamps...
      </div>
    );
  }

  const isMasterAdmin = me?.roles.some((r) => ["owner", "admin", "crm_master"].includes(r));
  const isClockedIn = status?.status === "clocked_in";
  const isOnBreak = status?.status === "on_break";
  const isClockedOut = status?.status === "clocked_out";
  const notClockedIn = status?.status === "not_clocked_in";

  const todayFormatted = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const formatHoursMins = (minutes = 0) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#24372B]/20 bg-gradient-to-br from-[#16241C] via-[#1E3024] to-[#25382B] p-8 text-white shadow-2xl">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#7C9C59]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#467065]/20 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left Column: Greeting, Shift info, Server Time */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7C9C59]/40 bg-[#7C9C59]/15 px-3 py-1 text-xs font-semibold text-[#A6C588]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Kotson Workforce Gate · Server-Verified Attendance</span>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"},{" "}
              {me?.name || "Kotson Team Member"}
            </h2>
            <p className="mt-1 text-xs text-[#D3DFD5]/80 font-medium">
              {todayFormatted} · Standard Shift (09:30 AM – 06:30 PM IST)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-3 py-1.5 text-[#D3DFD5]">
              <Clock className="h-3.5 w-3.5 text-[#7C9C59]" />
              <span>Shift: 9.0 Hours Full-Day</span>
            </div>
            {status?.clock_in_at && (
              <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-3 py-1.5 text-[#D3DFD5]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Clock In:{" "}
                  {new Date(status.clock_in_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Kolkata",
                  })}
                </span>
              </div>
            )}
            {status?.is_late && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 text-amber-200">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                <span>Late Arrival Marked</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Attendance Status & Primary Action Button */}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md lg:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#A6B8AA]">Current Status:</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                isClockedIn
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : isOnBreak
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : isClockedOut
                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                  : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
              }`}
            >
              {isClockedIn
                ? "Clocked In"
                : isOnBreak
                ? "On Break"
                : isClockedOut
                ? "Clocked Out (Completed)"
                : "Not Clocked In"}
            </span>
          </div>

          {/* Time tracker counters if active */}
          {(isClockedIn || isOnBreak) && (
            <div className="flex items-center gap-4 text-xs text-[#D3DFD5]">
              <div>
                <span className="text-[#A6B8AA]">Gross:</span>{" "}
                <span className="font-bold text-white">{formatHoursMins(status?.gross_minutes)}</span>
              </div>
              <div>
                <span className="text-[#A6B8AA]">Breaks:</span>{" "}
                <span className="font-bold text-amber-300">{formatHoursMins(status?.break_minutes)}</span>
              </div>
              <div>
                <span className="text-[#A6B8AA]">Net Active:</span>{" "}
                <span className="font-bold text-emerald-300">{formatHoursMins(status?.net_minutes)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {notClockedIn && (
              <Button
                size="lg"
                onClick={() => clockIn.mutate()}
                disabled={clockIn.isPending}
                className="h-12 gap-2 bg-[#7C9C59] hover:bg-[#6c8a4c] text-white font-bold px-8 text-sm shadow-lg shadow-[#7C9C59]/30 transition-all hover:scale-105"
              >
                <Play className="h-4 w-4 fill-current" />
                {clockIn.isPending ? "Clocking In..." : "CLOCK IN"}
              </Button>
            )}

            {isClockedIn && (
              <>
                <Button
                  size="default"
                  variant="outline"
                  onClick={() => breakStart.mutate()}
                  disabled={breakStart.isPending}
                  className="h-10 gap-2 border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 text-xs font-semibold"
                >
                  <Coffee className="h-4 w-4" />
                  {breakStart.isPending ? "Starting Break..." : "Start Break"}
                </Button>
                <Button
                  size="default"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clock out and end your workday?")) {
                      clockOut.mutate();
                    }
                  }}
                  disabled={clockOut.isPending}
                  className="h-10 gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  {clockOut.isPending ? "Clocking Out..." : "Clock Out"}
                </Button>
              </>
            )}

            {isOnBreak && (
              <Button
                size="default"
                onClick={() => breakEnd.mutate()}
                disabled={breakEnd.isPending}
                className="h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {breakEnd.isPending ? "Resuming..." : "Resume Work"}
              </Button>
            )}

            {isClockedOut && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-black/40 px-3 py-2 rounded-xl">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Shift completed for today.</span>
              </div>
            )}

            {(isMasterAdmin || allowBypass) && onBypass && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onBypass}
                className="h-10 text-xs text-[#D3DFD5] hover:bg-white/10 hover:text-white"
              >
                <span>Console Overview</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
