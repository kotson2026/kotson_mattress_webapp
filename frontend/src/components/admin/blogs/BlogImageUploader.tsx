import React, { useRef, useState } from "react";
import { Upload, Trash2, Copy, PlusCircle, Check, AlertCircle, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiUpload } from "@/lib/api";
import type { BlogImage } from "@/lib/types";

interface BlogImageUploaderProps {
  label: string;
  images: BlogImage[];
  onChange: (images: BlogImage[]) => void;
  onInsertMarkdown?: (markdownSnippet: string) => void;
  blogTitle?: string;
  helperText?: string;
}

export default function BlogImageUploader({
  label,
  images,
  onChange,
  onInsertMarkdown,
  blogTitle = "",
  helperText,
}: BlogImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleIsMissing = !blogTitle.trim();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (titleIsMissing) {
      toast.error("Please enter a blog title first before uploading images.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const file = files[0];

    // Client-side quick validations
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!validMimes.includes(file.type.toLowerCase())) {
      toast.error(`Unsupported format '${file.type}'. Allowed: JPG, PNG, WEBP, GIF, AVIF.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size exceeds the 10 MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await apiUpload<{ id: string; url: string; filename: string; size_kb: number }>(
        "/admin/blogs/upload-image",
        formData
      );

      const newImage: BlogImage = {
        id: res.id,
        url: res.url,
        alt_text: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      };

      onChange([...images, newImage]);
      toast.success("Image uploaded successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload image";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (id: string) => {
    onChange(images.filter((img) => img.id !== id));
    toast.info("Image removed from article list.");
  };

  const handleAltChange = (id: string, newAlt: string) => {
    onChange(
      images.map((img) => (img.id === id ? { ...img, alt_text: newAlt } : img))
    );
  };

  const handleCopyUrl = (id: string, url: string) => {
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    toast.success("Image URL copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (img: BlogImage) => {
    if (!onInsertMarkdown) return;
    const alt = (img.alt_text || "Blog illustration").trim();
    const snippet = `\n\n![${alt}](${img.url})\n\n`;
    onInsertMarkdown(snippet);
    toast.success("Image inserted into editor content.");
  };

  return (
    <div className="mt-3 rounded-xl border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {label}
          </h4>
          {helperText && <p className="text-xs text-muted-foreground mt-0.5">{helperText}</p>}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-upload-${label.replace(/\s+/g, "-").toLowerCase()}`}
            disabled={uploading || titleIsMissing}
          />

          {titleIsMissing ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Enter a title first to enable image upload</span>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs bg-background hover:bg-muted font-medium"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5 text-brand-leaf" />
                  Upload Image
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Images List */}
      {images.length === 0 ? (
        <div className="flex items-center gap-2 py-3 px-3 rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground bg-background/50">
          <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
          <span>No images uploaded yet.</span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-background p-2.5 shadow-2xs"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30">
                <img
                  src={img.url}
                  alt={img.alt_text || "Preview"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Alt Text (Accessibility & SEO)</label>
                  <Input
                    value={img.alt_text}
                    onChange={(e) => handleAltChange(img.id, e.target.value)}
                    placeholder="Descriptive image alt text"
                    className="h-7 text-xs mt-0.5"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {onInsertMarkdown && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={() => handleInsert(img)}
                      className="h-6 gap-1 px-2 text-[11px] font-medium text-brand-forest hover:bg-brand-forest/10"
                      title="Insert Markdown into story content"
                    >
                      <PlusCircle className="h-3 w-3" />
                      Insert into Content
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleCopyUrl(img.id, img.url)}
                    className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    title="Copy persistent image URL"
                  >
                    {copiedId === img.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy URL
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => handleRemove(img.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive ml-auto"
                    title="Remove image from list"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
