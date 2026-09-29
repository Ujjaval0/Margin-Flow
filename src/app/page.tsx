"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import { HeroApparatus } from "@/components/landing/hero-apparatus";
import { HairlineLeakGrid } from "@/components/landing/hairline-leak-grid";
import { AlternatingEngines } from "@/components/landing/alternating-engines";
import { GlowingSpectrum } from "@/components/landing/glowing-spectrum";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Mail,
  Building2,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    monthlyGmv: "₹25L - ₹1 Crore",
    channel: "Amazon + Flipkart",
    message: "",
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      question: "How is MarginFlow different from Tally, Zoho, or Seller Central?",
      answer:
        "Seller Central reports only show gross sales without factoring in true unit purchase costs, dead weight penalties, or damaged returns. Traditional tools like Tally record lump-sum bank deposits weeks later without order-level attribution. MarginFlow reconciles every transaction in real time: auditing courier freight, computing true profit per SKU, and tracking expiring dispute deadlines so you keep what you earn.",
    },
    {
      question: "How does automated courier weight reconciliation work?",
      answer:
        "Couriers frequently bill packages at higher dead or volumetric weight slabs (e.g. charging 1.5 kg for a 400g t-shirt). MarginFlow compares each order's billed courier freight weight against your master catalog dimensions, automatically flagging discrepancies and compiling claim tickets before settlement payouts lock in.",
    },
    {
      question: "Why is ROAS misleading and how does POAS fix it?",
      answer:
        "Return on Ad Spend (ROAS) divides gross sales by ad spend, completely ignoring returns, courier freight, and platform fees. A campaign with 4x ROAS can still lose money if returns are high. Profit on Ad Spend (POAS) divides actual net profit (after deducting product COGS, logistics, and commissions) by ad spend—ensuring you only scale campaigns that generate positive bank cash.",
    },
    {
      question: "How does the dispute and claim recovery system work?",
      answer:
        "When customer returns or RTO shipments arrive damaged, swapped, or empty, marketplaces only allow strict 7-to-30 day dispute windows (such as Amazon SAFE-T or Flipkart seller claims). MarginFlow tracks these countdowns, automatically compiles order cost snapshots, tracking numbers, and photo evidence checklists, and tracks recovered refunds directly into your bank ledger.",
    },
    {
      question: "How does MarginFlow handle GST TCS and Section 194-O TDS?",
      answer:
        "Indian marketplaces deduct 1% GST TCS and 1% Section 194-O TDS at source. A common mistake is classifying these withholdings as operating expenses. MarginFlow properly classifies them as balance-sheet tax withholding assets, keeping your net operating margin clean, accurate, and ready for your chartered accountant.",
    },
    {
      question: "How do I connect my store and get started?",
      answer:
        "Access is immediate through Google single sign-on. You can connect your Amazon India, Flipkart, Meesho, or Shopify stores in under 60 seconds via secure, 100% read-only API access.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#121214] selection:bg-[#121214] selection:text-white font-sans antialiased">
      
      {/* 1. EDITORIAL MINIMAL NAVBAR (Aintrum style) */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "backdrop-blur-md bg-[#FAF7F2]/90 border-b border-black/[0.06]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <MarginFlowLogo className="h-6 sm:h-7 w-auto text-[#121214]" />
          </Link>

          {/* Minimal Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#736F66]">
            <a href="#problems" className="hover:text-[#121214] transition-colors">
              The Reality
            </a>
            <a href="#engines" className="hover:text-[#121214] transition-colors">
              Engines
            </a>
            <a href="#spectrum" className="hover:text-[#121214] transition-colors">
              Cash Spectrum
            </a>
            <Link href="/dashboard" className="hover:text-[#121214] transition-colors">
              Cockpit
            </Link>
            <a href="#faq" className="hover:text-[#121214] transition-colors">
              FAQ
            </a>
            <a href="#contact" className="hover:text-[#121214] transition-colors">
              Contact
            </a>
          </nav>

          {/* Right Action: Clean Rounded Pills */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden sm:inline-block text-sm font-medium text-[#121214] hover:opacity-75 transition-opacity px-3 py-2"
            >
              Sign In
            </Link>

            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="px-5 py-2.5 rounded-full bg-[#121214] hover:bg-black active:scale-95 text-white text-sm font-medium transition-all shadow-sm cursor-pointer"
            >
              {isAuthenticating ? "Connecting..." : "Get Started"}
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-[#121214]"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#FAF7F2] border-b border-black/[0.08] px-6 py-6 space-y-4">
            <div className="flex flex-col space-y-3 text-base font-medium text-[#736F66]">
              <a href="#problems" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#121214]">
                The Reality
              </a>
              <a href="#engines" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#121214]">
                Engines
              </a>
              <a href="#spectrum" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#121214]">
                Cash Spectrum
              </a>
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#121214]">
                Cockpit
              </Link>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#121214]">
                FAQ
              </a>
              <a href="#contact" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-[#121214]">
                Contact
              </a>
            </div>
            <div className="pt-4 border-t border-black/[0.08] flex items-center justify-between">
              <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium text-[#121214]">
                Sign In
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleGoogleSignIn();
                }}
                className="px-5 py-2 rounded-full bg-[#121214] text-white text-sm font-medium"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. THE HERO (True Aintrum Style - Image 1: Split Screen with Free-Flowing Vector Apparatus) */}
      <section className="pt-10 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Bold Display Typography */}
          <div className="lg:col-span-5 space-y-6">
            <h1 className="text-5xl sm:text-6xl lg:text-[72px] font-bold tracking-[-0.035em] text-[#121214] leading-[1.03]">
              The profit engine for modern commerce.
            </h1>

            <p className="text-lg sm:text-xl text-[#736F66] leading-relaxed max-w-md font-normal">
              Automated fee audits, volumetric weight reconciliation, and dispute claim recovery for marketplace sellers.
            </p>

            {/* Pill CTAs (Image 1 style) */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="px-7 py-3.5 rounded-full bg-[#121214] hover:bg-black active:scale-95 text-white text-sm font-semibold tracking-tight shadow-sm transition-all cursor-pointer text-center"
              >
                {isAuthenticating ? "Connecting..." : "Started now"}
              </button>

              <Link
                href="/dashboard"
                className="px-7 py-3.5 rounded-full bg-white hover:bg-[#F2EFE8] text-[#121214] text-sm font-semibold tracking-tight border border-black/10 transition-all text-center"
              >
                See How It Works ↗
              </Link>
            </div>

            {/* Integration Text Row */}
            <div className="pt-6 border-t border-black/[0.08] flex items-center gap-4 text-xs font-mono text-[#736F66]">
              <span>SYNC CHANNELS:</span>
              <span className="text-[#121214] font-semibold">Amazon SP-API</span>
              <span>•</span>
              <span className="text-[#121214] font-semibold">Flipkart</span>
              <span>•</span>
              <span className="text-[#121214] font-semibold">Meesho</span>
              <span>•</span>
              <span className="text-[#121214] font-semibold">Shopify</span>
            </div>
          </div>

          {/* Right Column: The Free-Flowing Vector Apparatus (Sitting directly on canvas, Aintrum style) */}
          <div className="lg:col-span-7 flex items-center justify-center">
            <HeroApparatus />
          </div>

        </div>
      </section>

      {/* 3. THE 4-QUADRANT HAIRLINE LEAK GRID (Digital Swift & Medusa style - Image 2 & 4) */}
      <div id="problems">
        <HairlineLeakGrid />
      </div>

      {/* 4. THE 3 CORE ENGINES (Alternating Medusa style - Image 4) */}
      <div id="engines">
        <AlternatingEngines />
      </div>

      {/* 5. THE CASH RETENTION SPECTRUM (Image 5 style) */}
      <div id="spectrum">
        <GlowingSpectrum />
      </div>

      {/* 6. FAQ (Direct & Unadorned) */}
      <section id="faq" className="border-t border-black/[0.08] bg-white py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0055FF] mb-3">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214]">
              Clear answers for marketplace operators.
            </h2>
          </div>

          <div className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="py-6">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-[#121214] hover:text-[#0055FF] transition-colors cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <span className="shrink-0 text-[#736F66]">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pt-4 text-sm sm:text-base text-[#736F66] leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. CONTACT & CONSULTATION */}
      <section id="contact" className="border-t border-black/[0.08] bg-[#FAF7F2] py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            
            <div className="space-y-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0055FF]">
                Consultation
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#121214] leading-tight">
                Audit your historical marketplace fee leaks.
              </h2>
              <p className="text-base text-[#736F66] leading-relaxed">
                Whether you process ₹25L or ₹50 Crore annually, our team will review your past 90 days of settlement reports and quantify recoverable funds.
              </p>

              <div className="pt-4 space-y-3 text-sm text-[#736F66]">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#121214]" />
                  <a href="mailto:contact@marginflow.io" className="text-[#121214] font-semibold hover:underline">
                    contact@marginflow.io
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-[#121214]" />
                  <span>Bengaluru, Karnataka, India</span>
                </div>
              </div>
            </div>

            {/* Direct Form */}
            <div className="bg-white p-8 rounded-2xl border border-black/[0.08]">
              {contactSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#129E52] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#121214]">Inquiry Received</h3>
                  <p className="text-sm text-[#736F66]">
                    Our financial specialist will review your store details and contact you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#121214] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Rohan Sharma"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF7F2] border border-black/[0.08] text-sm text-[#121214] focus:outline-none focus:border-[#0055FF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#121214] mb-1">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="rohan@brand.in"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF7F2] border border-black/[0.08] text-sm text-[#121214] focus:outline-none focus:border-[#0055FF]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#121214] mb-1">
                        Monthly GMV
                      </label>
                      <select
                        value={contactForm.monthlyGmv}
                        onChange={(e) => setContactForm({ ...contactForm, monthlyGmv: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#FAF7F2] border border-black/[0.08] text-sm text-[#121214] focus:outline-none focus:border-[#0055FF]"
                      >
                        <option>Under ₹25L</option>
                        <option>₹25L - ₹1 Cr</option>
                        <option>₹1 Cr - ₹5 Cr</option>
                        <option>₹5 Cr+</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#121214] mb-1">
                        Primary Channel
                      </label>
                      <select
                        value={contactForm.channel}
                        onChange={(e) => setContactForm({ ...contactForm, channel: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#FAF7F2] border border-black/[0.08] text-sm text-[#121214] focus:outline-none focus:border-[#0055FF]"
                      >
                        <option>Amazon + Flipkart</option>
                        <option>Meesho</option>
                        <option>Shopify D2C</option>
                        <option>Omnichannel</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-full bg-[#121214] hover:bg-black text-white text-sm font-semibold transition-all cursor-pointer mt-2"
                  >
                    Request Free Fee Audit
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* SIMPLE REFINED FOOTER */}
      <footer className="border-t border-black/[0.08] bg-[#FAF7F2] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo & Product Name */}
          <Link href="/" className="flex items-center gap-2.5">
            <MarginFlowLogo className="h-6 w-auto text-[#121214]" />
          </Link>

          {/* Clean Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm font-medium text-[#736F66]">
            <a href="#problems" className="hover:text-[#121214] transition-colors">
              The Reality
            </a>
            <a href="#engines" className="hover:text-[#121214] transition-colors">
              Engines
            </a>
            <a href="#spectrum" className="hover:text-[#121214] transition-colors">
              Spectrum
            </a>
            <a href="#faq" className="hover:text-[#121214] transition-colors">
              FAQ
            </a>
            <Link href="/dashboard" className="hover:text-[#121214] transition-colors">
              Cockpit ↗
            </Link>
            <Link href="/login" className="hover:text-[#121214] transition-colors">
              Sign In
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-[#736F66]">
            © {new Date().getFullYear()} MarginFlow Technologies
          </p>
        </div>
      </footer>

    </div>
  );
}
