"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex items-center rounded-full border border-border bg-muted/50 p-0.5">
        {themes.map((t) => (
          <div key={t.value} className="size-7 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center rounded-full border border-border bg-muted/50 p-0.5">
      {themes.map((t) => {
        const Icon = t.icon;
        const isActive = theme === t.value;
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              "rounded-full p-1.5 transition-all duration-200",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={t.label}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
