"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import { MarginFlowNavbar } from "@/components/landing/marginflow-navbar";
import { MarginFlowHero } from "@/components/landing/marginflow-hero";
import { MarginFlowFlowMachine } from "@/components/landing/marginflow-flow-machine";
import { MarginFlowRouteComparison } from "@/components/landing/marginflow-route-comparison";
import { MarginFlowWorkspaceShowcase } from "@/components/landing/marginflow-workspace-showcase";
import { MarginFlowCompoundMetrics } from "@/components/landing/marginflow-compound-metrics";
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
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    monthlyGmv: "₹25L - ₹1 Crore",
    channel: "Amazon + Flipkart",
    message: "",
  });

  const handleGoogleSignIn = () => {
    setIsAuthenticating(true);
    try {
      if (typeof window !== "undefined") {
        const dummyUser = {
          name: "E-Commerce Founder",
          email: "founder@brand.in",
          provider: "google",
          authenticatedAt: new Date().toISOString(),
        };
        localStorage.setItem("marginflow_session", JSON.stringify(dummyUser));
      }
    } catch {
      // storage fallback
    }

    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
  };

  const faqs = [
    {
      question: "How far back can MarginFlow audit past settlements?",
      answer:
        "MarginFlow scans your past 90 days of transactions immediately upon onboarding, auto-flagging historical courier deadweight overcharges, unannounced commission tier increases, and unfiled claim opportunities.",
    },
    {
      question: "Does MarginFlow replace Tally, Zoho Books, or my Chartered Accountant?",
      answer:
        "No. MarginFlow feeds verified, transaction-level net cash and isolated tax withholdings (1% TCS & TDS) directly into your accounting workflows, giving your CA audit-ready, balanced books.",
    },
    {
      question: "How does automated courier weight reconciliation work?",
      answer:
        "Couriers frequently bump 400g products into 1.5kg or 2kg deadweight slabs. MarginFlow compares billed courier weights against your catalog dimensions, auto-flagging overcharges for reimbursement before payouts lock.",
    },
    {
      question: "How do you handle Return to Origin (RTO) vs Customer Returns?",
      answer:
        "MarginFlow isolates RTOs (courier freight costs with zero return fees) from customer returns (handling fees, damaged goods, or swapped units) so you know exactly how returns impact each SKU's contribution margin.",
    },
    {
      question: "Which marketplaces and sales channels are supported?",
      answer:
        "Native support for Amazon India (SP-API), Flipkart, Meesho (smart statement auto-mapper), Shopify D2C, WooCommerce, and Shiprocket courier telemetry.",
    },
    {
      question: "Is my seller central data secure and read-only?",
      answer:
        "Yes. We connect via official read-only APIs and bank-grade encryption. MarginFlow cannot modify listings, alter prices, or move funds.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f9f5] text-[#193022] font-sans antialiased selection:bg-[#00ae3b] selection:text-white">
      
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
      <section id="faq" className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white border-t border-[#cfdfd1] select-none">
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
                    className="w-full text-left flex items-center justify-between gap-4 font-mono font-bold text-base sm:text-lg text-[#193022] hover:text-[#00872e] transition-colors cursor-pointer"
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
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[#060c09] text-white relative overflow-hidden select-none border-t border-white/[0.08]">
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
              className="px-8 py-4 rounded-full bg-[#00ae3b] hover:bg-[#008f36] active:scale-95 text-white text-sm font-mono font-semibold transition-all shadow-[0_0_35px_rgba(0,174,59,0.4)] cursor-pointer flex items-center gap-2"
            >
              <span>{isAuthenticating ? "Connecting..." : "Audit Your Store Free"}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs font-mono text-[#8da494] pt-2">
            Bank-grade encryption • 100% read-only access • No card required
          </p>
        </div>
      </section>

      {/* 10. ATMOSPHERIC MINIMALIST FOOTER */}
      <footer className="bg-[#0c140e] border-t border-white/[0.08] text-[#8da494] py-16 px-4 sm:px-6 lg:px-8 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <MarginFlowLogo className="h-6 w-auto text-white" />
            </Link>
            <p className="text-xs font-mono text-[#687d6e] mt-2">
              Financial truth for marketplace commerce.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-mono font-medium">
            <a href="#engine" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#routes" className="hover:text-white transition-colors">
              Reconciliation
            </a>
            <a href="#workspace" className="hover:text-white transition-colors">
              Cockpit
            </a>
            <a href="#metrics" className="hover:text-white transition-colors">
              Results
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
            <Link href="/dashboard" className="text-[#71d78e] hover:text-white transition-colors flex items-center gap-1">
              <span>Cockpit</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <p className="text-xs font-mono text-[#687d6e]">
            © {new Date().getFullYear()} MarginFlow Technologies
          </p>
        </div>
      </footer>

    </div>
  );
}
