import React from "react";
import { X, Truck, Package, Clock, User, Hash, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { StockDispatch } from "@/lib/types";

interface DispatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: StockDispatch | null;
}

export default function DispatchDetailsModal({
  isOpen,
  onClose,
  dispatch,
}: DispatchDetailsModalProps) {
  if (!isOpen || !dispatch) return null;

  const typeColorMap: Record<string, string> = {
    ONLINE_ORDER: "bg-blue-50 text-blue-800 border-blue-200",
    OFFLINE_ORDER: "bg-amber-50 text-amber-800 border-amber-200",
    DEALER: "bg-purple-50 text-purple-800 border-purple-200",
    FRIENDS_INTERNAL: "bg-emerald-50 text-emerald-800 border-emerald-200",
    OTHER: "bg-slate-100 text-slate-800 border-slate-200",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E3DDCF] bg-[#FAF8F5] p-6 shadow-2xl text-[#16241C]"
        data-testid="dispatch-details-modal"
      >
        <div className="flex items-center justify-between border-b border-[#E3DDCF]/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#16241C] text-[#FAF8F5]">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold font-mono">{dispatch.dispatch_number}</h2>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    typeColorMap[dispatch.dispatch_type] || ""
                  }`}
                >
                  {dispatch.dispatch_type.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Clock className="h-3 w-3" />
                {dispatch.formatted_datetime}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-[#E3DDCF]/50 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl border border-border/80 bg-white text-xs">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block flex items-center gap-1">
                <Hash className="h-3 w-3" /> Reference Number
              </span>
              <span className="font-mono font-bold text-sm mt-0.5 block">
                {dispatch.reference_number || "DIRECT"}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block flex items-center gap-1">
                <User className="h-3 w-3" /> Packed / Dispatched By
              </span>
              <span className="font-semibold text-sm mt-0.5 block">
                {dispatch.created_by_name} ({dispatch.created_by_role})
              </span>
            </div>
          </div>

          {/* Package Contents Table */}
          <div className="rounded-2xl border border-[#E3DDCF] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#16241C] flex items-center gap-1.5">
                <Package className="h-4 w-4 text-[#7C9C59]" /> Package Contents
              </span>
              <span className="text-xs font-mono font-bold text-[#467065] bg-[#7C9C59]/10 px-2.5 py-0.5 rounded-full">
                {dispatch.total_units} Total Units
              </span>
            </div>

            <div className="space-y-2">
              {(dispatch.items || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-[#FAF8F5] text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#16241C] text-sm">{item.product_name}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {item.category} • Size: <span className="font-semibold text-foreground">{item.variant_size}</span> ({item.unit})
                      {item.sku && <span> • SKU: <span className="font-mono">{item.sku}</span></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {item.previous_stock} → {item.new_stock}
                    </span>
                    <span className="font-mono font-bold text-sm bg-white border border-border px-2.5 py-1 rounded-lg text-[#467065]">
                      Qty {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          {dispatch.remarks && (
            <div className="rounded-2xl border border-border/80 bg-white p-3.5 text-xs space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Remarks
              </span>
              <p className="text-foreground font-medium pl-4">{dispatch.remarks}</p>
            </div>
          )}

          <div className="flex items-center justify-end pt-3 border-t border-[#E3DDCF]/80">
            <Button type="button" onClick={onClose} className="rounded-xl h-11 px-6 bg-[#16241C] text-white font-bold">
              Close Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
