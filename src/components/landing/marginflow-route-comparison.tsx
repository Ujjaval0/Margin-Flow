"use client";

import React from "react";
import { Check } from "lucide-react";

export function MarginFlowRouteComparison() {
  return (
    <section
      id="routes"
      className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#fafbfa] text-[#193022] border-t border-[#e2e8e0]"
    >
      {/* Scoped CSS replicating Section B Time-Axis precise dimensions & keyframe animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes timeAxisRise { from { opacity: 0; transform: translateY(12px); } }
            @keyframes timeAxisPop { from { transform: scale(0); } }
            @keyframes timeAxisGrow { from { transform: scaleX(0); } }
            @keyframes timeAxisFade { from { opacity: 0; } }

            .timeaxis-card {
              --accent: #00872e;
              --bg: #F6F7F5;
              --fg: #0B1210;
              --mut: #4A5750;
              --ln: #DDE2DE;
              background: #fff;
              border: 1px solid var(--ln);
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 16px 40px rgba(0, 0, 0, 0.04);
              font-variant-numeric: tabular-nums;
            }
            .timeaxis-hd {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 24px;
              flex-wrap: wrap;
              padding: 20px 36px;
              border-bottom: 1px solid var(--ln);
            }
            .timeaxis-hd b {
              display: block;
              font-size: 16px;
              font-weight: 600;
              letter-spacing: -0.01em;
              color: var(--fg);
            }
            .timeaxis-hd small {
              display: block;
              font-size: 12px;
              color: var(--mut);
              margin-top: 2px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .timeaxis-lg {
              display: flex;
              gap: 22px;
              font-size: 12px;
              color: var(--mut);
              flex-wrap: wrap;
            }
            .timeaxis-lg span {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .timeaxis-lg i {
              display: block;
              width: 14px;
              height: 10px;
              border-radius: 2px;
            }
            .timeaxis-cw {
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }
            .timeaxis-ch {
              display: grid;
              grid-template-columns: 190px minmax(640px, 1fr);
              padding: 8px 36px 28px;
              min-width: 880px;
            }
            .timeaxis-tc {
              position: relative;
            }
            .timeaxis-lab {
              display: flex;
              flex-direction: column;
              justify-content: center;
              border-top: 1px solid var(--ln);
            }
            .timeaxis-lab b {
              font-size: 14px;
              font-weight: 600;
              color: var(--fg);
            }
            .timeaxis-lab .v {
              font-size: 26px;
              font-weight: 600;
              letter-spacing: -0.045em;
              line-height: 1.15;
            }
            .timeaxis-bd {
              position: absolute;
              top: 0;
              bottom: 0;
              width: 33.3333%;
            }
            .timeaxis-bd.o {
              background: #F7F9F7;
            }
            .timeaxis-ax {
              position: relative;
              height: 56px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .timeaxis-ax .wk {
              position: absolute;
              top: 6px;
              width: 33.3333%;
              text-align: center;
              font-size: 10px;
              letter-spacing: 0.1em;
              color: #7A857F;
            }
            .timeaxis-ax .tk {
              position: absolute;
              top: 24px;
              font-size: 11px;
              color: var(--mut);
            }
            .timeaxis-mn {
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              height: 7px;
              border-right: 1px solid #B9C1BC;
              background: repeating-linear-gradient(90deg, #B9C1BC 0 1px, transparent 1px calc(100% / 21));
            }
            .timeaxis-gl {
              position: absolute;
              top: 56px;
              bottom: 0;
              border-left: 1px solid #D5DBD7;
            }
            .timeaxis-lane {
              position: relative;
              border-top: 1px solid var(--ln);
            }
            .timeaxis-sg {
              position: absolute;
              top: 24px;
              height: 40px;
              border-radius: 4px;
              border: 1px solid #B3BBB6;
              font-size: 13px;
              font-weight: 500;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              padding: 0 12px;
              white-space: nowrap;
              overflow: hidden;
              color: #26302A;
              transform-origin: left;
              animation: timeAxisGrow 0.7s ease-out var(--d) both;
            }
            .timeaxis-sg em {
              font-style: normal;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 11px;
              color: #56635B;
            }
            .timeaxis-dm {
              position: absolute;
              left: 0;
              right: 0;
              top: 84px;
              height: 1px;
              background: #8A958E;
              animation: timeAxisFade 0.5s ease-out 2.1s both;
            }
            .timeaxis-dm::before,
            .timeaxis-dm::after {
              content: '';
              position: absolute;
              top: -4px;
              height: 9px;
              border-left: 1px solid #8A958E;
            }
            .timeaxis-dm::before { left: 0; }
            .timeaxis-dm::after { right: 0; }
            .timeaxis-dm span {
              position: absolute;
              left: 50%;
              top: -9px;
              margin-left: -52px;
              width: 104px;
              text-align: center;
              background: #fff;
              font-size: 11px;
              letter-spacing: 0.04em;
              color: #26302A;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            .timeaxis-mk {
              position: absolute;
              top: 56px;
              bottom: 0;
              left: 33.3333%;
              border-left: 2px dashed #C2410C;
              animation: timeAxisFade 0.5s ease-out 1s both;
              z-index: 2;
            }
            .timeaxis-mt {
              position: absolute;
              top: 2px;
              left: 33.3333%;
              transform: translateX(-50%);
              background: #C2410C;
              color: #fff;
              font-size: 11px;
              font-weight: 600;
              padding: 3px 10px;
              border-radius: 4px;
              white-space: nowrap;
              z-index: 3;
              animation: timeAxisFade 0.5s ease-out 1s both;
            }
            .timeaxis-mfb {
              position: absolute;
              top: 24px;
              left: 0;
              width: 1.2%;
              min-width: 10px;
              height: 40px;
              border-radius: 4px;
              background: var(--accent);
              animation: timeAxisPop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) 0.2s both;
            }
            .timeaxis-mfl {
              position: absolute;
              top: 34px;
              left: calc(1.2% + 14px);
              font-size: 12px;
              font-weight: 600;
              color: #00872e;
              letter-spacing: 0.03em;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              animation: timeAxisRise 0.5s ease-out 0.5s both;
            }
            .timeaxis-an {
              position: absolute;
              top: 26px;
              left: calc(33.3333% + 18px);
              right: 12px;
              font-size: 13px;
              color: #8A2D17;
              line-height: 1.35;
              animation: timeAxisFade 0.5s ease-out 1.4s both;
              z-index: 3;
            }
            .timeaxis-st {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 24px;
              padding: 18px 36px 24px;
              border-top: 1px solid var(--ln);
              background: #FAFBFA;
            }
            .timeaxis-st .sh {
              grid-column: 1 / -1;
              font-size: 11px;
              letter-spacing: 0.08em;
              color: var(--mut);
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-weight: 600;
            }
            .timeaxis-st b {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 15px;
              font-weight: 600;
              color: var(--fg);
            }
            .timeaxis-st span {
              display: block;
              font-size: 13px;
              color: var(--mut);
              margin: 3px 0 0 26px;
            }
            .timeaxis-ck {
              display: inline-flex;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: var(--accent);
              color: #fff;
              font-size: 11px;
              font-style: normal;
              font-weight: 700;
              align-items: center;
              justify-content: center;
              flex: none;
            }
            .timeaxis-cap {
              font-size: 12px;
              color: var(--mut);
              margin: 16px 0 0;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }
            @media (prefers-reduced-motion: reduce) {
              .timeaxis-card * {
                animation: none !important;
              }
            }
            @media (max-width: 900px) {
              .timeaxis-st {
                grid-template-columns: 1fr 1fr;
              }
            }
            @media (max-width: 600px) {
              .timeaxis-st {
                grid-template-columns: 1fr;
              }
            }
          `,
        }}
      />

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

        {/* Time-Axis Timeline Card (Extracted Reference Design) */}
        <div className="timeaxis-card">
          {/* Header */}
          <div className="timeaxis-hd">
            <div>
              <b>Time from statement to reconciled books</b>
              <small>Illustrative · days after the statement arrives</small>
            </div>
            <div className="timeaxis-lg">
              <span>
                <i style={{ background: "#D2D8D4", border: "1px solid #B3BBB6" }} />
                Manual step
              </span>
              <span>
                <i style={{ background: "var(--accent)" }} />
                MarginFlow
              </span>
              <span>
                <i
                  style={{
                    background: "none",
                    borderLeft: "2px dashed #C2410C",
                    width: "2px",
                    height: "12px",
                    borderRadius: 0,
                  }}
                />
                Shortest claim windows close
              </span>
            </div>
          </div>

          {/* Timeline Chart Scrollable Viewport */}
          <div className="timeaxis-cw">
            <div className="timeaxis-ch">
              {/* Left Column Labels */}
              <div>
                <div style={{ height: "56px" }} />
                <div className="timeaxis-lab" style={{ height: "116px" }}>
                  <b>The manual way</b>
                  <span className="v" style={{ color: "#4F5B54" }}>
                    Up to 21 days
                  </span>
                </div>
                <div className="timeaxis-lab" style={{ height: "92px" }}>
                  <b>With MarginFlow</b>
                  <span className="v" style={{ color: "#00872e" }}>
                    On upload
                  </span>
                </div>
              </div>

              {/* Right Column Time Axis */}
              <div className="timeaxis-tc">
                {/* Background Alternating Stripe (Week 2) */}
                <i className="timeaxis-bd o" style={{ left: "33.3333%" }} />

                {/* Week Header & Day Ticks */}
                <div className="timeaxis-ax">
                  <span className="wk" style={{ left: "0%" }}>WEEK 1</span>
                  <span className="wk" style={{ left: "33.3333%" }}>WEEK 2</span>
                  <span className="wk" style={{ left: "66.6667%" }}>WEEK 3</span>
                  <span className="tk" style={{ left: "0%" }}>0</span>
                  <span className="tk" style={{ left: "33.3333%", marginLeft: "-3px" }}>7</span>
                  <span className="tk" style={{ left: "66.6667%", marginLeft: "-6px" }}>14</span>
                  <span className="tk" style={{ right: "0%" }}>21</span>
                  <i className="timeaxis-mn" />
                </div>

                {/* Vertical Grid Lines */}
                <i className="timeaxis-gl" style={{ left: "0%" }} />
                <i className="timeaxis-gl" style={{ left: "33.3333%" }} />
                <i className="timeaxis-gl" style={{ left: "66.6667%" }} />
                <i className="timeaxis-gl" style={{ right: "0%" }} />

                {/* Lane 1: The Manual Way */}
                <div className="timeaxis-lane" style={{ height: "116px" }}>
                  <div
                    className="timeaxis-sg"
                    style={{
                      left: "0%",
                      width: "calc(23.81% - 2px)",
                      background: "#E6EAE7",
                      ["--d" as any]: "0.3s",
                    }}
                  >
                    Portal CSV dump<em>5d</em>
                  </div>
                  <div
                    className="timeaxis-sg"
                    style={{
                      left: "23.81%",
                      width: "calc(38.1% - 2px)",
                      background: "#D5DBD7",
                      ["--d" as any]: "0.8s",
                    }}
                  >
                    Excel VLOOKUP<em>8d</em>
                  </div>
                  <div
                    className="timeaxis-sg"
                    style={{
                      left: "61.91%",
                      width: "38.09%",
                      background: "#C3CBC6",
                      ["--d" as any]: "1.4s",
                    }}
                  >
                    Lump payout matching<em>8d</em>
                  </div>
                  <div className="timeaxis-dm">
                    <span>UP TO 21 DAYS</span>
                  </div>
                </div>

                {/* Lane 2: With MarginFlow */}
                <div className="timeaxis-lane" style={{ height: "92px" }}>
                  <div className="timeaxis-mfb" />
                  <span className="timeaxis-mfl">ON UPLOAD</span>
                  <div className="timeaxis-an">
                    Manual audits finish after the shortest claim windows have closed.
                  </div>
                </div>

                {/* 7-Day Claim Window Marker */}
                <i className="timeaxis-mk" />
                <span className="timeaxis-mt">7-day claim windows close</span>
              </div>
            </div>
          </div>

          {/* Bottom Checklist Strip */}
          <div className="timeaxis-st">
            <div className="sh">ON UPLOAD, ALL FOUR RUN AUTOMATICALLY</div>
            <div>
              <b>
                <i className="timeaxis-ck">
                  <Check className="w-3 h-3 stroke-[3]" />
                </i>
                Data ingest
              </b>
              <span>Webhook sync or statement upload</span>
            </div>
            <div>
              <b>
                <i className="timeaxis-ck">
                  <Check className="w-3 h-3 stroke-[3]" />
                </i>
                Cross-reconciliation
              </b>
              <span>COGS, commission fees and return audit</span>
            </div>
            <div>
              <b>
                <i className="timeaxis-ck">
                  <Check className="w-3 h-3 stroke-[3]" />
                </i>
                Dispute queue
              </b>
              <span>Dossier compiled with evidence in SLA</span>
            </div>
            <div>
              <b>
                <i className="timeaxis-ck">
                  <Check className="w-3 h-3 stroke-[3]" />
                </i>
                Bank cash matched
              </b>
              <span>UTR verified down to the rupee</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
