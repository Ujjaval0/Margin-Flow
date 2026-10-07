"use client";

import { RefreshCw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center min-h-screen bg-[#F5F5F7] text-slate-900 font-sans">
        <div className="text-center p-8 max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Error</h2>
          <p className="text-sm text-slate-500 mb-6">
            A critical runtime error occurred. Please reload to re-initialize your session.
          </p>
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D1D1F] text-white font-medium hover:bg-black transition shadow-apple-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
