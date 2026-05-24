# Self-Hosted Blog CMS for React + Vite

Add a `/admin/studio` blog CMS to your existing **React + Vite** site. Write posts
in a rich text editor, upload images/videos, and **publish straight to your own
GitHub repo** as Markdown/HTML files. Your host rebuilds and the post goes live.

**No database. No third-party CMS. No monthly bill.** Your content is just files
in your repository, and the only backend is a handful of free Supabase Edge
Functions that commit to GitHub on your behalf.

---

## How it works

```
┌──────────────┐   login / publish / delete   ┌────────────────────────┐   GitHub API   ┌──────────────┐
│  Blog Studio │ ───────────────────────────► │  Supabase Edge Functions │ ─────────────► │  Your GitHub │
│  (/admin)    │ ◄─────────────────────────── │  auth · publish · delete │ ◄───────────── │     repo     │
└──────────────┘         JSON responses        └────────────────────────┘   commits      └──────┬───────┘
                                                                                                  │ push triggers
                                                                                                  ▼
                                                                                          ┌──────────────┐
                                                                                          │  Your host   │
                                                                                          │  rebuilds &  │
                                                                                          │  deploys     │
                                                                                          └──────────────┘
```

1. You log in to the studio with a password (`ADMIN_SECRET`).
2. The studio sends your post + media to the `publish-blog` Edge Function.
3. The function commits a `.md` file to `src/content/posts/` (and images to
   `public/blog-images/`) in your repo using a GitHub token.
4. Your normal deploy pipeline rebuilds the site. Posts are read at build time by
   `src/lib/posts.ts` — no runtime database calls.

---

## Features

- ✍️ **Rich text editor** (TipTap) with a bubble menu for inline formatting
- 🖼️ **Drag-and-drop media uploads** — committed alongside the post
- 🎬 **Generic embeds** — paste a YouTube/Vimeo link, any `https://` URL, or an `<iframe>`
- 💾 **Local drafts** — multiple drafts with autosave, restore, and delete (localStorage)
- 🗑️ **Delete posts** (and optionally their media) with a type-to-confirm dialog
- 🔐 **Password gate** with short-lived JWTs and idle timeout
- 🧠 **Smart renderer** — auto-detects HTML (new posts) vs Markdown (old posts), sanitized with DOMPurify

---

## Screenshots

| Studio editor | Rendered post |
| --- | --- |
| ![Blog Studio editor](docs/studio.png) | ![Rendered blog post](docs/post.png) |

> Swap in your own images (drop them in a `docs/` folder). The studio inherits
> your site's Tailwind theme tokens, so it automatically matches your design.

---

## Prerequisites

- An existing **React + Vite + TypeScript** site styled with **Tailwind CSS** *(required)*
- The **`@/` path alias** pointing at `src/` (the default in most Vite setups)
- A free **[Supabase](https://supabase.com)** account + the **[Supabase CLI](https://supabase.com/docs/guides/cli)**
- A **GitHub repo** for your site and a **personal access token** with `repo` scope
- A host that **rebuilds on push** (Vercel, Netlify, Cloudflare Pages, GitHub Pages CI, etc.)

> ### Tailwind is the real requirement — shadcn/ui is optional
>
> The UI is styled entirely with Tailwind utility classes that resolve to
> **shadcn's theme tokens** (`bg-background`, `text-primary`, `bg-card`, …). It
> uses a handful of **shadcn/ui** components, but you don't have to have "adopted"
> shadcn to use this template:
>
> - **Already on shadcn/ui?** You likely have most of these components already —
>   just add any you're missing (see [What you'll add](#what-youll-add)).
> - **On Tailwind but not shadcn?** Run **`npx shadcn@latest init`** once — it
>   works on *any* Tailwind project and sets up the theme tokens, the `cn()`
>   helper, and the `@/` alias — then add the components.
> - **Not on Tailwind?** This template is out of scope: every component is
>   Tailwind-styled, so you'd need to adopt Tailwind or restyle the components.
>
> shadcn's latest CLI defaults to **Tailwind v4**; this template's class *names*
> are identical across v3 and v4, so either works.

---

## File reference — what to copy

Everything below lives under `/template`. Paths mirror a standard Vite project, so
you can copy them straight into your own `src/` and `supabase/`.

### Core (required)

| File | Purpose |
| --- | --- |
| `src/components/cms/BlogStudio.tsx` | The studio page: editor, drafts, publish/delete flow |
| `src/components/cms/RichTextEditor.tsx` | TipTap editor + toolbar + bubble menu |
| `src/components/cms/AdminGate.tsx` | Password gate + token helpers (`getAdminToken`, `useAdminLogout`) |
| `src/components/cms/PostListSidebar.tsx` | List of published posts (edit / delete) |
| `src/components/cms/PostSettingsPanel.tsx` | Slug, date, description, tags, preview + Danger Zone |
| `src/components/cms/DeletePostDialog.tsx` | Type-to-confirm delete dialog |
| `src/components/cms/MediaUploader.tsx` | Drag-and-drop image/video uploader |
| `src/components/cms/EmbedModal.tsx` | Generic embed (URL / iframe → responsive iframe) |
| `src/lib/posts.ts` | Loads + parses posts at build time |
| `src/integrations/supabase/client.ts` | Supabase client (Edge Functions only) |
| `supabase/functions/publish-blog/index.ts` | Commits posts + media to GitHub |
| `supabase/functions/auth-admin/index.ts` | Issues/validates the studio login token |
| `supabase/functions/delete-blog/index.ts` | Removes a post (and optionally its media) |

### Recommended

| File | Purpose |
| --- | --- |
| `src/pages/BlogPost.tsx` | Renders a single post (HTML/Markdown auto-detect + sanitize). Drop in your own `<Header>`/`<Footer>` where marked. |
| `src/content/posts/hello-world.md` | Demo post so you can verify rendering immediately. Delete after your first real post. |

<h3 id="what-youll-add">What you'll add</h3>

The CMS imports a small set of shadcn/ui components from `@/components/ui/*`, plus
`@/hooks/use-toast` and `@/lib/utils` (`cn`). Most existing Tailwind/shadcn sites
already have some of these — add whatever you're missing:

```bash
# If you've never run shadcn here, do this first (works on any Tailwind project):
npx shadcn@latest init

# Then add the components the CMS uses:
npx shadcn@latest add button input label textarea dialog checkbox badge scroll-area toast
```

`init` provides the theme tokens, `cn()`, and the `@/` alias; `add` drops the
component files (including `Toaster` — mount it once in your root, e.g. `App.tsx`).
Nothing here is locked to shadcn internals: if you'd rather supply these ten
components yourself, any equivalents with the same import paths work.

> **Heads-up:** This template was distilled from a personal site. The original
> `publish-blog` was the only function named in the brief, but the studio also
> needs **`auth-admin`** (login) and **`delete-blog`** (deletion) to function, so
> both are included. The following site-specific pieces were intentionally
> **excluded**: confetti hooks, post-likes (table + function + UI), newsletter
> signup, a table-of-contents component, per-tag color maps, FreeSQL embed
> tokens/iframes, and the generated Supabase `types.ts` (the client no longer
> depends on it).

---

## Setup (≈ 20–30 minutes)

### 1. Copy the files

Copy the `src/` and `supabase/` folders from `/template` into your project,
merging with what you already have. Then copy `.env.example` to your project root
as `.env`.

### 2. Install dependencies

```bash
npm install @supabase/supabase-js dompurify marked date-fns lucide-react \
  @tiptap/react @tiptap/core @tiptap/starter-kit @tiptap/extension-bubble-menu \
  @tiptap/extension-link @tiptap/extension-code-block @tiptap/extension-image \
  @tiptap/extension-heading

npm install -D @types/dompurify @tailwindcss/typography
```

> TipTap v3 is required (`BubbleMenu` is imported from `@tiptap/react/menus`).

### 3. Enable the Tailwind typography plugin

`BlogPost.tsx` uses `prose` classes. Add the plugin to `tailwind.config.ts`:

```ts
export default {
  // ...
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};
```

> `BlogPost.tsx` references a `font-display` utility for headings. If your theme
> doesn't define one it harmlessly falls back to the default font — add a
> `fontFamily.display` entry in your Tailwind config to customize it.

### 4. Create the content folders

- `src/content/posts/` — where posts are committed (the demo post is here)
- `public/blog-images/` — where uploaded media is committed

Both are created automatically on first publish, but adding a `.gitkeep` to
`public/blog-images/` avoids a missing-folder error if you delete the demo post first.

### 5. Add the routes to your router

In your `react-router-dom` setup (e.g. `App.tsx`), add the studio and the dynamic
post route. **The `/:slug` catch-all must come last**, and reserved top-level
routes must be registered in `RESERVED_ROUTES` (see step 5b).

```tsx
import BlogStudio from "@/components/cms/BlogStudio";
import BlogPost from "@/pages/BlogPost";

<Routes>
  {/* your existing routes... */}
  <Route path="/admin/studio" element={<BlogStudio />} />

  {/* dynamic post route — keep this near the end */}
  <Route path="/:slug" element={<BlogPost />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

**5b. Reserve your non-post routes.** `src/lib/posts.ts` ships with
`RESERVED_ROUTES = new Set(["", "404"])`. Add every other top-level path your site
uses so `/:slug` never mistakes it for a post:

```ts
const RESERVED_ROUTES = new Set(["", "404", "about", "projects", "contact"]);
```

### 6. Create a Supabase project and wire up the frontend

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon /
   publishable key** into your `.env`:

   ```
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

### 7. Create a GitHub personal access token

Create a token that can commit to your repo:

- **Fine-grained token** (recommended): **Repository access → only your repo**,
  **Repository permissions → Contents: Read and write**, and a short expiry.
  (Verified working with the template's `Authorization: token …` header.)
- **Classic token**: select the **`repo`** scope.

Keep it secret — it's only ever used server-side by the Edge Functions, and never
reaches the browser.

### 8. Deploy the Edge Functions and set secrets

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Set the backend secrets (never commit these)
supabase secrets set ADMIN_SECRET="a-long-random-password-at-least-16-chars"
supabase secrets set GITHUB_TOKEN="ghp_xxx_or_fine_grained_token"
supabase secrets set GITHUB_REPO="your-username/your-repo"
# optional:
supabase secrets set GITHUB_BRANCH="main"
supabase secrets set ALLOWED_ORIGIN="https://your-site.com"

# Deploy all three functions
supabase functions deploy auth-admin
supabase functions deploy publish-blog
supabase functions deploy delete-blog
```

> **Testing locally against this project?** Include your dev origin in
> `ALLOWED_ORIGIN`, e.g.
> `supabase secrets set ALLOWED_ORIGIN="http://localhost:5173,https://your-site.com"`
> (or leave it unset / `*` while testing). Otherwise the browser blocks the
> studio's requests with a CORS error.

### 9. Run it

```bash
npm run dev
```

Visit `/hello-world` to confirm the renderer works, then `/admin/studio`, log in
with your `ADMIN_SECRET`, write a post, and hit **Publish**. Check your repo for a
new commit under `src/content/posts/`. After your host redeploys, the post is live.

---

## Deploying to production

This is a single-page app with a dynamic `/:slug` route, so **your host must serve
`index.html` for unknown paths** — otherwise refreshing or deep-linking to a post
404s. Add a history fallback for your host:

- **Netlify** — a `public/_redirects` file containing: `/*  /index.html  200`
- **Vercel** — `vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- **Cloudflare Pages** — a `_redirects` file with `/*  /index.html  200`
- **GitHub Pages** — copy `index.html` to `404.html` at build time (Pages has no rewrite rules)

A few more production notes:

- **Posts go live on the next build.** Publishing commits to your repo, which
  triggers your host's auto-deploy. Expect a short build delay — posts are read at
  build time, so there's no instant/runtime update.
- **Lock down CORS.** Set `ALLOWED_ORIGIN` to your production domain (comma-separate
  multiple origins) so only your site can call the functions.
- **Sub-path deploys** (e.g. GitHub Pages project sites at `user.github.io/repo/`):
  the renderer and media use root-absolute paths (`/blog-images/...`). If your site
  isn't served from the domain root, set Vite's [`base`](https://vitejs.dev/config/shared-options.html#base)
  and adjust the media path in `BlogStudio.tsx` (`handleInsertMedia`) to match.

---

## Environment variables

| Variable | Where | Required | Description |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` (frontend) | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env` (frontend) | ✅ | Supabase anon / publishable key |
| `ADMIN_SECRET` | Supabase secret | ✅ | Studio login password (min 16 chars). Must match across all 3 functions |
| `GITHUB_TOKEN` | Supabase secret | ✅ | GitHub PAT with `repo`/contents write access |
| `GITHUB_REPO` | Supabase secret | ✅ | Target repo as `owner/name` |
| `GITHUB_BRANCH` | Supabase secret | ➖ | Branch to commit to (default `main`) |
| `ALLOWED_ORIGIN` | Supabase secret | ➖ | Allowed site origin(s) for CORS, comma-separated (default `*`). Include `http://localhost:5173` for local dev. |

---

## Security notes

- The GitHub token lives **only** in Supabase secrets — it never reaches the browser.
- Login issues a **1-hour JWT** signed with `ADMIN_SECRET`; the studio also logs you
  out after 30 minutes of inactivity.
- The functions include basic **per-IP rate limiting** and strict **slug validation**
  (blocks path traversal) so the GitHub writes stay confined to the posts/media folders.
- Set **`ALLOWED_ORIGIN`** to your real domain in production to lock down CORS.
- Rendered post HTML is **sanitized with DOMPurify**; `<iframe>` is allowed so embeds
  work. If you don't want embeds, remove `ADD_TAGS: ["iframe"]` in `BlogPost.tsx`.
- **Single-author by design.** Publish and delete *force-update* the branch ref, so a
  publish can overwrite commits pushed in between. Don't publish while CI or someone
  else is pushing to the same branch.
- Rate limiting is **in-memory per function instance** — it resets on cold start and
  isn't shared across instances. Treat it as a guardrail, not a hard access control.

---

## Customization

- **Studio route** — use any path you like; just keep it above the `/:slug` route.
- **Branding** — "Blog Studio" appears in `AdminGate.tsx` and `BlogStudio.tsx`.
- **Post layout** — `BlogPost.tsx` renders only the article. Wrap it in your own
  header/footer/theme where the comments indicate.
- **Allowed media** — tweak `ALLOWED_TYPES` / `MAX_FILE_SIZE` in `MediaUploader.tsx`.
- **Frontmatter fields** — extend `PostFrontmatter` in `posts.ts` and the frontmatter
  string built in `publish-blog/index.ts` to add fields (cover image, author, etc.).

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| "Server is not configured yet" | A required secret is missing. Check the function logs (`supabase functions logs <name>`) for the exact variable. |
| Login always fails | `ADMIN_SECRET` not set, under 16 chars, or different across functions. Re-set and redeploy. |
| `Could not find branch "main"` | Your default branch isn't `main`. Set `GITHUB_BRANCH` accordingly. |
| "GitHub rejected the token" | Token lacks contents-write access to `GITHUB_REPO`, or `GITHUB_REPO` isn't `owner/name`. |
| CORS errors in the browser | Add your origin to `ALLOWED_ORIGIN` (include `http://localhost:5173` for local dev), or leave it `*` while testing. |
| Published post 404s locally | Posts are read at **build time**. Restart `npm run dev` / pull the new commit so Vite picks up the new file. |
| Post 404s on refresh **in production** | Your host isn't serving `index.html` for unknown routes. Add the SPA history fallback (see [Deploying to production](#deploying-to-production)). |
| `/about` (etc.) renders as a post | Add that path to `RESERVED_ROUTES` in `posts.ts`. |
| Studio works locally but not deployed | Add your production origin to `ALLOWED_ORIGIN` and redeploy the functions. |
