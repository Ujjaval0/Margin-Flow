"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarginFlowLogo } from "@/components/MarginFlowLogo";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { AccountType } from "@/domain/types";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [selectedRole, setSelectedRole] = useState<AccountType>("BRAND_OWNER");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Google 1-Click Auth
  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Google User",
          email: email.trim() || "founder@marginflow.io",
          accountType: selectedRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Google authentication failed");
      }

      if (typeof window !== "undefined" && data.user) {
        localStorage.setItem("marginflow_session", JSON.stringify(data.user));
      }

      setTimeout(() => {
        if (data.isNewUser) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to authenticate with Google");
      setIsLoading(false);
    }
  };

  // 2. Email Sign In / Sign Up
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (authMode === "signup" && !name.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Please enter your email address");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        authMode === "signup"
          ? {
              name: name.trim(),
              email: email.trim().toLowerCase(),
              password,
              accountType: selectedRole,
            }
          : {
              email: email.trim().toLowerCase(),
              password,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      if (typeof window !== "undefined" && data.user) {
        localStorage.setItem("marginflow_session", JSON.stringify(data.user));
      }

      setTimeout(() => {
        if (authMode === "signup" || data.isNewUser) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication error occurred");
      setIsLoading(false);
    }
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
          <span>Secure Authentication</span>
        </div>
      </div>

      {/* Main Login / Signup Card */}
      <div className="max-w-md w-full mx-auto my-auto py-4 sm:py-6">
        <div className="apple-card bg-white rounded-3xl border border-black/[0.08] shadow-apple-lg p-6 sm:p-8 relative overflow-hidden">
          {/* Top subtle highlight line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#0071E3] to-transparent opacity-60" />

          {/* Logo & Headline */}
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="mb-4 inline-block">
              <MarginFlowLogo className="h-8 w-auto text-[#1D1D1F]" />
            </Link>

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
              {authMode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
          </div>

          {/* Auth Mode Toggle (Sign In vs Sign Up) */}
          <div className="mt-6 p-1 bg-[#F5F5F7] rounded-xl border border-black/[0.04] grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setErrorMessage(null);
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                authMode === "signup"
                  ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                setErrorMessage(null);
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                authMode === "signin"
                  ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Sign In
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200/60 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Google One-Click Button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-[#FBFBFD] active:bg-[#F5F5F7] text-[#1D1D1F] font-medium text-xs sm:text-sm border border-black/[0.1] shadow-apple-sm btn-press transition-all disabled:opacity-75 disabled:cursor-not-allowed group relative overflow-hidden cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0071E3] border-t-transparent animate-spin" />
                  <span className="text-[#1D1D1F]">Connecting...</span>
                </div>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
          </div>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-[#86868B]">
              <span className="bg-white px-3 font-medium">or continue with email</span>
            </div>
          </div>

          {/* 2. Email & Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {authMode === "signup" && (
              <div>
                <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    disabled={isLoading}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/40 text-xs sm:text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@brand.com"
                  disabled={isLoading}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/40 text-xs sm:text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isLoading}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-black/[0.1] bg-[#F5F5F7]/40 text-xs sm:text-sm focus:outline-none focus:border-[#0071E3] focus:bg-white transition-all text-[#1D1D1F]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors p-0.5 rounded cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062C4] text-white font-medium text-xs sm:text-sm shadow-apple-sm btn-press transition-all disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : authMode === "signup" ? (
                "Create Account & Continue"
              ) : (
                "Sign In to Dashboard"
              )}
            </button>
          </form>

          {/* Trust Guarantees */}
          <div className="mt-5 pt-4 border-t border-black/[0.05] flex items-center justify-center gap-1.5 text-[11px] text-[#86868B]">
            <Lock className="w-3 h-3 text-[#0071E3] shrink-0" />
            <span>Encrypted local session • Zero credentials stored</span>
          </div>
        </div>

        {/* Footer Subtext */}
        <p className="mt-5 text-center text-xs text-[#86868B]">
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
