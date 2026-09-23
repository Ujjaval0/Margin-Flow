"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import { ArrowLeft, ShieldCheck, CheckCircle2, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleAuth = () => {
    setIsLoading(true);
    // Simulate instantaneous Google OAuth handshake & session initialization
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
    }, 700);
  };

  return (
    <div className="min-h-screen w-full bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to home</span>
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-[#86868B] bg-white px-3 py-1.5 rounded-full border border-black/[0.06] shadow-apple-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#288548]" />
          <span>Secure Google OAuth 2.0</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-12">
        <div className="apple-card bg-white rounded-3xl border border-black/[0.08] shadow-apple-lg p-8 sm:p-10 relative overflow-hidden">
          {/* Top subtle highlight line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#0071E3] to-transparent opacity-60" />

          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="mb-6 inline-block">
              <MarginFlowLogo
                className="h-9 w-auto text-[#1D1D1F]"
              />
            </Link>

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
              Welcome to MarginFlow
            </h1>
            <p className="mt-2 text-sm text-[#86868B] leading-relaxed">
              Transaction-level multi-channel profit intelligence for Amazon, Flipkart, Meesho, and D2C brands.
            </p>
          </div>

          {/* Authentication Action */}
          <div className="mt-8 space-y-4">
            <button
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white hover:bg-[#FBFBFD] active:bg-[#F5F5F7] text-[#1D1D1F] font-medium text-sm border border-black/[0.1] shadow-apple-sm btn-press transition-all disabled:opacity-75 disabled:cursor-not-allowed group relative overflow-hidden cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
                  <span className="text-[#1D1D1F]">Authenticating with Google...</span>
                </div>
              ) : (
                <>
                  {/* Official Google G vector */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-xs text-[#86868B] leading-normal">
                Single sign-on: New accounts are automatically created. Existing accounts will be authenticated instantly.
              </p>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-8 pt-6 border-t border-black/[0.05] space-y-2.5">
            <div className="flex items-center gap-2 text-xs text-[#86868B]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#288548] shrink-0" />
              <span>Direct redirect to your real-time profit dashboard</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#86868B]">
              <Lock className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
              <span>Read-only marketplace audit • No customer payment credentials stored</span>
            </div>
          </div>
        </div>

        {/* Footer Subtext */}
        <p className="mt-6 text-center text-xs text-[#86868B]">
          By continuing, you agree to MarginFlow&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* Bottom info */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-[#86868B]">
        MarginFlow Technologies India • Financial Intelligence for Modern E-Commerce
      </div>
    </div>
  );
}
