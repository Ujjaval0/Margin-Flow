"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

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
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("marginflow_theme", nextTheme);
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      window.dispatchEvent(
        new CustomEvent("marginflow_theme_change", {
          detail: { theme: nextTheme },
        })
      );
    } catch {
      // ignore
    }
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
