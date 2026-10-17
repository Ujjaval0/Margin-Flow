"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Phone,
  ChevronRight,
} from "lucide-react";

const validatePhoneNumber = (value: string) => {
  if (!value.trim()) return "Phone number is required.";
  if (!/^\d{10}$/.test(value)) return "Enter exactly 10 digits for your Indian mobile number.";
  return "";
};

interface OnboardingData {
  brandName: string;
  phone: string;
  businessRole: string;
  customBusinessRole: string;
  orderVolume: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [userName, setUserName] = useState<string>("");
  const [isFinishing, setIsFinishing] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [formData, setFormData] = useState<OnboardingData>({
    brandName: "",
    phone: "",
    businessRole: "FOUNDER",
    customBusinessRole: "",
    orderVolume: "GROWTH",
  });

  // Load onboarding identity from the server-verified Supabase session.
  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.user) return;
        setUserName(data.user.name || "");
        if (data.user.phone) {
          setFormData((prev) => ({ ...prev, phone: data.user.phone }));
        }
        if (data.user.companyName && data.user.companyName !== "My Company") {
          setFormData((prev) => ({ ...prev, brandName: data.user.companyName }));
        }
        localStorage.setItem("marginflow_session", JSON.stringify(data.user));
      })
      .catch(() => undefined);
  }, []);

  const handleNext = () => {
    setSubmitError(null);
    if (currentStep === 1) {
      if (!formData.brandName.trim()) {
        setSubmitError("Enter your brand or company name to continue.");
        return;
      }
      const phoneValidationError = validatePhoneNumber(formData.phone);
      if (phoneValidationError) {
        setPhoneTouched(true);
        return;
      }
    }
    if (currentStep === 2 && formData.businessRole === "OTHER" && !formData.customBusinessRole.trim()) {
      setSubmitError("Enter your role to continue.");
      return;
    }
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

  const handleComplete = async () => {
    setIsFinishing(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/auth/onboarding", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: formData.brandName.trim(),
          phone: formData.phone.trim(),
          businessRole: formData.businessRole,
          customBusinessRole: formData.customBusinessRole.trim(),
          orderVolume: formData.orderVolume,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your onboarding details.");

      const raw = localStorage.getItem("marginflow_session");
      const session = raw ? JSON.parse(raw) : {};
      localStorage.setItem("marginflow_session", JSON.stringify({
        ...session,
        companyName: formData.brandName.trim(),
        phone: formData.phone.trim(),
        onboardingPreferences: result.onboardingPreferences,
      }));
      localStorage.setItem("marginflow_onboarding_completed", "true");

      router.push("/dashboard");
    } catch {
      setSubmitError("We couldn’t save your onboarding details. Please try again.");
      setIsFinishing(false);
    }
  };

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

          {/* STEP 1: Profile & Identity */}
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

              <div className="mb-6">
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-2">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868B]" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    onBlur={() => setPhoneTouched(true)}
                    placeholder="10-digit mobile number"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    required
                    disabled={isFinishing}
                    aria-invalid={Boolean(phoneTouched && validatePhoneNumber(formData.phone))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/50 text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
                  />
                </div>
                <p className={`mt-1.5 text-[11px] ${phoneTouched && validatePhoneNumber(formData.phone) ? "text-red-600" : "text-[#86868B]"}`}>
                  {phoneTouched && validatePhoneNumber(formData.phone)
                    ? validatePhoneNumber(formData.phone)
                    : "Enter exactly 10 digits; do not include the +91 country code."}
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

            </div>
          )}

          {/* STEP 2: Business Role */}
          {currentStep === 2 && (
            <div>
              <div className="mb-6">
                <span className="text-[11px] font-semibold tracking-wider text-[#0071E3] uppercase">
                  Step 2 • Your Role
                </span>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-1">
                  What best describes you?
                </h1>
                <p className="mt-1.5 text-sm text-[#86868B]">
                  Choose a role or enter your own.
                </p>
              </div>

              <label className="block text-xs font-semibold text-[#1D1D1F] mb-2" htmlFor="business-role">
                Primary operating role
              </label>
              <select
                id="business-role"
                value={formData.businessRole}
                onChange={(e) => setFormData((prev) => ({ ...prev, businessRole: e.target.value }))}
                disabled={isFinishing}
                className="w-full px-3.5 py-3 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/50 text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
              >
                <option value="FOUNDER">Founder / Business Owner</option>
                <option value="STUDENT">Student</option>
                <option value="OPERATIONS_FINANCE">E-commerce / Finance Manager</option>
                <option value="SUPPLIER_MANUFACTURER">Manufacturer / Supplier</option>
                <option value="AGENCY_CONSULTANT">Agency Owner / Consultant</option>
                <option value="OTHER">Other — enter your role</option>
              </select>
              {formData.businessRole === "OTHER" && (
                <input
                  type="text"
                  value={formData.customBusinessRole}
                  onChange={(e) => setFormData((prev) => ({ ...prev, customBusinessRole: e.target.value }))}
                  placeholder="Enter your role"
                  maxLength={100}
                  disabled={isFinishing}
                  className="mt-3 w-full px-3.5 py-3 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/50 text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
                />
              )}
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
                  About how many orders do you process each month?
                </h1>
                <p className="mt-1.5 text-sm text-[#86868B]">
                  This helps us tailor your dashboard.
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
          {submitError && (
            <p role="alert" className="mt-3 text-xs text-red-600 text-right">{submitError}</p>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-[#86868B]">
          You can update your details anytime in Settings.
        </p>
      </div>
    </div>
  );
}
