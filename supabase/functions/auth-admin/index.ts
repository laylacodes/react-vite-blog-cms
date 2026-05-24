// ---------------------------------------------------------------------------
// auth-admin  —  Supabase Edge Function
//
// Gives the studio a tiny password-based login. The browser sends the secret
// once; if it matches ADMIN_SECRET the function returns a short-lived JWT that
// the studio attaches to publish/delete requests. No user database required.
//
// Required secrets:
//   ADMIN_SECRET    Your studio password. Must be at least 16 characters.
//
// Optional secrets:
//   ALLOWED_ORIGIN  Comma-separated allowed site origins for CORS (default "*").
//
// The same ADMIN_SECRET must be set on publish-blog and delete-blog so the
// JWTs issued here can be verified there.
// ---------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

const MIN_SECRET_LENGTH = 16;

// In-memory throttle on failed logins, per IP.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const MAX_FAILED_ATTEMPTS = 5;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const key = `auth:${ip}`;
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

function resetRateLimit(ip: string): void {
  rateLimitMap.delete(`auth:${ip}`);
}

// Derive an HMAC key from ADMIN_SECRET (padded/truncated to 32 bytes).
async function getJwtKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("ADMIN_SECRET") || "";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.padEnd(32, "0").slice(0, 32));
  return await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
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
    const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET");

    if (!ADMIN_SECRET) {
      console.error('Setup error: ADMIN_SECRET is not set. Run: supabase secrets set ADMIN_SECRET="<16+ char password>"');
      return json({ error: "Server is not configured yet. See the function logs for setup steps." }, 500);
    }
    if (ADMIN_SECRET.length < MIN_SECRET_LENGTH) {
      console.error(`Setup error: ADMIN_SECRET must be at least ${MIN_SECRET_LENGTH} characters (currently ${ADMIN_SECRET.length}).`);
      return json({ error: "Server is misconfigured (weak ADMIN_SECRET). See the function logs." }, 500);
    }

    const body = await req.json();
    const action = body.action || "login";

    // --- Exchange the password for a token --------------------------------
    if (action === "login") {
      const rateLimit = checkRateLimit(clientIP);
      if (!rateLimit.allowed) {
        console.warn(`Rate limit exceeded for IP: ${clientIP}`);
        return new Response(
          JSON.stringify({ error: "Too many attempts. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfter || 60) },
          },
        );
      }

      const { secret } = body;
      if (!secret || secret !== ADMIN_SECRET) {
        console.warn(`Failed login attempt from IP: ${clientIP}`);
        return json({ error: "Invalid credentials" }, 401);
      }

      resetRateLimit(clientIP);
      const key = await getJwtKey();
      const token = await create(
        { alg: "HS256", typ: "JWT" },
        { sub: "admin", role: "admin", iat: getNumericDate(0), exp: getNumericDate(60 * 60) }, // 1 hour
        key,
      );

      return json({ success: true, token });
    }

    // --- Confirm an existing token is still valid -------------------------
    if (action === "validate") {
      const { token } = body;
      if (!token) return json({ valid: false });
      try {
        const payload = await verify(token, await getJwtKey());
        return json({ valid: payload.role === "admin" });
      } catch {
        return json({ valid: false });
      }
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Auth error:", error);
    return json({ error: "Authentication failed" }, 500);
  }
});
