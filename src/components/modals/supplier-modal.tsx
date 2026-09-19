"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, Pencil, X, Check } from "lucide-react";
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

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialSupplier) {
      setName(initialSupplier.name);
      setContactPerson(initialSupplier.contactPerson || "");
      setPhone(initialSupplier.phone || "");
      setEmail(initialSupplier.email || "");
      setGstin(initialSupplier.gstin || "");
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
  }, [isOpen, mode, initialSupplier]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const supplierData: Supplier = {
      id:
        mode === "edit" && initialSupplier
          ? initialSupplier.id
          : `SUP-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gstin: gstin.trim() || undefined,
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
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              SUPPLIER / VENDOR COMPANY NAME *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Electronics Mfg Ltd"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

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
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                PHONE / WHATSAPP
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98200 12345"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orders@supplier.in"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                GSTIN / TAX ID
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="27AAACA1234A1Z5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

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
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="supplier@okhdfcbank"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              BANK ACCOUNT / BENEFICIARY DETAILS
            </label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="HDFC Bank - A/C 50200088912 (IFSC: HDFC0000123)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              WAREHOUSE / FACTORY ADDRESS
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, Industrial Area, City, State..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              NOTES &amp; PROCUREMENT TERMS
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special credit notes, return policies, lead time..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
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
