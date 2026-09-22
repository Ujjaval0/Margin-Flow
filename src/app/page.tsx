"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Scale,
  ShieldCheck,
  Receipt,
  FileCheck2,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Mail,
  Building2,
  ExternalLink,
  Lock,
  BarChart3,
  Package,
  Zap,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [activeSolutionStep, setActiveSolutionStep] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-advance solution step animation every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSolutionStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, []);
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
      question: "How is MarginFlow different from Tally, Zoho, or Seller Central reports?",
      answer:
        "Seller Central reports only show top-line sales and surface-level fees for a single channel. Traditional accounting tools like Tally record lump-sum bank deposits weeks later without unit-level attribution. MarginFlow is a transaction-level financial intelligence ERP specifically built for Indian e-commerce: it reconciles courier weight slabs, isolates 20–35% RTO losses, computes True Contribution Margin (CM2), tracks expiring SAFE-T claim windows, and segregates statutory TCS/TDS withholdings from operating expenses.",
    },
    {
      question: "How does MarginFlow catch courier volumetric weight overcharging?",
      answer:
        "Couriers frequently bill packages at higher dead or volumetric weight slabs (for example, billing 1.5 kg for a 400g package). MarginFlow binds to your master product catalog dimensions, cross-checks every single order's billed courier freight weight against your catalog baselines, and flags weight discrepancies for automated reimbursement claims before payout batches settle.",
    },
    {
      question: "Why is ROAS dangerous and how does POAS fix it?",
      answer:
        "Return on Ad Spend (ROAS) divides Gross Revenue by Ad Spend. If a SKU has a 30% RTO rate and high commission fees, a campaign with 4x ROAS can still lose substantial net cash on every delivery. Profit on Ad Spend (POAS) divides Net Contribution Profit (after deducting COGS, forward logistics, reverse logistics, and marketplace commissions) by Ad Spend. MarginFlow guarantees you only scale campaigns that generate positive bank cash.",
    },
    {
      question: "How does the SAFE-T and dispute claim recovery engine work?",
      answer:
        "When customer returns or RTO shipments arrive damaged, replaced, or missing, marketplaces provide strict 7-to-30 day dispute windows (such as Amazon SAFE-T or Flipkart seller claims). MarginFlow tracks expiring claim deadlines, automatically compiles order cost snapshots, tracking numbers, and damage evidence checklists, and tracks recovered funds through payout settlements to recover cash that would otherwise be permanently lost.",
    },
    {
      question: "Does MarginFlow properly isolate Indian GST, TCS, and Section 194-O TDS?",
      answer:
        "Yes. A critical accounting error among Indian sellers is classifying GST TCS (1%) and Section 194-O TDS (1%) as operating expenses. In MarginFlow, our deterministic P6 Tax Guardrail enforces statutory isolation: withholdings are maintained in balance-sheet withholding asset ledgers, ensuring your net operating profit and EBITDA are compliant and ready for chartered accountants.",
    },
    {
      question: "What channels are currently supported?",
      answer:
        "MarginFlow provides native support for Amazon India (Easy Ship, FBA & Self Ship), Flipkart (FBF & Smart Fulfillment), Meesho, Myntra, as well as direct-to-consumer stores on Shopify and WooCommerce via real-time webhooks.",
    },
    {
      question: "How does the Human-in-the-Loop (HITL) AI Document Staging Sandbox work?",
      answer:
        "When you upload supplier purchase bills or settlement PDFs, our OCR engine extracts line items, quantities, and GST rates. However, instead of blindly trusting AI, MarginFlow isolates the data in a quarantine staging sandbox where our P7 deterministic arithmetic invariant checks (Quantity × Unit Price − Discount + Tax == Total) must pass before updating your inventory cost basis.",
    },
    {
      question: "How do I sign up and access the platform?",
      answer:
        "Access is streamlined through Google single sign-on. Click 'Continue with Google' anywhere on the page to authenticate your Google account and immediately enter your dedicated MarginFlow dashboard.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] selection:bg-[#1D1D1F] selection:text-white font-mono antialiased">
      {/* 1. AETERNA-INSPIRED TRANSPARENT & SCROLL-BLUR NAVBAR */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ease-in-out ${
          isScrolled
            ? "backdrop-blur-xl bg-[#F5F5F7]/80 border-b border-black/[0.05] shadow-[0_4px_30px_rgba(0,0,0,0.03)]"
            : "bg-transparent backdrop-blur-none border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <MarginFlowLogo
              className="h-6 sm:h-7 w-auto text-[#1D1D1F] transition-opacity group-hover:opacity-80"
            />
          </Link>

          {/* Clean Floating Text Links (No Pill Container - Pure Aeterna Style) */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-9 font-mono text-xs sm:text-[13px] font-medium text-[#1D1D1F]/80">
            <a
              href="#features"
              className="hover:text-black transition-colors"
            >
              Features
            </a>
            <a
              href="#solution"
              className="hover:text-black transition-colors"
            >
              Solutions
            </a>
            <a
              href="#channels"
              className="hover:text-black transition-colors"
            >
              Integrations
            </a>
            <Link
              href="/dashboard"
              className="hover:text-black transition-colors"
            >
              Cockpit
            </Link>
            <a
              href="#faq"
              className="hover:text-black transition-colors"
            >
              FAQ
            </a>
            <a
              href="#contact"
              className="hover:text-black transition-colors"
            >
              Contact
            </a>
          </nav>

          {/* Right Action: Clean Monospace Sign In & Sharp Black Button */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="hidden sm:inline-block font-mono text-xs sm:text-[13px] font-medium text-[#1D1D1F] hover:text-black transition-colors px-2 py-1.5"
            >
              Sign In
            </Link>

            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-[2px] bg-black hover:bg-neutral-800 active:scale-[0.98] text-white font-mono text-xs sm:text-[13px] font-medium tracking-tight shadow-2xs transition-all cursor-pointer"
            >
              {isAuthenticating ? "Connecting..." : "Get Started"}
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded hover:bg-black/[0.05] text-[#1D1D1F] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden backdrop-blur-2xl bg-[#F5F5F7]/95 border-b border-black/[0.06] px-5 py-5 space-y-4 animate-in slide-in-from-top-2 duration-200 shadow-sm">
            <div className="flex flex-col space-y-2 font-mono text-sm font-medium text-[#1D1D1F]/80">
              <a
                href="#features"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-black transition"
              >
                Features
              </a>
              <a
                href="#solution"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-black transition"
              >
                Solutions
              </a>
              <a
                href="#channels"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-black transition"
              >
                Integrations
              </a>
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-black transition"
              >
                Cockpit
              </Link>
              <a
                href="#faq"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-black transition"
              >
                FAQ
              </a>
              <a
                href="#contact"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-1.5 hover:text-black transition"
              >
                Contact
              </a>
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="font-mono text-xs font-medium text-[#1D1D1F] hover:text-black transition"
              >
                Sign In
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleGoogleSignIn();
                }}
                className="px-4 py-2 rounded-[2px] bg-black text-white font-mono text-xs font-medium"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl lg:max-w-5xl mx-auto">
          {/* High-Tech Technical Kicker */}
          <div className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#555558] bg-[#E5E5DF]/90 border border-black/[0.04] px-4 py-1.5 rounded-lg shadow-2xs mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
            <span>Marketplace Financial Audit & Reconciliation Engine</span>
          </div>

          {/* Solid Black Balanced Heading (No Blue, No Orphan Words) */}
          <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-bold tracking-tight text-[#1D1D1F] leading-[1.1] text-balance">
            Stop marketplace fee leaks. <br className="hidden sm:inline" />
            Automate your net profit.
          </h1>

          {/* Short, Punchy, Balanced Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-[#6E6E73] leading-relaxed max-w-xl mx-auto font-normal text-balance">
            Automated fee audits, weight discrepancy reconciliation, and dispute recovery for Amazon, Flipkart, and Meesho sellers.
          </p>

          {/* High-Tech Action CTAs */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 rounded-xl bg-[#18181B] hover:bg-black active:scale-[0.98] text-white font-mono text-xs sm:text-[13px] font-semibold uppercase tracking-wider border border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all cursor-pointer"
            >
              {isAuthenticating ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span className="text-neutral-400 text-xs">▸</span>
                  <span>Connect Store via Google</span>
                </>
              )}
            </button>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-xl bg-white hover:bg-[#FBFBFD] text-[#1D1D1F] font-mono text-xs sm:text-[13px] font-semibold uppercase tracking-wider border border-black/[0.1] shadow-2xs hover:border-black/[0.2] transition-all"
            >
              <span>Explore Live Cockpit</span>
              <span className="text-neutral-400">↗</span>
            </Link>
          </div>

          {/* Balanced High-Trust Badges (No Awkward Wraps) */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 font-mono text-[11px] sm:text-xs text-[#6E6E73]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#288548]" />
              <span>Amazon, Flipkart & Meesho Sync</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-[#1D1D1F]" />
              <span>100% Read-Only Security</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#288548]" />
              <span>Deterministic GAAP Ledger</span>
            </span>
          </div>
        </div>

        {/* HERO VISUAL: Apple Cockpit Financial Waterfall Mockup */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-4 sm:p-7 relative overflow-hidden">
            {/* Top Mock Window Bar */}
            <div className="flex items-center justify-between pb-5 border-b border-black/[0.05]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10" />
                <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10" />
                <span className="ml-3 text-xs font-medium text-[#86868B] hidden sm:inline">
                  MarginFlow Intelligence Engine • Multi-Channel Live Ledger
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-[#288548] border border-emerald-200/50">
                  7 Invariants Verified
                </span>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-[#0071E3] border border-blue-200/50">
                  POAS: 3.42x
                </span>
              </div>
            </div>

            {/* Interactive Metric Showcase Cards */}
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-[#F5F5F7]/70 border border-black/[0.04]">
                <p className="text-xs text-[#86868B] font-medium">Invoiced Gross Sales</p>
                <p className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F] mt-1.5 tabular-nums">
                  ₹48,24,650
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#288548] font-medium">
                  <TrendingUp className="w-3 h-3" />
                  <span>+18.4% vs last cycle</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F5F5F7]/70 border border-black/[0.04]">
                <p className="text-xs text-[#86868B] font-medium">Delivered COGS</p>
                <p className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1D1D1F] mt-1.5 tabular-nums">
                  ₹18,62,400
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#86868B]">
                  <Lock className="w-3 h-3 text-[#0071E3]" />
                  <span>Locked at order intake</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F5F5F7]/70 border border-black/[0.04]">
                <p className="text-xs text-[#86868B] font-medium">RTO & Reverse Logistics</p>
                <p className="text-xl sm:text-2xl font-semibold tracking-tight text-[#D70015] mt-1.5 tabular-nums">
                  -₹4,12,380
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#B25E00]">
                  <RotateCcw className="w-3 h-3" />
                  <span>22.6% blended RTO</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#0071E3]/30 shadow-xs">
                <p className="text-xs text-[#0071E3] font-semibold">True Net Operating Profit</p>
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F] mt-1.5 tabular-nums">
                  ₹12,41,890
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#288548] font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>25.7% True Margin</span>
                </div>
              </div>
            </div>

            {/* Financial Waterfall Visual Rail */}
            <div className="mt-6 pt-6 border-t border-black/[0.05]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <p className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                  Deterministic 4-Tier Financial Waterfall
                </p>
                <p className="text-[11px] text-[#86868B]">
                  Transaction-level precision • Zero estimation collapse
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 rounded-lg bg-[#F5F5F7] border border-black/[0.03]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Tier 1
                  </span>
                  <p className="font-medium text-[#1D1D1F] mt-0.5">Gross Sales</p>
                  <p className="text-[#86868B] text-[11px] mt-1">₹48.2L Invoiced</p>
                </div>

                <div className="p-3 rounded-lg bg-[#F5F5F7] border border-black/[0.03]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Tier 2
                  </span>
                  <p className="font-medium text-[#1D1D1F] mt-0.5">Gross Profit</p>
                  <p className="text-[#86868B] text-[11px] mt-1">₹29.6L Post-COGS</p>
                </div>

                <div className="p-3 rounded-lg bg-[#F5F5F7] border border-black/[0.03]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Tier 3
                  </span>
                  <p className="font-medium text-[#1D1D1F] mt-0.5">Contribution (CM2)</p>
                  <p className="text-[#86868B] text-[11px] mt-1">₹16.8L Post-RTO & Fees</p>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-[#288548]/20">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#288548]">
                    Tier 4
                  </span>
                  <p className="font-semibold text-[#1D1D1F] mt-0.5">Operating Profit (EBIT)</p>
                  <p className="text-[#288548] font-medium text-[11px] mt-1">₹12.4L Net Bank Cash</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THE PROBLEM SECTION - SIMPLIFIED, CARD-FREE */}
      <section id="problems" className="py-20 sm:py-28 bg-white border-y border-black/[0.06] scroll-mt-16 sm:scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-[#D70015] text-xs font-mono font-medium mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D70015]" />
              <span>The Reality of Indian E-Commerce</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1D1D1F] leading-tight">
              High sales numbers <br />
              <span className="text-[#86868B]">don&apos;t guarantee real profit.</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#86868B] leading-relaxed">
              On Amazon, Flipkart, and Meesho, sales charts look exciting. But your bank balance tells a different story. Here are the 4 main ways sellers quietly lose their hard-earned money:
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            {/* Problem 1 */}
            <div className="border-t border-black/[0.08] pt-6 group hover:border-[#D70015]/40 transition-colors duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-[#D70015] group-hover:scale-110 transition-transform duration-300">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] group-hover:text-[#D70015] transition-colors">
                    Hidden Marketplace Fees
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-rose-50 text-[#D70015] border border-rose-100 shrink-0">
                  Silent deductions
                </span>
              </div>
              <p className="mt-3 text-sm text-[#86868B] leading-relaxed">
                Platforms constantly tweak commission rates, category rules, and closing fees without a clear warning. A few rupees deducted here and there quietly eats away lakhs from your profit every single month.
              </p>
            </div>

            {/* Problem 2 */}
            <div className="border-t border-black/[0.08] pt-6 group hover:border-[#B25E00]/40 transition-colors duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-[#B25E00] group-hover:scale-110 transition-transform duration-300">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] group-hover:text-[#B25E00] transition-colors">
                    Expensive Returns & COD Cancellations
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-[#B25E00] border border-amber-100 shrink-0">
                  Courier charges both ways
                </span>
              </div>
              <p className="mt-3 text-sm text-[#86868B] leading-relaxed">
                When a customer cancels or returns a delivery, you still pay for outward courier, return shipping, and damaged packaging. In fact, just one returned order can wipe out the profit of 3 successful sales.
              </p>
            </div>

            {/* Problem 3 */}
            <div className="border-t border-black/[0.08] pt-6 group hover:border-purple-600/40 transition-colors duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform duration-300">
                    <Scale className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] group-hover:text-purple-600 transition-colors">
                    Couriers Overcharging on Weight
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
                  Billed for ghost weight
                </span>
              </div>
              <p className="mt-3 text-sm text-[#86868B] leading-relaxed">
                Logistics partners regularly bill packages at higher weight slabs (e.g. charging 1.5 kg for a 400g t-shirt). Unless you check every single order against your master catalog, you overpay thousands on shipping every week.
              </p>
            </div>

            {/* Problem 4 */}
            <div className="border-t border-black/[0.08] pt-6 group hover:border-[#0071E3]/40 transition-colors duration-300">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-[#0071E3] group-hover:scale-110 transition-transform duration-300">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors">
                    Missed Deadlines for Refund Claims
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0071E3] border border-blue-100 shrink-0">
                  Strict 7-30 day window
                </span>
              </div>
              <p className="mt-3 text-sm text-[#86868B] leading-relaxed">
                When returns arrive damaged, swapped, or empty, marketplaces only give you a brief window to claim compensation. Without automated deadline alerts, most sellers simply miss out and lose that money permanently.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE SOLUTION SECTION - SIMPLIFIED, CARD-FREE, ANIMATED */}
      <section id="solution" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-16 sm:scroll-mt-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#0071E3] text-xs font-mono font-medium mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-ping" />
            <span>How MarginFlow Solves It</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1D1D1F] leading-tight">
            Real profit clarity <br />
            <span className="text-[#86868B]">in 4 simple steps.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#86868B] leading-relaxed">
            No complex accounting degrees or broken Excel spreadsheets. MarginFlow connects directly to your seller accounts and shows you the exact cash you take home.
          </p>
        </div>

        {/* Card-free 4-Step Interactive Flow */}
        <div className="mt-16">
          {/* Step Selector Navigation (Card-free tabs with animated progress bar) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 border-b border-black/[0.08] pb-6">
            {[
              {
                num: "01",
                label: "Connect Accounts",
                headline: "Link stores in 60 seconds",
                desc: "1-click read-only connection to Amazon, Flipkart, Meesho, and Shopify. All your orders and returns sync automatically.",
                badge: "Zero Manual CSVs",
                color: "text-blue-600",
                barColor: "bg-blue-600",
              },
              {
                num: "02",
                label: "Track True Profit",
                headline: "Know profit on every order",
                desc: "We subtract exact product cost, courier charges, and platform fees so you immediately see what makes money and what loses money.",
                badge: "True Unit Margin",
                color: "text-emerald-600",
                barColor: "bg-emerald-600",
              },
              {
                num: "03",
                label: "Catch Overcharges",
                headline: "Stop courier and fee leaks",
                desc: "MarginFlow flags wrong courier weights, extra commission deductions, and expiring return disputes before you lose money.",
                badge: "Auto-Claim Recovery",
                color: "text-amber-600",
                barColor: "bg-amber-600",
              },
              {
                num: "04",
                label: "Bank Deposit Clarity",
                headline: "See exact cash in your bank",
                desc: "Know exactly how much actual cash arrives in your bank account after GST, TDS withholdings, and advertising costs.",
                badge: "CA & Tax Audit Ready",
                color: "text-purple-600",
                barColor: "bg-purple-600",
              },
            ].map((item, idx) => {
              const isActive = activeSolutionStep === idx;
              return (
                <button
                  key={item.num}
                  onClick={() => setActiveSolutionStep(idx)}
                  className="text-left group relative pb-2 transition-all duration-300 cursor-pointer focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-semibold tracking-wider transition-colors duration-300 ${
                        isActive ? item.color : "text-[#86868B] group-hover:text-[#1D1D1F]"
                      }`}
                    >
                      {item.num}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-semibold transition-colors duration-300 ${
                        isActive ? "text-[#1D1D1F]" : "text-[#86868B] group-hover:text-[#1D1D1F]"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div
                    className={`mt-3 h-[2px] w-full rounded-full transition-all duration-300 ${
                      isActive ? item.barColor : "bg-transparent group-hover:bg-black/10"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Active Step Showcase (Clean, Open, Animated - No Boxy Cards) */}
          <div className="mt-8 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column: Simple Description */}
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#0071E3] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/50">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span>
                    {activeSolutionStep === 0 && "Step 01 • Instant Sync"}
                    {activeSolutionStep === 1 && "Step 02 • True Unit Economics"}
                    {activeSolutionStep === 2 && "Step 03 • Automated Money Recovery"}
                    {activeSolutionStep === 3 && "Step 04 • Net Bank Cash"}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
                  {activeSolutionStep === 0 && "Connect your stores with zero setup hassle"}
                  {activeSolutionStep === 1 && "See real profit on every single product and order"}
                  {activeSolutionStep === 2 && "Catch courier overcharges & file claims before deadlines"}
                  {activeSolutionStep === 3 && "Know your exact bank deposit with zero surprises"}
                </h3>

                <p className="text-base text-[#86868B] leading-relaxed">
                  {activeSolutionStep === 0 &&
                    "Forget manually downloading messy CSV files every Monday. Simply connect your Amazon, Flipkart, Meesho, or Shopify store with secure, read-only API access. Your historical orders, catalog weights, return tracking, and payment fee statements sync in under a minute."}
                  {activeSolutionStep === 1 &&
                    "A product selling at ₹1,499 might actually make ₹720 or lose ₹150. MarginFlow pairs every order with your exact purchase cost (COGS), actual courier shipping, and platform commissions so you know exactly which campaigns and SKUs to double down on."}
                  {activeSolutionStep === 2 &&
                    "Courier companies often bump a 400g package into 1.5kg billing. MarginFlow cross-checks every single tracking number against your catalog dimensions. When a package is overbilled or returned damaged, MarginFlow generates the claim evidence for you before time runs out."}
                  {activeSolutionStep === 3 &&
                    "Most accounting tools only record lump sums weeks later. MarginFlow isolates statutory 1% GST TCS and 1% TDS into asset ledgers and deducts ad spend, giving you the real, untouchable bank cash ready for your personal account or business reinvestment."}
                </p>

                {/* Micro Key Points */}
                <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm font-medium text-[#1D1D1F]">
                  {activeSolutionStep === 0 && (
                    <>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> 1-Click OAuth Connect
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Read-Only Security
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Multi-Channel Sync
                      </span>
                    </>
                  )}
                  {activeSolutionStep === 1 && (
                    <>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Order-by-order profit
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> POAS (Profit on Ad Spend)
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> SKU-level profitability
                      </span>
                    </>
                  )}
                  {activeSolutionStep === 2 && (
                    <>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Courier weight audit
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Expiring SAFE-T alerts
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Damaged return evidence
                      </span>
                    </>
                  )}
                  {activeSolutionStep === 3 && (
                    <>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> Net bank deposit forecast
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> GST TCS & TDS separated
                      </span>
                      <span className="flex items-center gap-1.5 text-[#288548]">
                        <CheckCircle2 className="w-4 h-4" /> CA & audit compliant
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Dynamic Live Visual (Cardless Minimalist Layout) */}
              <div className="lg:col-span-6">
                <div className="border border-black/[0.08] rounded-2xl p-6 sm:p-8 bg-[#FBFBFD] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] text-xs font-mono text-[#86868B]">
                    <span>LIVE ENGINE PREVIEW</span>
                    <span className="flex items-center gap-1 text-[#288548]">
                      <span className="w-2 h-2 rounded-full bg-[#288548] animate-pulse" />
                      Active Verification
                    </span>
                  </div>

                  {/* Visual Example based on step */}
                  {activeSolutionStep === 0 && (
                    <div className="space-y-3 py-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white border border-black/[0.04]">
                        <span className="font-medium text-[#1D1D1F]">Amazon India SP-API</span>
                        <span className="text-[#288548] font-mono">Connected • 1,420 orders</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white border border-black/[0.04]">
                        <span className="font-medium text-[#1D1D1F]">Flipkart Seller Hub</span>
                        <span className="text-[#288548] font-mono">Connected • 890 orders</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-white border border-black/[0.04]">
                        <span className="font-medium text-[#1D1D1F]">Meesho Supplier API</span>
                        <span className="text-[#288548] font-mono">Connected • 640 orders</span>
                      </div>
                      <p className="text-[11px] font-mono text-[#86868B] pt-1">
                        All channels automatically synchronized into unified INR currency.
                      </p>
                    </div>
                  )}

                  {activeSolutionStep === 1 && (
                    <div className="space-y-2.5 py-1 animate-in fade-in duration-200">
                      <div className="flex justify-between text-xs py-1.5 border-b border-black/[0.04]">
                        <span className="text-[#86868B]">Customer Selling Price</span>
                        <span className="font-semibold text-[#1D1D1F]">₹1,499</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-black/[0.04]">
                        <span className="text-[#86868B]">Product Purchase Cost (COGS)</span>
                        <span className="font-semibold text-[#D70015]">− ₹420</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-black/[0.04]">
                        <span className="text-[#86868B]">Courier Freight + Marketplace Fees</span>
                        <span className="font-semibold text-[#D70015]">− ₹315</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-black/[0.04]">
                        <span className="text-[#86868B]">Taxes (GST & Section 194-O TDS)</span>
                        <span className="font-semibold text-[#D70015]">− ₹44</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 font-bold text-[#288548]">
                        <span>Real Bank Profit (Per Unit)</span>
                        <span className="font-mono text-base">+ ₹720</span>
                      </div>
                    </div>
                  )}

                  {activeSolutionStep === 2 && (
                    <div className="space-y-3 py-2 animate-in fade-in duration-200">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                        <div className="flex items-center justify-between font-semibold text-[#B25E00]">
                          <span>Courier Overcharge Detected</span>
                          <span className="font-mono">+₹185 Discrepancy</span>
                        </div>
                        <p className="text-[11px] text-[#B25E00]/80 mt-1">
                          AWB 7892110: Billed for 1.5 kg. Catalog verified weight is 420g. Dispute ticket generated.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                        <div className="flex items-center justify-between font-semibold text-[#0071E3]">
                          <span>SAFE-T Claim Deadline Alert</span>
                          <span className="font-mono">4 Days Remaining</span>
                        </div>
                        <p className="text-[11px] text-[#0071E3]/80 mt-1">
                          Damaged return order #408-921: ₹640 compensation packet pre-compiled with photo checklist.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeSolutionStep === 3 && (
                    <div className="space-y-3 py-2 animate-in fade-in duration-200">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#288548]">Net Payout to Bank (Next Cycle)</span>
                          <span className="text-xl font-bold font-mono text-[#288548]">₹12,42,850</span>
                        </div>
                        <p className="text-[11px] text-[#288548]/80 mt-1.5">
                          ✓ Exactly matches your bank deposit line item with zero unreconciled gaps.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 font-mono">
                        <span>GST TCS (1%): ₹14,200 (Asset)</span>
                        <span>194-O TDS (1%): ₹14,200 (Asset)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Simple Cardless Call-to-Action Strip */}
          <div className="mt-12 pt-8 border-t border-black/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-base sm:text-lg font-semibold text-[#1D1D1F]">
                Stop guessing your margins. See your real bank numbers today.
              </h4>
              <p className="text-xs sm:text-sm text-[#86868B] mt-0.5">
                Takes 60 seconds to link your accounts. 100% read-only and bank-secure.
              </p>
            </div>
            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black hover:bg-neutral-800 active:scale-[0.98] text-white text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer"
            >
              <span>{isAuthenticating ? "Connecting..." : "Get Started with Google"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. CORE CAPABILITIES SECTION */}
      <section id="features" className="py-20 sm:py-28 bg-white border-y border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
              Engineered for Operations & Finance
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#1D1D1F]">
              Everything You Need to Protect Your Margin.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#86868B]">
              Built ground-up for the operational realities of Indian multi-channel commerce.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-7 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] hover:border-black/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#0071E3] mb-5">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Dual-Mode Dashboard: Operator vs CFO
              </h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Toggle seamlessly between operational cash flow (bank deposits, pending RTOs, daily
                dispatches) and GAAP financial waterfall statements.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-7 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] hover:border-black/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-[#B25E00] mb-5">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                3+1 Reverse Logistics Classification
              </h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Categorize returns into Customer Returns, RTO Undelivered, and Aging Returns. 1-click
                restock putaways preserve sellable inventory valuation automatically.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-7 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] hover:border-black/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-[#D70015] mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                SAFE-T & Dispute Recovery Cockpit
              </h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Track every damaged package, generate structured claim packets with tracking and cost
                evidence, and monitor reimbursement payouts directly to your bank ledger.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-7 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] hover:border-black/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-[#288548] mb-5">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Settlement Aging Pipeline
              </h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Segment pending marketplace remittances by SLA cohorts (0–7 days, 8–14 days, &gt;14
                days) to predict working capital gaps and catch delayed marketplace deposits.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-7 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] hover:border-black/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 mb-5">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                HITL AI Document Quarantine Sandbox
              </h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Upload supplier purchase bills and PDFs. Line items are quarantined in a review
                sandbox where arithmetic invariants are verified before mutating your inventory ledger.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-7 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] hover:border-black/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 mb-5">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                POAS Ad Attribution Engine
              </h3>
              <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
                Calculate Profit on Ad Spend (Contribution Margin / Ad Spend) for every marketing
                campaign, preventing performance teams from scaling loss-making, high-return SKUs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. INTEGRATED CHANNELS */}
      <section id="channels" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
            Ecosystem Connectivity
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#1D1D1F]">
            Unified Across All Major Indian Channels
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#86868B]">
            One single audited ledger connecting your marketplace seller accounts and D2C storefronts.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: "Amazon India", type: "SP-API / Easy Ship" },
            { name: "Flipkart", type: "FBF & Smart" },
            { name: "Meesho", type: "Logistics Sync" },
            { name: "Myntra", type: "Omnichannel" },
            { name: "Shopify", type: "Direct Webhooks" },
            { name: "WooCommerce", type: "REST API" },
          ].map((channel, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white border border-black/[0.06] text-center shadow-2xs hover:border-black/[0.15] transition-all"
            >
              <p className="font-semibold text-sm sm:text-base text-[#1D1D1F]">{channel.name}</p>
              <p className="mt-1 text-[11px] text-[#86868B]">{channel.type}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <section id="faq" className="py-20 sm:py-28 bg-white border-y border-black/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
              Frequently Asked Questions
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#1D1D1F]">
              Clear Answers for Pragmatic Operators
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#86868B]">
              Everything you need to know about MarginFlow architecture, data security, and accounting precision.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#1D1D1F] hover:text-[#0071E3] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <span className="shrink-0 text-[#86868B]">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-[#86868B] leading-relaxed border-t border-black/[0.03]">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. CONTACT & CONSULTATION SECTION */}
      <section id="contact" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.04)] p-8 sm:p-12 lg:p-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left Column: Direct Info */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
                  Get In Touch
                </span>
                <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#1D1D1F]">
                  Speak With Our E-Commerce Financial Specialists
                </h2>
                <p className="mt-4 text-sm sm:text-base text-[#86868B] leading-relaxed">
                  Whether you are scaling ₹50L or ₹100 Crore+ across marketplaces, we will help you
                  audit your historical fee leakages and set up your deterministic profit engine.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F] shrink-0 mt-0.5">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#86868B]">Email Inquiries</p>
                      <a
                        href="mailto:contact@marginflow.io"
                        className="text-sm font-semibold text-[#1D1D1F] hover:text-[#0071E3] transition-colors"
                      >
                        contact@marginflow.io
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] flex items-center justify-center text-[#1D1D1F] shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#86868B]">Headquarters</p>
                      <p className="text-sm font-semibold text-[#1D1D1F]">
                        Bengaluru, Karnataka, India
                      </p>
                    </div>
                  </div>
                </div>

                {/* Instant Google Login Callout */}
                <div className="mt-10 p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.05]">
                  <p className="text-xs font-semibold text-[#1D1D1F]">
                    Prefer to start exploring immediately?
                  </p>
                  <p className="mt-1 text-xs text-[#86868B]">
                    Sign in with Google to enter your live dashboard with pre-loaded audit data.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isAuthenticating}
                    className="mt-3.5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-[#FBFBFD] text-xs font-medium text-[#1D1D1F] border border-black/[0.1] shadow-2xs transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Enter via Google</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Contact Form */}
              <div>
                {contactSubmitted ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[#F5F5F7] rounded-2xl border border-black/[0.05]">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#288548] mb-4">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#1D1D1F]">
                      Inquiry Received
                    </h3>
                    <p className="mt-2 text-sm text-[#86868B] max-w-sm">
                      Thank you for reaching out. An e-commerce financial specialist will contact you
                      within 24 business hours to review your platform setup.
                    </p>
                    <button
                      onClick={() => setContactSubmitted(false)}
                      className="mt-6 text-xs text-[#0071E3] font-medium hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Rohan Sharma"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="rohan@brand.in"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                          Monthly GMV Volume
                        </label>
                        <select
                          value={contactForm.monthlyGmv}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, monthlyGmv: e.target.value })
                          }
                          className="w-full px-3 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-sm text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] transition-colors cursor-pointer"
                        >
                          <option>Under ₹25 Lakhs</option>
                          <option>₹25L - ₹1 Crore</option>
                          <option>₹1 Crore - ₹5 Crores</option>
                          <option>₹5 Crores+</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                          Primary Channels
                        </label>
                        <select
                          value={contactForm.channel}
                          onChange={(e) =>
                            setContactForm({ ...contactForm, channel: e.target.value })
                          }
                          className="w-full px-3 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-sm text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] transition-colors cursor-pointer"
                        >
                          <option>Amazon + Flipkart</option>
                          <option>Meesho Focused</option>
                          <option>D2C (Shopify / Woo)</option>
                          <option>Omnichannel All 4</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                        Specific Questions or Margin Challenges
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Tell us about your current return rate, fee auditing concerns, or questions..."
                        value={contactForm.message}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, message: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.08] text-sm text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium transition-colors shadow-2xs cursor-pointer"
                    >
                      Request Financial Audit Consultation
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. MINIMALIST APPLE FOOTER */}
      <footer className="bg-white border-t border-black/[0.06] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image
              src="/margin-flow-icon.png"
              alt="MarginFlow"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <span className="font-semibold text-sm tracking-tight text-[#1D1D1F]">
              MarginFlow
            </span>
            <span className="text-xs text-[#86868B]">
              • Unified E-Commerce Financial Intelligence
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#86868B]">
            <a href="#problems" className="hover:text-[#1D1D1F] transition-colors">
              The Problem
            </a>
            <a href="#solution" className="hover:text-[#1D1D1F] transition-colors">
              Waterfall
            </a>
            <a href="#features" className="hover:text-[#1D1D1F] transition-colors">
              Features
            </a>
            <a href="#faq" className="hover:text-[#1D1D1F] transition-colors">
              FAQ
            </a>
            <a href="#contact" className="hover:text-[#1D1D1F] transition-colors">
              Contact
            </a>
            <Link href="/login" className="hover:text-[#1D1D1F] transition-colors">
              Google Login
            </Link>
          </div>

          <p className="text-xs text-[#86868B]">
            © {new Date().getFullYear()} MarginFlow Technologies. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
