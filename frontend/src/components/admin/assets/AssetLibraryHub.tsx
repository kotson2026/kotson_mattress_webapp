import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Image,
  Film,
  Grid,
  List,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  HardDrive,
  Tag,
  Info,
  CheckCircle2,
  X,
  FileImage,
  FolderOpen,
} from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";

export default function AssetLibraryHub() {
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [usageWarningAsset, setUsageWarningAsset] = useState<any>(null);

  // Queries
  const { data: overview } = useQuery({
    queryKey: ["asset-overview"],
    queryFn: () => apiGet<any>("/admin/assets/overview"),
  });

  const { data: assetsData, isLoading } = useQuery({
    queryKey: ["asset-list", selectedCategory, q, page, pageSize],
    queryFn: () =>
      apiGet<{ total: number; assets: any[] }>(
        `/admin/assets?category=${selectedCategory}&q=${encodeURIComponent(q)}&page=${page}&limit=${pageSize}`
      ),
  });

  const assets = assetsData?.assets || [];
  const total = assetsData?.total || 0;

  // Mutations
  const attemptDelete = async (asset: any) => {
    try {
      // First check usage
      const usageRes: any = await apiGet(`/admin/assets/${asset.id}/usage`);
      if (usageRes.usage_count > 0) {
        setUsageWarningAsset({
          ...asset,
          usage: usageRes.used_in,
        });
      } else {
        if (confirm(`Delete asset "${asset.title}"?`)) {
          await apiDelete(`/admin/assets/${asset.id}`);
          toast.success("Asset deleted successfully");
          qc.invalidateQueries({ queryKey: ["asset-list"] });
          qc.invalidateQueries({ queryKey: ["asset-overview"] });
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to inspect asset usage");
    }
  };

  const forceDelete = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/assets/${id}?force=true`),
    onSuccess: () => {
      setUsageWarningAsset(null);
      qc.invalidateQueries({ queryKey: ["asset-list"] });
      qc.invalidateQueries({ queryKey: ["asset-overview"] });
      toast.success("Asset force-deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete asset"),
  });

  return (
    <div className="space-y-6" data-testid="asset-library-hub">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Media Asset Library</h1>
          <p className="text-sm text-muted-foreground">
            Centralized graphics, diagrams, video assets, and trust seals with live "Used-In" deletion protection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-border bg-card p-1">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("table")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Media Asset
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Assets</span>
            <FileImage className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{overview?.total_assets ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Across all folders</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Storage Footprint</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{overview?.total_size_mb ?? "0"} MB</div>
          <div className="text-xs text-muted-foreground mt-1">Optimized WebP & JPG</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</span>
            <FolderOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{overview?.categories?.length ?? "12"}</div>
          <div className="text-xs text-muted-foreground mt-1">Structural media tags</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Safeguard</span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-sm font-bold text-foreground">Zero Broken Images</div>
          <div className="text-xs text-muted-foreground mt-1">Deletion guard active</div>
        </div>
      </div>

      {/* Category Folders Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={selectedCategory === "ALL" ? "default" : "outline"}
          onClick={() => {
            setSelectedCategory("ALL");
            setPage(1);
          }}
          className="text-xs rounded-full h-8"
        >
          All Assets ({overview?.total_assets ?? 0})
        </Button>
        {overview?.categories?.map((cat: string) => {
          const count = overview?.category_stats?.[cat]?.count || 0;
          return (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => {
                setSelectedCategory(cat);
                setPage(1);
              }}
              className="text-xs rounded-full h-8 whitespace-nowrap"
            >
              {cat} ({count})
            </Button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search assets by title, alt text, or tags…"
            className="pl-9 bg-background"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {assets.length} of {total} assets
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-border text-muted-foreground">
            No assets found in category "{selectedCategory}".
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {assets.map((a) => (
              <div
                key={a.id}
                className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="relative h-32 bg-muted/30 flex items-center justify-center overflow-hidden">
                  {a.file_type?.includes("video") ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Film className="w-8 h-8" />
                      <span className="text-[10px] mt-1">Video</span>
                    </div>
                  ) : (
                    <img
                      src={a.url}
                      alt={a.alt_text || a.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md bg-black/60 text-white hover:bg-black"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => attemptDelete(a)}
                      className="p-1.5 rounded-md bg-rose-600/80 text-white hover:bg-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5">
                  <div className="font-semibold text-xs truncate" title={a.title}>
                    {a.title}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                    <span>{a.dimensions || "—"}</span>
                    <span>{a.file_size_kb ? `${Math.round(a.file_size_kb)} KB` : "—"}</span>
                  </div>
                  <Badge variant="outline" className="mt-1.5 text-[9px] px-1.5 py-0 capitalize">
                    {a.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Table View */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Title & File URL</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Dimensions</TableHead>
                <TableHead>File Size</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
                      <img src={a.url} alt={a.title} className="w-full h-full object-cover" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm">{a.title}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate max-w-xs">{a.url}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.category}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{a.dimensions || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {a.file_size_kb ? `${Math.round(a.file_size_kb)} KB` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.tags?.map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                        onClick={() => attemptDelete(a)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <DataTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
        />
      </div>

      {/* Add Asset Modal */}
      {isAddModalOpen && (
        <AddAssetModal
          categories={overview?.categories || []}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            qc.invalidateQueries({ queryKey: ["asset-list"] });
            qc.invalidateQueries({ queryKey: ["asset-overview"] });
          }}
        />
      )}

      {/* Used-In Live Protection Safety Warning Modal */}
      {usageWarningAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-rose-300 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-700">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-rose-900">
                  Deletion Guard: Asset In Active Use!
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cannot delete <strong>"{usageWarningAsset.title}"</strong> without breaking live graphics on the
                  storefront.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Referenced In Live Storefront ({usageWarningAsset.usage?.length} Place(s)):
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {usageWarningAsset.usage?.map((u: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs"
                  >
                    <div>
                      <span className="font-semibold">{u.title}</span>
                      <span className="ml-2 text-muted-foreground">({u.type})</span>
                    </div>
                    {u.url && (
                      <a href={u.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        View Live
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted-foreground italic">
              To delete safely: Please replace or remove this asset from the products or pages listed above first.
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button variant="outline" onClick={() => setUsageWarningAsset(null)}>
                Cancel (Keep Safe)
              </Button>
              <Button
                variant="destructive"
                onClick={() => forceDelete.mutate(usageWarningAsset.id)}
                disabled={forceDelete.isPending}
              >
                {forceDelete.isPending ? "Deleting…" : "Force Delete Anyway"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddAssetModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    category: "Product Media",
    dimensions: "1200x800",
    width: 1200,
    height: 800,
    file_size_kb: 180,
    alt_text: "",
    tags: "mattress, ortho",
  });

  const save = useMutation({
    mutationFn: () =>
      apiPost("/admin/assets", {
        ...formData,
        tags: formData.tags.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Media asset registered in library");
      onSuccess();
    },
    onError: (e: any) => toast.error(e.message || "Failed to add asset"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-heading text-lg font-bold">Add Media Asset</h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Asset Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. 7-Zone Anatomical Foam Diagram"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Asset CDN / Public URL *</Label>
            <Input
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-10 mt-1 px-3 rounded-md border border-input bg-background text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Dimensions</Label>
              <Input
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="1920x1080"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Alt Text (SEO & Screen Readers)</Label>
            <Input
              value={formData.alt_text}
              onChange={(e) => setFormData({ ...formData, alt_text: e.target.value })}
              placeholder="Descriptive text for accessibility"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Tags (Comma-separated)</Label>
            <Input
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="hero, ortho, latex"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !formData.title || !formData.url}>
            {save.isPending ? "Registering…" : "Register Asset"}
          </Button>
        </div>
      </div>
    </div>
  );
}
