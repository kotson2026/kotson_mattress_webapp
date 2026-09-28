import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Save,
  Send,
  Trash2,
  AlertTriangle,
  Check,
  ChevronDown,
  Globe,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Blog, BlogImage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import MarkdownEditor from "@/components/admin/blogs/MarkdownEditor";
import BlogImageUploader from "@/components/admin/blogs/BlogImageUploader";
import BlogCoverImageUploader from "@/components/admin/blogs/BlogCoverImageUploader";

function slugify(text: string = ""): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BlogEditor() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [conclusionMarkdown, setConclusionMarkdown] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [contentImages, setContentImages] = useState<BlogImage[]>([]);
  const [conclusionImages, setConclusionImages] = useState<BlogImage[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "scheduled" | "archived">("draft");
  const [scheduledAt, setScheduledAt] = useState<string>("");

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugConflictMessage, setSlugConflictMessage] = useState<string | null>(null);

  const publishDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch blog data if editing
  const { data: blog, isLoading: isLoadingBlog } = useQuery({
    queryKey: ["admin-blog", id],
    queryFn: () => apiGet<Blog>(`/admin/blogs/${id}`),
    enabled: isEditing,
  });

  // Populate state on edit
  useEffect(() => {
    if (blog) {
      setTitle(blog.title || "");
      setSlug(blog.slug || "");
      setSlugManuallyEdited(true);
      setExcerpt(blog.excerpt || "");
      setContentMarkdown(blog.content_markdown || "");
      setConclusionMarkdown(blog.conclusion_markdown || "");
      setCoverImage(blog.cover_image || "");
      setContentImages(blog.content_images || []);
      setConclusionImages(blog.conclusion_images || []);
      setSeoTitle(blog.seo_title || "");
      setSeoDescription(blog.seo_description || "");
      setKeywordsInput((blog.keywords || []).join(", "));
      setTags(blog.tags || []);
      setStatus(blog.status);
      if (blog.scheduled_at) {
        setScheduledAt(new Date(blog.scheduled_at).toISOString().slice(0, 16));
      }
      setIsDirty(false);
    }
  }, [blog]);

  // Track user modifications
  const markDirty = () => {
    if (!isDirty) setIsDirty(true);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (publishDropdownRef.current && !publishDropdownRef.current.contains(event.target as Node)) {
        setPublishMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Title changes -> Auto-generate slug and default SEO title if not manually customized
  const handleTitleChange = (val: string) => {
    setTitle(val);
    markDirty();

    if (!slugManuallyEdited) {
      const generated = slugify(val);
      setSlug(generated);
      checkSlug(generated);
    }

    if (!seoTitle || seoTitle === title) {
      setSeoTitle(val.slice(0, 60));
    }
  };

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true);
    const cleaned = slugify(val);
    setSlug(cleaned);
    markDirty();
    checkSlug(cleaned);
  };

  // Check slug conflict
  const checkSlug = async (targetSlug: string) => {
    if (!targetSlug.trim()) {
      setSlugConflictMessage(null);
      return;
    }
    setSlugChecking(true);
    try {
      const url = `/admin/blogs/check-slug?slug=${encodeURIComponent(targetSlug)}${
        id ? `&exclude_id=${id}` : ""
      }`;
      const res = await apiGet<{ available: boolean; suggested?: string; message?: string }>(url);
      if (!res.available && res.message) {
        setSlugConflictMessage(res.message);
      } else {
        setSlugConflictMessage(null);
      }
    } catch {
      setSlugConflictMessage(null);
    } finally {
      setSlugChecking(false);
    }
  };

  // Excerpt changes -> default SEO description if empty
  const handleExcerptChange = (val: string) => {
    setExcerpt(val);
    markDirty();
    if (!seoDescription || seoDescription === excerpt) {
      setSeoDescription(val.slice(0, 160));
    }
  };

  // Tag management
  const handleAddTag = (raw: string) => {
    const trimmed = raw.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (!tags.some((t) => t.toLowerCase() === lower)) {
      setTags([...tags, trimmed]);
      markDirty();
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
    markDirty();
  };

  // Parse keywords to list
  const parseKeywords = (): string[] => {
    return keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  };

  // Validation
  const validateForPublish = (): string | null => {
    if (!title.trim()) return "Title is required for publishing";
    if (!slug.trim()) return "Slug is required for publishing";
    if (slugConflictMessage) return "Please resolve the slug conflict before publishing";
    if (!excerpt.trim()) return "Excerpt is required for publishing";
    if (!contentMarkdown.trim()) return "Main Content is required for publishing";
    if (!conclusionMarkdown.trim()) return "Conclusion is required for publishing";
    if (!coverImage.trim()) return "Cover image is required for publishing";
    if (!seoTitle.trim()) return "SEO Title is required for publishing";
    if (!seoDescription.trim()) return "SEO Description is required for publishing";
    return null;
  };

  // Save / Publish Mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      targetStatus,
      targetScheduledAt,
    }: {
      targetStatus: "draft" | "published" | "scheduled" | "archived";
      targetScheduledAt?: string | null;
    }) => {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugify(title),
        excerpt: excerpt.trim(),
        content_markdown: contentMarkdown,
        conclusion_markdown: conclusionMarkdown,
        cover_image: coverImage.trim(),
        content_images: contentImages,
        conclusion_images: conclusionImages,
        seo_title: seoTitle.trim(),
        seo_description: seoDescription.trim(),
        keywords: parseKeywords(),
        tags: tags,
        status: targetStatus,
        scheduled_at: targetScheduledAt || null,
      };

      if (isEditing) {
        return apiPut<Blog>(`/admin/blogs/${id}`, payload);
      } else {
        return apiPost<Blog>("/admin/blogs", payload);
      }
    },
    onSuccess: (savedBlog, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-blog", savedBlog.id] });
      setIsDirty(false);
      setStatus(savedBlog.status);

      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSavedTime(timeStr);
      setAutosaveStatus("saved");

      if (variables.targetStatus === "published") {
        toast.success("Blog published successfully!");
        navigate("/admin/blogs");
      } else if (variables.targetStatus === "scheduled") {
        toast.success("Blog scheduled successfully!");
        navigate("/admin/blogs");
      } else {
        toast.success("Draft saved successfully.");
        if (!isEditing) {
          navigate(`/admin/blogs/${savedBlog.id}/edit`, { replace: true });
        }
      }
    },
    onError: (err: any) => {
      setAutosaveStatus("idle");
      const msg = err instanceof Error ? err.message : "Failed to save blog";
      toast.error(msg);
    },
  });

  const handleSaveDraft = () => {
    if (!title.trim()) {
      toast.error("Please enter at least a blog title to save as draft.");
      return;
    }
    setAutosaveStatus("saving");
    saveMutation.mutate({ targetStatus: "draft" });
  };

  const handlePublishNow = () => {
    const error = validateForPublish();
    if (error) {
      toast.error(error);
      return;
    }
    setPublishMenuOpen(false);
    saveMutation.mutate({ targetStatus: "published" });
  };

  const handleConfirmSchedule = () => {
    const error = validateForPublish();
    if (error) {
      toast.error(error);
      return;
    }
    if (!scheduledAt) {
      toast.error("Please select a scheduled date and time.");
      return;
    }
    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future.");
      return;
    }

    setShowScheduleModal(false);
    setPublishMenuOpen(false);
    saveMutation.mutate({
      targetStatus: "scheduled",
      targetScheduledAt: scheduleDate.toISOString(),
    });
  };

  // Warn on browser close if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Back click handler
  const handleBack = () => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      navigate("/admin/blogs");
    }
  };

  if (isLoadingBlog) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-brand-forest mr-2" />
        Loading article…
      </div>
    );
  }

  // SEO Counter Helpers
  const seoTitleCount = seoTitle.length;
  const seoDescCount = seoDescription.length;

  return (
    <div className="relative pb-28 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-forest hover:text-brand-deep transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Blogs
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {isEditing ? "EDIT BLOG" : "CREATE BLOG"}
              </h1>
              {status && (
                <Badge
                  variant="outline"
                  className={`capitalize text-xs font-semibold ${
                    status === "published"
                      ? "border-emerald-500/30 bg-emerald-50 text-emerald-800"
                      : status === "scheduled"
                      ? "border-blue-500/30 bg-blue-50 text-blue-800"
                      : status === "archived"
                      ? "border-zinc-500/30 bg-zinc-100 text-zinc-700"
                      : "border-amber-500/30 bg-amber-50 text-amber-800"
                  }`}
                >
                  {status}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Craft your next masterpiece. Share your insights and research with the world.
            </p>
          </div>

          {/* Autosave status indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground self-center">
            {autosaveStatus === "saving" && (
              <span className="flex items-center gap-1 text-brand-forest">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving draft…
              </span>
            )}
            {autosaveStatus === "saved" && lastSavedTime && (
              <span className="flex items-center gap-1 text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Saved at {lastSavedTime}
              </span>
            )}
            {isDirty && autosaveStatus !== "saving" && (
              <span className="text-amber-700">• Unsaved changes</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 1: BASIC INFORMATION */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="border-b border-border/60 pb-3 mb-5">
            <h2 className="font-heading text-base font-bold text-foreground">
              BASIC INFORMATION
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Essential details to define your story's identity.
            </p>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="blog-title" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Title *
                </Label>
                <span className="text-[11px] text-muted-foreground">Required</span>
              </div>
              <Input
                id="blog-title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Enter blog title"
                className="min-h-11 font-medium bg-background text-base"
                maxLength={300}
              />
            </div>

            {/* Slug */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="blog-slug" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Slug
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Public URL: /blogs/{slug || "auto-generated-from-title"}
                </span>
              </div>
              <div className="relative">
                <Input
                  id="blog-slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="auto-generated-from-title"
                  className={`min-h-11 bg-background font-mono text-xs ${
                    slugConflictMessage ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                />
                {slugChecking && (
                  <div className="absolute right-3 top-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {slugConflictMessage && (
                <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {slugConflictMessage}
                </p>
              )}
              {status === "published" && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Note: Changing the slug of an already published article may impact existing external links.
                </p>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="blog-excerpt" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Excerpt *
                </Label>
                <span className="text-[11px] text-muted-foreground">Required • Used in cards & search summaries</span>
              </div>
              <Textarea
                id="blog-excerpt"
                value={excerpt}
                onChange={(e) => handleExcerptChange(e.target.value)}
                placeholder="Brief description of your blog post"
                rows={3}
                className="resize-y bg-background text-sm leading-relaxed"
              />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: STORY CONTENT */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="border-b border-border/60 pb-3 mb-5">
            <h2 className="font-heading text-base font-bold text-foreground">
              STORY CONTENT
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Where the magic happens. Use Markdown for rich formatting.
            </p>
          </div>

          <div className="space-y-6">
            {/* Main Content */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Main Content *
                </Label>
                <span className="text-[11px] text-muted-foreground">Markdown & formatted paste supported</span>
              </div>

              <MarkdownEditor
                value={contentMarkdown}
                onChange={(val) => {
                  setContentMarkdown(val);
                  markDirty();
                }}
                placeholder="Enter your content here... You can paste formatted content and it will be converted to Markdown automatically."
                minHeight="280px"
              />

              {/* Upload Content Images */}
              <BlogImageUploader
                label="Upload Content Images"
                images={contentImages}
                onChange={(imgs) => {
                  setContentImages(imgs);
                  markDirty();
                }}
                onInsertMarkdown={(snip) => {
                  setContentMarkdown((prev) => prev + snip);
                  markDirty();
                }}
                blogTitle={title}
                helperText="Upload supporting photos and diagrams to insert throughout your story."
              />
            </div>

            {/* Conclusion */}
            <div className="pt-4 border-t border-border/60">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Conclusion *
                </Label>
                <span className="text-[11px] text-muted-foreground">Required • Final takeaways & recommendations</span>
              </div>

              <MarkdownEditor
                value={conclusionMarkdown}
                onChange={(val) => {
                  setConclusionMarkdown(val);
                  markDirty();
                }}
                placeholder="Enter your conclusion here... You can paste formatted conclusion and it will be converted to Markdown automatically."
                minHeight="140px"
              />

              {/* Upload Conclusion Images */}
              <BlogImageUploader
                label="Upload Conclusion Images"
                images={conclusionImages}
                onChange={(imgs) => {
                  setConclusionImages(imgs);
                  markDirty();
                }}
                onInsertMarkdown={(snip) => {
                  setConclusionMarkdown((prev) => prev + snip);
                  markDirty();
                }}
                blogTitle={title}
                helperText="Optional images to emphasize conclusion takeaways."
              />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: COVER IMAGE */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="border-b border-border/60 pb-3 mb-5">
            <h2 className="font-heading text-base font-bold text-foreground">
              COVER IMAGE
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The face of your story. High resolution recommended.
            </p>
          </div>

          <BlogCoverImageUploader
            value={coverImage}
            onChange={(url) => {
              setCoverImage(url);
              markDirty();
            }}
            blogTitle={title}
          />
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: SEO & TAGS */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="border-b border-border/60 pb-3 mb-5">
            <h2 className="font-heading text-base font-bold text-foreground">
              SEO & TAGS
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Optimize your reach. How should the world find your story?
            </p>
          </div>

          <div className="space-y-4">
            {/* SEO Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="blog-seo-title" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  SEO Title *
                </Label>
                <div className="text-xs">
                  <span
                    className={`font-mono font-medium ${
                      seoTitleCount > 60
                        ? "text-destructive font-bold"
                        : seoTitleCount >= 50
                        ? "text-amber-600 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {seoTitleCount} / 60 characters
                  </span>
                </div>
              </div>
              <Input
                id="blog-seo-title"
                value={seoTitle}
                onChange={(e) => {
                  setSeoTitle(e.target.value);
                  markDirty();
                }}
                placeholder="SEO optimized title"
                className="min-h-11 bg-background text-sm"
              />
              {seoTitleCount > 60 && (
                <p className="mt-1 text-xs text-destructive">
                  Title exceeds the recommended 60 character Google search snippet limit.
                </p>
              )}
            </div>

            {/* SEO Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="blog-seo-desc" className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  SEO Description *
                </Label>
                <div className="text-xs">
                  <span
                    className={`font-mono font-medium ${
                      seoDescCount > 160
                        ? "text-destructive font-bold"
                        : seoDescCount >= 140
                        ? "text-amber-600 font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {seoDescCount} / 160 characters
                  </span>
                </div>
              </div>
              <Textarea
                id="blog-seo-desc"
                value={seoDescription}
                onChange={(e) => {
                  setSeoDescription(e.target.value);
                  markDirty();
                }}
                placeholder="Brief description for search results"
                rows={2}
                className="resize-y bg-background text-sm leading-relaxed"
              />
              {seoDescCount > 160 && (
                <p className="mt-1 text-xs text-destructive">
                  Description exceeds the recommended 160 character snippet limit.
                </p>
              )}
            </div>

            {/* Keywords */}
            <div>
              <Label htmlFor="blog-keywords" className="text-xs font-semibold uppercase tracking-wider text-foreground block mb-1.5">
                Keywords
              </Label>
              <Input
                id="blog-keywords"
                value={keywordsInput}
                onChange={(e) => {
                  setKeywordsInput(e.target.value);
                  markDirty();
                }}
                placeholder="organic latex mattress, natural sleep, mattress care"
                className="min-h-11 bg-background text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enter keywords separated by commas. These will be cleanly normalized and indexed.
              </p>
            </div>

            {/* Tags */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-foreground block mb-1.5">
                Tags
              </Label>

              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-border/80 bg-background min-h-12">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-forest/10 px-2.5 py-1 text-xs font-medium text-brand-forest border border-brand-forest/20"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-brand-forest/70 hover:text-brand-deep"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => handleAddTag(tagInput)}
                  placeholder={tags.length === 0 ? "Type a tag and press Enter…" : "Add more…"}
                  className="flex-1 min-w-[120px] bg-transparent text-xs p-1 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 mt-2">
                <span className="text-[11px] text-muted-foreground mr-1">Suggestions:</span>
                {["Natural Sleep", "Mattress Guide", "Sleep Science", "Organic Latex", "Spine Health"].map(
                  (sug) =>
                    !tags.includes(sug) && (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddTag(sug)}
                        className="text-[11px] text-muted-foreground hover:text-brand-forest bg-muted/60 hover:bg-muted px-2 py-0.5 rounded-md transition-colors"
                      >
                        + {sug}
                      </button>
                    )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM ACTION BAR */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur-md py-3.5 px-6 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={saveMutation.isPending}
              className="h-10 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              DISCARD CHANGES
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saveMutation.isPending}
              className="h-10 gap-1.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground"
            >
              <Save className="h-3.5 w-3.5 text-muted-foreground" />
              SAVE DRAFT
            </Button>

            {/* Publish Dropdown */}
            <div className="relative" ref={publishDropdownRef}>
              <div className="flex rounded-lg shadow-sm">
                <Button
                  type="button"
                  onClick={handlePublishNow}
                  disabled={saveMutation.isPending}
                  className="h-10 rounded-r-none bg-brand-forest hover:bg-brand-deep text-white px-4 text-xs font-semibold gap-1.5"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  PUBLISH NOW
                </Button>
                <Button
                  type="button"
                  onClick={() => setPublishMenuOpen(!publishMenuOpen)}
                  disabled={saveMutation.isPending}
                  className="h-10 rounded-l-none border-l border-white/20 bg-brand-forest hover:bg-brand-deep text-white px-2"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {publishMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl z-40 animate-in fade-in slide-in-from-bottom-2">
                  <button
                    type="button"
                    onClick={handlePublishNow}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted text-left transition-colors"
                  >
                    <Send className="h-3.5 w-3.5 text-brand-leaf" />
                    Publish Immediately
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPublishMenuOpen(false);
                      setShowScheduleModal(true);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground hover:bg-muted text-left transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    Schedule for Later…
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-heading text-lg font-bold text-foreground">Discard unsaved changes?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You have unsaved changes in this blog post. If you leave now, your latest edits will be lost.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiscardModal(false)}
                className="text-xs"
              >
                Keep Editing
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowDiscardModal(false);
                  setIsDirty(false);
                  navigate("/admin/blogs");
                }}
                className="text-xs"
              >
                Discard & Leave
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Publication Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-2.5 text-brand-forest mb-2">
              <Calendar className="h-5 w-5" />
              <h3 className="font-heading text-lg font-bold text-foreground">Schedule Publication</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select the exact future date and time for automatic server-side publishing.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="schedule-datetime" className="text-xs font-semibold">
                  Publish Date & Time
                </Label>
                <Input
                  id="schedule-datetime"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1.5 min-h-11 bg-background text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmSchedule}
                className="bg-brand-forest hover:bg-brand-deep text-white text-xs font-semibold"
              >
                Confirm Schedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
