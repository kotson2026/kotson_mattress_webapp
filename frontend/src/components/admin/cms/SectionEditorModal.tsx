import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Eye,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
