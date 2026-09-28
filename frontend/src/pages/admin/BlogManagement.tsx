import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Edit,
  Eye,
  Send,
  Archive,
  Trash2,
  Undo2,
  Calendar,
  AlertTriangle,
  Loader2,
  FileText,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import type { Blog, BlogListResponse } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DataTablePagination from "@/components/ui/DataTablePagination";

const STATUS_FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Archived", value: "archived" },
];

export default function BlogManagement() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals state
  const [deleteBlogTarget, setDeleteBlogTarget] = useState<Blog | null>(null);
  const [previewBlogTarget, setPreviewBlogTarget] = useState<Blog | null>(null);

  // Fetch blogs list
  const { data, isLoading } = useQuery<BlogListResponse>({
    queryKey: ["admin-blogs", statusFilter, searchQuery, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      return apiGet<BlogListResponse>(`/admin/blogs?${params.toString()}`);
    },
  });

  // Actions mutations
  const publishMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/blogs/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast.success("Blog published successfully.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to publish blog");
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/blogs/${id}/unpublish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast.success("Blog reverted to draft.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unpublish");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/admin/blogs/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] });
      toast.success("Blog archived successfully.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to archive blog");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/blogs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-blogs"] });
      setDeleteBlogTarget(null);
      toast.success("Blog deleted permanently.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete blog");
    },
  });

  const blogs = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Blogs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, manage and publish stories from Kotson.
          </p>
        </div>

        <Button
          onClick={() => navigate("/admin/blogs/new")}
          className="bg-brand-forest hover:bg-brand-deep text-white font-semibold text-xs h-10 px-4 gap-2 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          CREATE BLOG
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-muted/30 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === f.value
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full max-w-xs sm:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by blog title, slug or keyword…"
            className="pl-9 min-h-10 text-xs bg-background"
          />
        </div>
      </div>

      {/* Blogs Table / Empty State */}
      {isLoading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-brand-forest mr-2" />
          Loading blogs…
        </div>
      ) : blogs.length === 0 ? (
        /* Empty State matching spec */
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-forest/10 text-brand-forest mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="font-heading text-lg font-bold text-foreground">No stories yet.</h3>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
            Create your first Kotson article and start sharing useful sleep knowledge.
          </p>
          <Button
            onClick={() => navigate("/admin/blogs/new")}
            className="mt-5 bg-brand-forest hover:bg-brand-deep text-white font-semibold text-xs h-10 px-5 gap-2 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            CREATE BLOG
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[80px]">Cover</TableHead>
                <TableHead className="min-w-[240px]">Title</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[140px]">Author</TableHead>
                <TableHead className="w-[140px]">Published</TableHead>
                <TableHead className="w-[140px]">Last Updated</TableHead>
                <TableHead className="w-[170px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blogs.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/20">
                  {/* Cover */}
                  <TableCell>
                    {b.cover_image ? (
                      <div className="h-12 w-16 overflow-hidden rounded-md border border-border bg-muted/30">
                        <img
                          src={b.cover_image}
                          alt={b.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground/50 bg-muted/20 text-xs">
                        No cover
                      </div>
                    )}
                  </TableCell>

                  {/* Title & Slug */}
                  <TableCell>
                    <div className="font-medium text-foreground text-sm line-clamp-1">
                      {b.title}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground line-clamp-1">
                      /blogs/{b.slug}
                    </div>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`capitalize text-[11px] font-semibold ${
                        b.status === "published"
                          ? "border-emerald-500/30 bg-emerald-50 text-emerald-800"
                          : b.status === "scheduled"
                          ? "border-blue-500/30 bg-blue-50 text-blue-800"
                          : b.status === "archived"
                          ? "border-zinc-500/30 bg-zinc-100 text-zinc-700"
                          : "border-amber-500/30 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {b.status}
                    </Badge>
                  </TableCell>

                  {/* Author */}
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[130px]">
                    {b.author_name || "Kotson"}
                  </TableCell>

                  {/* Published Date */}
                  <TableCell className="text-xs text-muted-foreground">
                    {b.published_at ? fmtDateTime(b.published_at) : "—"}
                  </TableCell>

                  {/* Last Updated */}
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDateTime(b.updated_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => navigate(`/admin/blogs/${b.id}/edit`)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Edit article"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      {/* Preview */}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          if (b.status === "published") {
                            window.open(`/blogs/${b.slug}`, "_blank");
                          } else {
                            setPreviewBlogTarget(b);
                          }
                        }}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        title={b.status === "published" ? "View live article" : "Preview draft"}
                      >
                        {b.status === "published" ? (
                          <ExternalLink className="h-3.5 w-3.5 text-brand-forest" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {/* Publish / Unpublish */}
                      {b.status === "published" ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => unpublishMutation.mutate(b.id)}
                          disabled={unpublishMutation.isPending}
                          className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          title="Unpublish (revert to draft)"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => publishMutation.mutate(b.id)}
                          disabled={publishMutation.isPending}
                          className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          title="Publish now"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Archive */}
                      {b.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => archiveMutation.mutate(b.id)}
                          disabled={archiveMutation.isPending}
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
                          title="Archive"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeleteBlogTarget(b)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="p-4 border-t border-border/60">
            <DataTablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={() => {}}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteBlogTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-destructive mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-heading text-lg font-bold text-foreground">
                Delete "{deleteBlogTarget.title}"?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this blog post? This action cannot be undone. If you just want to unpublish it, choose Archive instead.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteBlogTarget(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(deleteBlogTarget.id)}
                disabled={deleteMutation.isPending}
                className="text-xs"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Preview Modal */}
      {previewBlogTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-forest">
                  Draft Preview
                </span>
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {previewBlogTarget.title}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewBlogTarget(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>

            {previewBlogTarget.cover_image && (
              <div className="aspect-21/9 w-full overflow-hidden rounded-xl mb-4 bg-muted/30">
                <img
                  src={previewBlogTarget.cover_image}
                  alt={previewBlogTarget.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <p className="text-sm font-medium text-foreground/80 italic mb-4 leading-relaxed">
              {previewBlogTarget.excerpt}
            </p>

            <div className="prose prose-stone max-w-none text-sm leading-relaxed mb-6">
              <div
                dangerouslySetInnerHTML={{
                  __html: previewBlogTarget.content_markdown,
                }}
              />
            </div>

            {previewBlogTarget.conclusion_markdown && (
              <div className="rounded-xl border border-brand-forest/20 bg-brand-forest/5 p-4 text-sm text-brand-deep">
                <h4 className="font-bold text-xs uppercase tracking-wider text-brand-forest mb-1.5">
                  Conclusion
                </h4>
                <p>{previewBlogTarget.conclusion_markdown}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const id = previewBlogTarget.id;
                  setPreviewBlogTarget(null);
                  navigate(`/admin/blogs/${id}/edit`);
                }}
                className="bg-brand-forest text-white text-xs"
              >
                Edit Story
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
