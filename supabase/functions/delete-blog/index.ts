// ---------------------------------------------------------------------------
// delete-blog  —  Supabase Edge Function
//
// Removes a post's Markdown file (and optionally its media) from your GitHub
// repo by committing a deletion. Mirrors publish-blog and shares ADMIN_SECRET.
//
// Required secrets:
//   ADMIN_SECRET    Same value used by auth-admin / publish-blog.
//   GITHUB_TOKEN    GitHub personal access token with "repo" (contents) scope.
//   GITHUB_REPO     Target repo as "owner/name".
//
// Optional secrets:
//   GITHUB_BRANCH   Branch to commit to. Defaults to "main".
//   ALLOWED_ORIGIN  Comma-separated allowed site origins for CORS (default "*").
// ---------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

const MAX_SLUG_LENGTH = 100;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: false, error: "Slug is required" };
  if (slug.length > MAX_SLUG_LENGTH) return { valid: false, error: "Slug exceeds maximum length" };
  if (slug.includes("..") || slug.includes("/") || slug.includes("\\") || slug.includes(".")) {
    return { valid: false, error: "Invalid slug format" };
  }
  if (!SLUG_PATTERN.test(slug)) return { valid: false, error: "Invalid slug format" };
  return { valid: true };
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 3_600_000; // 1 hour
const MAX_OPERATIONS = 20; // 20 deletes per hour

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const key = `delete:${ip}`;
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

interface DeleteRequest {
  token: string;
  slug: string;
  deleteMedia: boolean;
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

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.error(
        "Setup error: missing GitHub configuration. Run:\n" +
          '  supabase secrets set GITHUB_TOKEN=ghp_xxx GITHUB_REPO="owner/name"',
      );
      return json({ error: "Server is not configured yet. See the function logs for setup steps." }, 500);
    }

    const body: DeleteRequest = await req.json();

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

    const { slug, deleteMedia } = body;
    const slugValidation = validateSlug(slug);
    if (!slugValidation.valid) {
      return json({ error: slugValidation.error }, 400);
    }

    const [owner, repo] = GITHUB_REPO.split("/");
    const ghHeaders = {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
    };

    // Always delete the post file.
    const filesToDelete: string[] = [`src/content/posts/${slug}.md`];

    // Optionally sweep up media named "<slug>-*" under public/blog-images/.
    if (deleteMedia) {
      const contentsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/public/blog-images`,
        { headers: ghHeaders },
      );
      if (contentsResponse.ok) {
        const contents = await contentsResponse.json();
        if (Array.isArray(contents)) {
          for (const file of contents) {
            if (file.type === "file" && file.name.startsWith(`${slug}-`)) {
              filesToDelete.push(`public/blog-images/${file.name}`);
            }
          }
        }
      } else {
        // Not fatal — the post file is still removed below.
        console.error(`Could not list public/blog-images (status ${contentsResponse.status}); skipping media cleanup.`);
      }
    }

    // --- Commit the deletion via the Git Data API -------------------------
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${GITHUB_BRANCH}`,
      { headers: ghHeaders },
    );
    if (!refResponse.ok) {
      console.error(`GitHub API error reading branch "${GITHUB_BRANCH}": ${refResponse.status}`);
      return json({ error: `Could not find branch "${GITHUB_BRANCH}". Check GITHUB_REPO/GITHUB_BRANCH.` }, 500);
    }
    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    const baseCommitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${baseSha}`,
      { headers: ghHeaders },
    );
    if (!baseCommitResponse.ok) {
      console.error(`GitHub API error reading base commit: ${baseCommitResponse.status}`);
      return json({ error: "Delete failed while reading the repository. Please try again." }, 500);
    }
    const baseCommit = await baseCommitResponse.json();
    const baseTreeSha = baseCommit.tree.sha;

    // sha: null tells GitHub to remove the path from the new tree.
    const treeItems = filesToDelete.map((path) => ({
      path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: null,
    }));

    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    if (!treeResponse.ok) {
      console.error(`GitHub API error creating tree: ${treeResponse.status}`);
      return json({ error: "Delete failed while building the commit. Please try again." }, 500);
    }
    const tree = await treeResponse.json();

    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: deleteMedia ? "blog: delete post and associated media" : "blog: delete post",
        tree: tree.sha,
        parents: [baseSha],
      }),
    });
    if (!commitResponse.ok) {
      console.error(`GitHub API error creating commit: ${commitResponse.status}`);
      return json({ error: "Delete failed while creating the commit. Please try again." }, 500);
    }
    const commit = await commitResponse.json();

    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${GITHUB_BRANCH}`,
      {
        method: "PATCH",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ sha: commit.sha, force: true }),
      },
    );
    if (!updateRefResponse.ok) {
      console.error(`GitHub API error updating ref: ${updateRefResponse.status}`);
      return json({ error: "Delete failed while updating the branch. Please try again." }, 500);
    }

    console.log(`Successfully deleted "${slug}" (${filesToDelete.length} file(s)).`);

    return json({ success: true, message: "Post deleted successfully", filesDeleted: filesToDelete.length });
  } catch (error: unknown) {
    console.error("Delete error:", error);
    return json({ error: "Delete failed unexpectedly. Please try again." }, 500);
  }
});
