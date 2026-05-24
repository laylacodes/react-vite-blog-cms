import { useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadedMedia {
  id: string;
  filename: string;
  type: "image" | "video";
  preview: string; // data URL for the in-browser preview
  base64: string; // raw base64 (no data: prefix) sent to the publish function
}

interface MediaUploaderProps {
  slug: string;
  media: UploadedMedia[];
  onMediaAdd: (media: UploadedMedia) => void;
  onMediaRemove: (id: string) => void;
  onInsertIntoPost: (media: UploadedMedia) => void;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "video/mp4"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Drag-and-drop uploader. Files are read into base64 in the browser and only
 * committed to the repo when the post is published (under public/blog-images/).
 * Filenames are derived from the post slug: "<slug>-01.png", "<slug>-02.mp4"...
 */
export function MediaUploader({ slug, media, onMediaAdd, onMediaRemove, onInsertIntoPost }: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateFilename = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const paddedIndex = String(media.length + 1).padStart(2, "0");
      const safeSlug = slug || "untitled";
      return `${safeSlug}-${paddedIndex}.${ext}`;
    },
    [slug, media.length],
  );

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Invalid file type: ${file.type}. Allowed: png, jpg, jpeg, webp, gif, mp4`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("File too large. Maximum size is 10MB.");
        return;
      }

      const filename = generateFilename(file);
      const isVideo = file.type.startsWith("video/");

      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(",")[1]; // strip "data:...;base64,"
          onMediaAdd({
            id: crypto.randomUUID(),
            filename,
            type: isVideo ? "video" : "image",
            preview: result,
            base64,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    },
    [generateFilename, onMediaAdd],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      for (const file of Array.from(e.dataTransfer.files)) {
        await processFile(file);
      }
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      for (const file of Array.from(e.target.files || [])) {
        await processFile(file);
      }
      e.target.value = ""; // allow re-selecting the same file
    },
    [processFile],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">Drag & drop images or videos here, or</p>
        <label>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif,.mp4"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span className="cursor-pointer">Browse Files</span>
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-2">Supported: PNG, JPG, JPEG, WebP, GIF, MP4 (max 10MB)</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {media.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative group rounded-lg overflow-hidden border border-border bg-muted/30"
            >
              {item.type === "image" ? (
                <img src={item.preview} alt={item.filename} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-muted">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onInsertIntoPost(item)}
                  className="text-xs"
                >
                  <ImageIcon className="h-3 w-3 mr-1" />
                  Insert
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onMediaRemove(item.id)}
                  className="text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="p-2">
                <p className="text-xs text-muted-foreground truncate" title={item.filename}>
                  {item.filename}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { UploadedMedia };
