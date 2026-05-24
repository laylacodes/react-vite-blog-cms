// ---------------------------------------------------------------------------
// publish-blog  —  Supabase Edge Function
//
// Commits a blog post (and any uploaded media) directly to your GitHub repo
// using the GitHub Git Data API. No database is involved: your posts live as
// Markdown/HTML files inside src/content/posts/ in your own repository.
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   ADMIN_SECRET    The password used to log in to the studio. Min 16 chars.
//   GITHUB_TOKEN    A GitHub personal access token with "repo" (contents:write)
//                   scope for the target repository.
//   GITHUB_REPO     The repo to publish to, in "owner/name" form (e.g. "jane/blog").
//
// Optional secrets:
//   GITHUB_BRANCH   Branch to commit to. Defaults to "main".
//   ALLOWED_ORIGIN  Comma-separated list of allowed site origins for CORS.
//                   Defaults to "*". Set this to your site URL in production,
//                   e.g. "https://example.com".
// ---------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// Build CORS headers. When ALLOWED_ORIGIN is set to one or more specific
// origins, only those are echoed back; otherwise we fall back to "*".
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";

  if (allowedOrigin !== "*" && requestOrigin) {
    const allowedOrigins = allowedOrigin.split(",").map((o) => o.trim());
    if (allowedOrigins.includes(requestOrigin)) {
      return {
        "Access-Control-Allow-Origin": requestOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Credentials": "true",
      };
    }
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// A slug becomes the filename and the post URL, so it must be safe.
const MAX_SLUG_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: false, error: "Slug is required" };
  if (slug.length > MAX_SLUG_LENGTH) return { valid: false, error: "Slug exceeds maximum length" };
  // Block path traversal and anything that could escape the posts directory.
  if (slug.includes("..") || slug.includes("/") || slug.includes("\\") || slug.includes(".")) {
    return { valid: false, error: "Invalid slug format" };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { valid: false, error: "Invalid slug format (use lowercase letters, numbers and hyphens)" };
  }
  return { valid: true };
}

// Lightweight in-memory rate limit per IP. Resets on cold start, which is fine
// for a single-author CMS — it just stops runaway loops.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 3_600_000; // 1 hour
const MAX_OPERATIONS = 30; // 30 publishes per hour

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const key = `publish:${ip}`;
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  if (record.count >= MAX_OPERATIONS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

// The studio's login token is a JWT signed with ADMIN_SECRET (see auth-admin).
async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("ADMIN_SECRET") || "";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.padEnd(32, "0").slice(0, 32));
  return await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const payload = await verify(token, await getJwtKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

interface MediaFile {
  filename: string;
  content: string; // base64-encoded file contents
  type: string;
}

interface PublishRequest {
  token: string;
  title: string;
  slug: string;
  description: string;
  tags: string[];
  publishedDate: string;
  content: string;
  media: MediaFile[];
}

async function githubRequest(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Full detail is logged server-side only; clients get a generic message.
    console.error(`GitHub API error [${response.status}] at ${url}: ${JSON.stringify(data)}`);
  }

  return { ok: response.ok, status: response.status, data };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const clientIP =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  try {
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const GITHUB_REPO = Deno.env.get("GITHUB_REPO");
    const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") || "main";

    // Most first-run failures land here — make the log unmistakable.
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.error(
        "Setup error: missing GitHub configuration. Run:\n" +
          '  supabase secrets set GITHUB_TOKEN=ghp_xxx GITHUB_REPO="owner/name"',
      );
      return json({ error: "Server is not configured yet. See the function logs for setup steps." }, 500);
    }
    if (!GITHUB_REPO.includes("/")) {
      console.error(`Setup error: GITHUB_REPO must be "owner/name", got "${GITHUB_REPO}".`);
      return json({ error: "Server is misconfigured (GITHUB_REPO). See the function logs." }, 500);
    }

    const body: PublishRequest = await req.json();

    if (!body.token || !(await verifyToken(body.token))) {
      return json({ error: "Unauthorized. Please log in again." }, 401);
    }

    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfter || 3600) },
        },
      );
    }

    const { title, slug, description, tags, publishedDate, content, media } = body;

    if (!title || !slug || !content) {
      return json({ error: "Title, slug and content are all required." }, 400);
    }

    const slugValidation = validateSlug(slug);
    if (!slugValidation.valid) {
      return json({ error: slugValidation.error }, 400);
    }

    const [owner, repo] = GITHUB_REPO.split("/");
    const baseApiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    // YAML frontmatter consumed by src/lib/posts.ts at build time.
    const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
publishedDate: "${publishedDate}"
description: "${(description || "").replace(/"/g, '\\"')}"
tags: [${(tags || []).map((t) => `"${t}"`).join(", ")}]
---`;

    const fullContent = `${frontmatter}\n\n${content}`;

    // The post Markdown file plus any uploaded media, committed together.
    const filesToCommit: { path: string; content: string }[] = [
      {
        path: `src/content/posts/${slug}.md`,
        // base64-encode the UTF-8 text so non-ASCII characters survive.
        content: btoa(unescape(encodeURIComponent(fullContent))),
      },
    ];
    for (const file of media || []) {
      filesToCommit.push({ path: `public/blog-images/${file.filename}`, content: file.content });
    }

    console.log(`Publishing ${filesToCommit.length} file(s) for "${slug}" to ${owner}/${repo}@${GITHUB_BRANCH}`);

    // --- Create a single commit via the Git Data API ----------------------
    // 1. Read the branch tip.
    const refResult = await githubRequest(`${baseApiUrl}/git/ref/heads/${GITHUB_BRANCH}`, GITHUB_TOKEN);
    if (!refResult.ok) {
      if (refResult.status === 404) {
        console.error(`Branch "${GITHUB_BRANCH}" or repo "${owner}/${repo}" not found. Check GITHUB_REPO/GITHUB_BRANCH and token access.`);
        return json({ error: `Could not find branch "${GITHUB_BRANCH}". Check your GITHUB_REPO and GITHUB_BRANCH settings.` }, 500);
      }
      if (refResult.status === 401 || refResult.status === 403) {
        return json({ error: "GitHub rejected the token. Confirm it has 'repo' (contents) access to this repository." }, 500);
      }
      return json({ error: "Publish failed while reading the repository. Please try again." }, 500);
    }
    const baseSha = refResult.data.object.sha;

    // 2. Read the tree the branch points at.
    const baseCommitResult = await githubRequest(`${baseApiUrl}/git/commits/${baseSha}`, GITHUB_TOKEN);
    if (!baseCommitResult.ok) return json({ error: "Publish failed while reading the repository. Please try again." }, 500);
    const baseTreeSha = baseCommitResult.data.tree.sha;

    // 3. Upload each file as a blob.
    const treeItems = [];
    for (const file of filesToCommit) {
      const blobResult = await githubRequest(`${baseApiUrl}/git/blobs`, GITHUB_TOKEN, {
        method: "POST",
        body: JSON.stringify({ content: file.content, encoding: "base64" }),
      });
      if (!blobResult.ok) {
        console.error(`Failed to create blob for ${file.path}`);
        return json({ error: "Publish failed while uploading files. Please try again." }, 500);
      }
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blobResult.data.sha });
    }

    // 4. Build a new tree on top of the current one.
    const treeResult = await githubRequest(`${baseApiUrl}/git/trees`, GITHUB_TOKEN, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    if (!treeResult.ok) return json({ error: "Publish failed while building the commit. Please try again." }, 500);

    // 5. Create the commit. No new media usually means it's an edit.
    const isUpdate = (media || []).length === 0;
    const commitResult = await githubRequest(`${baseApiUrl}/git/commits`, GITHUB_TOKEN, {
      method: "POST",
      body: JSON.stringify({
        message: isUpdate ? `blog: update ${slug}` : `blog: publish ${slug}`,
        tree: treeResult.data.sha,
        parents: [baseSha],
      }),
    });
    if (!commitResult.ok) return json({ error: "Publish failed while creating the commit. Please try again." }, 500);

    // 6. Move the branch to the new commit.
    const updateRefResult = await githubRequest(`${baseApiUrl}/git/refs/heads/${GITHUB_BRANCH}`, GITHUB_TOKEN, {
      method: "PATCH",
      body: JSON.stringify({ sha: commitResult.data.sha, force: true }),
    });
    if (!updateRefResult.ok) return json({ error: "Publish failed while updating the branch. Please try again." }, 500);

    console.log(`Successfully published "${slug}" (commit ${commitResult.data.sha}).`);

    return json({
      success: true,
      message: "Post published successfully",
      filesCommitted: filesToCommit.length,
      commitSha: commitResult.data.sha,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Publish error:", message, error);
    return json({ error: "Publish failed unexpectedly. Please try again." }, 500);
  }
});
