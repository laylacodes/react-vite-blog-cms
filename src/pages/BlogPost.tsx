import { useParams, Navigate, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";
import { ArrowLeft, Calendar, Clock, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getPostBySlug, isReservedRoute, getAdjacentPosts, calculateReadingTime } from "@/lib/posts";

// NOTE: This template renders just the post. Wrap it in your own site chrome
// (header, footer, theme provider, etc.) wherever it makes sense for your app.

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

// Demote any in-content <h1> to <h2> so the post title stays the only h1.
function enforceHeadingSemantics(html: string): string {
  return html.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/gi, "<h2$1>$2</h2>");
}

/**
 * Decide whether stored content is HTML (authored in the studio) or Markdown
 * (older posts). New posts start with a block-level HTML tag; Markdown does not.
 */
function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  return /^<(p|h[1-6]|ul|ol|pre|blockquote|div|img|iframe|video|figure)[\s>]/i.test(trimmed);
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const isReserved = slug && isReservedRoute(slug);
  const post = !isReserved && slug ? getPostBySlug(slug) : undefined;
  const { previous, next } = !isReserved && slug ? getAdjacentPosts(slug) : {};
  const readingTime = post ? calculateReadingTime(post.content) : 0;

  const htmlContent = useMemo(() => {
    if (!post) return "";

    let html: string;

    if (isHtmlContent(post.content)) {
      // Already HTML (from the studio editor).
      html = post.content;
    } else {
      // Markdown — render with `marked`, giving headings slug ids for anchors.
      const renderer = new marked.Renderer();
      renderer.heading = ({ text, depth }) => `<h${depth} id="${slugify(text)}">${text}</h${depth}>`;
      marked.setOptions({ renderer });
      html = marked(post.content, { async: false }) as string;
    }

    // Ensure every heading has an id so deep links / anchors work.
    html = html.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g, (match, level, attrs, text) => {
      if (attrs.includes("id=")) return match;
      const id = slugify(text.replace(/<[^>]+>/g, ""));
      return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
    });

    html = enforceHeadingSemantics(html);

    // Sanitize. `iframe` (+ its attributes) is allowed so embeds render; this
    // matches what EmbedModal inserts. Everything else uses DOMPurify defaults.
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["target", "rel", "aria-label", "allowfullscreen", "scrolling", "frameborder", "loading", "title"],
      ALLOW_DATA_ATTR: true,
    });
  }, [post]);

  if (isReserved || !post) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Add your site's <Header /> here if you have one. */}

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-6">
          <div className="mb-8 max-w-3xl">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>

          <article className="mx-auto min-w-0 max-w-3xl">
            <header className="mb-12">
              <h1 className="mb-6 font-display text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                {post.frontmatter.title}
              </h1>

              {post.frontmatter.description && (
                <p className="mb-6 text-lg text-muted-foreground md:text-xl">{post.frontmatter.description}</p>
              )}

              <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <time>{formatDate(post.frontmatter.publishedDate)}</time>
                </span>

                {post.frontmatter.updatedDate && (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-4 w-4" />
                    Updated {formatDate(post.frontmatter.updatedDate)}
                  </span>
                )}

                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {readingTime} min read
                </span>
              </div>

              {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.frontmatter.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <div
              className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-semibold prose-headings:scroll-mt-24 prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-muted-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:marker:text-primary"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {(previous || next) && (
              <footer className="mt-12 border-t border-border pt-8">
                <nav className="grid gap-4 sm:grid-cols-2" aria-label="Post navigation">
                  {previous ? (
                    <Link
                      to={`/${previous.slug}`}
                      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg"
                    >
                      <span className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <ChevronLeft className="h-3 w-3" />
                        Previous
                      </span>
                      <span className="font-display font-medium transition-colors group-hover:text-primary">
                        {previous.frontmatter.title}
                      </span>
                    </Link>
                  ) : (
                    <div />
                  )}

                  {next && (
                    <Link
                      to={`/${next.slug}`}
                      className="group flex flex-col rounded-xl border border-border bg-card p-4 text-right transition-all hover:border-primary/30 hover:shadow-lg sm:col-start-2"
                    >
                      <span className="mb-2 flex items-center justify-end gap-1 text-xs font-medium text-muted-foreground">
                        Next
                        <ChevronRight className="h-3 w-3" />
                      </span>
                      <span className="font-display font-medium transition-colors group-hover:text-primary">
                        {next.frontmatter.title}
                      </span>
                    </Link>
                  )}
                </nav>
              </footer>
            )}
          </article>
        </div>
      </main>

      {/* Add your site's <Footer /> here if you have one. */}
    </div>
  );
};

export default BlogPost;
