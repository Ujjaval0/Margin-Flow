"use client";

import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);
  const requestedTheme = useRef<"light" | "dark">("light");
  const transition = useRef<ViewTransition | null>(null);
  const cleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("marginflow_theme");
      if (saved === "dark") {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      } else {
        setTheme("light");
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // ignore
    }
    requestedTheme.current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(requestedTheme.current);

    return () => {
      revision.current += 1;
      transition.current?.skipTransition();
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
      delete document.documentElement.dataset.themeTransition;
    };
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = requestedTheme.current === "dark" ? "light" : "dark";
    requestedTheme.current = nextTheme;
    const currentRevision = ++revision.current;
    transition.current?.skipTransition();
    if (cleanupTimer.current) clearTimeout(cleanupTimer.current);

    const applyTheme = () => {
      // A superseded snapshot must never overwrite a newer choice or the marketing page.
      if (currentRevision !== revision.current || window.location.pathname === "/") return;
      root.classList.toggle("dark", nextTheme === "dark");
      flushSync(() => setTheme(nextTheme));
      try {
        localStorage.setItem("marginflow_theme", nextTheme);
      } catch {
        // Theme switching still works when browser storage is unavailable.
      }
      window.dispatchEvent(
        new CustomEvent("marginflow_theme_change", {
          detail: { theme: nextTheme },
        })
      );
    };
    const cleanup = () => {
      if (currentRevision !== revision.current) return;
      delete root.dataset.themeTransition;
      transition.current = null;
      cleanupTimer.current = null;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.dataset.themeTransition = "instant";
      applyTheme();
      // Commit final colors before restoring the controls' normal hover transitions.
      void root.offsetWidth;
      cleanup();
      return;
    }

    if (typeof document.startViewTransition === "function") {
      root.dataset.themeTransition = "snapshot";
      try {
        const activeTransition = document.startViewTransition(applyTheme);
        transition.current = activeTransition;
        void activeTransition.ready.catch(() => {});
        void activeTransition.finished.then(cleanup, cleanup);
        return;
      } catch {
        // Fall back to synchronized colors if snapshot capture is unavailable.
      }
    }

    root.dataset.themeTransition = "colors";
    // Establish the current palette before changing the theme in the same frame.
    void root.offsetWidth;
    applyTheme();
    cleanupTimer.current = setTimeout(cleanup, 360);
  };

  if (!mounted) {
    return (
      <div
        className="h-[34px] w-[34px] rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#242426] opacity-60 shrink-0"
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative h-[34px] w-[34px] rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 ${
        isDark
          ? "bg-[#242426] hover:bg-[#2C2C2E] text-[#F5F5F7] border-white/[0.12] shadow-apple-sm active:scale-[0.96]"
          : "bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border-black/[0.08] shadow-apple-sm active:scale-[0.96]"
      }`}
      title={isDark ? "Switch to day mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to day mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#FF9F0A] transition-transform duration-200 rotate-0 hover:rotate-12" strokeWidth={1.8} />
      ) : (
        <Moon className="w-4 h-4 text-[#1D1D1F] transition-transform duration-200 rotate-0 hover:-rotate-12" strokeWidth={1.8} />
      )}
    </button>
  );
}
