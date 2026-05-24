import { createClient } from "@supabase/supabase-js";

// The studio talks to your Supabase project only to invoke Edge Functions
// (auth-admin, publish-blog, delete-blog). No tables or Supabase Auth are used,
// so a plain client with your project URL + anon (publishable) key is enough.
//
// Set these in your .env file (see .env.example):
//   VITE_SUPABASE_URL       https://<project-ref>.supabase.co
//   VITE_SUPABASE_ANON_KEY  the project's anon / publishable key

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env, add your project values, then restart the dev server. " +
      "Your blog will still render, but the studio (login / publish / delete) won't work until these are set.",
  );
}

// Fall back to harmless placeholders so a missing .env doesn't crash the whole
// app at import time — createClient() throws on an empty URL. Studio requests
// will simply fail (and surface a toast) until real values are provided, instead
// of white-screening every page including the public blog.
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
);
