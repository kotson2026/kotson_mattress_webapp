import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  ShieldCheck,
  Eye,
  CheckCircle2,
} from "lucide-react";
import type { ProductStorytellingConfig } from "@/lib/types";

interface ProductStorytellingTabProps {
  storytelling: ProductStorytellingConfig | undefined;
  onChange: (updated: ProductStorytellingConfig) => void;
  productSlug: string;
  productName: string;
}

export default function ProductStorytellingTab({
  storytelling,
  onChange,
  productSlug,
  productName,
}: ProductStorytellingTabProps) {
  // Safe initial state with defaults
  const config: ProductStorytellingConfig = storytelling || {
    story: {
      enabled: true,
      eyebrow: "",
      heading: "",
      description: "",
      features: [],
    },
    lifestyle: {
      enabled: true,
      image_url: "",
      eyebrow: "",
      heading: "",
      description: "",
      suitability_items: [],
      bullet_features: [],
    },
    construction: {
      enabled: true,
      eyebrow: "WHAT'S INSIDE?",
      heading: "What's Inside",
      description: "",
      image_url: "",
      layers: [],
    },
    fit_guide: {
      enabled: false,
      eyebrow: "FIND THE RIGHT FIT",
      heading: "Find the Right Fit",
      description: "",
      items: [],
    },
    certification_ids: [],
  };

  // Fetch authoritative certifications from central Website Edit CMS
  const { data: cmsCertifications = [] } = useQuery<any[]>({
    queryKey: ["cms-certifications"],
    queryFn: () => apiGet<any[]>("/cms/certifications"),
    staleTime: 60_000,
  });

  const updateField = (section: keyof ProductStorytellingConfig, val: any) => {
    onChange({
      ...config,
      [section]: val,
    });
  };

  // --- Story Section Helpers ---
  const story = config.story || { enabled: true, features: [] };
  const addStoryFeature = () => {
    const list = [...(story.features || [])];
    list.push({ icon: "sparkles", title: "New Feature", description: "" });
    updateField("story", { ...story, features: list });
  };
  const updateStoryFeature = (idx: number, patch: any) => {
    const list = [...(story.features || [])];
    list[idx] = { ...list[idx], ...patch };
    updateField("story", { ...story, features: list });
  };
  const removeStoryFeature = (idx: number) => {
    const list = (story.features || []).filter((_, i) => i !== idx);
    updateField("story", { ...story, features: list });
  };

  // --- Lifestyle Section Helpers ---
  const lifestyle = config.lifestyle || { enabled: true, suitability_items: [], bullet_features: [] };
  const addSuitabilityItem = () => {
    const list = [...(lifestyle.suitability_items || [])];
    list.push({ label: "Attribute", value: "", icon: "ruler" });
    updateField("lifestyle", { ...lifestyle, suitability_items: list });
  };
  const updateSuitabilityItem = (idx: number, patch: any) => {
    const list = [...(lifestyle.suitability_items || [])];
    list[idx] = { ...list[idx], ...patch };
    updateField("lifestyle", { ...lifestyle, suitability_items: list });
  };
  const removeSuitabilityItem = (idx: number) => {
    const list = (lifestyle.suitability_items || []).filter((_, i) => i !== idx);
    updateField("lifestyle", { ...lifestyle, suitability_items: list });
  };

  // --- Construction Section Helpers ---
  const construction = config.construction || { enabled: true, layers: [] };
  const addConstructionLayer = () => {
    const list = [...(construction.layers || [])];
    const nextOrder = list.length + 1;
    list.push({
      order: nextOrder,
      name: `Layer ${nextOrder}`,
      description: "",
      icon: "layers",
    });
    updateField("construction", { ...construction, layers: list });
  };
  const updateConstructionLayer = (idx: number, patch: any) => {
    const list = [...(construction.layers || [])];
    list[idx] = { ...list[idx], ...patch };
    updateField("construction", { ...construction, layers: list });
  };
  const removeConstructionLayer = (idx: number) => {
    const list = (construction.layers || []).filter((_, i) => i !== idx);
    // re-index order
    const reordered = list.map((l, i) => ({ ...l, order: i + 1 }));
    updateField("construction", { ...construction, layers: reordered });
  };
  const moveLayer = (idx: number, dir: -1 | 1) => {
    const list = [...(construction.layers || [])];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    const reordered = list.map((l, i) => ({ ...l, order: i + 1 }));
    updateField("construction", { ...construction, layers: reordered });
  };

  // --- Fit Guide Section Helpers ---
  const fitGuide = config.fit_guide || { enabled: false, items: [] };
  const addFitItem = () => {
    const list = [...(fitGuide.items || [])];
    list.push({
      name: "Model Profile",
      subtitle: "",
      dimensions: "",
      specs: "",
      link_slug: "",
    });
    updateField("fit_guide", { ...fitGuide, items: list });
  };
  const updateFitItem = (idx: number, patch: any) => {
    const list = [...(fitGuide.items || [])];
    list[idx] = { ...list[idx], ...patch };
    updateField("fit_guide", { ...fitGuide, items: list });
  };
  const removeFitItem = (idx: number) => {
    const list = (fitGuide.items || []).filter((_, i) => i !== idx);
    updateField("fit_guide", { ...fitGuide, items: list });
  };

  // --- Certifications Helper ---
  const certIds = config.certification_ids || [];
  const toggleCertification = (id: string) => {
    const current = new Set(certIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    updateField("certification_ids", Array.from(current));
  };

  return (
    <div className="space-y-8" data-testid="pdp-storytelling-tab">
      {/* Top Banner & Live Preview Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-brand-leaf/30 bg-brand-sand/30">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-leaf" />
            <h3 className="font-heading text-base font-bold text-foreground">
              Product Page Storytelling Architecture
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dynamic editorial content for {productName || "this product"}. Unconfigured sections collapse automatically.
          </p>
        </div>
        {productSlug && (
          <div className="flex items-center gap-2">
            <a
              href={`/products/${productSlug}?pdp=storytelling`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-leaf text-white text-xs font-semibold hover:bg-brand-leaf/90 transition-colors shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Storytelling PDP
            </a>
            <a
              href={`/products/${productSlug}?pdp=current`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Preview Current PDP
            </a>
          </div>
        )}
      </div>

      {/* 1. PRODUCT STORY INTRODUCTION */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
              1. Product Story Introduction
            </h4>
            <p className="text-xs text-muted-foreground">Quickly answers: Why should I consider this product?</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={story.enabled !== false}
              onChange={(e) => updateField("story", { ...story, enabled: e.target.checked })}
              className="rounded text-brand-leaf focus:ring-brand-leaf"
            />
            <span>Enable Section</span>
          </label>
        </div>

        {story.enabled !== false && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Eyebrow</Label>
                <Input
                  value={story.eyebrow || ""}
                  onChange={(e) => updateField("story", { ...story, eyebrow: e.target.value })}
                  placeholder="e.g. MADE FOR GROWING SLEEPERS"
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Heading *</Label>
                <Input
                  value={story.heading || ""}
                  onChange={(e) => updateField("story", { ...story, heading: e.target.value })}
                  placeholder="e.g. Designed for Little Sleepers"
                  className="mt-1 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                value={story.description || ""}
                onChange={(e) => updateField("story", { ...story, description: e.target.value })}
                placeholder="Product-specific narrative answering why customer should consider it..."
                className="mt-1 text-xs"
              />
            </div>

            {/* Key Features List */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Key Features ({story.features?.length || 0})
                </Label>
                <Button size="sm" variant="outline" onClick={addStoryFeature} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Feature
                </Button>
              </div>

              <div className="space-y-2">
                {(story.features || []).map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border border-border/70 bg-muted/20">
                    <div className="w-24 shrink-0">
                      <Label className="text-[10px] text-muted-foreground">Icon</Label>
                      <select
                        value={feat.icon || "contour"}
                        onChange={(e) => updateStoryFeature(idx, { icon: e.target.value })}
                        className="w-full h-8 px-2 mt-0.5 rounded border border-input bg-background text-xs"
                      >
                        <option value="contour">Contour</option>
                        <option value="latex">Organic Latex</option>
                        <option value="bamboo">Bamboo</option>
                        <option value="shield">Shield</option>
                        <option value="layers">Layers</option>
                        <option value="sparkles">Sparkles</option>
                      </select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={feat.title}
                        onChange={(e) => updateStoryFeature(idx, { title: e.target.value })}
                        placeholder="Feature Title (e.g. Ergonomic Contour)"
                        className="h-8 text-xs font-medium"
                      />
                      <Input
                        value={feat.description}
                        onChange={(e) => updateStoryFeature(idx, { description: e.target.value })}
                        placeholder="Feature Description"
                        className="h-8 text-xs text-muted-foreground"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeStoryFeature(idx)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. LIFESTYLE + SUITABILITY */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
              2. Lifestyle + Suitability
            </h4>
            <p className="text-xs text-muted-foreground">50% lifestyle visual, 50% suitability specifications.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={lifestyle.enabled !== false}
              onChange={(e) => updateField("lifestyle", { ...lifestyle, enabled: e.target.checked })}
              className="rounded text-brand-leaf focus:ring-brand-leaf"
            />
            <span>Enable Section</span>
          </label>
        </div>

        {lifestyle.enabled !== false && (
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs">Lifestyle Image URL</Label>
              <Input
                value={lifestyle.image_url || ""}
                onChange={(e) => updateField("lifestyle", { ...lifestyle, image_url: e.target.value })}
                placeholder="https://... or upload path"
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Eyebrow</Label>
                <Input
                  value={lifestyle.eyebrow || ""}
                  onChange={(e) => updateField("lifestyle", { ...lifestyle, eyebrow: e.target.value })}
                  placeholder="e.g. DESIGNED FOR"
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Heading</Label>
                <Input
                  value={lifestyle.heading || ""}
                  onChange={(e) => updateField("lifestyle", { ...lifestyle, heading: e.target.value })}
                  placeholder="e.g. LITTLE SLEEPERS"
                  className="mt-1 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description / Supporting Copy</Label>
              <Textarea
                rows={2}
                value={lifestyle.description || ""}
                onChange={(e) => updateField("lifestyle", { ...lifestyle, description: e.target.value })}
                placeholder="Supporting lifestyle information..."
                className="mt-1 text-xs"
              />
            </div>

            {/* Suitability Items */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Suitability Items (Ages, Profile, Dimensions, etc.)
                </Label>
                <Button size="sm" variant="outline" onClick={addSuitabilityItem} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Suitability Metric
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(lifestyle.suitability_items || []).map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5 relative">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeSuitabilityItem(idx)}
                      className="h-6 w-6 absolute top-1 right-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Label</Label>
                      <Input
                        value={item.label}
                        onChange={(e) => updateSuitabilityItem(idx, { label: e.target.value })}
                        placeholder="e.g. Age / Dimensions"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Value</Label>
                      <Input
                        value={item.value}
                        onChange={(e) => updateSuitabilityItem(idx, { value: e.target.value })}
                        placeholder="e.g. Ages 2–5 / 44 × 28 × 6/6 cm"
                        className="h-7 text-xs font-semibold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. WHAT'S INSIDE / CONSTRUCTION */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
              3. What's Inside / Construction
            </h4>
            <p className="text-xs text-muted-foreground">Product construction visual + 0–N repeatable layers.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={construction.enabled !== false}
              onChange={(e) => updateField("construction", { ...construction, enabled: e.target.checked })}
              className="rounded text-brand-leaf focus:ring-brand-leaf"
            />
            <span>Enable Section</span>
          </label>
        </div>

        {construction.enabled !== false && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Section Heading</Label>
                <Input
                  value={construction.heading || "What's Inside"}
                  onChange={(e) => updateField("construction", { ...construction, heading: e.target.value })}
                  placeholder="What's Inside"
                  className="mt-1 text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs">Construction Visual Image URL</Label>
                <Input
                  value={construction.image_url || ""}
                  onChange={(e) => updateField("construction", { ...construction, image_url: e.target.value })}
                  placeholder="Exploded view or product visual URL"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Input
                value={construction.description || ""}
                onChange={(e) => updateField("construction", { ...construction, description: e.target.value })}
                placeholder="Brief summary of construction..."
                className="mt-1 text-xs"
              />
            </div>

            {/* Repeatable Layers */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Layers ({(construction.layers || []).length})
                </Label>
                <Button size="sm" variant="outline" onClick={addConstructionLayer} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Layer
                </Button>
              </div>

              <div className="space-y-2">
                {(construction.layers || []).map((layer, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border border-border/70 bg-muted/20">
                    <span className="font-heading text-lg font-bold text-brand-leaf shrink-0 w-8 pt-1">
                      {String(layer.order || idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={layer.name}
                        onChange={(e) => updateConstructionLayer(idx, { name: e.target.value })}
                        placeholder="Layer Name (e.g. Bamboo Cover)"
                        className="h-8 text-xs font-semibold"
                      />
                      <Input
                        value={layer.description}
                        onChange={(e) => updateConstructionLayer(idx, { description: e.target.value })}
                        placeholder="Layer Description"
                        className="h-8 text-xs text-muted-foreground"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={idx === 0}
                        onClick={() => moveLayer(idx, -1)}
                        className="h-7 w-7 text-muted-foreground"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={idx === (construction.layers || []).length - 1}
                        onClick={() => moveLayer(idx, 1)}
                        className="h-7 w-7 text-muted-foreground"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeConstructionLayer(idx)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete Layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. FIND THE RIGHT FIT */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
              4. Find the Right Fit
            </h4>
            <p className="text-xs text-muted-foreground">Only render when useful (e.g. Mini vs Junior comparison, mattress sizing).</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={fitGuide.enabled === true}
              onChange={(e) => updateField("fit_guide", { ...fitGuide, enabled: e.target.checked })}
              className="rounded text-brand-leaf focus:ring-brand-leaf"
            />
            <span>Enable Section</span>
          </label>
        </div>

        {fitGuide.enabled === true && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Heading</Label>
                <Input
                  value={fitGuide.heading || "Find the Right Fit"}
                  onChange={(e) => updateField("fit_guide", { ...fitGuide, heading: e.target.value })}
                  placeholder="Find the Right Fit"
                  className="mt-1 text-xs font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs">Supporting Copy</Label>
                <Input
                  value={fitGuide.description || ""}
                  onChange={(e) => updateField("fit_guide", { ...fitGuide, description: e.target.value })}
                  placeholder="Selection guidance..."
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Fit Items */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">
                  Fit Comparison Models
                </Label>
                <Button size="sm" variant="outline" onClick={addFitItem} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add Model
                </Button>
              </div>

              <div className="space-y-2">
                {(fitGuide.items || []).map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/70 bg-muted/20 grid grid-cols-1 sm:grid-cols-4 gap-2 relative">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFitItem(idx)}
                      className="h-6 w-6 absolute top-1 right-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Model Name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateFitItem(idx, { name: e.target.value })}
                        placeholder="e.g. Natural Nest Mini"
                        className="h-7 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Subtitle / Age</Label>
                      <Input
                        value={item.subtitle || ""}
                        onChange={(e) => updateFitItem(idx, { subtitle: e.target.value })}
                        placeholder="e.g. Ages 2–5"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Dimensions</Label>
                      <Input
                        value={item.dimensions || ""}
                        onChange={(e) => updateFitItem(idx, { dimensions: e.target.value })}
                        placeholder="e.g. 44 × 28 × 6/6 cm"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Product Link Slug</Label>
                      <Input
                        value={item.link_slug || ""}
                        onChange={(e) => updateFitItem(idx, { link_slug: e.target.value })}
                        placeholder="e.g. natural-nest-mini-pillow"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. CERTIFIED & TRUSTED */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="border-b border-border pb-3">
          <h4 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            5. Certified & Trusted (Assigned Certifications)
          </h4>
          <p className="text-xs text-muted-foreground">
            Select ONLY certifications that authoritative data validates for this product. Centralized from Website Edit CMS.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {cmsCertifications.map((cert: any) => {
            const isChecked = certIds.includes(cert.id) || certIds.includes(cert.id?.toLowerCase());
            return (
              <label
                key={cert.id}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isChecked
                    ? "border-brand-leaf bg-brand-sand/20 ring-1 ring-brand-leaf/30"
                    : "border-border bg-card hover:bg-muted/10"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCertification(cert.id)}
                  className="mt-1 rounded text-brand-leaf focus:ring-brand-leaf"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <span>{cert.selectorName || cert.title}</span>
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-brand-leaf" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {cert.category || cert.selectorCategory || cert.subtitle}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
