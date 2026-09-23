import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Globe,
  Layers,
  FileText,
  Navigation,
  Compass,
  Palette,
  Search,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  Upload,
  Clock,
  Sparkles,
  ChevronRight,
  X,
  Share2,
  Edit3,
  Smartphone,
  Tablet,
  Monitor,
  AlertTriangle,
  Check,
} from "lucide-react";
import SectionEditorModal from "@/components/admin/cms/SectionEditorModal";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WebsiteEditStudio() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "pages" | "home" | "header" | "footer" | "global" | "branding" | "seo"
  >("pages");

  // Modals state
  const [isNewPageModalOpen, setIsNewPageModalOpen] = useState(false);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [selectedSectionForEdit, setSelectedSectionForEdit] = useState<any>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [deleteConfirmSection, setDeleteConfirmSection] = useState<any>(null);

  // Queries
  const { data: overview } = useQuery({
    queryKey: ["cms-overview"],
    queryFn: () => apiGet<any>("/admin/cms/overview"),
  });

  const { data: sectionTypes = [] } = useQuery({
    queryKey: ["cms-section-types"],
    queryFn: () => apiGet<any[]>("/admin/cms/section-types"),
  });

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["admin-cms-pages"],
    queryFn: () => apiGet<any[]>("/cms/pages"),
  });

  const homePage = pages.find((p: any) => p.slug === "home") || pages[0];

  const { data: headerConfig, isLoading: headerLoading } = useQuery({
    queryKey: ["admin-cms-header"],
    queryFn: () => apiGet<any>("/admin/cms/header"),
  });

  const { data: footerConfig, isLoading: footerLoading } = useQuery({
    queryKey: ["admin-cms-footer"],
    queryFn: () => apiGet<any>("/admin/cms/footer"),
  });

  const { data: brandingConfig, isLoading: brandingLoading } = useQuery({
    queryKey: ["admin-cms-branding"],
    queryFn: () => apiGet<any>("/admin/cms/branding"),
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["admin-cms-versions"],
    queryFn: () => apiGet<any[]>("/admin/cms/versions"),
    enabled: isVersionModalOpen,
  });

  // Mutations
  const publishSite = useMutation({
    mutationFn: () => apiPost(`/admin/cms/publish?note=${encodeURIComponent(publishNote || "Website update")}`),
    onSuccess: (data: any) => {
      setIsPublishModalOpen(false);
      setPublishNote("");
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      qc.invalidateQueries({ queryKey: ["cms-overview"] });
      toast.success(data?.message || "Website changes published live to storefront!");
    },
    onError: (e: any) => toast.error(e.message || "Failed to publish website"),
  });

  const rollbackVersion = useMutation({
    mutationFn: (vid: string) => apiPost(`/admin/cms/rollback?version_id=${vid}`),
    onSuccess: (data: any) => {
      setIsVersionModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      qc.invalidateQueries({ queryKey: ["admin-cms-header"] });
      qc.invalidateQueries({ queryKey: ["admin-cms-footer"] });
      qc.invalidateQueries({ queryKey: ["admin-cms-branding"] });
      toast.success(data?.message || "Website rolled back successfully!");
    },
    onError: (e: any) => toast.error(e.message || "Failed to rollback"),
  });

  const duplicatePage = useMutation({
    mutationFn: (pid: string) => apiPost(`/admin/cms/pages/${pid}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Page duplicated into draft");
    },
    onError: (e: any) => toast.error(e.message || "Failed to duplicate page"),
  });

  const deletePage = useMutation({
    mutationFn: (pid: string) => apiDelete(`/admin/cms/pages/${pid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Page deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete page"),
  });

  const saveSection = useMutation({
    mutationFn: (updated: any) =>
      apiPut(`/admin/cms/pages/${homePage?.id}/sections/${updated.id}`, updated),
    onSuccess: () => {
      setSelectedSectionForEdit(null);
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Section updated successfully");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update section"),
  });

  const reorderSections = useMutation({
    mutationFn: (sectionIds: string[]) =>
      apiPut(`/admin/cms/pages/${homePage?.id}/sections/reorder`, sectionIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Sections reordered");
    },
    onError: (e: any) => toast.error(e.message || "Failed to reorder sections"),
  });

  const toggleSectionVisibility = useMutation({
    mutationFn: (sec: any) =>
      apiPut(`/admin/cms/pages/${homePage?.id}/sections/${sec.id}`, {
        ...sec,
        is_visible: sec.is_visible === false ? true : false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Visibility updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update visibility"),
  });

  const duplicateSection = useMutation({
    mutationFn: (sec: any) =>
      apiPost(`/admin/cms/pages/${homePage?.id}/sections`, {
        type: sec.type,
        title: `${sec.title || sec.type} (Copy)`,
        subtitle: sec.subtitle,
        content: sec.content,
        media_url: sec.media_url,
        config: sec.config || {},
        is_visible: false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Section duplicated as draft");
    },
    onError: (e: any) => toast.error(e.message || "Failed to duplicate section"),
  });

  const deleteSection = useMutation({
    mutationFn: (secId: string) =>
      apiDelete(`/admin/cms/pages/${homePage?.id}/sections/${secId}`),
    onSuccess: () => {
      setDeleteConfirmSection(null);
      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      toast.success("Section removed");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete section"),
  });

  const moveSection = (idx: number, direction: "up" | "down") => {
    if (!homePage?.sections) return;
    const sections = [...homePage.sections];
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const temp = sections[idx];
    sections[idx] = sections[targetIdx];
    sections[targetIdx] = temp;
    const sectionIds = sections.map((s) => s.id);
    reorderSections.mutate(sectionIds);
  };

  const saveHeader = useMutation({
    mutationFn: (updated: any) => apiPut("/admin/cms/header", updated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-header"] });
      toast.success("Header navigation updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update header"),
  });

  const saveFooter = useMutation({
    mutationFn: (updated: any) => apiPut("/admin/cms/footer", updated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-footer"] });
      toast.success("Footer configuration updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update footer"),
  });

  const saveBranding = useMutation({
    mutationFn: (updated: any) => apiPut("/admin/cms/branding", updated),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-cms-branding"] });
      toast.success("Branding assets updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update branding"),
  });

  return (
    <div className="space-y-6" data-testid="website-edit-studio">
      {/* Top Header & Publication Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">Website Visual Studio</h1>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs">
              CMS v2.0 Live
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Safe WYSIWYG configuration for pages, 22 section types, announcement ribbons, header/footer, and branding.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsVersionModalOpen(true)}
            className="border-primary/20 text-xs h-9"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Checkpoints & Rollback
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsPreviewModalOpen(true)}
            className="border-primary/20 text-xs h-9"
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Device Preview
          </Button>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground"
          >
            Preview Live Site <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>

          <Button
            onClick={() => setIsPublishModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 px-4 text-xs shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Publish Changes Live
          </Button>
        </div>
      </div>

      {/* 7 Core Studio Tabs */}
      <div className="flex border-b border-border bg-card rounded-t-xl px-4 pt-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("pages")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "pages"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <FileText className="w-4 h-4" />
          Pages ({pages.length})
        </button>

        <button
          onClick={() => setActiveTab("home")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "home"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Layers className="w-4 h-4" />
          Homepage Builder ({homePage?.sections?.length || 0} Sections)
        </button>

        <button
          onClick={() => setActiveTab("header")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "header"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Navigation className="w-4 h-4" />
          Header & Navigation
        </button>

        <button
          onClick={() => setActiveTab("footer")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "footer"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Compass className="w-4 h-4" />
          Footer Builder
        </button>

        <button
          onClick={() => setActiveTab("global")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "global"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Globe className="w-4 h-4" />
          Global Content & Promos
        </button>

        <button
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "branding"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Palette className="w-4 h-4" />
          Branding & Logos
        </button>

        <button
          onClick={() => setActiveTab("seo")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === "seo"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Search className="w-4 h-4" />
          SEO & Sitemap
        </button>
      </div>

      {/* Tab 1: Pages */}
      {activeTab === "pages" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Manage core storefront routes, campaign landing pages, and legal pages.
            </p>
            <Button
              size="sm"
              onClick={() => setIsNewPageModalOpen(true)}
              className="bg-primary text-primary-foreground text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add New Page
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Page Title</TableHead>
                  <TableHead>Route / Slug</TableHead>
                  <TableHead>Page Classification</TableHead>
                  <TableHead>Sections Count</TableHead>
                  <TableHead>SEO Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Loading pages…
                    </TableCell>
                  </TableRow>
                ) : (
                  pages.map((p: any) => {
                    const isProtected = p.is_system_page || p.page_type === "commerce" || p.slug === "home";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-sm">
                          {p.title}
                          {p.slug === "home" && (
                            <Badge variant="outline" className="ml-2 text-[10px] bg-primary/5 text-primary border-primary/20">
                              Core Storefront
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">/{p.slug}</TableCell>
                        <TableCell>
                          {isProtected ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900 border-amber-300">
                              SYSTEM / COMMERCE
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-900 border-blue-200">
                              CONTENT PAGE
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {p.sections?.length || 0} section(s)
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {p.seo_title || p.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${p.status === "published"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                          >
                            {p.status?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`/${p.slug === "home" ? "" : p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted"
                              title="Open Live URL"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground"
                              title="Duplicate Page"
                              onClick={() => duplicatePage.mutate(p.id)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            {isProtected ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground/40 cursor-not-allowed"
                                title="System page is protected from deletion"
                                disabled
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                                title="Delete Page"
                                onClick={() => {
                                  if (confirm(`Delete content page "${p.title}"?`)) {
                                    deletePage.mutate(p.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 2: Homepage Visual Builder */}
      {activeTab === "home" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-muted/20 border border-border">
            <div>
              <h3 className="font-heading text-sm font-bold">Homepage Section Arrangement ({homePage?.sections?.length || 0} Sections)</h3>
              <p className="text-xs text-muted-foreground">
                Reorder, edit content, or add new sections from the 22 registered modules. Live website reads published order.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddSectionModalOpen(true)}
              className="bg-primary text-primary-foreground text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Section from Library
            </Button>
          </div>

          <div className="space-y-3">
            {(!homePage?.sections || homePage.sections.length === 0) ? (
              <div className="p-12 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs space-y-3">
                <p className="font-semibold text-foreground">No sections configured on homepage.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => apiPost("/admin/cms/migrate-existing-website").then(() => qc.invalidateQueries({ queryKey: ["admin-cms-pages"] }))}
                  className="text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Restore Live Website Sections
                </Button>
              </div>
            ) : (
              homePage.sections.map((sec: any, idx: number) => {
                const typeMeta = sectionTypes.find((st: any) => st.type === sec.type);
                const isLive = sec.is_visible !== false;

                return (
                  <div
                    key={sec.id || idx}
                    className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-xs transition-shadow"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center font-mono text-xs font-bold text-primary shrink-0">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          <span>{sec.title || typeMeta?.name || sec.type}</span>
                          <Badge
                            className={`text-[10px] font-bold ${isLive
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-muted text-muted-foreground border-border"
                              }`}
                          >
                            {isLive ? "LIVE" : "HIDDEN"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {sec.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {sec.subtitle || typeMeta?.description || "Configured homepage section"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      {/* Reorder Up / Down */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        title="Move Up"
                        disabled={idx === 0}
                        onClick={() => moveSection(idx, "up")}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        title="Move Down"
                        disabled={idx === (homePage.sections.length - 1)}
                        onClick={() => moveSection(idx, "down")}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>

                      {/* Edit Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-semibold px-3 text-primary border-primary/30 hover:bg-primary/5"
                        onClick={() => setSelectedSectionForEdit(sec)}
                      >
                        <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>

                      {/* Visibility Toggle */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title={isLive ? "Hide from storefront" : "Show on storefront"}
                        onClick={() => toggleSectionVisibility.mutate(sec)}
                      >
                        {isLive ? (
                          <Eye className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>

                      {/* Duplicate */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        title="Duplicate Section"
                        onClick={() => duplicateSection.mutate(sec)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>

                      {/* Delete Section */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                        title="Delete Section"
                        onClick={() => setDeleteConfirmSection(sec)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Header & Navigation */}
      {activeTab === "header" && (
        <div className="p-6 rounded-xl border border-border bg-card space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="font-heading text-base font-bold">Top Announcement Ribbon & Customer Hotline</h3>
            <p className="text-xs text-muted-foreground">Global banner displayed at the very top of all pages.</p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ann_enabled"
                checked={headerConfig?.announcement_enabled !== false}
                onChange={(e) =>
                  saveHeader.mutate({
                    ...headerConfig,
                    announcement_enabled: e.target.checked,
                  })
                }
                className="rounded cursor-pointer"
              />
              <Label htmlFor="ann_enabled" className="text-sm font-semibold cursor-pointer">
                Display Announcement Bar
              </Label>
            </div>

            <div>
              <Label>Announcement Promo Text</Label>
              <Input
                defaultValue={headerConfig?.announcement_text || "Sleep Better Tonight — 100 Nights Risk-Free Trial"}
                onBlur={(e) =>
                  saveHeader.mutate({
                    ...headerConfig,
                    announcement_text: e.target.value,
                  })
                }
                className="mt-1 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destination URL</Label>
                <Input
                  defaultValue={headerConfig?.announcement_link || "/collections/mattresses"}
                  onBlur={(e) =>
                    saveHeader.mutate({
                      ...headerConfig,
                      announcement_link: e.target.value,
                    })
                  }
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label>Customer Support Hotline</Label>
                <Input
                  defaultValue={headerConfig?.phone_hotline || "+91 98765 43210"}
                  onBlur={(e) =>
                    saveHeader.mutate({
                      ...headerConfig,
                      phone_hotline: e.target.value,
                    })
                  }
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h4 className="font-heading text-sm font-bold mb-2">Main Navigation Links</h4>
              <div className="space-y-2">
                {headerConfig?.nav_items?.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                    <Input defaultValue={item.label} className="h-8 max-w-xs text-xs font-semibold" />
                    <Input defaultValue={item.href} className="h-8 font-mono text-xs" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Footer Builder */}
      {activeTab === "footer" && (
        <div className="p-6 rounded-xl border border-border bg-card space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="font-heading text-base font-bold">Footer Content & Social Channels</h3>
            <p className="text-xs text-muted-foreground">Footer columns, corporate mission, and trust badges.</p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div>
              <Label>Company Mission Tagline</Label>
              <Textarea
                defaultValue={footerConfig?.tagline || "Ergonomically engineered for deep sleep and spinal alignment."}
                onBlur={(e) =>
                  saveFooter.mutate({
                    ...footerConfig,
                    tagline: e.target.value,
                  })
                }
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Copyright Text</Label>
              <Input
                defaultValue={footerConfig?.copyright_text || "© 2026 Kotson Mattress Co. All rights reserved."}
                onBlur={(e) =>
                  saveFooter.mutate({
                    ...footerConfig,
                    copyright_text: e.target.value,
                  })
                }
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Instagram Link</Label>
                <Input
                  defaultValue={footerConfig?.social_links?.instagram || "https://instagram.com/kotsonmattress"}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label>YouTube Channel Link</Label>
                <Input
                  defaultValue={footerConfig?.social_links?.youtube || "https://youtube.com/@kotsonmattress"}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Global Content & Promos */}
      {activeTab === "global" && (
        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h3 className="font-heading text-base font-bold">Global Site Promos & Urgent Banners</h3>
          <p className="text-xs text-muted-foreground">
            Activate emergency banners or seasonal flash sale overlays across all storefront pages.
          </p>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <strong>Active Site Campaign:</strong> "Sleep Royal Festive Season — Flat 25% Off Across Orthopedic Models"
          </div>
        </div>
      )}

      {/* Tab 6: Branding & Logos */}
      {activeTab === "branding" && (
        <div className="p-6 rounded-xl border border-border bg-card space-y-6">
          <div className="border-b border-border pb-4">
            <h3 className="font-heading text-base font-bold">Storefront Brand Identity & Logos</h3>
            <p className="text-xs text-muted-foreground">
              Official vector / high-res logos, favicons, social share open-graph cards, and color tokens.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            <div className="space-y-4">
              <div>
                <Label>Primary Main Logo URL *</Label>
                <Input
                  defaultValue={brandingConfig?.main_logo_url || "/logo.png"}
                  onBlur={(e) =>
                    saveBranding.mutate({
                      ...brandingConfig,
                      main_logo_url: e.target.value,
                    })
                  }
                  className="mt-1 font-mono text-xs"
                />
                <div className="mt-2 p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-center h-24">
                  <img
                    src={brandingConfig?.main_logo_url || "/logo.png"}
                    alt="Main Logo"
                    className="max-h-12 object-contain"
                  />
                </div>
              </div>

              <div>
                <Label>Dark Mode / Contrast Logo URL</Label>
                <Input
                  defaultValue={brandingConfig?.dark_logo_url || "/logo-dark.png"}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label>Browser Favicon URL (.ico / .png)</Label>
                <Input
                  defaultValue={brandingConfig?.favicon_url || "/favicon.ico"}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Social Share Card Image URL (1200x630)</Label>
                <Input
                  defaultValue={brandingConfig?.og_image_url || "/og-image.jpg"}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Brand Color Palette
                </Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#16241C] border border-border" />
                    <span className="text-xs font-mono">#16241C (Forest)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#C69249] border border-border" />
                    <span className="text-xs font-mono">#C69249 (Gold)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#FAF8F5] border border-border" />
                    <span className="text-xs font-mono">#FAF8F5 (Sand)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: SEO & Sitemap */}
      {activeTab === "seo" && (
        <div className="p-6 rounded-xl border border-border bg-card space-y-4 max-w-2xl">
          <h3 className="font-heading text-base font-bold">Storefront SEO Master Configuration</h3>
          <p className="text-xs text-muted-foreground">
            Search engine indexation, meta titles, and automatic XML sitemap generation.
          </p>

          <div>
            <Label>Global Default Site Title</Label>
            <Input defaultValue="Kotson | 7-Zone Orthopedic & Natural Latex Mattresses" className="mt-1 font-medium" />
          </div>

          <div>
            <Label>Global Meta Description</Label>
            <Textarea
              defaultValue="Experience pain-free ergonomic sleep with Kotson's doctor-endorsed 7-Zone orthopedic memory foam and 100% natural organic Dunlop latex mattresses. 100-night trial."
              rows={3}
              className="mt-1"
            />
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs">Dynamic XML Sitemap</div>
              <div className="text-[11px] text-muted-foreground font-mono">https://kotsonmattress.com/seo/sitemap.xml</div>
            </div>
            <a
              href="/seo/sitemap.xml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View XML <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Add Section from 22 Types Modal */}
      {isAddSectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden p-6 space-y-4 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-lg font-bold">Section Types Catalogue (22 Modules)</h3>
                <p className="text-xs text-muted-foreground">Choose a pre-engineered section component to insert</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsAddSectionModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
              {sectionTypes.map((st: any) => (
                <div
                  key={st.type}
                  className="p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{st.name}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {st.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{st.description}</p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full h-8 text-xs font-semibold"
                    onClick={async () => {
                      await apiPost(`/admin/cms/pages/${homePage.id}/sections`, {
                        type: st.type,
                        title: st.name,
                        config: st.default_config || {},
                        is_visible: true,
                      });
                      setIsAddSectionModalOpen(false);
                      qc.invalidateQueries({ queryKey: ["admin-cms-pages"] });
                      toast.success(`Added ${st.name} to homepage`);
                    }}
                  >
                    Insert Section
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Publish Website Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <Sparkles className="w-6 h-6" />
              <h3 className="font-heading text-lg font-bold text-foreground">Publish Website Live</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This creates an authoritative checkpoint and updates all draft pages on the live storefront.
            </p>

            <div>
              <Label>Publication Note / Memo (Optional)</Label>
              <Input
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                placeholder="e.g. Updated festive hero banner and 100-night trial text"
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setIsPublishModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => publishSite.mutate()}
                disabled={publishSite.isPending}
                className="bg-primary text-primary-foreground font-semibold"
              >
                {publishSite.isPending ? "Publishing…" : "Confirm & Go Live"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoints & Rollback Modal */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-lg font-bold">Publication Checkpoints</h3>
                <p className="text-xs text-muted-foreground">One-click rollback to any previously published snapshot</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsVersionModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {versions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No previous checkpoints found.</div>
              ) : (
                versions.map((v: any) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-border bg-card flex items-center justify-between hover:bg-muted/20"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-foreground">{v.id}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{v.note || "Website publication"}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        By {v.published_by} • {new Date(v.published_at).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold"
                      onClick={() => {
                        if (confirm(`Rollback live website to version checkpoint ${v.id}?`)) {
                          rollbackVersion.mutate(v.id);
                        }
                      }}
                      disabled={rollbackVersion.isPending}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Rollback
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setIsVersionModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Human-Friendly Section Editor Modal */}
      {selectedSectionForEdit && (
        <SectionEditorModal
          isOpen={Boolean(selectedSectionForEdit)}
          section={selectedSectionForEdit}
          onClose={() => setSelectedSectionForEdit(null)}
          onSave={(updated) => saveSection.mutate(updated)}
          isSaving={saveSection.isPending}
        />
      )}

      {/* Delete Section Safety Confirmation Modal */}
      {deleteConfirmSection && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-heading text-base font-bold text-foreground">
                Delete Section: {deleteConfirmSection.title || deleteConfirmSection.type}?
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This section is currently part of the homepage. Removing it deletes its draft configuration. You can also hide it instead of permanently removing it.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmSection(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  toggleSectionVisibility.mutate(deleteConfirmSection);
                  setDeleteConfirmSection(null);
                }}
                className="text-xs"
              >
                Hide Instead
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteSection.mutate(deleteConfirmSection.id)}
                disabled={deleteSection.isPending}
                className="text-xs"
              >
                {deleteSection.isPending ? "Deleting..." : "Delete Section"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Device Preview Modal (Desktop, Tablet, Mobile) */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex flex-col items-center justify-between p-4">
          <div className="w-full max-w-5xl flex items-center justify-between bg-card px-5 py-3 rounded-2xl border border-border shadow-xl">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Responsive Device Preview</h3>
              <Badge variant="outline" className="text-[10px] font-mono">
                {previewDevice.toUpperCase()}
              </Badge>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              <Button
                size="sm"
                variant={previewDevice === "desktop" ? "default" : "ghost"}
                onClick={() => setPreviewDevice("desktop")}
                className="h-7 px-3 text-xs gap-1.5"
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </Button>
              <Button
                size="sm"
                variant={previewDevice === "tablet" ? "default" : "ghost"}
                onClick={() => setPreviewDevice("tablet")}
                className="h-7 px-3 text-xs gap-1.5"
              >
                <Tablet className="w-3.5 h-3.5" /> Tablet (768px)
              </Button>
              <Button
                size="sm"
                variant={previewDevice === "mobile" ? "default" : "ghost"}
                onClick={() => setPreviewDevice("mobile")}
                className="h-7 px-3 text-xs gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile (375px)
              </Button>
            </div>

            <Button size="icon" variant="ghost" onClick={() => setIsPreviewModalOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Iframe Viewport Container */}
          <div className="flex-1 w-full flex items-center justify-center p-4 overflow-hidden">
            <div
              className="h-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-background transition-all duration-300"
              style={{
                width:
                  previewDevice === "mobile"
                    ? "375px"
                    : previewDevice === "tablet"
                      ? "768px"
                      : "100%",
                maxWidth: "100%",
              }}
            >
              <iframe
                src="/"
                title="Storefront Preview"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
