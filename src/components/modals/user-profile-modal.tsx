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
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Initialize fields when opening
  useEffect(() => {
    if (!isOpen) return;

    let initialName = currentUser?.name || "Ujjaval";
    let initialAvatar = currentUser?.avatarUrl || null;

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("marginflow_session");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name) initialName = parsed.name;
          if (parsed?.avatarUrl) initialAvatar = parsed.avatarUrl;
        }
      } catch {}
    }

    setName(initialName);
    setAvatarUrl(initialAvatar);
    setIsEditingName(false);
    setHasChanges(false);
    setIsSaved(false);
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

  // Resolve business role from onboarding
  const rawRole =
    currentUser?.onboardingPreferences?.role ||
    sessionData?.onboardingPreferences?.role ||
    sessionData?.businessRole ||
    "FOUNDER";
  const roleTitle =
    ROLE_LABELS[rawRole] ||
    rawRole.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());

  // Resolve company, email, phone
  const companyName =
    sessionData?.companyName ||
    currentUser?.companyName ||
    "VoltTech Consumer Electronics";
  const userEmail = sessionData?.email || currentUser?.email || "founder@marginflow.io";
  const userPhone = sessionData?.phone || currentUser?.phone || "+91 98200 99881";

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
  const handleSave = () => {
    const cleanName = name.trim() || currentUser?.name || "User";

    const updatedUser = {
      ...currentUser,
      name: cleanName,
      avatarUrl: avatarUrl || undefined,
    };

    setCurrentUser(updatedUser);

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("marginflow_session");
        const currentSession = raw ? JSON.parse(raw) : {};
        const updatedSession = {
          ...currentSession,
          name: cleanName,
          avatarUrl: avatarUrl || undefined,
        };
        localStorage.setItem("marginflow_session", JSON.stringify(updatedSession));
      } catch {}
    }

    setIsSaved(true);
    setHasChanges(false);
    setIsEditingName(false);

    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 300);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] overflow-hidden animate-in zoom-in-95 duration-150 w-full max-w-[390px] flex flex-col"
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
        <div className="pt-6 pb-5 px-6 flex flex-col items-center">
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
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Briefcase className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Business Role</span>
              </div>
              <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">
                {roleTitle}
              </span>
            </div>

            {/* Brand / Company Name */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Company / Brand</span>
              </div>
              <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">
                {companyName}
              </span>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Mail className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Email</span>
              </div>
              <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">
                {userEmail}
              </span>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-2.5 text-[#6E6E73] font-medium">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center text-[#1D1D1F] shrink-0">
                  <Phone className="w-3.5 h-3.5 text-[#6E6E73]" />
                </div>
                <span>Phone</span>
              </div>
              <span className="font-semibold text-[#1D1D1F] text-right truncate max-w-[190px]">
                {userPhone}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/[0.05] bg-[#FBFBFD] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#86868B]">
            {isSaved ? (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved
              </span>
            ) : hasChanges ? (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {hasChanges ? (
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-full text-xs font-semibold shadow-apple-sm transition cursor-pointer active:scale-95"
              >
                Save Changes
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-[#1D1D1F] hover:bg-black text-white rounded-full text-xs font-semibold shadow-apple-sm transition cursor-pointer active:scale-95"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
