"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, ZapOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("cd-theme", theme);
  } catch {
    /* storage unavailable — theme still applies for this page view */
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Deferred so the effect body itself never triggers a cascading render.
    const id = window.setTimeout(() => {
      const root = document.documentElement;
      setThemeState(root.classList.contains("light") ? "light" : "dark");
      setReduceMotion(root.classList.contains("reduce-motion"));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function setTheme(next: "dark" | "light") {
    setThemeState(next);
    applyTheme(next);
  }

  function setReduce(next: boolean) {
    setReduceMotion(next);
    document.documentElement.classList.toggle("reduce-motion", next);
    try {
      localStorage.setItem("cd-reduce-motion", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return { theme, setTheme, reduceMotion, setReduce };
}

export function ThemeToggle({
  theme,
  onToggle,
  compact = false,
}: {
  theme: "dark" | "light";
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className={cn(
        "flex items-center justify-center gap-2 rounded-[4px] border border-[var(--border)] text-[var(--muted)]",
        "transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]",
        compact ? "h-9 w-9" : "h-9 w-full px-3",
      )}
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      {!compact ? <span className="label">{theme === "dark" ? "Light" : "Dark"}</span> : null}
    </button>
  );
}

export function MotionToggle({
  reduce,
  onChange,
}: {
  reduce: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={reduce}
      onClick={() => onChange(!reduce)}
      className="flex h-9 w-full items-center gap-2.5 rounded-[4px] border border-[var(--border)] px-3 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
    >
      {reduce ? <ZapOff size={14} /> : <Zap size={14} />}
      <span className="label">{reduce ? "Motion off" : "Motion on"}</span>
      <span
        aria-hidden
        className="ml-auto flex h-4 w-7 items-center rounded-full border border-[var(--border-strong)] p-[2px] transition-colors"
        style={{ background: reduce ? "color-mix(in oklab, var(--accent) 30%, transparent)" : "transparent" }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full bg-[var(--muted)] transition-transform duration-200"
          style={{ transform: reduce ? "translateX(12px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
