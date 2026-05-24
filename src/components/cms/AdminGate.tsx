import { useState, useEffect, useCallback } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface AdminGateProps {
  children: React.ReactNode;
}

// The login token lives in sessionStorage so it clears when the tab closes.
const STORAGE_KEY = "blog-studio-token";
const ACTIVITY_KEY = "blog-studio-last-activity";
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // re-auth after 30 min idle

function updateActivity() {
  sessionStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

function isInactive(): boolean {
  const lastActivity = sessionStorage.getItem(ACTIVITY_KEY);
  if (!lastActivity) return false;
  return Date.now() - parseInt(lastActivity, 10) > INACTIVITY_TIMEOUT;
}

/**
 * Wraps the studio in a password gate. The secret is checked by the
 * `auth-admin` Edge Function, which returns a short-lived JWT on success.
 */
export function AdminGate({ children }: AdminGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clearSessionIfInactive = useCallback(() => {
    if (isInactive()) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(ACTIVITY_KEY);
      setIsAuthenticated(false);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Re-validate any stored token on mount.
    const validateToken = async () => {
      const storedToken = sessionStorage.getItem(STORAGE_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      if (clearSessionIfInactive()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("auth-admin", {
          body: { action: "validate", token: storedToken },
        });

        if (error || !data?.valid) {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(ACTIVITY_KEY);
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
          updateActivity();
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(ACTIVITY_KEY);
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };

    validateToken();

    const handleActivity = () => {
      if (isAuthenticated) updateActivity();
    };

    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);

    const inactivityCheck = setInterval(() => {
      if (isAuthenticated && clearSessionIfInactive()) {
        window.location.reload();
      }
    }, 60000);

    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(inactivityCheck);
    };
  }, [isAuthenticated, clearSessionIfInactive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsAuthenticating(true);

    if (!secret.trim()) {
      setError("Please enter the admin secret");
      setIsAuthenticating(false);
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("auth-admin", {
        body: { action: "login", secret: secret.trim() },
      });

      if (invokeError) {
        setError("Authentication failed");
        setIsAuthenticating(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setIsAuthenticating(false);
        return;
      }

      if (data?.token) {
        sessionStorage.setItem(STORAGE_KEY, data.token);
        updateActivity();
        setIsAuthenticated(true);
      } else {
        setError("Authentication failed");
      }
    } catch {
      setError("Authentication failed");
    }

    setIsAuthenticating(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Validating session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 shadow-lg">
            <div className="flex items-center justify-center mb-6">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center mb-2">Blog Studio</h1>
            <p className="text-muted-foreground text-center mb-6">
              Enter the admin secret to access the CMS
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="secret">Admin Secret</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Enter admin secret..."
                  className="mt-1"
                  autoFocus
                  disabled={isAuthenticating}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={isAuthenticating}>
                {isAuthenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Authenticating...
                  </>
                ) : (
                  "Access Blog Studio"
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Clears the session and reloads — used by the studio's Logout button.
export function useAdminLogout() {
  return () => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ACTIVITY_KEY);
    window.location.reload();
  };
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}
