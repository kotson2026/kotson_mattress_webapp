import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserPlus, Sparkles, Building2, Phone, Mail, FileText, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WalkInLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCampaignId?: string;
  onSuccessLead?: (lead: any) => void;
}

export default function WalkInLeadDialog({
  open,
  onOpenChange,
  defaultCampaignId,
  onSuccessLead,
}: WalkInLeadDialogProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [campaignCode, setCampaignCode] = useState(defaultCampaignId || "");
  const [productInterest, setProductInterest] = useState("Natural Latex Mattress");
  const [note, setNote] = useState("");

  // Fetch authorized campaigns for dropdown
  const { data: campaigns } = useQuery<any[]>({
    queryKey: ["crm-campaigns-all"],
    queryFn: () => apiGet<any[]>("/crm/campaigns"),
    enabled: open,
  });

  const createLead = useMutation({
    mutationFn: () =>
      apiPost<any>("/crm/leads/walk-in", {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        campaign_code: campaignCode || (campaigns?.[0]?.id ?? undefined),
        product_interest: productInterest,
        note: note.trim() || undefined,
      }),
    onSuccess: (newLead) => {
      toast.success(`Walk-in lead created (${newLead.lead_number || "New"})`);
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-leads-paginated"] });
      qc.invalidateQueries({ queryKey: ["crm-campaigns-all"] });
      setName("");
      setPhone("");
      setEmail("");
      setNote("");
      onOpenChange(false);
      if (onSuccessLead) {
        onSuccessLead(newLead);
      } else {
        navigate(`/crm/leads/${newLead.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create walk-in lead");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error("Phone number or email address is required");
      return;
    }
    createLead.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border border-[#E8EDE7] shadow-xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#11291F] text-[#F7F4EE]">
              <UserPlus className="size-4 text-[#7C9C59]" />
            </div>
            <div>
              <DialogTitle className="font-heading text-lg font-bold text-[#11291F]">
                Add Walk-in Lead
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B716C]">
                Record a direct store or phone prospect into your authorized campaign.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="walkin-name" className="text-xs font-semibold text-[#11291F]">
              Contact Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="walkin-name"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="border-[#D8DDD7] focus:border-[#467065] focus:ring-[#467065]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-phone" className="text-xs font-semibold text-[#11291F]">
                Contact Number <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#6B716C]" />
                <Input
                  id="walkin-phone"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-8 border-[#D8DDD7] focus:border-[#467065] focus:ring-[#467065]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="walkin-email" className="text-xs font-semibold text-[#11291F]">
                Email (Optional)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#6B716C]" />
                <Input
                  id="walkin-email"
                  type="email"
                  placeholder="customer@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-8 border-[#D8DDD7] focus:border-[#467065] focus:ring-[#467065]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walkin-campaign" className="text-xs font-semibold text-[#11291F]">
              Campaign Assignment
            </Label>
            <select
              id="walkin-campaign"
              value={campaignCode}
              onChange={(e) => setCampaignCode(e.target.value)}
              className="w-full rounded-md border border-[#D8DDD7] bg-white px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#467065] focus:outline-none focus:ring-1 focus:ring-[#467065]"
            >
              <option value="">Select an authorized campaign…</option>
              {(campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.pipeline_id ? `(${c.lead_source || "campaign"})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walkin-product" className="text-xs font-semibold text-[#11291F]">
              Product Interest
            </Label>
            <select
              id="walkin-product"
              value={productInterest}
              onChange={(e) => setProductInterest(e.target.value)}
              className="w-full rounded-md border border-[#D8DDD7] bg-white px-3 py-2 text-sm text-[#2D2D2D] focus:border-[#467065] focus:outline-none focus:ring-1 focus:ring-[#467065]"
            >
              <option value="Natural Latex Mattress">Natural Latex Mattress</option>
              <option value="Orthopedic Mattress">Orthopedic Mattress</option>
              <option value="Natural Latex Pillows">Natural Latex Pillows</option>
              <option value="Mattress Topper">Mattress Topper</option>
              <option value="Baby & Kids Mattress">Baby & Kids Mattress</option>
              <option value="Custom Size Mattress">Custom Size Mattress</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walkin-notes" className="text-xs font-semibold text-[#11291F]">
              Visit Notes / Requirements
            </Label>
            <Textarea
              id="walkin-notes"
              placeholder="e.g. Inquired about 78x72 King 6-inch firmness for chronic back stiffness"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border-[#D8DDD7] focus:border-[#467065] focus:ring-[#467065] min-h-[60px] text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDE7]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#D8DDD7] text-[#2D2D2D] hover:bg-[#F7F4EE]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLead.isPending}
              className="bg-[#11291F] text-[#F7F4EE] hover:bg-[#467065] font-semibold text-xs tracking-wide uppercase transition-colors"
            >
              {createLead.isPending ? "Creating…" : "Save Walk-in Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
