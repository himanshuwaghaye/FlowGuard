import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 rounded-full transition-colors hover:bg-accent", className)}
      onClick={toggleTheme}
      title={resolvedTheme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
      aria-label="Toggle light/dark theme"
    >
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4 text-primary transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500 transition-transform duration-300 hover:rotate-45" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
