import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "b", "i", "strong", "em", "strike", "s", "del", "u",
    "ul", "ol", "li",
    "blockquote", "code", "pre", "hr", "br",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div"
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class", "target", "rel", "width", "height", "loading"
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Safely parse markdown to sanitized HTML.
 * Strips script tags, event handlers, and javascript: links.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return "";
  try {
    const rawHtml = marked.parse(markdown) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
    return cleanHtml;
  } catch (err) {
    console.error("Failed to render markdown:", err);
    return DOMPurify.sanitize(markdown);
  }
}

/**
 * Convert pasted rich HTML into clean Markdown.
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html) return "";
  
  // Clean HTML first
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "b", "strong", "i", "em", "u", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "br", "img"],
    ALLOWED_ATTR: ["href", "src", "alt"],
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "text/html");

  function traverse(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const childrenText = Array.from(el.childNodes).map(traverse).join("");

    switch (tag) {
      case "h1":
      case "h2":
        return `\n\n## ${childrenText.trim()}\n\n`;
      case "h3":
        return `\n\n### ${childrenText.trim()}\n\n`;
      case "h4":
      case "h5":
      case "h6":
        return `\n\n#### ${childrenText.trim()}\n\n`;
      case "p":
        return `\n\n${childrenText.trim()}\n\n`;
      case "b":
      case "strong":
        return `**${childrenText}**`;
      case "i":
      case "em":
        return `*${childrenText}*`;
      case "blockquote":
        return `\n\n> ${childrenText.trim()}\n\n`;
      case "code":
        return `\`${childrenText}\``;
      case "pre":
        return `\n\n\`\`\`\n${childrenText.trim()}\n\`\`\`\n\n`;
      case "hr":
        return `\n\n---\n\n`;
      case "br":
        return `\n`;
      case "a": {
        const href = el.getAttribute("href") || "#";
        return `[${childrenText.trim() || href}](${href})`;
      }
      case "img": {
        const src = el.getAttribute("src") || "";
        const alt = el.getAttribute("alt") || "Image";
        return `\n\n![${alt}](${src})\n\n`;
      }
      case "li":
        return `- ${childrenText.trim()}\n`;
      case "ul":
      case "ol":
        return `\n\n${childrenText.trim()}\n\n`;
      default:
        return childrenText;
    }
  }

  const result = traverse(doc.body)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}
