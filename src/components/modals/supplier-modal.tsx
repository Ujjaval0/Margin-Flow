"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, Pencil, X, Check, AlertCircle } from "lucide-react";
import { Supplier } from "@/domain/types";

export interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initialSupplier?: Supplier | null;
  onSave: (supplier: Supplier) => void;
}

export function SupplierModal({
  isOpen,
  onClose,
  mode = "create",
  initialSupplier = null,
  onSave,
}: SupplierModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [bankAccount, setBankAccount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialSupplier) {
      setName(initialSupplier.name || "");
      setContactPerson(initialSupplier.contactPerson || "");

      // Extract up to 10 numeric digits from existing phone data
      const rawDigits = (initialSupplier.phone || "").replace(/\D/g, "");
      const normalizedPhone = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
      setPhone(normalizedPhone);

      setEmail(initialSupplier.email || "");
      setGstin((initialSupplier.gstin || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15));
      setAddress(initialSupplier.address || "");
      setPaymentTerms(initialSupplier.paymentTerms || "Net 30");
      setBankAccount(initialSupplier.bankAccount || "");
      setUpiId(initialSupplier.upiId || "");
      setOpeningBalance(String(initialSupplier.openingBalance || 0));
      setNotes(initialSupplier.notes || "");
    } else {
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setGstin("");
      setAddress("");
      setPaymentTerms("Net 30");
      setBankAccount("");
      setUpiId("");
      setOpeningBalance("0");
      setNotes("");
    }
    setErrors({});
    setTouched({});
  }, [isOpen, mode, initialSupplier]);

  if (!isOpen) return null;

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case "name": {
        const trimmed = value.trim();
        if (!trimmed) return "Company name is required";
        if (trimmed.length < 2) return "Company name must be at least 2 characters";
        return undefined;
      }
      case "phone": {
        const digits = value.replace(/\D/g, "");
        if (digits.length > 0 && digits.length !== 10) {
          return `Phone number must be exactly 10 digits (${digits.length}/10)`;
        }
        return undefined;
      }
      case "email": {
        const trimmed = value.trim();
        if (trimmed) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(trimmed)) return "Enter a valid email address";
        }
        return undefined;
      }
      case "gstin": {
        const clean = value.trim().toUpperCase();
        if (clean.length > 0) {
          if (clean.length !== 15) {
            return `GSTIN must be exactly 15 characters (${clean.length}/15)`;
          }
          const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
          if (!gstinRegex.test(clean)) {
            return "Invalid GSTIN format (e.g. 27AAACA1234A1Z5)";
          }
        }
        return undefined;
      }
      case "upiId": {
        const trimmed = value.trim();
        if (trimmed) {
          const upiRegex = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/;
          if (!upiRegex.test(trimmed)) {
            return "Invalid UPI ID (e.g. vendor@okhdfcbank)";
          }
        }
        return undefined;
      }
      case "bankAccount": {
        const trimmed = value.trim();
        if (trimmed && trimmed.length < 5) {
          return "Please enter complete account details (Bank, A/C, IFSC)";
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only numeric digits, capped at 10 digits
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
    if (touched.phone || errors.phone) {
      const err = validateField("phone", digits);
      setErrors((prev) => ({ ...prev, phone: err || "" }));
    }
  };

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only alphanumeric characters, uppercase, capped at 15 characters
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
    setGstin(clean);
    if (touched.gstin || errors.gstin) {
      const err = validateField("gstin", clean);
      setErrors((prev) => ({ ...prev, gstin: err || "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const nameErr = validateField("name", name);
    if (nameErr) newErrors.name = nameErr;

    const phoneErr = validateField("phone", phone);
    if (phoneErr) newErrors.phone = phoneErr;

    const emailErr = validateField("email", email);
    if (emailErr) newErrors.email = emailErr;

    const gstinErr = validateField("gstin", gstin);
    if (gstinErr) newErrors.gstin = gstinErr;

    const upiErr = validateField("upiId", upiId);
    if (upiErr) newErrors.upiId = upiErr;

    const bankErr = validateField("bankAccount", bankAccount);
    if (bankErr) newErrors.bankAccount = bankErr;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched({
        name: true,
        phone: true,
        email: true,
        gstin: true,
        upiId: true,
        bankAccount: true,
      });
      return;
    }

    const cleanPhone = phone.trim();
    const formattedPhone = cleanPhone
      ? `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`
      : "";

    const supplierData: Supplier = {
      id:
        mode === "edit" && initialSupplier
          ? initialSupplier.id
          : `SUP-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: formattedPhone,
      email: email.trim(),
      gstin: gstin.trim().toUpperCase() || undefined,
      address: address.trim(),
      paymentTerms,
      bankAccount: bankAccount.trim() || undefined,
      upiId: upiId.trim() || undefined,
      openingBalance: parseFloat(openingBalance) || 0,
      totalPaid: mode === "edit" && initialSupplier ? initialSupplier.totalPaid || 0 : 0,
      notes: notes.trim() || undefined,
    };

    onSave(supplierData);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                mode === "edit"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-purple-50 border-purple-200 text-purple-700"
              }`}
            >
              {mode === "edit" ? <Pencil className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {mode === "edit" ? `Edit Supplier: ${initialSupplier?.name}` : "Add Wholesale Supplier"}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === "edit"
                  ? `ID: ${initialSupplier?.id}`
                  : "Configure merchant profile, credit terms, and GST invoicing basis."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs">
          {/* Supplier Name */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              SUPPLIER / VENDOR COMPANY NAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (touched.name || errors.name) {
                  const err = validateField("name", e.target.value);
                  setErrors((prev) => ({ ...prev, name: err || "" }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, name: true }));
                const err = validateField("name", name);
                setErrors((prev) => ({ ...prev, name: err || "" }));
              }}
              placeholder="e.g. Apex Electronics Mfg Ltd"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none transition ${
                errors.name
                  ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                  : "border-slate-200 focus:border-purple-500"
              }`}
              required
            />
            {errors.name && (
              <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.name}</span>
              </p>
            )}
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                CONTACT PERSON
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  PHONE / WHATSAPP
                </label>
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    phone.length === 10
                      ? "text-emerald-600 font-semibold"
                      : phone.length > 0
                      ? "text-amber-600"
                      : "text-slate-400"
                  }`}
                >
                  {phone.length}/10 digits
                </span>
              </div>
              <div
                className={`flex rounded-xl border bg-slate-50 focus-within:bg-white transition overflow-hidden ${
                  errors.phone
                    ? "border-rose-400 focus-within:border-rose-500 bg-rose-50/20"
                    : "border-slate-200 focus-within:border-purple-500"
                }`}
              >
                <span className="inline-flex items-center px-2.5 text-xs font-semibold text-slate-500 bg-slate-100/70 border-r border-slate-200 select-none shrink-0">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, phone: true }));
                    const err = validateField("phone", phone);
                    setErrors((prev) => ({ ...prev, phone: err || "" }));
                  }}
                  placeholder="98200 12345"
                  className="w-full px-2.5 py-2 bg-transparent text-xs text-slate-900 focus:outline-none font-mono"
                />
              </div>
              {errors.phone && (
                <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.phone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Email & GSTIN */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email || errors.email) {
                    const err = validateField("email", e.target.value);
                    setErrors((prev) => ({ ...prev, email: err || "" }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, email: true }));
                  const err = validateField("email", email);
                  setErrors((prev) => ({ ...prev, email: err || "" }));
                }}
                placeholder="orders@supplier.in"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none transition ${
                  errors.email
                    ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                    : "border-slate-200 focus:border-purple-500"
                }`}
              />
              {errors.email && (
                <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  GSTIN / TAX ID
                </label>
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    gstin.length === 15
                      ? "text-emerald-600 font-semibold"
                      : gstin.length > 0
                      ? "text-amber-600"
                      : "text-slate-400"
                  }`}
                >
                  {gstin.length}/15 chars
                </span>
              </div>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={handleGstinChange}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, gstin: true }));
                  const err = validateField("gstin", gstin);
                  setErrors((prev) => ({ ...prev, gstin: err || "" }));
                }}
                placeholder="27AAACA1234A1Z5"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-900 font-mono uppercase tracking-wider focus:bg-white focus:outline-none transition ${
                  errors.gstin
                    ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                    : "border-slate-200 focus:border-purple-500"
                }`}
              />
              {errors.gstin && (
                <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.gstin}</span>
                </p>
              )}
            </div>
          </div>

          {/* Payment Terms & UPI ID */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                PAYMENT TERMS
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="Net 15">Net 15 (15 days credit)</option>
                <option value="Net 30">Net 30 (30 days credit)</option>
                <option value="Net 45">Net 45 (45 days credit)</option>
                <option value="Immediate">Immediate / Advance</option>
                <option value="COD">Cash on Delivery (COD)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                UPI ID / VPA
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => {
                  setUpiId(e.target.value);
                  if (touched.upiId || errors.upiId) {
                    const err = validateField("upiId", e.target.value);
                    setErrors((prev) => ({ ...prev, upiId: err || "" }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, upiId: true }));
                  const err = validateField("upiId", upiId);
                  setErrors((prev) => ({ ...prev, upiId: err || "" }));
                }}
                placeholder="supplier@okhdfcbank"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none transition ${
                  errors.upiId
                    ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                    : "border-slate-200 focus:border-purple-500"
                }`}
              />
              {errors.upiId && (
                <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.upiId}</span>
                </p>
              )}
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              BANK ACCOUNT / BENEFICIARY DETAILS
            </label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => {
                setBankAccount(e.target.value);
                if (touched.bankAccount || errors.bankAccount) {
                  const err = validateField("bankAccount", e.target.value);
                  setErrors((prev) => ({ ...prev, bankAccount: err || "" }));
                }
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, bankAccount: true }));
                const err = validateField("bankAccount", bankAccount);
                setErrors((prev) => ({ ...prev, bankAccount: err || "" }));
              }}
              placeholder="HDFC Bank - A/C 50200088912 (IFSC: HDFC0000123)"
              className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none transition ${
                errors.bankAccount
                  ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                  : "border-slate-200 focus:border-purple-500"
              }`}
            />
            {errors.bankAccount && (
              <p className="text-[10px] text-rose-600 font-medium mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.bankAccount}</span>
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              WAREHOUSE / FACTORY ADDRESS
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, Industrial Area, City, State..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              NOTES &amp; PROCUREMENT TERMS
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special credit notes, return policies, lead time..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{mode === "edit" ? "Update Supplier" : "Create Supplier"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
