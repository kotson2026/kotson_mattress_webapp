import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Plus,
  Trash2,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  ShieldCheck,
  FileCheck,
  Award,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiUpload } from "@/lib/api";
import { DEFAULT_TESTIMONIALS, extractYouTubeId } from "@/components/home/CustomerTestimonials";

const DEFAULT_CERT_ITEMS = [
  {
    id: "gols",
    number: "01",
    selectorName: "GOLS",
    selectorCategory: "Raw Material & Process",
    badge: "GOLS CERTIFIED",
    category: "Raw Material & Process",
    title: "GOLS — Global Organic Latex Standard",
    subtitle: "The standard for certified organic latex.",
    checksHeader: "IT AUDITS",
    checks: [
      "Rubber plantation",
      "Processing unit",
      "Manufacturing facility",
      "Final product",
    ],
    whyItMatters:
      "The latex core is a major component of the mattress. GOLS provides independent certification behind the organic latex claim.",
    hasVideo: true,
    videoUrl: "https://videotourl.com/videos/1790071320217-f57e96c0-9918-440c-8c8e-a0b7ddf8178d.mp4",
    visible: true,
    certificationImage: {
      url: "",
      alt: "GOLS — Global Organic Latex Standard Certification",
      background: "default",
    },
  },
  {
    id: "eco-institut",
    number: "02",
    selectorName: "eco-INSTITUT",
    selectorCategory: "Emissions & Chemical Safety",
    badge: "eco-INSTITUT",
    category: "Emissions & Chemical Safety",
    title: "eco-INSTITUT",
    subtitle: "Independent testing for emissions and harmful substances.",
    checksHeader: "IT TESTS FOR",
    checks: [
      "VOC emissions",
      "Formaldehyde",
      "Heavy metals",
      "Pesticides",
      "Phthalates",
      "Other specified chemical residues",
    ],
    whyItMatters:
      "Mattresses spend years inside the sleeping environment. Independent emissions testing provides additional evidence about the materials used in that environment.",
    hasVideo: false,
    visible: true,
    certificationImage: {
      url: "/certifications/eco-institut.png",
      alt: "eco-INSTITUT Tested Product certification",
      background: "white",
    },
  },
  {
    id: "fsc",
    number: "03",
    selectorName: "FSC",
    selectorCategory: "Sustainable Sourcing",
    badge: "FSC",
    category: "Sustainable Sourcing",
    title: "FSC — Forest Stewardship Council",
    subtitle: "Responsible sourcing and forest management.",
    checksHeader: "IT ADDRESSES",
    checks: [
      "Responsible forest management",
      "Traceable sourcing",
      "Environmental considerations",
      "Social and worker considerations within applicable standards",
    ],
    whyItMatters:
      "Certification provides traceability behind responsibly sourced forest-based materials.",
    hasVideo: false,
    visible: true,
    certificationImage: {
      url: "/certifications/fsc.png",
      alt: "Forest Stewardship Council (FSC) Certification",
      background: "white",
    },
  },
  {
    id: "lga",
    number: "04",
    selectorName: "LGA",
    selectorCategory: "Durability & Performance",
    badge: "LGA TESTED",
    category: "Durability & Performance",
    title: "LGA Quality Testing",
    subtitle: "Independent physical and durability testing.",
    checksHeader: "IT MAY EVALUATE (SUBJECT TO CERTIFICATE)",
    checks: [
      "Durability",
      "Compression resistance",
      "Structural stability",
      "Shape retention",
    ],
    whyItMatters:
      "Performance testing helps demonstrate how the tested product behaves under repeated physical use.",
    hasVideo: false,
    visible: true,
    certificationImage: {
      url: "/certifications/lga.png",
      alt: "LGA Quality Certificate — Tested Quality",
      background: "white",
    },
  },
  {
    id: "oeko-tex",
    number: "05",
    selectorName: "OEKO-TEX®",
    selectorCategory: "Human Contact Safety",
    badge: "OEKO-TEX® STANDARD 100",
    category: "Human Contact Safety",
    title: "OEKO-TEX® STANDARD 100",
    subtitle: "Testing for harmful substances in textiles and components.",
    checksHeader: "TESTING CAN COVER",
    checks: [
      "Formaldehyde",
      "Heavy metals",
      "Restricted dyes",
      "Other regulated or harmful substances",
    ],
    whyItMatters:
      "STANDARD 100 testing provides independent verification against specified harmful-substance requirements for tested components.",
    hasVideo: false,
    visible: true,
    certificationImage: {
      url: "/certifications/oeko-tex.png",
      alt: "OEKO-TEX STANDARD 100 Certification",
      background: "white",
    },
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  section: any;
  onSave: (updatedSection: any) => void;
  isSaving: boolean;
}

export default function SectionEditorModal({
  isOpen,
  onClose,
  section,
  onSave,
  isSaving,
}: Props) {
  const [formData, setFormData] = useState<any>({});
  const [configData, setConfigData] = useState<any>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    if (section) {
      setFormData({
        title: section.title || "",
        subtitle: section.subtitle || "",
        content: section.content || "",
        media_url: section.media_url || "",
        is_visible: section.is_visible !== false,
      });
      setConfigData(JSON.parse(JSON.stringify(section.config || {})));
      setIsDirty(false);
    }
  }, [section]);

  if (!isOpen || !section) return null;

  const handleFormChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfigData((prev: any) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleUploadCertImage = async (file: File, cIdx: number) => {
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    try {
      toast.loading("Uploading certification proof image...", { id: "cert-upload" });
      const data = await apiUpload<{ url: string; asset_id?: string }>("/admin/cms/upload-image", uploadForm);
      const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
      const existing = list[cIdx].certificationImage || {};
      list[cIdx] = {
        ...list[cIdx],
        certificationImage: {
          url: data.url,
          alt: existing.alt || `${list[cIdx].badge || list[cIdx].selectorName} certification`,
          background: existing.background || "white",
          assetId: data.asset_id,
        },
      };
      handleConfigChange("certifications", list);
      toast.success("Certification proof image uploaded successfully!", { id: "cert-upload" });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload certification image", { id: "cert-upload" });
    }
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    const updated = {
      ...section,
      title: formData.title,
      subtitle: formData.subtitle,
      content: formData.content,
      media_url: formData.media_url,
      is_visible: formData.is_visible,
      config: configData,
    };
    onSave(updated);
    setIsDirty(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Edit Section: {section.title || section.name || section.type}
                </h2>
                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                  {section.type}
                </Badge>
                {isDirty && (
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                    Unsaved Changes
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Configure live content, imagery, links, and display options.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCloseAttempt}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable Editors */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* General Section Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-border/80 bg-background/60">
            <div>
              <Label className="text-xs font-semibold">Section Name / Admin Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
                className="mt-1 h-9 text-xs"
                placeholder="e.g. Hero Video / Banner"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Section Subtitle / Eyebrow</Label>
              <Input
                value={formData.subtitle}
                onChange={(e) => handleFormChange("subtitle", e.target.value)}
                className="mt-1 h-9 text-xs"
                placeholder="e.g. Full-width native looping video hero"
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="section-visibility"
                  checked={formData.is_visible}
                  onChange={(e) => handleFormChange("is_visible", e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <Label htmlFor="section-visibility" className="text-xs font-medium cursor-pointer">
                  Show this section on the live website (Section Visible)
                </Label>
              </div>
            </div>
          </div>

          {/* 1. HERO VIDEO EDITOR */}
          {section.type === "hero_video" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Video className="w-4 h-4 text-primary" />
                Hero Video Settings
              </div>

              <div>
                <Label className="text-xs">Direct MP4 Video Stream URL</Label>
                <Input
                  value={configData.video_url || ""}
                  onChange={(e) => handleConfigChange("video_url", e.target.value)}
                  className="mt-1 font-mono text-xs"
                  placeholder="https://...mp4"
                />
              </div>

              {configData.video_url && (
                <div className="rounded-xl overflow-hidden border border-border bg-black/5 aspect-video max-h-48 flex items-center justify-center">
                  <video
                    src={configData.video_url}
                    poster={configData.poster_url}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Poster / Fallback Image URL</Label>
                  <Input
                    value={configData.poster_url || ""}
                    onChange={(e) => handleConfigChange("poster_url", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="https://...png"
                  />
                </div>
                <div>
                  <Label className="text-xs">Poster Alt Text</Label>
                  <Input
                    value={configData.poster_alt || ""}
                    onChange={(e) => handleConfigChange("poster_alt", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="Kotson mattress hero video"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configData.autoplay !== false}
                    onChange={(e) => handleConfigChange("autoplay", e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  Autoplay Muted
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configData.loop !== false}
                    onChange={(e) => handleConfigChange("loop", e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  Loop Continuously
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configData.muted !== false}
                    onChange={(e) => handleConfigChange("muted", e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  Muted Audio
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configData.playsinline !== false}
                    onChange={(e) => handleConfigChange("playsinline", e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  Plays Inline
                </label>
              </div>
            </div>
          )}

          {/* 2. ANNOUNCEMENT RIBBON EDITOR */}
          {section.type === "announcement_bar" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Sleep Ribbon Messages
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const msgs = configData.messages || [];
                    handleConfigChange("messages", [...msgs, "NEW PROMISE"]);
                  }}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Message
                </Button>
              </div>

              <div className="space-y-2">
                {(configData.messages || []).map((msg: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground w-6">
                      #{idx + 1}
                    </span>
                    <Input
                      value={msg}
                      onChange={(e) => {
                        const copy = [...(configData.messages || [])];
                        copy[idx] = e.target.value;
                        handleConfigChange("messages", copy);
                      }}
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const copy = (configData.messages || []).filter((_: any, i: number) => i !== idx);
                        handleConfigChange("messages", copy);
                      }}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-xs">Divider Symbol</Label>
                  <Input
                    value={configData.separator || "✦"}
                    onChange={(e) => handleConfigChange("separator", e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Scroll Speed (seconds for loop)</Label>
                  <Input
                    type="number"
                    value={configData.speed || 40}
                    onChange={(e) => handleConfigChange("speed", Number(e.target.value))}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. EXPLORE CATEGORIES EDITOR */}
          {section.type === "category_grid" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Layers className="w-4 h-4 text-primary" />
                  Category Showroom Cards
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Section Heading</Label>
                  <Input
                    value={configData.heading || "Explore Our Categories"}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Subheading</Label>
                  <Input
                    value={configData.subheading || ""}
                    onChange={(e) => handleConfigChange("subheading", e.target.value)}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {(configData.categories || []).map((cat: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-background flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border">
                      {cat.image || cat.fallback_image ? (
                        <img src={cat.image || cat.fallback_image} alt={cat.name} className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Category Name</Label>
                        <Input
                          value={cat.name || ""}
                          onChange={(e) => {
                            const copy = [...(configData.categories || [])];
                            copy[idx] = { ...copy[idx], name: e.target.value };
                            handleConfigChange("categories", copy);
                          }}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Subtitle</Label>
                        <Input
                          value={cat.subtitle || ""}
                          onChange={(e) => {
                            const copy = [...(configData.categories || [])];
                            copy[idx] = { ...copy[idx], subtitle: e.target.value };
                            handleConfigChange("categories", copy);
                          }}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Destination Route</Label>
                        <Input
                          value={cat.route || ""}
                          onChange={(e) => {
                            const copy = [...(configData.categories || [])];
                            copy[idx] = { ...copy[idx], route: e.target.value };
                            handleConfigChange("categories", copy);
                          }}
                          className="h-7 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. SHARK TANK FEATURE EDITOR */}
          {section.type === "shark_tank_feature" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Video className="w-4 h-4 text-primary" />
                Shark Tank India Feature (Design 2 Unified Panel)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Original Poster Image URL</Label>
                  <Input
                    value={configData.banner_url || configData.poster_url || ""}
                    onChange={(e) => {
                      handleConfigChange("banner_url", e.target.value);
                      handleConfigChange("poster_url", e.target.value);
                    }}
                    placeholder="/shark-tank/kotson-shark-tank-square.webp"
                    className="mt-1 text-xs font-mono"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Authoritative poster artwork with GOLS organic latex branding.
                  </p>
                </div>
                <div>
                  <Label className="text-xs">YouTube URL or Video ID</Label>
                  <Input
                    value={configData.youtube_url || configData.video_url || ""}
                    onChange={(e) => {
                      handleConfigChange("youtube_url", e.target.value);
                      handleConfigChange("video_url", e.target.value);
                    }}
                    placeholder="https://www.youtube.com/watch?v=xF_ri6AQJMo or xF_ri6AQJMo"
                    className="mt-1 text-xs font-mono"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Accepts standard YouTube links, short links, or direct 11-char ID.
                  </p>
                </div>
              </div>

              {(configData.banner_url || configData.poster_url) && (
                <div className="rounded-xl overflow-hidden border border-border bg-black/5 max-h-48 flex items-center justify-center p-2">
                  <img
                    src={configData.banner_url || configData.poster_url}
                    alt="Shark Tank Poster Preview"
                    className="max-h-44 object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Eyebrow Text</Label>
                  <Input
                    value={configData.eyebrow ?? "AS SEEN ON"}
                    onChange={(e) => handleConfigChange("eyebrow", e.target.value)}
                    placeholder="AS SEEN ON"
                    className="mt-1 text-xs uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bottom Caption</Label>
                  <Input
                    value={configData.caption ?? "KOTSON × SHARK TANK INDIA"}
                    onChange={(e) => handleConfigChange("caption", e.target.value)}
                    placeholder="KOTSON × SHARK TANK INDIA"
                    className="mt-1 text-xs uppercase"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. 3D LAYER BREAKDOWN EDITOR */}
          {section.type === "mattress_layer_breakdown" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Layers className="w-4 h-4 text-primary" />
                Mattress Layers Breakdown (3 Genuine Layers)
              </div>

              <div className="space-y-3">
                {(configData.layers || []).map((layer: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border border-border bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">Layer {layer.step || idx + 1}</span>
                      <span className="text-[11px] text-muted-foreground">{layer.id}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px]">Layer Name</Label>
                        <Input
                          value={layer.name || ""}
                          onChange={(e) => {
                            const copy = [...(configData.layers || [])];
                            copy[idx] = { ...copy[idx], name: e.target.value };
                            handleConfigChange("layers", copy);
                          }}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Description</Label>
                        <Input
                          value={layer.description || ""}
                          onChange={(e) => {
                            const copy = [...(configData.layers || [])];
                            copy[idx] = { ...copy[idx], description: e.target.value };
                            handleConfigChange("layers", copy);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. 7-ZONE & BENEFITS STRIP EDITOR */}
          {section.type === "seven_zones_support" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Layers className="w-4 h-4 text-primary" />
                7-Zone Support & Benefits Strip
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Main Heading</Label>
                  <Input
                    value={configData.heading || ""}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Subheading</Label>
                  <Input
                    value={configData.subheading || ""}
                    onChange={(e) => handleConfigChange("subheading", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">7-Zone Diagram Image URL</Label>
                <Input
                  value={configData.diagram_image_url || ""}
                  onChange={(e) => handleConfigChange("diagram_image_url", e.target.value)}
                  className="mt-1 text-xs font-mono"
                />
              </div>

              {configData.diagram_image_url && (
                <div className="rounded-xl overflow-hidden border border-border bg-black/5 p-2 max-h-48 flex items-center justify-center">
                  <img src={configData.diagram_image_url} alt="7-Zone Diagram" className="max-h-40 object-contain" />
                </div>
              )}
            </div>
          )}

          {/* 7. ORGANIC LATEX PROCESS EDITOR (8 STEPS) */}
          {section.type === "organic_latex_process" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Organic Dunlop Latex Manufacturing Process (8 Steps)
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const steps = configData.steps || [];
                    handleConfigChange("steps", [
                      ...steps,
                      { n: steps.length + 1, title: "New Step", body: "Step description..." },
                    ]);
                  }}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Process Heading</Label>
                  <Input
                    value={configData.heading || ""}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Subheading</Label>
                  <Input
                    value={configData.subheading || ""}
                    onChange={(e) => handleConfigChange("subheading", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {(configData.steps || []).map((step: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] font-mono">
                        STEP {String(step.n || idx + 1).padStart(2, "0")}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const copy = (configData.steps || []).filter((_: any, i: number) => i !== idx);
                          handleConfigChange("steps", copy);
                        }}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Step Title</Label>
                        <Input
                          value={step.title || ""}
                          onChange={(e) => {
                            const copy = [...(configData.steps || [])];
                            copy[idx] = { ...copy[idx], title: e.target.value };
                            handleConfigChange("steps", copy);
                          }}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Step Description</Label>
                        <Input
                          value={step.body || ""}
                          onChange={(e) => {
                            const copy = [...(configData.steps || [])];
                            copy[idx] = { ...copy[idx], body: e.target.value };
                            handleConfigChange("steps", copy);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CERTIFICATIONS & TRUST EXPLORER EDITOR */}
          {section.type === "certifications_badges" && (
            <div className="space-y-6 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Certifications &amp; Trust Explorer Configuration
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
                  5 ACCREDITATIONS &amp; AUDIT
                </Badge>
              </div>

              {/* 1. Section Level Copy & Media */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Overview Presentation Header
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Section Eyebrow</Label>
                    <Input
                      value={configData.eyebrow ?? "CERTIFIED ORGANIC"}
                      onChange={(e) => handleConfigChange("eyebrow", e.target.value)}
                      className="mt-1 text-xs uppercase"
                      placeholder="CERTIFIED ORGANIC"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Main Heading</Label>
                    <Input
                      value={configData.heading ?? "Proof in Every Layer."}
                      onChange={(e) => handleConfigChange("heading", e.target.value)}
                      className="mt-1 text-xs font-serif"
                      placeholder="Proof in Every Layer."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-semibold">Introduction / Description</Label>
                    <Textarea
                      value={
                        configData.subheading ??
                        configData.description ??
                        "Every Kotson mattress is built around independently tested materials and recognized certification standards."
                      }
                      onChange={(e) => {
                        handleConfigChange("subheading", e.target.value);
                        handleConfigChange("description", e.target.value);
                      }}
                      rows={2}
                      className="mt-1 text-xs leading-relaxed"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">CTA Button Label</Label>
                    <Input
                      value={configData.cta_label ?? "Know More"}
                      onChange={(e) => handleConfigChange("cta_label", e.target.value)}
                      className="mt-1 text-xs"
                      placeholder="Know More"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Overview Video Stream URL</Label>
                    <Input
                      value={
                        configData.overview_video_url ??
                        "https://videotourl.com/videos/1790071320217-f57e96c0-9918-440c-8c8e-a0b7ddf8178d.mp4"
                      }
                      onChange={(e) => handleConfigChange("overview_video_url", e.target.value)}
                      className="mt-1 text-xs font-mono"
                      placeholder="https://...mp4"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label className="text-xs font-semibold">Expanded Explorer Eyebrow</Label>
                    <Input
                      value={configData.expanded_eyebrow ?? "CERTIFIED, NOT JUST CLAIMED"}
                      onChange={(e) => handleConfigChange("expanded_eyebrow", e.target.value)}
                      className="mt-1 text-xs uppercase"
                      placeholder="CERTIFIED, NOT JUST CLAIMED"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Expanded Explorer Heading</Label>
                    <Input
                      value={configData.expanded_heading ?? "Our Certifications"}
                      onChange={(e) => handleConfigChange("expanded_heading", e.target.value)}
                      className="mt-1 text-xs"
                      placeholder="Our Certifications"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Structured Certification Items Manager */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                      Certification Records ({(configData.certifications || DEFAULT_CERT_ITEMS).length} Items)
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Manage names, short labels, subtitles, repeatable "It Tests For" checks, and "Why It Matters" copy.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                      const nextNum = String(list.length + 1).padStart(2, "0");
                      list.push({
                        id: `cert-${Date.now()}`,
                        number: nextNum,
                        selectorName: "New Certificate",
                        selectorCategory: "Safety Standard",
                        badge: "CERTIFIED",
                        category: "Safety Standard",
                        title: "New Independent Certification",
                        subtitle: "Rigorous laboratory testing for safety and durability.",
                        checksHeader: "IT TESTS FOR",
                        checks: ["Material purity", "Structural integrity", "No hazardous chemicals"],
                        whyItMatters: "Independent certification ensures verified quality throughout the sleeping environment.",
                        hasVideo: false,
                        visible: true,
                      });
                      handleConfigChange("certifications", list);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Certification
                  </Button>
                </div>

                <div className="space-y-4">
                  {(configData.certifications || DEFAULT_CERT_ITEMS).map((cert: any, cIdx: number) => {
                    const isVisible = cert.visible !== false;
                    return (
                      <div
                        key={cert.id || cIdx}
                        className={`p-4 rounded-xl border transition-all ${
                          isVisible
                            ? "border-border bg-background"
                            : "border-dashed border-border/70 bg-muted/20 opacity-75"
                        } space-y-3.5`}
                      >
                        {/* Cert Header Bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                              #{cert.number || String(cIdx + 1).padStart(2, "0")}
                            </span>
                            <span className="font-bold text-xs text-foreground">
                              {cert.selectorName || cert.title || `Certification ${cIdx + 1}`}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {cert.selectorCategory || cert.category || "Standard"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Move Up */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={cIdx === 0}
                              onClick={() => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                const temp = list[cIdx - 1];
                                list[cIdx - 1] = list[cIdx];
                                list[cIdx] = temp;
                                handleConfigChange("certifications", list);
                              }}
                              className="h-7 w-7 text-muted-foreground"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            {/* Move Down */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={cIdx === (configData.certifications || DEFAULT_CERT_ITEMS).length - 1}
                              onClick={() => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                const temp = list[cIdx + 1];
                                list[cIdx + 1] = list[cIdx];
                                list[cIdx] = temp;
                                handleConfigChange("certifications", list);
                              }}
                              className="h-7 w-7 text-muted-foreground"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            {/* Visibility Toggle */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], visible: !isVisible };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-7 w-7"
                              title={isVisible ? "Hide from customer view" : "Show in customer view"}
                            >
                              {isVisible ? (
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </Button>
                            {/* Delete */}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list.splice(cIdx, 1);
                                handleConfigChange("certifications", list);
                              }}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* General Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-semibold">Short Label / Tab Name</Label>
                            <Input
                              value={cert.selectorName || ""}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], selectorName: e.target.value };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-8 text-xs font-semibold"
                              placeholder="e.g. eco-INSTITUT"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-semibold">Category / Purpose</Label>
                            <Input
                              value={cert.selectorCategory || cert.category || ""}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = {
                                  ...list[cIdx],
                                  selectorCategory: e.target.value,
                                  category: e.target.value,
                                };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-8 text-xs"
                              placeholder="e.g. Emissions &amp; Chemical Safety"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-semibold">Badge Pill Text</Label>
                            <Input
                              value={cert.badge || ""}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], badge: e.target.value };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-8 text-xs uppercase"
                              placeholder="e.g. eco-INSTITUT"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground font-semibold">Full Title / Heading</Label>
                            <Input
                              value={cert.title || ""}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], title: e.target.value };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-8 text-xs font-medium"
                              placeholder="e.g. eco-INSTITUT"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground font-semibold">Order / Number</Label>
                            <Input
                              value={cert.number || String(cIdx + 1).padStart(2, "0")}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], number: e.target.value };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-8 text-xs font-mono"
                              placeholder="01"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <Label className="text-[10px] text-muted-foreground font-semibold">Subtitle / Summary</Label>
                            <Input
                              value={cert.subtitle || ""}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], subtitle: e.target.value };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-8 text-xs"
                              placeholder="e.g. Independent testing for emissions and harmful substances."
                            />
                          </div>
                        </div>

                        {/* Repeatable "It Tests For" checks */}
                        <div className="space-y-2 pt-2 border-t border-border/60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label className="text-[11px] font-bold text-foreground">
                                Testing Checks Header:
                              </Label>
                              <Input
                                value={cert.checksHeader || "IT TESTS FOR"}
                                onChange={(e) => {
                                  const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                  list[cIdx] = { ...list[cIdx], checksHeader: e.target.value };
                                  handleConfigChange("certifications", list);
                                }}
                                className="h-6 w-44 text-[11px] font-bold uppercase"
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                const checks = [...(list[cIdx].checks || [])];
                                checks.push("New tested criterion");
                                list[cIdx] = { ...list[cIdx], checks };
                                handleConfigChange("certifications", list);
                              }}
                              className="h-6 text-[10px] text-primary hover:bg-primary/5"
                            >
                              <Plus className="w-3 h-3 mr-1" /> Add Test Item
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(cert.checks || []).map((chk: string, kIdx: number) => (
                              <div key={kIdx} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-muted-foreground w-4">
                                  {kIdx + 1}.
                                </span>
                                <Input
                                  value={chk}
                                  onChange={(e) => {
                                    const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                    const checks = [...(list[cIdx].checks || [])];
                                    checks[kIdx] = e.target.value;
                                    list[cIdx] = { ...list[cIdx], checks };
                                    handleConfigChange("certifications", list);
                                  }}
                                  className="h-7 text-xs flex-1"
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                    const checks = [...(list[cIdx].checks || [])];
                                    checks.splice(kIdx, 1);
                                    list[cIdx] = { ...list[cIdx], checks };
                                    handleConfigChange("certifications", list);
                                  }}
                                  className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* "Why It Matters" copy */}
                        <div className="pt-2 border-t border-border/60">
                          <Label className="text-[11px] font-bold text-foreground">Why It Matters</Label>
                          <Textarea
                            value={cert.whyItMatters || ""}
                            onChange={(e) => {
                              const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                              list[cIdx] = { ...list[cIdx], whyItMatters: e.target.value };
                              handleConfigChange("certifications", list);
                            }}
                            rows={2}
                            className="mt-1 text-xs leading-relaxed"
                            placeholder="Explain why this certification benefits customer health, purity, and sleep..."
                          />
                        </div>

                        {/* Optional Video / Media Toggle for this item */}
                        <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
                          <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={cert.hasVideo === true}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], hasVideo: e.target.checked };
                                handleConfigChange("certifications", list);
                              }}
                              className="rounded border-border text-primary"
                            />
                            Display Dedicated Video on Explorer
                          </label>
                          {cert.hasVideo && (
                            <Input
                              value={cert.videoUrl || ""}
                              onChange={(e) => {
                                const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                list[cIdx] = { ...list[cIdx], videoUrl: e.target.value };
                                handleConfigChange("certifications", list);
                              }}
                              placeholder="Direct video stream URL (defaults to overview video)"
                              className="h-7 text-xs font-mono w-72"
                            />
                          )}
                        </div>

                        {/* CERTIFICATION PROOF */}
                        <div className="pt-3 border-t border-border/70 space-y-3 bg-muted/20 p-3.5 rounded-xl border border-border/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                              <FileCheck className="w-3.5 h-3.5 text-primary" />
                              CERTIFICATION PROOF
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Displays on customer-facing right card
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
                            {/* Current Image Preview / Empty State */}
                            <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-border bg-background min-h-[120px]">
                              {cert.certificationImage?.url ? (
                                <div className="space-y-1.5 text-center w-full">
                                  <div
                                    className="p-2 rounded-lg flex items-center justify-center max-h-[90px] border border-border/40"
                                    style={{
                                      backgroundColor:
                                        cert.certificationImage.background === "warm-ivory"
                                          ? "#FAF8F5"
                                          : "#FFFFFF",
                                    }}
                                  >
                                    <img
                                      src={cert.certificationImage.url}
                                      alt={cert.certificationImage.alt || "Certificate preview"}
                                      className="max-h-[75px] max-w-full object-contain"
                                    />
                                  </div>
                                  <p className="text-[10px] text-muted-foreground font-mono truncate px-1" title={cert.certificationImage.url}>
                                    {cert.certificationImage.url.split("/").pop()}
                                  </p>
                                </div>
                              ) : (
                                <div className="text-center p-2 text-muted-foreground">
                                  <ImageIcon className="w-6 h-6 mx-auto mb-1 text-muted-foreground/40" />
                                  <p className="text-[11px] font-medium text-foreground/80">No certification image uploaded</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">Upload official proof document or logo</p>
                                </div>
                              )}
                            </div>

                            {/* Image Management Actions & Fields */}
                            <div className="sm:col-span-8 space-y-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                                  <Upload className="w-3.5 h-3.5" />
                                  {cert.certificationImage?.url ? "Replace Image" : "Upload Image"}
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadCertImage(file, cIdx);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>

                                {cert.certificationImage?.url && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                      list[cIdx] = {
                                        ...list[cIdx],
                                        certificationImage: { url: "", alt: "", background: "default" },
                                      };
                                      handleConfigChange("certifications", list);
                                    }}
                                    className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Image
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground font-semibold">Alt Text (Accessibility)</Label>
                                  <Input
                                    value={cert.certificationImage?.alt || ""}
                                    onChange={(e) => {
                                      const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                      const existing = list[cIdx].certificationImage || {};
                                      list[cIdx] = {
                                        ...list[cIdx],
                                        certificationImage: { ...existing, alt: e.target.value },
                                      };
                                      handleConfigChange("certifications", list);
                                    }}
                                    className="h-8 text-xs mt-0.5"
                                    placeholder="e.g. eco-INSTITUT Tested Product certification"
                                  />
                                </div>

                                <div>
                                  <Label className="text-[10px] text-muted-foreground font-semibold">Image Background</Label>
                                  <select
                                    value={cert.certificationImage?.background || "default"}
                                    onChange={(e) => {
                                      const list = [...(configData.certifications || DEFAULT_CERT_ITEMS)];
                                      const existing = list[cIdx].certificationImage || {};
                                      list[cIdx] = {
                                        ...list[cIdx],
                                        certificationImage: { ...existing, background: e.target.value },
                                      };
                                      handleConfigChange("certifications", list);
                                    }}
                                    className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs mt-0.5 font-medium"
                                  >
                                    <option value="default">Default (#FFFFFF)</option>
                                    <option value="white">White (#FFFFFF)</option>
                                    <option value="warm-ivory">Warm Ivory (#FAF8F5)</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Independent Audit Card Content & Background Controls */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                      Independent Audit Card Presentation
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Configure badge, verification label, document links, and safe background treatment.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    DYNAMIC POSITION (e.g. 02 / 05)
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Audit Eyebrow / Badge Text</Label>
                    <Input
                      value={configData.auditCard?.badge ?? "Independent Audit"}
                      onChange={(e) => {
                        const card = { ...(configData.auditCard || {}), badge: e.target.value };
                        handleConfigChange("auditCard", card);
                      }}
                      className="mt-1 text-xs"
                      placeholder="Independent Audit"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Supporting Documentation Label</Label>
                    <Input
                      value={
                        configData.auditCard?.documentationText ??
                        "Official Certification Documentation"
                      }
                      onChange={(e) => {
                        const card = {
                          ...(configData.auditCard || {}),
                          documentationText: e.target.value,
                        };
                        handleConfigChange("auditCard", card);
                      }}
                      className="mt-1 text-xs uppercase"
                      placeholder="Official Certification Documentation"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Verification Protocol Text</Label>
                    <Input
                      value={
                        configData.auditCard?.verificationText ??
                        "Verification protocol on file"
                      }
                      onChange={(e) => {
                        const card = {
                          ...(configData.auditCard || {}),
                          verificationText: e.target.value,
                        };
                        handleConfigChange("auditCard", card);
                      }}
                      className="mt-1 text-xs"
                      placeholder="Verification protocol on file"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Optional Verification Document / Link URL</Label>
                    <Input
                      value={configData.auditCard?.verificationLink ?? ""}
                      onChange={(e) => {
                        const card = {
                          ...(configData.auditCard || {}),
                          verificationLink: e.target.value,
                        };
                        handleConfigChange("auditCard", card);
                      }}
                      className="mt-1 text-xs font-mono"
                      placeholder="https://... or certificate document"
                    />
                  </div>
                </div>

                {/* Background Treatment Controls */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      Card Background Type
                    </Label>
                    <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg">
                      {[
                        { id: "default", label: "Default" },
                        { id: "solid", label: "Solid Colour" },
                        { id: "image", label: "Image" },
                      ].map((bt) => {
                        const isCurrent = (configData.auditCard?.bgType || "default") === bt.id;
                        return (
                          <button
                            key={bt.id}
                            type="button"
                            onClick={() => {
                              const card = { ...(configData.auditCard || {}), bgType: bt.id };
                              handleConfigChange("auditCard", card);
                            }}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                              isCurrent
                                ? "bg-card text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {bt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Solid Colour Options */}
                  {configData.auditCard?.bgType === "solid" && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Select Safe Theme Token
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: "Warm Ivory", val: "#FAF8F5" },
                          { name: "Crisp White", val: "#FFFFFF" },
                          { name: "Natural Stone", val: "#F3F1EC" },
                          { name: "Pale Sage", val: "#EEF4E8" },
                          { name: "Dark Forest", val: "#163D32" },
                        ].map((cToken) => {
                          const isSelected = (configData.auditCard?.bgColor || "#FAF8F5") === cToken.val;
                          return (
                            <button
                              key={cToken.val}
                              type="button"
                              onClick={() => {
                                const card = { ...(configData.auditCard || {}), bgColor: cToken.val };
                                handleConfigChange("auditCard", card);
                              }}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                isSelected ? "ring-2 ring-primary border-primary" : "border-border hover:bg-muted/40"
                              }`}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: cToken.val }}
                              />
                              <span>{cToken.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Image Options */}
                  {configData.auditCard?.bgType === "image" && (
                    <div className="space-y-3 pt-2 border-t border-border/60">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Background Image URL
                          </Label>
                          <Input
                            value={configData.auditCard?.bgImageUrl || ""}
                            onChange={(e) => {
                              const card = { ...(configData.auditCard || {}), bgImageUrl: e.target.value };
                              handleConfigChange("auditCard", card);
                            }}
                            className="mt-1 text-xs font-mono"
                            placeholder="https://...png"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Image Position
                          </Label>
                          <select
                            value={configData.auditCard?.bgPosition || "center"}
                            onChange={(e) => {
                              const card = { ...(configData.auditCard || {}), bgPosition: e.target.value };
                              handleConfigChange("auditCard", card);
                            }}
                            className="mt-1 w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                          Overlay Tint:
                        </Label>
                        <div className="flex items-center gap-2">
                          {["none", "light", "medium"].map((ov) => (
                            <label key={ov} className="flex items-center gap-1.5 text-xs cursor-pointer capitalize">
                              <input
                                type="radio"
                                name="auditBgOverlay"
                                value={ov}
                                checked={(configData.auditCard?.bgOverlay || "none") === ov}
                                onChange={(e) => {
                                  const card = { ...(configData.auditCard || {}), bgOverlay: e.target.value };
                                  handleConfigChange("auditCard", card);
                                }}
                              />
                              {ov}
                            </label>
                          ))}
                        </div>
                      </div>

                      {configData.auditCard?.bgImageUrl && (
                        <div className="rounded-xl overflow-hidden border border-border bg-black/5 max-h-36 flex items-center justify-center p-2">
                          <img
                            src={configData.auditCard.bgImageUrl}
                            alt="Audit Card BG Preview"
                            className="max-h-32 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 8. TESTIMONIALS EDITOR */}
          {section.type === "testimonials_slider" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Real Sleeper Testimonials
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const t = configData.testimonials || [];
                    handleConfigChange("testimonials", [
                      ...t,
                      { name: "Verified buyer — City", text: "Comfortable organic sleep.", rating: 5 },
                    ]);
                  }}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Quote
                </Button>
              </div>

              <div>
                <Label className="text-xs">Section Heading</Label>
                <Input
                  value={configData.heading || ""}
                  onChange={(e) => handleConfigChange("heading", e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="space-y-3 pt-2">
                {(configData.testimonials || []).map((t: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Review #{idx + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const copy = (configData.testimonials || []).filter((_: any, i: number) => i !== idx);
                          handleConfigChange("testimonials", copy);
                        }}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Author / City</Label>
                        <Input
                          value={t.name || ""}
                          onChange={(e) => {
                            const copy = [...(configData.testimonials || [])];
                            copy[idx] = { ...copy[idx], name: e.target.value };
                            handleConfigChange("testimonials", copy);
                          }}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Review Quote</Label>
                        <Input
                          value={t.text || ""}
                          onChange={(e) => {
                            const copy = [...(configData.testimonials || [])];
                            copy[idx] = { ...copy[idx], text: e.target.value };
                            handleConfigChange("testimonials", copy);
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. FINAL CTA EDITOR */}
          {section.type === "cta_banner" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Sparkles className="w-4 h-4 text-primary" />
                Final Conversion CTA Banner
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Banner Headline</Label>
                  <Input
                    value={configData.heading || ""}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Subtext</Label>
                  <Input
                    value={configData.subheading || ""}
                    onChange={(e) => handleConfigChange("subheading", e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">CTA Button Label</Label>
                  <Input
                    value={configData.cta_label || ""}
                    onChange={(e) => handleConfigChange("cta_label", e.target.value)}
                    className="mt-1 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-xs">Button Destination Route</Label>
                  <Input
                    value={configData.cta_link || ""}
                    onChange={(e) => handleConfigChange("cta_link", e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 10. EXPLORE OUR STORES EDITOR */}
          {section.type === "explore_stores" && (
            <div className="space-y-6 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  Explore Our Stores Configuration
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
                  RETAIL &amp; LOCATIONS
                </Badge>
              </div>

              {/* General Copy Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Section Eyebrow</Label>
                  <Input
                    value={configData.eyebrow ?? "EXPLORE OUR STORES"}
                    onChange={(e) => handleConfigChange("eyebrow", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="EXPLORE OUR STORES"
                  />
                </div>
                <div>
                  <Label className="text-xs">Main Heading</Label>
                  <Input
                    value={configData.heading ?? "Experience Kotson In Person"}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 text-xs font-serif"
                    placeholder="Experience Kotson In Person"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Supporting Paragraph</Label>
                  <Textarea
                    value={
                      configData.paragraph ??
                      "Experience our mattresses, pillows and natural latex products in person. Visit a Kotson store and find the comfort that feels right for you."
                    }
                    onChange={(e) => handleConfigChange("paragraph", e.target.value)}
                    rows={2}
                    className="mt-1 text-xs leading-relaxed"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Showroom Image URL</Label>
                  <Input
                    value={
                      configData.showroom_image ??
                      "https://cdn.phototourl.com/free/2026-09-22-5f3360d1-de72-4db6-b87b-fd03e0286836.png"
                    }
                    onChange={(e) => handleConfigChange("showroom_image", e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Stores Manager */}
              <div className="space-y-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-foreground">
                      Physical Store Locations ({configData.stores?.length || 2} Active)
                    </h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Configure city name, showroom address, contact numbers, and covered pincodes.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const current = configData.stores || [
                        {
                          id: "hyderabad",
                          number: "01",
                          name: "Hyderabad Experience Centre",
                          city: "Hyderabad",
                          state: "Telangana",
                          area: "Jubilee Hills",
                          address: "Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033",
                          pincodes: ["500033", "500081", "500034", "500001"],
                          phone: "+91 91234 56789",
                          timings: "10:30 AM – 8:30 PM (All 7 Days)",
                          mapUrl: "https://maps.google.com/?q=Kotson+Mattress+Hyderabad",
                        },
                      ];
                      const newStore = {
                        id: `store_${Date.now()}`,
                        number: String(current.length + 1).padStart(2, "0"),
                        name: "New Experience Centre",
                        city: "New City",
                        state: "State",
                        area: "Area",
                        address: "Store Address, City, State Pincode",
                        pincodes: ["500001"],
                        phone: "+91 91234 00000",
                        timings: "10:30 AM – 8:30 PM (All 7 Days)",
                        mapUrl: "https://maps.google.com",
                      };
                      handleConfigChange("stores", [...current, newStore]);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Location
                  </Button>
                </div>

                <div className="space-y-3">
                  {(configData.stores || [
                    {
                      id: "hyderabad",
                      number: "01",
                      name: "Hyderabad Experience Centre",
                      city: "Hyderabad",
                      state: "Telangana",
                      area: "Jubilee Hills",
                      address: "Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033",
                      pincodes: ["500033", "500081", "500034", "500001"],
                      phone: "+91 91234 56789",
                      timings: "10:30 AM – 8:30 PM (All 7 Days)",
                      mapUrl: "https://maps.google.com/?q=Kotson+Mattress+Hyderabad",
                    },
                    {
                      id: "vijayawada",
                      number: "02",
                      name: "Vijayawada Experience Centre",
                      city: "Vijayawada",
                      state: "Andhra Pradesh",
                      area: "Benz Circle",
                      address: "MG Road, Near Benz Circle, Vijayawada, Andhra Pradesh 520010",
                      pincodes: ["520010", "520001", "520008"],
                      phone: "+91 91234 56790",
                      timings: "10:30 AM – 8:30 PM (All 7 Days)",
                      mapUrl: "https://maps.google.com/?q=Kotson+Mattress+Vijayawada",
                    },
                  ]).map((st: any, idx: number) => (
                    <div key={st.id || idx} className="p-4 rounded-xl border border-border/80 bg-background space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            #{st.number || idx + 1}
                          </span>
                          <span className="font-bold text-xs text-foreground">{st.city} Experience Centre</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const list = [...(configData.stores || [])];
                            list.splice(idx, 1);
                            handleConfigChange("stores", list);
                          }}
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">City Name</Label>
                          <Input
                            value={st.city || ""}
                            onChange={(e) => {
                              const list = [...(configData.stores || [])];
                              list[idx] = { ...list[idx], city: e.target.value };
                              handleConfigChange("stores", list);
                            }}
                            className="h-8 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Area / Landmark</Label>
                          <Input
                            value={st.area || ""}
                            onChange={(e) => {
                              const list = [...(configData.stores || [])];
                              list[idx] = { ...list[idx], area: e.target.value };
                              handleConfigChange("stores", list);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Phone Number</Label>
                          <Input
                            value={st.phone || ""}
                            onChange={(e) => {
                              const list = [...(configData.stores || [])];
                              list[idx] = { ...list[idx], phone: e.target.value };
                              handleConfigChange("stores", list);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Full Showroom Address</Label>
                          <Input
                            value={st.address || ""}
                            onChange={(e) => {
                              const list = [...(configData.stores || [])];
                              list[idx] = { ...list[idx], address: e.target.value };
                              handleConfigChange("stores", list);
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Pincodes (comma separated)</Label>
                          <Input
                            value={Array.isArray(st.pincodes) ? st.pincodes.join(", ") : (st.pincodes || "")}
                            onChange={(e) => {
                              const list = [...(configData.stores || [])];
                              const pins = e.target.value.split(",").map((p: string) => p.trim()).filter(Boolean);
                              list[idx] = { ...list[idx], pincodes: pins };
                              handleConfigChange("stores", list);
                            }}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visit Benefits Editor */}
              <div className="space-y-3 pt-3 border-t border-border">
                <Label className="text-xs font-bold text-foreground">Visit Benefits (3 Highlights)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: "b1", defTitle: "Try before you buy", defDesc: "Experience all natural latex densities in person" },
                    { key: "b2", defTitle: "Friendly sleep experts", defDesc: "Zero-pressure posture guidance" },
                    { key: "b3", defTitle: "Personal sleep guidance", defDesc: "Custom firmness recommendations" },
                  ].map((item, bIdx) => (
                    <div key={item.key} className="p-3 rounded-lg border border-border bg-background space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground font-semibold">Benefit #{bIdx + 1} Title</Label>
                      <Input
                        value={configData.benefits?.[bIdx]?.title ?? item.defTitle}
                        onChange={(e) => {
                          const current = configData.benefits || [
                            { title: "Try before you buy", desc: "Experience all natural latex densities in person" },
                            { title: "Friendly sleep experts", desc: "Zero-pressure posture guidance" },
                            { title: "Personal sleep guidance", desc: "Custom firmness recommendations" },
                          ];
                          current[bIdx] = { ...current[bIdx], title: e.target.value };
                          handleConfigChange("benefits", [...current]);
                        }}
                        className="h-7 text-xs font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 11. CUSTOMER TESTIMONIALS EDITOR */}
          {(section.type === "customer_testimonials" || section.type === "testimonials_slider") && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Video className="w-4 h-4 text-primary" />
                Customer Testimonials Configuration
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Section Eyebrow</Label>
                  <Input
                    value={configData.eyebrow ?? "REAL STORIES"}
                    onChange={(e) => handleConfigChange("eyebrow", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="REAL STORIES"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Section Heading</Label>
                  <Input
                    value={configData.heading ?? "Customer Testimonials"}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 text-xs font-semibold"
                    placeholder="Customer Testimonials"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Supporting Subheading</Label>
                  <Input
                    value={
                      configData.subheading ??
                      "Hear what our customers have to say about their Kotson sleep experience."
                    }
                    onChange={(e) => handleConfigChange("subheading", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="Hear what our customers have to say about their Kotson sleep experience."
                  />
                </div>
              </div>

              {/* Video List Manager */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">
                    Video Testimonials ({configData.testimonials?.length || 3})
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const list = [...(configData.testimonials || DEFAULT_TESTIMONIALS)];
                      list.push({
                        id: `test-${Date.now()}`,
                        type: "youtube",
                        videoId: "",
                        embedUrl: "",
                        enabled: true,
                        sortOrder: list.length + 1,
                        title: `Kotson Customer Testimonial ${list.length + 1}`,
                      });
                      handleConfigChange("testimonials", list);
                    }}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Testimonial Video
                  </Button>
                </div>

                <div className="space-y-3">
                  {(configData.testimonials || DEFAULT_TESTIMONIALS).map((item: any, idx: number) => {
                    const videoId = extractYouTubeId(item.videoId || item.embedUrl);
                    return (
                      <div
                        key={item.id || idx}
                        className="p-3.5 rounded-xl border border-border/80 bg-background/80 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Video #{idx + 1} {videoId ? `(${videoId})` : ""}
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={item.enabled !== false}
                                onChange={(e) => {
                                  const list = [...(configData.testimonials || DEFAULT_TESTIMONIALS)];
                                  list[idx] = { ...list[idx], enabled: e.target.checked };
                                  handleConfigChange("testimonials", list);
                                }}
                                className="rounded border-border text-primary h-3.5 w-3.5"
                              />
                              Visible
                            </label>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                const list = [...(configData.testimonials || DEFAULT_TESTIMONIALS)];
                                list.splice(idx, 1);
                                handleConfigChange("testimonials", list);
                              }}
                              className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">
                              YouTube Video URL or Video ID
                            </Label>
                            <Input
                              value={item.embedUrl || item.videoId || ""}
                              onChange={(e) => {
                                const list = [...(configData.testimonials || DEFAULT_TESTIMONIALS)];
                                const sanitizedId = extractYouTubeId(e.target.value);
                                list[idx] = {
                                  ...list[idx],
                                  embedUrl: e.target.value.trim(),
                                  videoId: sanitizedId,
                                };
                                handleConfigChange("testimonials", list);
                              }}
                              placeholder="https://www.youtube.com/embed/6PxVBxEe-TA or 6PxVBxEe-TA"
                              className="mt-0.5 h-8 text-xs font-mono"
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Accepts standard watch links, embed links, or 11-char ID.
                            </p>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">
                              Accessible Video Title (Screen Readers)
                            </Label>
                            <Input
                              value={item.title || ""}
                              onChange={(e) => {
                                const list = [...(configData.testimonials || DEFAULT_TESTIMONIALS)];
                                list[idx] = { ...list[idx], title: e.target.value };
                                handleConfigChange("testimonials", list);
                              }}
                              placeholder={`Kotson Customer Testimonial ${idx + 1}`}
                              className="mt-0.5 h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 12. NEED HELP CHOOSING EDITOR */}
          {section.type === "need_help_choosing" && (
            <div className="space-y-4 rounded-xl border border-border p-5 bg-card">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Phone className="w-4 h-4 text-primary" />
                Need Help Choosing? Configuration
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Section Eyebrow</Label>
                  <Input
                    value={configData.eyebrow ?? "SUPPORT & ASSISTANCE"}
                    onChange={(e) => handleConfigChange("eyebrow", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="SUPPORT & ASSISTANCE"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Section Heading</Label>
                  <Input
                    value={configData.heading ?? "NEED HELP CHOOSING?"}
                    onChange={(e) => handleConfigChange("heading", e.target.value)}
                    className="mt-1 text-xs font-serif"
                    placeholder="NEED HELP CHOOSING?"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold">Supporting Subheading</Label>
                  <Input
                    value={
                      configData.subheading ??
                      "Our team can help you find the right Kotson product for your needs."
                    }
                    onChange={(e) => handleConfigChange("subheading", e.target.value)}
                    className="mt-1 text-xs"
                    placeholder="Our team can help you find the right Kotson product for your needs."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="outline" size="sm" onClick={handleCloseAttempt} className="text-xs">
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-5"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? "Saving..." : "Save Draft Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Dirty-state Exit Confirmation Alert */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-sm text-foreground">You have unsaved changes</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you leave now without saving, your edits will be discarded.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExitConfirm(false)}
                className="text-xs"
              >
                Stay and Continue
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setShowExitConfirm(false);
                  onClose();
                }}
                className="text-xs"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
