"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Camera,
  Pencil,
  Check,
  LogOut,
} from "lucide-react";
import { usePlatform } from "@/domain/store";

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  FOUNDER: "Founder / Business Owner",
  OPERATIONS_FINANCE: "E-Commerce / Finance Manager",
  SUPPLIER_MANUFACTURER: "Manufacturer / Supplier",
  AGENCY_CONSULTANT: "Agency / CA / Consultant",
};

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const [mounted, setMounted] = useState(false);
  const { currentUser, setCurrentUser } = usePlatform();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [businessRole, setBusinessRole] = useState("FOUNDER");
  const [customRole, setCustomRole] = useState("");
  const initialProfile = useRef({ name: "", companyName: "", email: "", phone: "", businessRole: "FOUNDER", customRole: "" });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Initialize fields when opening
  useEffect(() => {
    if (!isOpen) return;

    let initialName = currentUser?.name || "E-Commerce";
    let initialAvatar = currentUser?.avatarUrl || null;
    let initialCompany = currentUser?.companyName || "";
    let initialEmail = currentUser?.email || "";
    let initialPhone = currentUser?.phone || "";
    let initialRole = currentUser?.onboardingPreferences?.role || "FOUNDER";
    let initialCustomRole = currentUser?.onboardingPreferences?.roleLabel || "";

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("marginflow_session");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name) initialName = parsed.name;
          if (parsed?.avatarUrl) initialAvatar = parsed.avatarUrl;
          if (parsed?.companyName) initialCompany = parsed.companyName;
          if (parsed?.email) initialEmail = parsed.email;
          if (parsed?.phone !== undefined) initialPhone = parsed.phone || "";
          if (parsed?.onboardingPreferences?.role) initialRole = parsed.onboardingPreferences.role;
          if (parsed?.onboardingPreferences?.roleLabel) initialCustomRole = parsed.onboardingPreferences.roleLabel;
        }
      } catch {}
    }

    setName(initialName);
    setAvatarUrl(initialAvatar);
    setCompanyName(initialCompany);
    setUserEmail(initialEmail);
    setUserPhone(initialPhone);
    setBusinessRole(initialRole);
    setCustomRole(initialRole === "OTHER" ? initialCustomRole : "");
    initialProfile.current = { name: initialName, companyName: initialCompany, email: initialEmail, phone: initialPhone, businessRole: initialRole, customRole: initialRole === "OTHER" ? initialCustomRole : "" };
    setIsEditingName(false);
    setIsEditingProfile(false);
    setHasChanges(false);
    setIsSaved(false);
    setLogoutError(null);
    setProfileError(null);
    setProfileNotice(null);
  }, [isOpen, currentUser]);

  // Keyboard dismissal on Escape key (Standard invariant)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditingName) {
          setIsEditingName(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isEditingName, onClose]);

  // Read local storage session for other profile fields
  const sessionData = useMemo(() => {
    if (typeof window === "undefined" || !isOpen) return null;
    try {
      const raw = localStorage.getItem("marginflow_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const resolvedRawRole = currentUser?.onboardingPreferences?.role || sessionData?.onboardingPreferences?.role || sessionData?.businessRole || "FOUNDER";
  const resolvedRoleTitle = sessionData?.onboardingPreferences?.roleLabel || ROLE_LABELS[resolvedRawRole] || resolvedRawRole.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  const profileInputClass = "w-[min(190px,52vw)] rounded-lg border border-black/[0.1] bg-white px-2 py-1.5 text-right text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20";

  // Calculate initials
  const initials =
    name
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarUrl(result);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    setHasChanges(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Commit changes to state and storage
  const handleSave = async () => {
    const cleanName = name.trim() || currentUser?.name || "User";
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: cleanName, companyName, phone: userPhone, businessRole, customRole }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Profile could not be saved.");

      const updatedUser = { ...currentUser, ...result.user, avatarUrl: avatarUrl || undefined };
      setCurrentUser(updatedUser);
      try {
        const raw = localStorage.getItem("marginflow_session");
        const currentSession = raw ? JSON.parse(raw) : {};
        localStorage.setItem("marginflow_session", JSON.stringify({ ...currentSession, ...result.user, avatarUrl: avatarUrl || undefined }));
      } catch {}

      setName(cleanName);
      setUserEmail(result.user.email || userEmail);
      setIsSaved(true);
      setHasChanges(false);
      setIsEditingName(false);
      setIsEditingProfile(false);
      initialProfile.current = { name: cleanName, companyName, email: result.user.email || userEmail, phone: userPhone, businessRole, customRole };
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 600);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Profile could not be saved. Please retry.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const cancelProfileEdit = () => {
    const initial = initialProfile.current;
    setName(initial.name);
    setCompanyName(initial.companyName);
    setUserEmail(initial.email);
    setUserPhone(initial.phone);
    setBusinessRole(initial.businessRole);
    setCustomRole(initial.customRole);
    setIsEditingName(false);
    setIsEditingProfile(false);
    setHasChanges(false);
    setProfileError(null);
    setProfileNotice(null);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Logout could not be completed.");
      }

      localStorage.removeItem("marginflow_session");
      localStorage.removeItem("marginflow_onboarding_completed");
      window.dispatchEvent(new Event("marginflow:session-changed"));
      window.location.assign("/");
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Logout could not be completed. Please retry.");
      setIsLoggingOut(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] overflow-hidden animate-in zoom-in-95 duration-150 w-full max-w-[390px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black/[0.05] flex items-center justify-between bg-[#FBFBFD] shrink-0">
          <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
            Profile
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Profile Avatar & Name Section */}
        <div className="pt-6 pb-5 px-6 flex flex-col items-center flex-1 overflow-y-auto">
          {/* Avatar with Camera Trigger */}
          <div className="relative group mb-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full overflow-hidden shadow-apple-sm ring-1 ring-black/[0.08] relative block focus:outline-none focus:ring-2 focus:ring-[#0071E3] cursor-pointer"
              title="Change profile picture"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#0071E3] to-[#0051A8] text-white text-2xl font-semibold flex items-center justify-center select-none">
                  {initials}
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium gap-0.5">
                <Camera className="w-4 h-4" />
                <span>Change</span>
              </div>
            </button>

            {/* Camera Badge Icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-apple-xs border border-black/[0.08] flex items-center justify-center text-[#1D1D1F] hover:bg-black/[0.02] active:scale-95 transition cursor-pointer"
              title="Upload new photo"
            >
              <Camera className="w-3.5 h-3.5 text-[#1D1D1F]" />
            </button>
          </div>

          {/* Photo Actions */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-medium text-[#0071E3] hover:text-[#0051A8] transition-colors cursor-pointer"
            >
              Change Photo
            </button>
            {avatarUrl && (
              <>
                <span className="text-[10px] text-[#86868B]">•</span>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-[11px] font-medium text-[#86868B] hover:text-[#D70015] transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </>
            )}
          </div>

          {/* Editable Name */}
          {isEditingName ? (
            <div className="flex items-center gap-1.5 w-full max-w-[260px] animate-in fade-in duration-100">
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasChanges(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingName(false);
                }}
                placeholder="Enter profile name"
                className="w-full text-center text-sm font-semibold text-[#1D1D1F] bg-[#F5F5F7] border border-[#0071E3] rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 transition"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="w-8 h-8 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#1D1D1F] transition shrink-0 cursor-pointer active:scale-95"
                title="Done editing name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 group/name cursor-pointer py-0.5 px-2 rounded-xl hover:bg-black/[0.03] transition"
              title="Click to edit name"
            >
              <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight group-hover/name:text-[#0071E3] transition-colors">
                {name || "User"}
              </h2>
              <Pencil className="w-3 h-3 text-[#86868B] opacity-40 group-hover/name:opacity-100 group-hover/name:text-[#0071E3] transition" />
            </div>
          )}
        </div>

        {/* Clean Attributes List */}
        <div className="px-5 pb-5">
          <div className="bg-[#F9F9FB] rounded-2xl border border-black/[0.06] divide-y divide-black/[0.04] overflow-hidden text-xs">
            {/* Business Role (from onboarding) */}
            <div className="flex items-center justify-between gap-2 p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Briefcase className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Business Role</span>
              </div>
              {isEditingProfile ? (
                <div className="flex w-[min(190px,52vw)] flex-col gap-1.5">
                  <select className={profileInputClass} value={businessRole} onChange={(e) => { setBusinessRole(e.target.value); setHasChanges(true); }}>
                    <option value="FOUNDER">Founder / Business Owner</option>
                    <option value="STUDENT">Student</option>
                    <option value="OPERATIONS_FINANCE">E-commerce / Finance Manager</option>
                    <option value="SUPPLIER_MANUFACTURER">Manufacturer / Supplier</option>
                    <option value="AGENCY_CONSULTANT">Agency Owner / Consultant</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {businessRole === "OTHER" && <input className={profileInputClass} value={customRole} onChange={(e) => { setCustomRole(e.target.value); setHasChanges(true); }} placeholder="Your role" maxLength={100} />}
                </div>
              ) : <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">{sessionData?.onboardingPreferences?.roleLabel || ROLE_LABELS[resolvedRawRole] || resolvedRoleTitle}</span>}
            </div>

            {/* Brand / Company Name */}
            <div className="flex items-center justify-between gap-2 p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Company / Brand</span>
              </div>
              {isEditingProfile ? <input className={profileInputClass} value={companyName} onChange={(e) => { setCompanyName(e.target.value); setHasChanges(true); }} maxLength={200} aria-label="Company or brand name" /> : <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">{companyName || currentUser?.companyName || "Not provided"}</span>}
            </div>

            {/* Email */}
            <div className="flex items-center justify-between gap-2 p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Mail className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Email</span>
              </div>
              <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]" title="Email changes are managed through account verification">{userEmail || currentUser?.email || "Not provided"}</span>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between gap-2 p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Phone className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Phone</span>
              </div>
              {isEditingProfile ? <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} className={profileInputClass} value={userPhone} onChange={(e) => { setUserPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setHasChanges(true); }} placeholder="10-digit mobile number" aria-label="10-digit Indian mobile number" autoComplete="tel" /> : <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">{userPhone || currentUser?.phone || "Not provided"}</span>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/[0.05] bg-[#FBFBFD] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#86868B] min-w-0">
            {profileError ? (
              <span role="alert" className="text-red-600">{profileError}</span>
            ) : profileNotice ? (
              <span role="status" className="text-[#6E6E73]">{profileNotice}</span>
            ) : logoutError ? (
              <span role="alert" className="text-red-600">{logoutError}</span>
            ) : isSaved ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            ) : hasChanges ? (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[#B42318] hover:bg-red-50 rounded-full text-xs font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogOut className="w-3.5 h-3.5" />
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
            {hasChanges ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSavingProfile}
                className="px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-full text-xs font-semibold shadow-apple-sm transition cursor-pointer active:scale-95 disabled:opacity-60"
              >
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </button>
            ) : isEditingProfile ? (
              <button type="button" onClick={cancelProfileEdit} className="px-4 py-1.5 bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] rounded-full text-xs font-semibold transition cursor-pointer">Cancel</button>
            ) : (
              <button type="button" onClick={() => { setIsEditingProfile(true); setProfileNotice(null); setProfileError(null); }} className="px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-full text-xs font-semibold shadow-apple-sm transition cursor-pointer active:scale-95">Edit Profile</button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
