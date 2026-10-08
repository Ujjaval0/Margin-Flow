"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Building2,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Store,
  Layers,
  ChevronRight,
  Briefcase,
  BarChart3,
  Factory,
  Users,
} from "lucide-react";

interface OnboardingData {
  brandName: string;
  businessRole: string;
  channels: string[];
  orderVolume: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [userName, setUserName] = useState<string>("");
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  const [formData, setFormData] = useState<OnboardingData>({
    brandName: "",
    businessRole: "FOUNDER",
    channels: ["AMAZON", "FLIPKART"],
    orderVolume: "GROWTH",
  });

  // Rehydrate existing user name from active session
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("marginflow_session");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name) setUserName(parsed.name);
          if (parsed?.companyName && parsed.companyName !== "My Company") {
            setFormData((prev) => ({ ...prev, brandName: parsed.companyName }));
          }
        }
      }
    } catch {
      // storage fallback
    }
  }, []);

  const toggleChannel = (channelKey: string) => {
    setFormData((prev) => {
      const exists = prev.channels.includes(channelKey);
      if (exists) {
        if (prev.channels.length === 1) return prev; // keep at least one
        return { ...prev, channels: prev.channels.filter((c) => c !== channelKey) };
      } else {
        return { ...prev, channels: [...prev.channels, channelKey] };
      }
    });
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsFinishing(true);

    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("marginflow_session");
        let session = raw ? JSON.parse(raw) : {};
        session = {
          ...session,
          companyName: formData.brandName.trim() || session.companyName || "My Brand",
          onboardingPreferences: {
            role: formData.businessRole,
            channels: formData.channels,
            volume: formData.orderVolume,
            completedAt: new Date().toISOString(),
          },
        };
        localStorage.setItem("marginflow_session", JSON.stringify(session));
        localStorage.setItem("marginflow_onboarding_completed", "true");
      }
    } catch {
      // ignore
    }

    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const roles = [
    {
      id: "FOUNDER",
      title: "Founder / Business Owner",
      desc: "Executive visibility over true net profit & cash flow",
      icon: Briefcase,
    },
    {
      id: "OPERATIONS_FINANCE",
      title: "E-Commerce / Finance Manager",
      desc: "Order reconciliation, marketplace deductions & margins",
      icon: BarChart3,
    },
    {
      id: "SUPPLIER_MANUFACTURER",
      title: "Manufacturer / Supplier",
      desc: "B2B wholesale ledger, billing & inventory costs",
      icon: Factory,
    },
    {
      id: "AGENCY_CONSULTANT",
      title: "Agency / CA / Consultant",
      desc: "Multi-brand client profitability & tax audit trail",
      icon: Users,
    },
  ];

  const channelOptions = [
    { id: "AMAZON", name: "Amazon India", badge: "FBA / Easy Ship" },
    { id: "FLIPKART", name: "Flipkart", badge: "FBF / Seller" },
    { id: "MEESHO", name: "Meesho", badge: "Zero Commission" },
    { id: "SHOPIFY", name: "Shopify / D2C", badge: "Web Store" },
    { id: "QUICK_COMMERCE", name: "Quick Commerce", badge: "Blinkit / Zepto / Instamart" },
    { id: "OFFLINE_B2B", name: "Offline Wholesale", badge: "B2B Trade" },
  ];

  const volumes = [
    {
      id: "STARTER",
      label: "Under 500 orders / mo",
      sub: "Starter • Manual sync & baseline auditing",
    },
    {
      id: "GROWTH",
      label: "500 – 5,000 orders / mo",
      sub: "Growth • Multi-channel automated reconciliation",
    },
    {
      id: "SCALE",
      label: "5,000 – 25,000 orders / mo",
      sub: "Scale • High-frequency dispute & returns engine",
    },
    {
      id: "ENTERPRISE",
      label: "25,000+ orders / mo",
      sub: "Enterprise • High-volume data pipeline & ledger",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Login</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-medium text-[#86868B] bg-white px-3.5 py-1.5 rounded-full border border-black/[0.06] shadow-apple-sm">
          <span>Step {currentStep} of 3</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full mx-auto my-auto py-8">
        <div className="apple-card bg-white rounded-3xl border border-black/[0.08] shadow-apple-lg p-6 sm:p-10 relative overflow-hidden">
          {/* Subtle Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-black/[0.04]">
            <div
              className="h-full bg-[#0071E3] transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>

          {/* STEP 1: Brand & Role */}
          {currentStep === 1 && (
            <div>
              <div className="mb-6">
                <span className="text-[11px] font-semibold tracking-wider text-[#0071E3] uppercase">
                  Step 1 • Profile & Identity
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-1">
                  {userName ? `Welcome, ${userName}` : "Welcome to MarginFlow"}
                </h1>
                <p className="mt-1.5 text-sm text-[#86868B]">
                  Tell us a bit about your business to personalize your financial intelligence dashboard.
                </p>
              </div>

              {/* Brand Name Input */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-2">
                  Brand or Company Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
                  <input
                    type="text"
                    value={formData.brandName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, brandName: e.target.value }))
                    }
                    placeholder="e.g. Acme Lifestyle Co."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/50 text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-2.5">
                  What is your primary operating role?
                </label>
                <div className="space-y-2">
                  {roles.map((r) => {
                    const isSelected = formData.businessRole === r.id;
                    const IconComponent = r.icon;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, businessRole: r.id }))
                        }
                        className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#0071E3]/[0.04] border-[#0071E3] shadow-apple-sm"
                            : "bg-white hover:bg-[#F5F5F7]/60 border-black/[0.08]"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? "bg-[#0071E3]/10 text-[#0071E3]"
                              : "bg-black/[0.04] text-[#86868B]"
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[#1D1D1F]">
                            {r.title}
                          </div>
                          <div className="text-xs text-[#86868B] mt-0.5">{r.desc}</div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? "bg-[#0071E3] border-[#0071E3] text-white"
                              : "border-black/[0.15]"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Sales Channels */}
          {currentStep === 2 && (
            <div>
              <div className="mb-6">
                <span className="text-[11px] font-semibold tracking-wider text-[#0071E3] uppercase">
                  Step 2 • Sales Channels
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-1">
                  Where do you sell?
                </h1>
                <p className="mt-1.5 text-sm text-[#86868B]">
                  Select all active sales channels. MarginFlow will pre-configure fee schedules and reconciliation filters.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {channelOptions.map((c) => {
                  const isSelected = formData.channels.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleChannel(c.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                        isSelected
                          ? "bg-[#0071E3]/[0.05] border-[#0071E3] shadow-apple-sm"
                          : "bg-white hover:bg-[#F5F5F7]/60 border-black/[0.08]"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#1D1D1F]">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-[#86868B] mt-0.5">{c.badge}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-[#0071E3] border-[#0071E3] text-white"
                            : "border-black/[0.2]"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-[#86868B] mt-4 text-center">
                You can easily connect or modify channels at any time inside Settings.
              </p>
            </div>
          )}

          {/* STEP 3: Order Volume */}
          {currentStep === 3 && (
            <div>
              <div className="mb-6">
                <span className="text-[11px] font-semibold tracking-wider text-[#0071E3] uppercase">
                  Step 3 • Business Scale
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-1">
                  What is your monthly volume?
                </h1>
                <p className="mt-1.5 text-sm text-[#86868B]">
                  Helps us calibrate anomaly detection sensitivity and automated ledger processing.
                </p>
              </div>

              <div className="space-y-2.5">
                {volumes.map((v) => {
                  const isSelected = formData.orderVolume === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, orderVolume: v.id }))
                      }
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-[#0071E3]/[0.04] border-[#0071E3] shadow-apple-sm"
                          : "bg-white hover:bg-[#F5F5F7]/60 border-black/[0.08]"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#1D1D1F]">
                          {v.label}
                        </div>
                        <div className="text-xs text-[#86868B] mt-0.5">{v.sub}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-[#0071E3] border-[#0071E3] text-white"
                            : "border-black/[0.15]"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="mt-8 pt-6 border-t border-black/[0.06] flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isFinishing}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>Back</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={isFinishing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062C4] text-white text-xs font-semibold shadow-apple-sm btn-press transition-all cursor-pointer disabled:opacity-70"
            >
              {isFinishing ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Configuring Dashboard...</span>
                </div>
              ) : currentStep < 3 ? (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Go to Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footnote */}
        <p className="mt-5 text-center text-xs text-[#86868B]">
          You can refine channels, product SKUs, and billing suppliers inside Settings anytime.
        </p>
      </div>

      {/* Footer Branding */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-[#86868B]">
        MarginFlow Technologies India • Financial Intelligence for Modern E-Commerce
      </div>
    </div>
  );
}
