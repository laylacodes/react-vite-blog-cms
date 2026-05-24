import { format } from "date-fns";
import { Edit3, Trash2, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Post } from "@/lib/posts";

interface PostListSidebarProps {
  posts: Post[];
  selectedSlug: string | null;
  onSelectPost: (post: Post) => void;
  onDeletePost: (slug: string) => void;
  onNewPost: () => void;
  hasUnsavedChanges: boolean;
}

/** Lists already-published posts and lets you edit or delete them. */
export function PostListSidebar({
  posts,
  selectedSlug,
  onSelectPost,
  onDeletePost,
  onNewPost,
  hasUnsavedChanges,
}: PostListSidebarProps) {
  const handleAction = (type: "edit" | "delete" | "new", post?: Post) => {
    // Guard against losing edits when switching away (delete is its own dialog).
    if (hasUnsavedChanges && type !== "delete") {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to switch posts?");
      if (!confirmed) return;
    }

    if (type === "edit" && post) onSelectPost(post);
    else if (type === "delete" && post) onDeletePost(post.slug);
    else if (type === "new") onNewPost();
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-full flex flex-col border-r border-border bg-muted/20">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm text-foreground">Existing Posts</h2>
          <Button variant="ghost" size="sm" onClick={() => handleAction("new")} className="h-7 px-2">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{posts.length} posts</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {posts.map((post) => (
            <div
              key={post.slug}
              className={cn(
                "group rounded-lg p-3 transition-colors cursor-pointer",
                selectedSlug === post.slug
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted border border-transparent",
              )}
              onClick={() => handleAction("edit", post)}
            >
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">
                    {post.frontmatter.title || post.slug}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(post.frontmatter.publishedDate)}
                  </p>
                  {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {post.frontmatter.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                      {post.frontmatter.tags.length > 2 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          +{post.frontmatter.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction("edit", post);
                  }}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAction("delete", post);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
