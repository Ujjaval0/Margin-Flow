"use client";

import React from "react";
import { MarginFlowFlowDiagram } from "./marginflow-flow-machine";

export function MarginFlowRouteComparison() {
  return (
    <section
      id="routes"
      className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#fafbfa] text-[#193022] border-t border-[#e2e8e0]"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Heading */}
        <div className="max-w-2xl mb-12 sm:mb-14">
          <span className="text-[11px] font-mono tracking-widest text-[#00872e] uppercase font-semibold block mb-3">
            RECONCILIATION
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.02]">
            The manual audit bottleneck.{" "}
            <span className="font-serif italic font-normal text-[#00872e]">
              Solved with automated precision.
            </span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#5c7062] leading-relaxed">
            Stop waiting weeks for monthly CSV exports or CA reconciliations. Catch deductions, silent fee hikes and damaged returns the moment statements drop.
          </p>
        </div>

        <MarginFlowFlowDiagram />
      </div>
    </section>
  );
}
