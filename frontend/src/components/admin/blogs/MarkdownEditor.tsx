import React, { useRef, useState } from "react";
import {
  Heading2,
  Heading3,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Undo2,
  Redo2,
  Eye,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderMarkdown, convertHtmlToMarkdown } from "@/lib/markdown";

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  id?: string;
  minHeight?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter your content here...",
  id,
  minHeight = "240px",
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Simple undo/redo history stack
  const historyRef = useRef<string[]>([value]);
  const historyIndexRef = useRef<number>(0);

  const pushHistory = (newVal: string) => {
    const curIndex = historyIndexRef.current;
    const history = historyRef.current.slice(0, curIndex + 1);
    history.push(newVal);
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    onChange(newVal);
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevVal = historyRef.current[historyIndexRef.current];
      onChange(prevVal);
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextVal = historyRef.current[historyIndexRef.current];
      onChange(nextVal);
    }
  };

  const applyFormat = (prefix: string, suffix: string = "", defaultText: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || defaultText;

    const before = value.substring(0, start);
    const after = value.substring(end);

    const replacement = `${prefix}${selected}${suffix}`;
    const nextValue = `${before}${replacement}${after}`;

    pushHistory(nextValue);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      );
    }, 10);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (html) {
      e.preventDefault();
      const markdown = convertHtmlToMarkdown(html);
      const textarea = textareaRef.current;
      if (!textarea) {
        pushHistory(value + markdown);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);

      const nextVal = `${before}${markdown}${after}`;
      pushHistory(nextVal);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length);
      }, 10);
    }
  };

  const insertLink = () => {
    const url = window.prompt("Enter link URL:", "https://");
    if (!url) return;
    applyFormat("[", `](${url})`, "Link text");
  };

  const insertImage = () => {
    const url = window.prompt("Enter image URL:", "https://");
    if (!url) return;
    const alt = window.prompt("Enter image alt text:", "Image description");
    applyFormat(`![${alt || "Image"}](${url})`, "", "");
  };

  return (
    <div className="w-full rounded-xl border border-border/80 bg-background overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-brand-leaf/30 focus-within:border-brand-leaf">
      {/* Editor Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-2 py-1.5 gap-1 select-none">
        <div className="flex flex-wrap items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("\n\n## ", "\n", "Heading 2")}
            title="Heading 2"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("\n\n### ", "\n", "Heading 3")}
            title="Heading 3"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border/80" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("**", "**", "bold text")}
            title="Bold"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("*", "*", "italic text")}
            title="Italic"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border/80" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("\n- ", "\n", "List item")}
            title="Bullet List"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("\n1. ", "\n", "List item")}
            title="Numbered List"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("\n\n> ", "\n\n", "Quote text")}
            title="Quote"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Quote className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border/80" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertLink}
            title="Insert Link"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertImage}
            title="Insert Image"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => applyFormat("\n\n---\n\n", "")}
            title="Horizontal Divider"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Minus className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-4 w-px bg-border/80" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            title="Undo"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            title="Redo"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Edit / Preview Tabs */}
        <div className="flex items-center rounded-lg border border-border/70 bg-background/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
              activeTab === "edit"
                ? "bg-brand-forest text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
              activeTab === "preview"
                ? "bg-brand-forest text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      {activeTab === "edit" ? (
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            // Throttle history
            historyRef.current[historyIndexRef.current] = e.target.value;
          }}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden"
        />
      ) : (
        <div
          style={{ minHeight }}
          className="prose prose-stone max-w-none p-5 text-sm leading-relaxed text-foreground/90 bg-[#FAFAF8]"
        >
          {value.trim() ? (
            <div
              dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
              className="blog-preview-content space-y-4"
            />
          ) : (
            <p className="italic text-muted-foreground">Nothing to preview yet. Switch back to Edit to write your story.</p>
          )}
        </div>
      )}
    </div>
  );
}
