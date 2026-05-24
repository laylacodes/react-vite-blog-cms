import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface EmbedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (iframeHtml: string) => void;
}

/**
 * Wraps an embed src in a responsive 16:9 container so it scales on any screen.
 * The matching iframe sanitization config lives in src/pages/BlogPost.tsx.
 */
function createResponsiveIframe(src: string): string {
  return (
    `<div class="embed-wrapper" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:2rem 0;border-radius:12px;">` +
    `<iframe src="${src}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy" title="Embedded content"></iframe>` +
    `</div>`
  );
}

/** Normalizes common share links (YouTube, Vimeo) into their embeddable form. */
function normalizeEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    return url;
  } catch {
    return url;
  }
}

// Accepts a plain URL or a full <iframe> snippet and returns a safe https src.
function parseEmbedInput(input: string): { valid: boolean; src?: string; error?: string } {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, error: "Paste an embed URL or an <iframe> snippet." };
  }

  // If an <iframe> was pasted, pull the src out of it.
  if (trimmed.includes("<iframe")) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return { valid: false, error: "Could not find a src attribute in that iframe." };
    const src = srcMatch[1];
    if (!src.startsWith("https://")) return { valid: false, error: "Embeds must use an https:// URL." };
    return { valid: true, src };
  }

  // Otherwise treat the input as a URL.
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, error: "Enter a full URL starting with https://" };
  }
  if (!trimmed.startsWith("https://")) {
    return { valid: false, error: "Embeds must use an https:// URL." };
  }
  try {
    new URL(trimmed);
  } catch {
    return { valid: false, error: "That does not look like a valid URL." };
  }

  return { valid: true, src: normalizeEmbedUrl(trimmed) };
}

/** Generic embed inserter — paste a YouTube/Vimeo link, any https URL, or an iframe. */
export function EmbedModal({ open, onOpenChange, onInsert }: EmbedModalProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleInsert = () => {
    const result = parseEmbedInput(input);
    if (!result.valid || !result.src) {
      setError(result.error || "Invalid embed");
      return;
    }
    onInsert(createResponsiveIframe(result.src));
    handleClose();
  };

  const handleClose = () => {
    setInput("");
    setError(null);
    onOpenChange(false);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (error) setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Insert Embed</DialogTitle>
          <DialogDescription>Add a video or other embeddable content to your post.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="embed-input">Embed URL or iframe</Label>
            <Textarea
              id="embed-input"
              placeholder="https://www.youtube.com/watch?v=...  — or paste a full <iframe> snippet"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Paste a YouTube/Vimeo link, any https:// URL, or a full iframe snippet.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { createResponsiveIframe, normalizeEmbedUrl, parseEmbedInput };
