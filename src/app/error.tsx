"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Runtime Boundary caught error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in fade-in duration-200">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-sm mb-4">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        An unexpected runtime error occurred. Your financial ledger data is persisted safely in storage.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-[#1D1D1F] text-white hover:bg-black transition shadow-apple-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}
