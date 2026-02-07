import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20">
          <div className="glass-card p-8 max-w-lg mx-auto text-center">
            <h1 className="text-2xl font-display font-bold mb-2">Loading…</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!user || String(user.role || "").toUpperCase() !== "ADMIN") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-20">
          <div className="glass-card p-8 max-w-lg mx-auto text-center">
            <h1 className="text-2xl font-display font-bold mb-2">Admin Access Required</h1>
            <p className="text-muted-foreground mb-6">
              You don&apos;t have permission to access the admin panel.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" asChild>
                <a href="/">Go Home</a>
              </Button>
              <Button variant="neon" asChild>
                <a href="/auth">Sign In</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminIndexRedirect() {
  return <Navigate to="/admin/dashboard" replace />;
}
