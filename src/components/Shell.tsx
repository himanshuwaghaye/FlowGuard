import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_HOME, ROLE_LABEL, useApp } from "@/lib/store";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export function LastUpdated({ className }: { className?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s >= 14 ? 0 : s + 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flow opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flow" />
      </span>
      <span className="num">last updated {secs}s ago</span>
    </span>
  );
}

const NAV = [
  { to: "/", label: "Citizen map" },
  { to: "/planner", label: "Planner" },
  { to: "/responder", label: "Responders" },
] as const;

export function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const { user, signOut } = useApp();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src="/logo.png"
            alt="FlowGuard Logo"
            className="h-8 w-8 rounded-md object-cover shadow-sm ring-1 ring-border/50 transition-transform duration-200 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight leading-tight">FlowGuard</span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground leading-tight font-medium tracking-wide">
              Traffic Signal Intelligence
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "rounded-sm px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                path === n.to && "bg-accent text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {right}
          <ThemeToggle />
          <LastUpdated className="hidden lg:flex" />
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-xs font-medium">{user.contact}</div>
                <div className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                onClick={() => {
                  signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              Sign in
            </Button>
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

export function roleHome(role: keyof typeof ROLE_HOME) {
  return ROLE_HOME[role];
}

export function Metric({
  label,
  value,
  unit,
  delta,
  tone = "default",
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  tone?: "default" | "flow" | "peak" | "critical";
}) {
  return (
    <div className="panel p-3">
      <div className="label-xs">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className={cn(
            "num text-2xl font-semibold",
            tone === "flow" && "text-flow",
            tone === "peak" && "text-peak",
            tone === "critical" && "text-critical",
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {delta && <div className="mt-0.5 text-[11px] text-muted-foreground">{delta}</div>}
    </div>
  );
}
