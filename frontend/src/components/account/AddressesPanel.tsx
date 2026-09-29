import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Pencil, Trash2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import type { SavedAddress, Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressesPanelProps {
  orders?: Order[];
}

interface AddressFormData {
  id?: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

const emptyForm: AddressFormData = {
  label: "Home",
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  is_default: false,
};

export default function AddressesPanel({ orders = [] }: AddressesPanelProps) {
  const qc = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AddressFormData>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch saved addresses from backend API
  const {
    data: savedAddresses = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => apiGet<SavedAddress[]>("/addresses").catch(() => []),
  });

  // Mutation: Create address
  const createMutation = useMutation({
    mutationFn: (data: AddressFormData) =>
      apiPost<SavedAddress>("/addresses", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address saved successfully");
      setIsDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save address");
    },
  });

  // Mutation: Update address
  const updateMutation = useMutation({
    mutationFn: (data: AddressFormData) =>
      apiPut<SavedAddress>(`/addresses/${data.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address updated successfully");
      setIsDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update address");
    },
  });

  // Mutation: Delete address
  const deleteMutation = useMutation({
    mutationFn: (addressId: string) =>
      apiDelete(`/addresses/${addressId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Address deleted");
      setDeleteConfirmId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete address");
    },
  });

  const handleOpenAdd = () => {
    setFormData({
      ...emptyForm,
      is_default: savedAddresses.length === 0,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (addr: SavedAddress) => {
    setFormData({
      id: addr.id,
      label: addr.label || "Home",
      full_name: addr.full_name,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || "",
      landmark: addr.landmark || "",
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      is_default: addr.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error("Please enter a recipient name");
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (!formData.line1.trim() || formData.line1.length < 5) {
      toast.error("Please enter a complete street address");
      return;
    }
    if (!formData.city.trim()) {
      toast.error("Please enter city");
      return;
    }
    if (!formData.state.trim()) {
      toast.error("Please enter state");
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(formData.pincode.trim())) {
      toast.error("Please enter a valid 6-digit Indian PIN code");
      return;
    }

    if (formData.id) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  // Derive any addresses used in orders if user hasn't explicitly saved any yet
  const orderAddresses = [
    ...new Map(
      orders.map((o) => [`${o.address.line1}-${o.address.pincode}`, o.address])
    ).values(),
  ];

  const hasAnyAddresses = savedAddresses.length > 0 || orderAddresses.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-8 md:p-12">
        <div className="space-y-4">
          <div className="h-6 w-44 rounded-md bg-[#F4F6F2] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-36 rounded-xl bg-[#F8FAF7] animate-pulse" />
            <div className="h-36 rounded-xl bg-[#F8FAF7] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[20px] border border-[#E4E9E2] bg-white p-8 md:p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-heading text-lg font-bold text-[#2D2D2D]">
          Unable to load addresses
        </h3>
        <p className="mt-1 text-sm text-[#666666]">
          We encountered an error loading your address book.
        </p>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="mt-4 rounded-xl border-[#CBD6C7] text-sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div
      className="rounded-[20px] border border-[#E4E9E2] bg-white p-6 sm:p-8 md:p-10 shadow-[0_1px_4px_rgba(70,112,101,0.02)]"
      data-testid="account-addresses-panel"
    >
      {/* Top Bar: Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E9EFE7]">
        <div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#2D2D2D]">
            Saved Addresses
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#666666]">
            Manage your delivery destinations for rapid checkout.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenAdd}
          className="h-11 rounded-xl bg-[#467065] px-5 text-sm font-semibold text-white shadow-xs hover:bg-[#3B5F56] transition-colors shrink-0"
          data-testid="account-add-address-button"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span>Add new address</span>
        </Button>
      </div>

      {/* Empty State */}
      {!hasAnyAddresses && (
        <div
          className="py-12 sm:py-16 text-center"
          data-testid="account-addresses-empty"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F4F6F2] text-[#467065]">
            <MapPin className="h-8 w-8" />
          </div>
          <h3 className="mt-4 font-heading text-xl font-bold text-[#2D2D2D]">
            No saved addresses
          </h3>
          <p className="mt-1.5 text-sm text-[#666666]">
            Save an address to make checkout faster.
          </p>
          <Button
            type="button"
            onClick={handleOpenAdd}
            className="mt-5 h-11 rounded-xl bg-[#467065] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#3B5F56]"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Add address</span>
          </Button>
        </div>
      )}

      {/* Explicit Saved Addresses */}
      {savedAddresses.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedAddresses.map((addr) => (
            <div
              key={addr.id}
              className="relative flex flex-col justify-between rounded-xl border border-[#E4E9E2] bg-[#FAFAF8] p-5 transition-all hover:border-[#CBD6C7] hover:shadow-xs"
              data-testid={`account-address-card-${addr.id}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2D2D2D]">
                      {addr.full_name}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-[#D3DCD0] text-[11px] font-medium text-[#555555] bg-white"
                    >
                      {addr.label || "Address"}
                    </Badge>
                  </div>
                  {addr.is_default && (
                    <Badge className="bg-[#EAF3E7] text-[#3E6B4B] border-transparent text-[11px] font-medium">
                      Default
                    </Badge>
                  )}
                </div>

                <p className="mt-3 text-sm text-[#555555] leading-relaxed">
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ""}
                  {addr.landmark ? `, Near ${addr.landmark}` : ""}
                  <br />
                  {addr.city}, {addr.state} —{" "}
                  <span className="font-semibold text-[#2D2D2D]">
                    {addr.pincode}
                  </span>
                </p>

                <p className="mt-2 text-xs font-medium text-[#777777]">
                  Phone: {addr.phone}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-[#E9EFE7] flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(addr)}
                  className="h-8 px-2.5 text-xs text-[#555555] hover:text-[#2D2D2D] hover:bg-[#EAF0E6]"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmId(addr.id)}
                  disabled={deleteMutation.isPending}
                  className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fallback / Prior Order Addresses if user has no explicitly saved address yet */}
      {savedAddresses.length === 0 && orderAddresses.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase font-bold tracking-wider text-[#7C9C59] mb-3">
            Addresses from recent orders
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderAddresses.map((a, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-xl border border-[#E4E9E2] bg-[#FAFAF8] p-5"
              >
                <div>
                  <span className="font-semibold text-[#2D2D2D]">
                    {a.full_name}
                  </span>
                  <p className="mt-2 text-sm text-[#555555] leading-relaxed">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} —{" "}
                    <span className="font-semibold text-[#2D2D2D]">
                      {a.pincode}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-[#777777]">
                    Phone: {a.phone}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#E9EFE7]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        label: "Home",
                        full_name: a.full_name,
                        phone: a.phone,
                        line1: a.line1,
                        line2: a.line2 || "",
                        landmark: "",
                        city: a.city,
                        state: a.state,
                        pincode: a.pincode,
                        is_default: true,
                      });
                      setIsDialogOpen(true);
                    }}
                    className="h-8 text-xs border-[#CBD6C7] text-[#467065] hover:bg-[#F4F6F2]"
                  >
                    Save as Address
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-lg border border-[#E4E9E2]">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-[#2D2D2D]">
              {formData.id ? "Edit Address" : "Add New Address"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#666666]">
              Please fill in your delivery details for accurate shipping.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  Full Name *
                </Label>
                <Input
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="e.g. Uday Simhadri"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  Phone (10 digits) *
                </Label>
                <Input
                  required
                  type="tel"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="9876543210"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[#444444]">
                Flat, House no., Apartment *
              </Label>
              <Input
                required
                value={formData.line1}
                onChange={(e) =>
                  setFormData({ ...formData, line1: e.target.value })
                }
                placeholder="Flat 402, Green Meadows"
                className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  Area / Street
                </Label>
                <Input
                  value={formData.line2 || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, line2: e.target.value })
                  }
                  placeholder="Road No 12, Banjara Hills"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  Landmark
                </Label>
                <Input
                  value={formData.landmark || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, landmark: e.target.value })
                  }
                  placeholder="Opposite City Park"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  City *
                </Label>
                <Input
                  required
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Hyderabad"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  State *
                </Label>
                <Input
                  required
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  placeholder="Telangana"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-[#444444]">
                  PIN Code *
                </Label>
                <Input
                  required
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pincode: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  placeholder="500034"
                  className="mt-1 h-10 rounded-lg text-sm border-[#D3DCD0] focus-visible:ring-[#467065]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-[#467065] focus:ring-[#467065]"
              />
              <label
                htmlFor="is_default"
                className="text-xs font-medium text-[#444444] cursor-pointer"
              >
                Set as default delivery address
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E9EFE7]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="h-10 rounded-lg border-[#CBD6C7] text-xs text-[#555555]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-10 rounded-lg bg-[#467065] px-5 text-xs font-semibold text-white hover:bg-[#3B5F56]"
              >
                {formData.id ? "Update Address" : "Save Address"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm rounded-2xl bg-white p-6 shadow-lg border border-[#E4E9E2]">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-[#2D2D2D]">
              Delete Address
            </DialogTitle>
            <DialogDescription className="text-xs text-[#666666]">
              Are you sure you want to remove this delivery address? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="h-9 rounded-lg border-[#CBD6C7] text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteConfirmId && deleteMutation.mutate(deleteConfirmId)
              }
              className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
