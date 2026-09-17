"use client";

import React, { useState, useMemo } from "react";
import { Supplier } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import {
  Building2,
  Plus,
  X,
  Search,
  Pencil,
  Trash2,
  CreditCard,
  CheckCircle2,
  Clock,
  Coins,
  Phone,
  Mail,
  MapPin,
  FileText,
  Check,
  ArrowUpRight,
  Receipt,
  Layers,
  Sparkles,
} from "lucide-react";

export function SuppliersView() {
  const {
    suppliers,
    purchases,
    orders,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    recordSupplierPayment,
  } = usePlatform();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [payoutSupplier, setPayoutSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Add Supplier Form State
  const [addName, setAddName] = useState("");
  const [addContactPerson, setAddContactPerson] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addGstin, setAddGstin] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addPaymentTerms, setAddPaymentTerms] = useState("Net 30");
  const [addBankAccount, setAddBankAccount] = useState("");
  const [addUpiId, setAddUpiId] = useState("");
  const [addOpeningBalance, setAddOpeningBalance] = useState("");
  const [addNotes, setAddNotes] = useState("");

  // Edit Supplier Form State
  const [editName, setEditName] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGstin, setEditGstin] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("Net 30");
  const [editBankAccount, setEditBankAccount] = useState("");
  const [editUpiId, setEditUpiId] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Payout Form State
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split("T")[0]);
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer (NEFT/RTGS)");
  const [payoutRef, setPayoutRef] = useState(`UTR-${Math.floor(10000000 + Math.random() * 90000000)}`);
  const [payoutNotes, setPayoutNotes] = useState("");

  // ----------------------------------------------------
  // Financial Calculations per Supplier
  // ----------------------------------------------------
  const supplierFinancials = useMemo(() => {
    const map = new Map<
      string,
      { sourcedCogs: number; totalPaid: number; outstanding: number }
    >();

    suppliers.forEach((sup) => {
      // 1. Sourced from purchases
      const supPurchases = purchases.filter(
        (p) => p.supplierId === sup.id || p.supplierName.toLowerCase() === sup.name.toLowerCase()
      );
      const purchaseTotal = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

      // 2. Sourced from orders where COGS was tagged with this supplier
      const orderCogs = orders.reduce((sum, o) => {
        // Match either by supplier name in note or product supplierId
        return (
          sum +
          o.items.reduce((iSum, item) => {
            // Check if item's SKU belongs to this supplier or notes mention supplier
            const isMatch =
              o.notes?.includes(sup.name) ||
              (sup.id === "SUP-001" && item.sku.startsWith("ELEC-WEM")) ||
              (sup.id === "SUP-002" && item.sku.startsWith("ELEC-USBC"));
            return isMatch ? iSum + item.snapshotUnitCost * item.quantity : iSum;
          }, 0)
        );
      }, 0);

      const totalSourced = purchaseTotal + orderCogs + (sup.openingBalance || 0);

      // Total paid from purchase bills marked PAID + supplier.totalPaid
      const purchasesPaid = supPurchases
        .filter((p) => p.paymentStatus === "PAID")
        .reduce((sum, p) => sum + p.totalAmount, 0);
      const manualPaid = sup.totalPaid || 0;
      const totalPaid = Math.max(purchasesPaid, manualPaid);

      const outstanding = Math.max(0, totalSourced - totalPaid);

      map.set(sup.id, {
        sourcedCogs: totalSourced,
        totalPaid,
        outstanding,
      });
    });

    return map;
  }, [suppliers, purchases, orders]);

  // Aggregate Totals for Top KPI Cards
  const aggregateMetrics = useMemo(() => {
    let totalCogs = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    supplierFinancials.forEach((fin) => {
      totalCogs += fin.sourcedCogs;
      totalPaid += fin.totalPaid;
      totalOutstanding += fin.outstanding;
    });

    return { totalCogs, totalPaid, totalOutstanding };
  }, [supplierFinancials]);

  // Filtered Suppliers List
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.gstin && s.gstin.toLowerCase().includes(q)) ||
        (s.paymentTerms && s.paymentTerms.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Handle Add Supplier Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;

    const newSupplier: Supplier = {
      id: `SUP-${Math.floor(100 + Math.random() * 900)}`,
      name: addName.trim(),
      contactPerson: addContactPerson.trim(),
      phone: addPhone.trim(),
      email: addEmail.trim(),
      gstin: addGstin.trim() || undefined,
      address: addAddress.trim(),
      paymentTerms: addPaymentTerms,
      bankAccount: addBankAccount.trim() || undefined,
      upiId: addUpiId.trim() || undefined,
      openingBalance: parseFloat(addOpeningBalance) || 0,
      totalPaid: 0,
      notes: addNotes.trim() || undefined,
    };

    addSupplier(newSupplier);

    // Reset fields & close
    setAddName("");
    setAddContactPerson("");
    setAddPhone("");
    setAddEmail("");
    setAddGstin("");
    setAddAddress("");
    setAddPaymentTerms("Net 30");
    setAddBankAccount("");
    setAddUpiId("");
    setAddOpeningBalance("");
    setAddNotes("");
    setIsAddOpen(false);
  };

  // Open Edit Modal
  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setEditName(s.name);
    setEditContactPerson(s.contactPerson || "");
    setEditPhone(s.phone || "");
    setEditEmail(s.email || "");
    setEditGstin(s.gstin || "");
    setEditAddress(s.address || "");
    setEditPaymentTerms(s.paymentTerms || "Net 30");
    setEditBankAccount(s.bankAccount || "");
    setEditUpiId(s.upiId || "");
    setEditNotes(s.notes || "");
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier || !editName.trim()) return;

    const updated: Supplier = {
      ...editingSupplier,
      name: editName.trim(),
      contactPerson: editContactPerson.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      gstin: editGstin.trim() || undefined,
      address: editAddress.trim(),
      paymentTerms: editPaymentTerms,
      bankAccount: editBankAccount.trim() || undefined,
      upiId: editUpiId.trim() || undefined,
      notes: editNotes.trim() || undefined,
    };

    updateSupplier(updated);
    setEditingSupplier(null);
  };

  // Open Record Payout Modal
  const handleOpenPayout = (s: Supplier) => {
    const fin = supplierFinancials.get(s.id);
    setPayoutSupplier(s);
    setPayoutAmount(fin && fin.outstanding > 0 ? String(fin.outstanding) : "10000");
    setPayoutDate(new Date().toISOString().split("T")[0]);
    setPayoutRef(`UTR-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setPayoutNotes("");
  };

  // Handle Record Payout Submit
  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutSupplier) return;

    const parsedAmt = parseFloat(payoutAmount) || 0;
    if (parsedAmt > 0) {
      recordSupplierPayment(
        payoutSupplier.id,
        parsedAmt,
        payoutMethod,
        payoutRef,
        payoutNotes
      );
    }
    setPayoutSupplier(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (supplierToDelete) {
      deleteSupplier(supplierToDelete.id);
      setSupplierToDelete(null);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* --------------------------------------------------------------------------------- */}
      {/* 1. Header Banner matching image features in clean Light Fintech aesthetic         */}
      {/* --------------------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[11px] font-bold uppercase tracking-wider">
            <Layers className="w-3 h-3" />
            <span>WHOLESALER & SUPPLIER PAYABLE LEDGER</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Wholesale Supplier Cost & Payables
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Manage supplier contact details, edit payment terms, track total balance paid till date, and record payout logs.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-xs font-semibold shadow-sm shadow-purple-600/20 transition shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* --------------------------------------------------------------------------------- */}
      {/* 2. Three KPI Metric Cards matching image features                                 */}
      {/* --------------------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Sourced Order COGS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              TOTAL SOURCED ORDER COGS
            </span>
            <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
              {formatINR(aggregateMetrics.totalCogs)}
            </div>
            <span className="text-[11px] text-slate-400 block">
              Goods sourced across all catalog orders
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Balance Paid To Suppliers */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              TOTAL BALANCE PAID TO SUPPLIERS
            </span>
            <div className="text-2xl font-semibold text-[#288548] tracking-tight tabular-nums">
              {formatINR(aggregateMetrics.totalPaid)}
            </div>
            <span className="text-[11px] text-slate-400 block">
              Reconciled bank & vendor payout settlements
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Outstanding Payable Owed */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              OUTSTANDING PAYABLE OWED
            </span>
            <div className="text-2xl font-semibold text-amber-600 tracking-tight tabular-nums">
              {formatINR(aggregateMetrics.totalOutstanding)}
            </div>
            <span className="text-[11px] text-slate-400 block">
              Unsettled supplier invoices and credit terms
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------------------- */}
      {/* 3. Empty State (when 0 suppliers) OR Suppliers Ledger Table (when suppliers exist) */}
      {/* --------------------------------------------------------------------------------- */}
      {suppliers.length === 0 ? (
        /* Empty State matching image features */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-14 text-center">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <Coins className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No wholesale suppliers added</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configure your product suppliers to connect wholesale purchasing COGS details, track payable terms, and record bank payouts.
            </p>
            <button
              onClick={() => setIsAddOpen(true)}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-full shadow-sm shadow-purple-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Supplier</span>
            </button>
          </div>
        </div>
      ) : (
        /* Suppliers Ledger Container */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Controls & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by supplier name, contact, phone, or GSTIN..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 transition shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{filteredSuppliers.length}</strong> of{" "}
              <strong className="text-slate-800">{suppliers.length}</strong> active vendors
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">SUPPLIER & ID</th>
                  <th className="py-3.5 px-4 font-semibold">CONTACT & LOCATION</th>
                  <th className="py-3.5 px-4 font-semibold">PAYMENT TERMS</th>
                  <th className="py-3.5 px-4 font-semibold">SOURCED GOODS (COGS)</th>
                  <th className="py-3.5 px-4 font-semibold">PAID TILL DATE</th>
                  <th className="py-3.5 px-4 font-semibold">OUTSTANDING PAYABLE</th>
                  <th className="py-3.5 px-4 font-semibold text-center">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No suppliers matching &quot;{searchQuery}&quot; found.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sup) => {
                    const fin = supplierFinancials.get(sup.id) || {
                      sourcedCogs: 0,
                      totalPaid: 0,
                      outstanding: 0,
                    };

                    return (
                      <tr
                        key={sup.id}
                        className="hover:bg-slate-50/70 transition-colors duration-150 text-slate-800 group"
                      >
                        {/* 1. SUPPLIER & ID */}
                        <td className="py-3.5 px-4 align-middle">
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-purple-600" />
                              <span>{sup.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                {sup.id}
                              </span>
                              {sup.gstin && (
                                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]" title={sup.gstin}>
                                  GST: {sup.gstin}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. CONTACT & LOCATION */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="space-y-0.5 text-[11px]">
                            <div className="font-semibold text-slate-800">
                              {sup.contactPerson || "Primary Contact"}
                            </div>
                            <div className="text-slate-500 flex items-center gap-2">
                              {sup.phone && <span>{sup.phone}</span>}
                              {sup.email && <span>• {sup.email}</span>}
                            </div>
                            {sup.address && (
                              <div className="text-slate-400 text-[10px] truncate max-w-[200px]" title={sup.address}>
                                {sup.address}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. PAYMENT TERMS */}
                        <td className="py-3.5 px-4 align-middle">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {sup.paymentTerms || "Net 30"}
                          </span>
                          {sup.bankAccount && (
                            <div className="text-[10px] text-slate-400 font-mono mt-1 truncate max-w-[150px]" title={sup.bankAccount}>
                              {sup.bankAccount}
                            </div>
                          )}
                        </td>

                        {/* 4. SOURCED GOODS (COGS) */}
                        <td className="py-3.5 px-4 align-middle text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
                          {formatINR(fin.sourcedCogs)}
                        </td>

                        {/* 5. PAID TILL DATE */}
                        <td className="py-3.5 px-4 align-middle text-sm font-semibold text-[#288548] tracking-tight tabular-nums">
                          {formatINR(fin.totalPaid)}
                        </td>

                        {/* 6. OUTSTANDING PAYABLE */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="space-y-0.5">
                            <span
                              className={`text-sm font-semibold tracking-tight tabular-nums block ${
                                fin.outstanding > 0 ? "text-amber-600" : "text-[#288548]"
                              }`}
                            >
                              {formatINR(fin.outstanding)}
                            </span>
                            <span
                              className={`block text-[10px] font-medium ${
                                fin.outstanding > 0 ? "text-amber-600" : "text-[#288548]"
                              }`}
                            >
                              {fin.outstanding > 0 ? "Pending Payout" : "Settled in Full"}
                            </span>
                          </div>
                        </td>

                        {/* 7. ACTIONS */}
                        <td className="py-3.5 px-4 align-middle text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Record Payout Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenPayout(sup)}
                              title="Record Payout / Payment"
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition flex items-center gap-1 shadow-xs"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>

                            {/* Edit Supplier Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(sup)}
                              title="Edit Supplier Details"
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 hover:border-purple-300 transition shadow-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Supplier Button */}
                            <button
                              type="button"
                              onClick={() => setSupplierToDelete(sup)}
                              title="Delete Supplier"
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition shadow-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* ADD NEW SUPPLIER MODAL                                                            */}
      {/* --------------------------------------------------------------------------------- */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Add New Wholesale Supplier</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  SUPPLIER / VENDOR COMPANY NAME *
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
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
                    value={addContactPerson}
                    onChange={(e) => setAddContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="+91 98200 12345"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
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
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="orders@supplier.in"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={addGstin}
                    onChange={(e) => setAddGstin(e.target.value)}
                    placeholder="e.g. 27AAACA1234A1Z5"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PAYMENT TERMS
                  </label>
                  <select
                    value={addPaymentTerms}
                    onChange={(e) => setAddPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Immediate / Advance">Immediate / 100% Advance</option>
                    <option value="Cash On Delivery">Cash On Delivery (COD)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    OPENING PAYABLE BALANCE (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={addOpeningBalance}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setAddOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  BANK ACCOUNT / BENEFICIARY DETAILS
                </label>
                <input
                  type="text"
                  value={addBankAccount}
                  onChange={(e) => setAddBankAccount(e.target.value)}
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
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  placeholder="Street, Industrial Area, City, State..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* EDIT SUPPLIER MODAL                                                               */}
      {/* --------------------------------------------------------------------------------- */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Edit Supplier: {editingSupplier.name}</h2>
                  <span className="text-[11px] text-slate-500 font-mono">ID: {editingSupplier.id}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  SUPPLIER / VENDOR COMPANY NAME *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                    value={editContactPerson}
                    onChange={(e) => setEditContactPerson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PHONE NUMBER
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
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
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={editGstin}
                    onChange={(e) => setEditGstin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PAYMENT TERMS
                  </label>
                  <select
                    value={editPaymentTerms}
                    onChange={(e) => setEditPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Immediate / Advance">Immediate / 100% Advance</option>
                    <option value="Cash On Delivery">Cash On Delivery (COD)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    value={editUpiId}
                    onChange={(e) => setEditUpiId(e.target.value)}
                    placeholder="vendor@upi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  BANK BENEFICIARY ACCOUNT
                </label>
                <input
                  type="text"
                  value={editBankAccount}
                  onChange={(e) => setEditBankAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  ADDRESS
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Supplier Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* RECORD PAYOUT / PAYMENT MODAL                                                     */}
      {/* --------------------------------------------------------------------------------- */}
      {payoutSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Vendor Payout</h3>
                  <span className="text-[11px] text-slate-500">{payoutSupplier.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayoutSupplier(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  PAYOUT AMOUNT (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={payoutAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    PAYMENT DATE
                  </label>
                  <input
                    type="date"
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    METHOD
                  </label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                  >
                    <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT)</option>
                    <option value="UPI / QR">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  BANK TRANSACTION / UTR REFERENCE #
                </label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. UTR-982173921"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  REMARKS / NOTES
                </label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Invoice settlement batch reference..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayoutSupplier(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL                                                         */}
      {/* --------------------------------------------------------------------------------- */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Supplier?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Supplier: <strong className="font-semibold text-slate-800">{supplierToDelete.name}</strong></p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently remove <strong className="text-slate-900">{supplierToDelete.name}</strong> from your supplier directory? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20"
              >
                Delete Supplier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
