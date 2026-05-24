---
title: "Hello World"
slug: "hello-world"
publishedDate: "2024-01-01"
description: "Your first post — proof that the CMS template is wired up correctly."
tags: ["welcome", "getting-started"]
---

# Hello World 👋

If you can read this at `/hello-world`, your blog renderer is working.

This post is a plain Markdown file living at `src/content/posts/hello-world.md`.
Posts you create in the Blog Studio are saved the same way — committed straight
to your GitHub repo, no database required.

## How it fits together

- **Write** in the studio at `/admin/blog-studio`
- **Publish** — a Supabase Edge Function commits the post (and any media) to your repo
- **Deploy** — your host rebuilds and the new post goes live

## Markdown still works

The renderer auto-detects content: older Markdown posts like this one are parsed
on the fly, while posts authored in the studio are stored as HTML. You can mix
both freely.

Things you can use:

- **Bold** and *italic* text
- [Links](https://example.com)
- `inline code` and fenced blocks:

```ts
function greet(name: string) {
  return `Hello, ${name}!`;
}
```

> Delete this file once you've published your own first post.

Happy writing!
