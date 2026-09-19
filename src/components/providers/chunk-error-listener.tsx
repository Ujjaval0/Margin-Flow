"use client";

import { useEffect } from "react";

/**
 * Handles Webpack chunk loading mismatches, stale HMR updates, and unhandled
 * DOM Event rejections (which display as "[object Event]" in Next.js).
 */
export function ChunkErrorListener() {
  useEffect(() => {
    const RELOAD_KEY = "mf_chunk_reload_ts";

    const triggerSafeReload = () => {
      try {
        const lastReload = sessionStorage.getItem(RELOAD_KEY);
        const now = Date.now();
        // Prevent infinite reload loops (require at least 10s between auto-reloads)
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem(RELOAD_KEY, now.toString());
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;

      // Check if the rejection reason is a raw DOM Event (e.g. script.onerror triggering [object Event])
      const isEventReason =
        reason instanceof Event ||
        (reason && typeof reason === "object" && reason.constructor?.name === "Event") ||
        Object.prototype.toString.call(reason) === "[object Event]";

      // Check for Webpack ChunkLoadError or dynamic import failures
      const isChunkError =
        reason?.name === "ChunkLoadError" ||
        (typeof reason?.message === "string" &&
          (reason.message.includes("Loading chunk") ||
            reason.message.includes("Failed to fetch dynamically imported module") ||
            reason.message.includes("ChunkLoadError")));

      if (isEventReason || isChunkError) {
        console.warn(
          "Captured stale chunk or unhandled Event rejection. Refreshing to synchronize client bundle:",
          reason
        );
        event.preventDefault();
        triggerSafeReload();
      }
    };

    const handleError = (event: ErrorEvent) => {
      // Catch failed script/link tag network loads from Webpack HMR or stale hashes
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.tagName === "SCRIPT" &&
        (target as HTMLScriptElement).src?.includes("/_next/static/")
      ) {
        console.warn(
          "Script chunk failed to load (stale hash or HMR mismatch):",
          (target as HTMLScriptElement).src
        );
        event.preventDefault();
        triggerSafeReload();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError, true);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError, true);
    };
  }, []);

  return null;
}
