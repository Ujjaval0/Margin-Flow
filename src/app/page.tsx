"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowNavbar } from "@/components/landing/marginflow-navbar";
import { MarginFlowHero } from "@/components/landing/marginflow-hero";
import { MarginFlowFlowMachine } from "@/components/landing/marginflow-flow-machine";
import { MarginFlowRouteComparison } from "@/components/landing/marginflow-route-comparison";
import { MarginFlowWorkspaceShowcase } from "@/components/landing/marginflow-workspace-showcase";
import { MarginFlowCompoundMetrics } from "@/components/landing/marginflow-compound-metrics";
import { MarginFlowFooter } from "@/components/landing/marginflow-footer";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Mail,
  Building2,
  ArrowUpRight,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Marketing page strictly operates in light mode
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("dark");
    }
  }, []);
  const handleGoogleSignIn = () => {
    setIsAuthenticating(true);
    router.push("/login");
  };

  const faqs = [
    {
      question: "What does MarginFlow help me track?",
      answer:
        "MarginFlow brings your orders, costs, fees, returns, and settlements together so you can understand your profit.",
    },
    {
      question: "How do I bring my sales data into MarginFlow?",
      answer:
        "You can connect supported sales channels or upload CSV and Excel reports. Available options depend on your channel.",
    },
    {
      question: "Can I track product costs and return losses?",
      answer:
        "Yes. You can record purchase costs, review uploaded supplier invoices, and track customer returns and RTOs, including shipping charges, return fees, and damaged stock losses.",
    },
    {
      question: "How does MarginFlow help me prepare marketplace claims?",
      answer:
        "MarginFlow helps prepare a claim narrative and an evidence checklist. You review the details and submit the claim through your marketplace account.",
    },
    {
      question: "How does MarginFlow make accounting easier?",
      answer:
        "MarginFlow organizes your recorded transactions into a ledger and trial balance, helping you and your accountant review income, expenses, and balances.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f9f5] text-[#193022] font-sans antialiased selection:bg-[#00ae3b] selection:text-white overflow-x-hidden">
      
      {/* 1. DYNAMIC HYSTERESIS FLOATING NAVBAR */}
      <MarginFlowNavbar
        onSignIn={handleGoogleSignIn}
        isAuthenticating={isAuthenticating}
      />

      {/* 2. ATMOSPHERIC LIVING EMERALD HERO */}
      <MarginFlowHero
        onSignIn={handleGoogleSignIn}
        isAuthenticating={isAuthenticating}
      />

      {/* 3. THE INTERACTIVE ENGINE: 4-WAY CROSS RECONCILIATION */}
      <MarginFlowFlowMachine />

      {/* 5. THE TWO ROUTES COMPARISON: 3 SECONDS VS 21 DAYS */}
      <MarginFlowRouteComparison />

      {/* 6. NOT ANOTHER SPREADSHEET: INTERACTIVE WORKSPACE SHOWCASE */}
      <MarginFlowWorkspaceShowcase />

      {/* 7. GROWTH METRICS & THE COMPOUND EFFECT */}
      <MarginFlowCompoundMetrics />

      {/* 8. FAQ: GOOD QUESTIONS. CLEAR ANSWERS. */}
      <section id="faq" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white border-t border-[#cfdfd1]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14">
            <span className="text-[11px] font-mono tracking-widest text-[#00872e] uppercase font-semibold block mb-3">
              A LITTLE MORE CLARITY
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.04em] text-[#193022] leading-[1.05]">
              Good questions.<br />
              <span className="font-serif italic font-normal text-[#00872e]">
                Clear answers.
              </span>
            </h2>
            <p className="mt-4 text-base text-[#5c7062]">
              Start with the essentials. Find the details for your store’s next audit.
            </p>
          </div>

          <div className="divide-y divide-[#cfdfd1] border-y border-[#cfdfd1]">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="py-6">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-[#193022] hover:text-[#00872e] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <span className="shrink-0 text-[#5c7062]">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pt-3 text-sm sm:text-base text-[#5c7062] leading-relaxed font-sans">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 9. FINAL HIGH-EMOTION CTA (Exact MarginFlow .final-cta styling) */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#060c09] text-white relative overflow-hidden border-t border-white/[0.08]">
        {/* Ambient Glowing Orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#00ae3b]/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <span className="text-[11px] font-mono tracking-widest text-[#71d78e] uppercase font-semibold block">
            INSTANT FINANCIAL CLARITY
          </span>

          <h2 className="text-4xl sm:text-6xl font-bold tracking-[-0.04em] text-white leading-[1.05]">
            Stop marketplace margin leaks.<br />
            <span className="font-serif italic font-normal text-[#71d78e]">
              See your true numbers in 60 seconds.
            </span>
          </h2>

          <p className="text-base sm:text-lg text-[#9ab1a1] max-w-lg mx-auto font-normal">
            Connect your channels or upload your latest statement. Audit your past 90 days of settlements and quantify your recoverable capital.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="px-8 py-4 rounded-full bg-[#124b20] hover:bg-[#1b6235] active:scale-95 border border-white/20 backdrop-blur-sm text-white text-sm font-semibold transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_28px_rgba(18,75,32,0.4)] cursor-pointer flex items-center gap-2"
            >
              <span>{isAuthenticating ? "Connecting..." : "Get started free"}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* 10. IMMERSIVE ARCHITECTURAL FOOTER */}
      <MarginFlowFooter
        onSignIn={handleGoogleSignIn}
        isAuthenticating={isAuthenticating}
      />

    </div>
  );
}
