import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, LogOut, Plus, FileText, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminGate, getAdminToken, useAdminLogout } from "./AdminGate";
import { RichTextEditor, RichTextEditorHandle } from "./RichTextEditor";
import { MediaUploader, UploadedMedia } from "./MediaUploader";
import { PostListSidebar } from "./PostListSidebar";
import { PostSettingsPanel } from "./PostSettingsPanel";
import { DeletePostDialog } from "./DeletePostDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAllPosts, Post } from "@/lib/posts";

const DRAFTS_STORAGE_KEY = "blog-studio-drafts";
const AUTOSAVE_INTERVAL = 3000; // auto-save the active draft every 3s

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface FormState {
  title: string;
  slug: string;
  description: string;
  tags: string;
  publishedDate: string;
  content: string;
}

interface Draft {
  id: string;
  formState: FormState;
  createdAt: string;
  updatedAt: string;
}

const initialFormState: FormState = {
  title: "",
  slug: "",
  description: "",
  tags: "",
  publishedDate: new Date().toISOString().split("T")[0],
  content: "<p>Start writing your post...</p>",
};

// --- localStorage-backed draft store ----------------------------------------
function loadAllDrafts(): Draft[] {
  try {
    const drafts = localStorage.getItem(DRAFTS_STORAGE_KEY);
    return drafts ? JSON.parse(drafts) : [];
  } catch {
    return [];
  }
}

function saveAllDrafts(drafts: Draft[]): void {
  try {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error("Failed to save drafts:", error);
  }
}

function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hasContent(formState: FormState): boolean {
  return (
    formState.title.trim() !== "" ||
    (formState.content !== initialFormState.content && formState.content.trim() !== "")
  );
}

function BlogStudioContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const handleLogout = useAdminLogout();

  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [slugEdited, setSlugEdited] = useState(false);
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExistingPost, setIsExistingPost] = useState(false);
  const [selectedPostSlug, setSelectedPostSlug] = useState<string | null>(null);
  const [lastSavedState, setLastSavedState] = useState<FormState>(initialFormState);

  // Draft state
  const [drafts, setDrafts] = useState<Draft[]>(() => loadAllDrafts());
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetSlug, setDeleteTargetSlug] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>(() => getAllPosts());

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(lastSavedState),
    [formState, lastSavedState],
  );

  // Auto-save the active draft (new posts only).
  useEffect(() => {
    if (isExistingPost) return;
    if (!currentDraftId) return;

    const interval = setInterval(() => {
      if (hasContent(formState)) {
        const now = new Date().toISOString();
        setDrafts((prev) => {
          const updated = prev.map((d) => (d.id === currentDraftId ? { ...d, formState, updatedAt: now } : d));
          saveAllDrafts(updated);
          return updated;
        });
        setDraftSavedAt(now);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [formState, isExistingPost, currentDraftId]);

  // Auto-generate the slug from the title (new posts, until manually edited).
  useEffect(() => {
    if (!slugEdited && !isExistingPost && formState.title) {
      setFormState((prev) => ({ ...prev, slug: slugify(formState.title) }));
    }
  }, [formState.title, slugEdited, isExistingPost]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSlugChange = (value: string) => {
    updateForm("slug", slugify(value));
    setSlugEdited(true);
  };

  const handleMediaAdd = useCallback(
    (newMedia: UploadedMedia) => {
      // Re-key the filename to the current slug so media stays grouped by post.
      const updatedMedia = {
        ...newMedia,
        filename: newMedia.filename.replace(/^[^-]*/, formState.slug || "untitled"),
      };
      setMedia((prev) => [...prev, updatedMedia]);
    },
    [formState.slug],
  );

  const handleMediaRemove = useCallback((id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleInsertMedia = useCallback(
    (mediaItem: UploadedMedia) => {
      const mediaPath = `/blog-images/${mediaItem.filename}`;
      const altText = formState.title.trim() || "Image";
      const mediaHtml =
        mediaItem.type === "video"
          ? `<video controls src="${mediaPath}"></video>`
          : `<img src="${mediaPath}" alt="${altText}" />`;

      const inserted = editorRef.current?.insertContent(mediaHtml);

      if (inserted) {
        toast({ title: "Media inserted", description: `${mediaItem.filename} added to post` });
      } else {
        toast({
          title: "Insert failed",
          description: "Could not insert media. Try clicking in the editor first.",
          variant: "destructive",
        });
      }
    },
    [formState.title, toast],
  );

  const handleSaveDraft = () => {
    if (!hasContent(formState)) {
      toast({ title: "Nothing to save", description: "Add a title or content first", variant: "destructive" });
      return;
    }

    const now = new Date().toISOString();

    if (currentDraftId) {
      const updated = drafts.map((d) => (d.id === currentDraftId ? { ...d, formState, updatedAt: now } : d));
      setDrafts(updated);
      saveAllDrafts(updated);
      setDraftSavedAt(now);
      toast({ title: "Draft saved", description: "Your changes have been saved" });
    } else {
      const newDraft: Draft = { id: generateDraftId(), formState, createdAt: now, updatedAt: now };
      const updated = [...drafts, newDraft];
      setDrafts(updated);
      saveAllDrafts(updated);
      setCurrentDraftId(newDraft.id);
      setDraftSavedAt(now);
      toast({ title: "Draft created", description: "You can come back to this later" });
    }
  };

  const handleLoadDraft = (draft: Draft) => {
    setFormState(draft.formState);
    setLastSavedState(draft.formState);
    setCurrentDraftId(draft.id);
    setSelectedPostSlug(null);
    setIsExistingPost(false);
    setSlugEdited(true);
    setMedia([]);
    setDraftSavedAt(draft.updatedAt);

    setTimeout(() => {
      editorRef.current?.getEditor()?.commands.setContent(draft.formState.content);
    }, 100);

    toast({ title: "Draft loaded", description: draft.formState.title || "Untitled draft" });
  };

  const handleDeleteDraft = (draftId: string) => {
    const updated = drafts.filter((d) => d.id !== draftId);
    setDrafts(updated);
    saveAllDrafts(updated);

    if (currentDraftId === draftId) handleNewPost();

    toast({ title: "Draft deleted" });
  };

  // Load an existing post into the editor. Older Markdown posts are converted to
  // basic HTML so they render in the TipTap editor; new posts are already HTML.
  const loadPost = useCallback((post: Post) => {
    let htmlContent = post.content;

    if (!htmlContent.trim().startsWith("<")) {
      htmlContent = htmlContent
        .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n\n/g, "</p><p>")
        .replace(/^- (.*?)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

      if (!htmlContent.startsWith("<")) {
        htmlContent = `<p>${htmlContent}</p>`;
      }
    }

    const newState: FormState = {
      title: post.frontmatter.title,
      slug: post.slug,
      description: post.frontmatter.description || "",
      tags: post.frontmatter.tags?.join(", ") || "",
      publishedDate: post.frontmatter.publishedDate,
      content: htmlContent,
    };

    setFormState(newState);
    setLastSavedState(newState);
    setSelectedPostSlug(post.slug);
    setIsExistingPost(true);
    setSlugEdited(true);
    setMedia([]);
    setCurrentDraftId(null);
    setDraftSavedAt(null);

    setTimeout(() => {
      editorRef.current?.getEditor()?.commands.setContent(newState.content);
    }, 100);
  }, []);

  const handleNewPost = useCallback(() => {
    setFormState(initialFormState);
    setLastSavedState(initialFormState);
    setSelectedPostSlug(null);
    setIsExistingPost(false);
    setSlugEdited(false);
    setMedia([]);
    setCurrentDraftId(null);
    setDraftSavedAt(null);

    setTimeout(() => {
      editorRef.current?.getEditor()?.commands.setContent(initialFormState.content);
    }, 100);
  }, []);

  const handleSelectPost = useCallback((post: Post) => loadPost(post), [loadPost]);

  const handleDeleteFromSidebar = useCallback((slug: string) => {
    setDeleteTargetSlug(slug);
    setDeleteDialogOpen(true);
  }, []);

  const handlePublish = async () => {
    if (!formState.title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    if (!formState.slug.trim()) {
      toast({ title: "Error", description: "Slug is required", variant: "destructive" });
      return;
    }

    const token = getAdminToken();
    if (!token) {
      toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
      return;
    }

    setIsPublishing(true);

    try {
      const tagArray = formState.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const mediaFiles = media.map((m) => ({ filename: m.filename, content: m.base64, type: m.type }));

      const { data, error } = await supabase.functions.invoke("publish-blog", {
        body: {
          token,
          title: formState.title,
          slug: formState.slug,
          description: formState.description,
          tags: tagArray,
          publishedDate: formState.publishedDate,
          content: formState.content,
          media: mediaFiles,
        },
      });

      if (error) throw new Error(error.message || "Failed to publish");
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Published!",
        description: `Your post "${formState.title}" has been published to GitHub`,
      });

      setIsExistingPost(true);
      setSelectedPostSlug(formState.slug);
      setLastSavedState(formState);
      setMedia([]);

      // The post is published now, so drop its draft.
      if (currentDraftId) {
        const updated = drafts.filter((d) => d.id !== currentDraftId);
        setDrafts(updated);
        saveAllDrafts(updated);
        setCurrentDraftId(null);
        setDraftSavedAt(null);
      }
    } catch (error: any) {
      console.error("Publish error:", error);
      toast({
        title: "Publish failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Delete invoked from the settings panel's Danger Zone.
  const handleDelete = async (deleteMedia: boolean) => {
    const token = getAdminToken();
    if (!token || !formState.slug.trim()) {
      throw new Error("Not authenticated or no slug");
    }

    const { data, error } = await supabase.functions.invoke("delete-blog", {
      body: { token, slug: formState.slug.trim(), deleteMedia },
    });

    if (error) {
      toast({ title: "Delete failed", description: error.message || "Something went wrong", variant: "destructive" });
      throw error;
    }
    if (data?.error) {
      toast({ title: "Delete failed", description: data.error, variant: "destructive" });
      throw new Error(data.error);
    }

    toast({ title: "Post deleted", description: `"${formState.title}" has been removed` });
    setPosts((prev) => prev.filter((p) => p.slug !== formState.slug));
    handleNewPost();
  };

  // Delete invoked from the post list sidebar.
  const handleSidebarDelete = async (deleteMedia: boolean) => {
    const token = getAdminToken();
    if (!token || !deleteTargetSlug) {
      throw new Error("Not authenticated or no slug");
    }

    const { data, error } = await supabase.functions.invoke("delete-blog", {
      body: { token, slug: deleteTargetSlug, deleteMedia },
    });

    if (error) {
      toast({ title: "Delete failed", description: error.message || "Something went wrong", variant: "destructive" });
      throw error;
    }
    if (data?.error) {
      toast({ title: "Delete failed", description: data.error, variant: "destructive" });
      throw new Error(data.error);
    }

    const deletedPost = posts.find((p) => p.slug === deleteTargetSlug);
    toast({ title: "Post deleted", description: `"${deletedPost?.frontmatter.title || deleteTargetSlug}" has been removed` });

    setPosts((prev) => prev.filter((p) => p.slug !== deleteTargetSlug));
    if (selectedPostSlug === deleteTargetSlug) handleNewPost();

    setDeleteDialogOpen(false);
    setDeleteTargetSlug(null);
  };

  const canPublish = formState.title.trim() && formState.slug.trim();

  const draftSavedTimeLabel = useMemo(() => {
    if (!draftSavedAt) return null;
    const date = new Date(draftSavedAt);
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSeconds < 5) return "Saved just now";
    if (diffSeconds < 60) return `Saved ${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `Saved ${Math.floor(diffSeconds / 60)}m ago`;
    return `Saved ${date.toLocaleTimeString()}`;
  }, [draftSavedAt]);

  const formatDraftDate = (dateString: string) => {
    const date = new Date(dateString);
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-lg font-semibold">Blog Studio</h1>
            {currentDraftId && (
              <span className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 px-2 py-0.5 rounded font-medium">
                Editing Draft
              </span>
            )}
            {hasUnsavedChanges && !currentDraftId && (
              <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                Unsaved changes
              </span>
            )}
            {draftSavedTimeLabel && !isExistingPost && (
              <span className="text-xs text-muted-foreground">{draftSavedTimeLabel}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewPost} disabled={isPublishing}>
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
            {!isExistingPost && (
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isPublishing || !hasContent(formState)}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            )}
            <Button variant="default" onClick={handlePublish} disabled={isPublishing || !canPublish}>
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publish
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex w-72 flex-shrink-0 flex-col">
          {/* Drafts */}
          {drafts.length > 0 && (
            <div className="border-b border-border p-3 max-h-64 overflow-y-auto">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Drafts ({drafts.length})
              </h3>
              <div className="space-y-1">
                {drafts
                  .slice()
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((draft) => (
                    <div
                      key={draft.id}
                      className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                        currentDraftId === draft.id ? "bg-muted" : ""
                      }`}
                      onClick={() => handleLoadDraft(draft)}
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{draft.formState.title || "Untitled draft"}</p>
                        <p className="text-xs text-muted-foreground">{formatDraftDate(draft.updatedAt)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDraft(draft.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        aria-label="Delete draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Published posts */}
          <div className="flex-1 overflow-y-auto">
            <PostListSidebar
              posts={posts}
              selectedSlug={selectedPostSlug}
              onSelectPost={handleSelectPost}
              onDeletePost={handleDeleteFromSidebar}
              onNewPost={handleNewPost}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formState.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Enter post title..."
                className="mt-1 text-lg"
              />
            </div>

            <div>
              <Label>Content</Label>
              <div className="mt-1">
                <RichTextEditor
                  ref={editorRef}
                  content={formState.content}
                  onChange={(content) => updateForm("content", content)}
                  onInsertMedia={() => {
                    document.getElementById("media-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </div>
            </div>

            <div id="media-section">
              <Label>Media</Label>
              <div className="mt-1">
                <MediaUploader
                  slug={formState.slug || "untitled"}
                  media={media}
                  onMediaAdd={handleMediaAdd}
                  onMediaRemove={handleMediaRemove}
                  onInsertIntoPost={handleInsertMedia}
                />
              </div>
            </div>
          </div>
        </main>

        <div className="hidden xl:block w-80 flex-shrink-0 border-l border-border overflow-y-auto p-6">
          <PostSettingsPanel
            slug={formState.slug}
            onSlugChange={handleSlugChange}
            publishedDate={formState.publishedDate}
            onPublishedDateChange={(v) => updateForm("publishedDate", v)}
            description={formState.description}
            onDescriptionChange={(v) => updateForm("description", v)}
            tags={formState.tags}
            onTagsChange={(v) => updateForm("tags", v)}
            title={formState.title}
            isExistingPost={isExistingPost}
            onConfirmDelete={handleDelete}
            isPublishing={isPublishing}
          />
        </div>
      </div>

      {deleteTargetSlug && (
        <DeletePostDialog
          slug={deleteTargetSlug}
          onConfirmDelete={handleSidebarDelete}
          externalOpen={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteTargetSlug(null);
          }}
          hideTrigger
        />
      )}
    </div>
  );
}

export default function BlogStudio() {
  return (
    <AdminGate>
      <BlogStudioContent />
    </AdminGate>
  );
}
