import { useState, useEffect } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface DeletePostDialogProps {
  slug: string;
  onConfirmDelete: (deleteMedia: boolean) => Promise<void>;
  disabled?: boolean;
  /** If provided, controls the dialog's open state externally. */
  externalOpen?: boolean;
  /** Called when the dialog requests an open-state change (external control). */
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in trigger button (when opening from elsewhere). */
  hideTrigger?: boolean;
}

/**
 * Type-to-confirm delete dialog. Optionally also deletes media named
 * "<slug>-*" from public/blog-images/. Works both standalone (with its own
 * trigger) and as an externally-controlled dialog.
 */
export function DeletePostDialog({
  slug,
  onConfirmDelete,
  disabled,
  externalOpen,
  onOpenChange: externalOnOpenChange,
  hideTrigger,
}: DeletePostDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteMedia, setDeleteMedia] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const isConfirmValid = confirmText === "DELETE";

  useEffect(() => {
    if (open) {
      setConfirmText("");
      setDeleteMedia(false);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isDeleting) return;

    if (isControlled) externalOnOpenChange?.(newOpen);
    else setInternalOpen(newOpen);

    if (!newOpen) {
      setConfirmText("");
      setDeleteMedia(false);
    }
  };

  const handleDelete = async () => {
    if (!isConfirmValid) return;
    setIsDeleting(true);
    try {
      await onConfirmDelete(deleteMedia);
      handleOpenChange(false);
    } catch {
      // Parent surfaces the error (e.g. via a toast).
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={disabled}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Post
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Post
          </DialogTitle>
          <DialogDescription>
            This will permanently delete <strong className="text-foreground">{slug}.md</strong> from GitHub.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="delete-media"
              checked={deleteMedia}
              onCheckedChange={(checked) => setDeleteMedia(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="delete-media"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Also delete associated media
              </Label>
              <p className="text-xs text-muted-foreground">
                Deletes files in public/blog-images/ starting with "{slug}-"
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">
              Type <strong>DELETE</strong> to confirm
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!isConfirmValid || isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Forever
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
