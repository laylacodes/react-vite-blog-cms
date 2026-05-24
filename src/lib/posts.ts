// ---------------------------------------------------------------------------
// posts.ts — loads and parses your blog posts at build time.
//
// Every Markdown/HTML file in src/content/posts/*.md is imported by Vite's
// import.meta.glob, its frontmatter is parsed, and the result is exposed
// through the helpers below. No database, no network — posts ship with the app.
// ---------------------------------------------------------------------------

export interface PostFrontmatter {
  title: string;
  slug?: string;
  publishedDate: string;
  description: string;
  tags?: string[];
  updatedDate?: string;
  readingTime?: number;
}

export interface Post {
  slug: string;
  frontmatter: PostFrontmatter;
  content: string;
}

export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

// Routes in your app that are NOT blog posts. The dynamic "/:slug" route uses
// this so that, e.g., "/about" never gets treated as a post. Add any top-level
// routes your site defines (about, projects, etc.).
const RESERVED_ROUTES = new Set(["", "404"]);

// Minimal, browser-friendly frontmatter parser. Handles strings, quoted
// strings and simple arrays — enough for the fields the studio writes.
function parseFrontmatter(markdown: string): { data: PostFrontmatter; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { data: { title: "", publishedDate: "", description: "" }, content: markdown };
  }

  const frontmatterBlock = match[1];
  const content = match[2];

  const data: Record<string, unknown> = {};
  for (const line of frontmatterBlock.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Strip surrounding quotes.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Parse a simple array: ["a", "b"]
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = value;
    }
  }

  // Accept both "publishedDate"/"date" and "updatedDate"/"updated".
  const normalizedData: PostFrontmatter = {
    title: (data.title as string) || "",
    slug: data.slug as string | undefined,
    publishedDate: (data.publishedDate as string) || (data.date as string) || "",
    description: (data.description as string) || "",
    tags: data.tags as string[] | undefined,
    updatedDate: (data.updatedDate as string) || (data.updated as string) || undefined,
  };

  return { data: normalizedData, content };
}

// Import every post as a raw string at build time.
const postFiles = import.meta.glob("/src/content/posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const posts: Post[] = Object.entries(postFiles).map(([path, content]) => {
  const filename = path.split("/").pop()?.replace(".md", "") || "";
  const { data, content: markdown } = parseFrontmatter(content as string);
  return { slug: filename, frontmatter: data, content: markdown };
});

// Newest first.
posts.sort(
  (a, b) => new Date(b.frontmatter.publishedDate).getTime() - new Date(a.frontmatter.publishedDate).getTime(),
);

export function getAllPosts(): Post[] {
  return posts;
}

export function getPostBySlug(slug: string): Post | undefined {
  if (RESERVED_ROUTES.has(slug)) return undefined;
  return posts.find((post) => post.slug === slug);
}

export function isReservedRoute(slug: string): boolean {
  return RESERVED_ROUTES.has(slug);
}

export function getAdjacentPosts(slug: string): { previous?: Post; next?: Post } {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return {};
  return {
    previous: index < posts.length - 1 ? posts[index + 1] : undefined,
    next: index > 0 ? posts[index - 1] : undefined,
  };
}
