import React, { useRef, useState } from "react";
import { Upload, Trash2, RefreshCw, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiUpload } from "@/lib/api";

interface BlogCoverImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  blogTitle?: string;
}

export default function BlogCoverImageUploader({
  value,
  onChange,
  blogTitle = "",
}: BlogCoverImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

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
      onChange(res.url);
      toast.success("Cover image uploaded successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload cover image";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onChange("");
    toast.info("Cover image removed.");
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        onChange={handleFileSelect}
        className="hidden"
        id="blog-cover-image-input"
        disabled={uploading}
      />

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border/80 bg-background shadow-xs group">
          <div className="relative aspect-21/9 w-full max-h-[320px] bg-muted/30 overflow-hidden flex items-center justify-center">
            <img
              src={value}
              alt={blogTitle || "Cover image preview"}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-102"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium text-foreground truncate max-w-[280px]">Cover image active</span>
              <span className="hidden sm:inline text-muted-foreground/60">• Recommended 16:9 or 2:1</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Replace
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={handleRemove}
                className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-8 text-center transition-colors hover:border-brand-leaf/50 hover:bg-muted/30 cursor-pointer"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-leaf/10 text-brand-forest mb-3">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-brand-leaf" />
            ) : (
              <Upload className="h-6 w-6 text-brand-leaf" />
            )}
          </div>

          <h4 className="text-sm font-semibold text-foreground">
            {uploading ? "Uploading cover image…" : "Upload Cover Image *"}
          </h4>

          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Drag and drop or click to browse. High resolution recommended (1200×630px or 16:9). JPG, PNG, WEBP up to 10MB.
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            className="mt-4 h-8 gap-1.5 text-xs bg-background shadow-xs font-medium"
          >
            <ImageIcon className="h-3.5 w-3.5 text-brand-forest" />
            Browse Image
          </Button>
        </div>
      )}
    </div>
  );
}
