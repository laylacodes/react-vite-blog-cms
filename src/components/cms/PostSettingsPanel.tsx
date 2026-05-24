import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DeletePostDialog } from "./DeletePostDialog";

interface PostSettingsPanelProps {
  slug: string;
  onSlugChange: (value: string) => void;
  publishedDate: string;
  onPublishedDateChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  tags: string;
  onTagsChange: (value: string) => void;
  title: string;
  isExistingPost: boolean;
  onConfirmDelete: (deleteMedia: boolean) => Promise<void>;
  isPublishing: boolean;
}

/** Right-hand panel: slug, date, description, tags, a live preview, and delete. */
export function PostSettingsPanel({
  slug,
  onSlugChange,
  publishedDate,
  onPublishedDateChange,
  description,
  onDescriptionChange,
  tags,
  onTagsChange,
  title,
  isExistingPost,
  onConfirmDelete,
  isPublishing,
}: PostSettingsPanelProps) {
  const [dangerExpanded, setDangerExpanded] = useState(false);

  // The delete ("Danger Zone") section only applies to already-published posts.
  const showDanger = isExistingPost && slug.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-lg">Post Settings</h2>

        <div>
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="post-url-slug"
            className="mt-1"
            disabled={isExistingPost}
          />
          <p className="text-xs text-muted-foreground mt-1">URL: /{slug || "post-slug"}</p>
        </div>

        <div>
          <Label htmlFor="date">Published Date</Label>
          <Input
            id="date"
            type="date"
            value={publishedDate}
            onChange={(e) => onPublishedDateChange(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description">Description / Excerpt</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Brief description of the post..."
            className="mt-1"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => onTagsChange(e.target.value)}
            placeholder="tutorial, react, typescript"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">Separate tags with commas</p>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h3 className="font-medium mb-2">Preview</h3>
        <div className="text-sm space-y-1">
          <p className="font-semibold">{title || "Untitled Post"}</p>
          <p className="text-muted-foreground text-xs">
            {publishedDate} · {tags || "No tags"}
          </p>
          <p className="text-muted-foreground">{description || "No description"}</p>
        </div>
      </div>

      {/* Danger Zone — collapsible delete control for existing posts */}
      {showDanger && (
        <div className="border border-destructive/30 rounded-lg bg-destructive/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setDangerExpanded((v) => !v)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-destructive/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-semibold text-sm text-destructive">Danger Zone</span>
            </div>
            {dangerExpanded ? (
              <ChevronUp className="h-4 w-4 text-destructive" />
            ) : (
              <ChevronDown className="h-4 w-4 text-destructive" />
            )}
          </button>

          <div className={cn("overflow-hidden transition-all duration-200", dangerExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
            <div className="p-4 pt-0 space-y-3">
              <p className="text-xs text-muted-foreground">
                Permanently delete this post and optionally its associated media files.
              </p>
              <DeletePostDialog slug={slug} onConfirmDelete={onConfirmDelete} disabled={isPublishing} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
