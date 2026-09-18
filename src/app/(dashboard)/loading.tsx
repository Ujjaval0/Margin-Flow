"use client";

import React from "react";

export default function DashboardLoading() {
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-pulse p-2">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-slate-200/80 rounded-xl" />
          <div className="h-4 w-80 bg-slate-200/60 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-slate-200/70 rounded-full" />
          <div className="h-9 w-28 bg-slate-200/70 rounded-full" />
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-slate-200/70 rounded" />
              <div className="w-8 h-8 rounded-xl bg-slate-100" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-36 bg-slate-200/90 rounded-lg" />
              <div className="h-3.5 w-20 bg-slate-100 rounded" />
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="h-3 w-48 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Main content table/chart skeleton */}
      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="h-5 w-40 bg-slate-200/70 rounded-lg" />
          <div className="h-8 w-32 bg-slate-100 rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div
              key={row}
              className="h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center px-4 gap-4"
            >
              <div className="h-4 w-16 bg-slate-200/60 rounded" />
              <div className="h-4 w-32 bg-slate-200/70 rounded" />
              <div className="h-4 w-24 bg-slate-200/50 rounded ml-auto" />
              <div className="h-4 w-20 bg-slate-200/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
