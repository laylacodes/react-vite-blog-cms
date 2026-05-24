import { Link } from "react-router-dom";
import { getAllPosts } from "@/lib/posts";

// EXAMPLE PAGE — a minimal, theme-aware listing of every post (newest first).
// Treat this as a starting point: restyle it freely or replace it with your own
// design. Wire it into your router at whatever path you like (e.g. /blog or
// /writing), and drop your site's <Header>/<Footer> in where marked.

function formatDate(dateString: string): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background">
      {/* Add your site's <Header /> here if you have one. */}

      <main className="container mx-auto px-6 py-16 md:py-24">
        <header className="mx-auto mb-12 max-w-3xl">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Writing</h1>
          <p className="mt-3 text-muted-foreground">Thoughts, notes, and posts.</p>
        </header>

        <div className="mx-auto max-w-3xl">
          {posts.length === 0 ? (
            <p className="text-muted-foreground">No posts yet — publish one from the studio.</p>
          ) : (
            <ul className="space-y-8">
              {posts.map((post) => (
                <li key={post.slug}>
                  <article>
                    <Link to={`/${post.slug}`} className="group block">
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 className="font-display text-xl font-semibold transition-colors group-hover:text-primary">
                          {post.frontmatter.title || post.slug}
                        </h2>
                        <time className="shrink-0 text-sm text-muted-foreground">
                          {formatDate(post.frontmatter.publishedDate)}
                        </time>
                      </div>
                      {post.frontmatter.description && (
                        <p className="mt-2 text-muted-foreground">{post.frontmatter.description}</p>
                      )}
                    </Link>

                    {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
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
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Add your site's <Footer /> here if you have one. */}
    </div>
  );
}
