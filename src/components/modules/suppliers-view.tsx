"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
} from "lucide-react";
import { SupplierModal } from "@/components/modals/supplier-modal";

export function SuppliersView() {
  const {
    suppliers,
    purchases,
    orders,
    products,
    returns,
    claims,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    recordSupplierPayment,
  } = usePlatform();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");

  // Modals State
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [payoutSupplier, setPayoutSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (supplierToDelete) setSupplierToDelete(null);
        else if (payoutSupplier) setPayoutSupplier(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [supplierToDelete, payoutSupplier]);

  // Payout Form State
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split("T")[0]);
  const [payoutMethod, setPayoutMethod] = useState("Bank Transfer (NEFT/RTGS)");
  const [payoutRef, setPayoutRef] = useState(`UTR-${Math.floor(10000000 + Math.random() * 90000000)}`);
  const [payoutNotes, setPayoutNotes] = useState("");

  // ----------------------------------------------------
  // Dynamic Financial Calculations per Supplier
  // ----------------------------------------------------
  const supplierFinancials = useMemo(() => {
    // Dynamic SKU -> Product mapping including channel aliases
    const skuToProductMap = new Map<string, (typeof products)[0]>();
    products.forEach((p) => {
      skuToProductMap.set(p.sku.toLowerCase(), p);
      if (p.channelAliases) {
        Object.values(p.channelAliases).forEach((alias) => {
          if (alias) skuToProductMap.set(alias.toLowerCase(), p);
        });
      }
    });

    // Dynamic O(1) returns lookup
    const returnsByOrderMap = new Map<string, (typeof returns)[0][]>();
    returns.forEach((r) => {
      if (r.orderId) {
        const list = returnsByOrderMap.get(r.orderId) || [];
        list.push(r);
        returnsByOrderMap.set(r.orderId, list);
      }
      if (r.channelOrderId) {
        const list = returnsByOrderMap.get(r.channelOrderId) || [];
        list.push(r);
        returnsByOrderMap.set(r.channelOrderId, list);
      }
    });

    // Dynamic O(1) claims lookup
    const claimsByOrderMap = new Map<string, (typeof claims)[0][]>();
    claims.forEach((c) => {
      if (c.orderId) {
        const list = claimsByOrderMap.get(c.orderId) || [];
        list.push(c);
        claimsByOrderMap.set(c.orderId, list);
      }
    });

    const map = new Map<
      string,
      { sourcedCogs: number; totalPaid: number; outstanding: number }
    >();

    suppliers.forEach((sup) => {
      const supNameLower = sup.name.toLowerCase();

      // 1. Sourced from purchase bills
      const supPurchases = purchases.filter(
        (p) => p.supplierId === sup.id || p.supplierName.toLowerCase() === supNameLower
      );
      const purchaseTotal = supPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

      // 2. Sourced from orders with active COGS attributed to this supplier
      const orderCogs = orders.reduce((sum, o) => {
        // Exclude cancelled orders
        if (o.status === "CANCELLED") return sum;

        const linkedReturns = [
          ...(returnsByOrderMap.get(o.id) || []),
          ...(o.channelOrderId ? returnsByOrderMap.get(o.channelOrderId) || [] : []),
        ];
        const linkedClaims = [
          ...(claimsByOrderMap.get(o.id) || []),
          ...(o.channelOrderId ? claimsByOrderMap.get(o.channelOrderId) || [] : []),
        ];

        const isRto =
          o.status === "RTO" ||
          linkedReturns.some((r) => r.returnType === "RTO");

        const isDamaged =
          o.status === "DAMAGED_RETURN" ||
          o.status === "CLAIM_PENDING" ||
          o.status === "CLAIM_APPROVED" ||
          linkedReturns.some(
            (r) =>
              r.returnType === "DAMAGED_RETURN" ||
              r.condition === "UNUSABLE" ||
              r.condition === "MISSING" ||
              (r.condition as string) === "DAMAGED"
          ) ||
          linkedClaims.length > 0;

        const isCustomerReturn =
          o.status === "CUSTOMER_RETURN" ||
          o.status === "RETURNED" ||
          linkedReturns.some((r) => r.returnType === "CUSTOMER_RETURN");

        // COGS Invariants (aligned with profitability engine):
        // Active: Delivered, Damaged return, Claim pending/approved.
        // Inactive: Cancelled, RTO, Intact/Good Customer Return.
        if (isRto) return sum;
        if (isCustomerReturn && !isDamaged && o.status !== "CLAIM_PENDING" && o.status !== "CLAIM_APPROVED") {
          return sum;
        }

        // Sum COGS of items belonging to this supplier
        const itemsCogs = o.items.reduce((iSum, item) => {
          const prod =
            skuToProductMap.get(item.sku.toLowerCase()) ||
            products.find((p) => p.name.toLowerCase() === item.productName.toLowerCase());

          const isMatch =
            o.supplierId === sup.id ||
            (o.supplierName && o.supplierName.toLowerCase() === supNameLower) ||
            (prod && (prod.supplierId === sup.id || prod.supplierId.toLowerCase() === supNameLower)) ||
            (o.notes && o.notes.toLowerCase().includes(supNameLower)) ||
            // Fallback for initial mock SKUs if unmapped
            (!prod && sup.id === "SUP-001" && (item.sku.startsWith("ELEC-WEM") || item.sku.startsWith("ELEC-ANC"))) ||
            (!prod && sup.id === "SUP-002" && (item.sku.startsWith("ELEC-USBC") || item.sku.startsWith("ELEC-BRAID")));

          return isMatch ? iSum + item.snapshotUnitCost * item.quantity : iSum;
        }, 0);

        return sum + itemsCogs;
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
  }, [suppliers, purchases, orders, products, returns, claims]);

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
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.gstin && s.gstin.toLowerCase().includes(q)) ||
        (s.paymentTerms && s.paymentTerms.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, currentPage, pageSize]);

  // Open Edit Modal
  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
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
      {/* 1. Page Header (Minimal Apple Aesthetic)                                          */}
      {/* --------------------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Wholesale Supplier Cost & Payables
          </h1>
          <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
            Manage supplier contact details, edit payment terms, track total balance paid till date, and record payout logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold shadow-apple-sm transition active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* --------------------------------------------------------------------------------- */}
      {/* 2. Three KPI Metric Cards matching image features                                 */}
      {/* --------------------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Sourced Order COGS */}
        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#86868B] block">
              Total sourced order COGS
            </span>
            <div className="text-2xl font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
              {formatINR(aggregateMetrics.totalCogs)}
            </div>
            <span className="text-[11px] text-[#86868B] block">
              Goods sourced across all catalog orders
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Balance Paid To Suppliers */}
        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#86868B] block">
              Total balance paid to suppliers
            </span>
            <div className="text-2xl font-semibold text-[#288548] tracking-tight tabular-nums">
              {formatINR(aggregateMetrics.totalPaid)}
            </div>
            <span className="text-[11px] text-[#86868B] block">
              Reconciled bank & vendor payout settlements
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Outstanding Payable Owed */}
        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-[#86868B] block">
              Outstanding payable owed
            </span>
            <div className="text-2xl font-semibold text-[#B25E00] tracking-tight tabular-nums">
              {formatINR(aggregateMetrics.totalOutstanding)}
            </div>
            <span className="text-[11px] text-[#86868B] block">
              Unsettled supplier invoices and credit terms
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------------------- */}
      {/* 3. Empty State (when 0 suppliers) OR Suppliers Ledger Table (when suppliers exist) */}
      {/* --------------------------------------------------------------------------------- */}
      {suppliers.length === 0 ? (
        /* Empty State matching image features */
        <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md p-14 text-center">
          <div className="flex flex-col items-center justify-center gap-3 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              <Coins className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-[#1D1D1F]">No wholesale suppliers added</h3>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Configure your product suppliers to connect wholesale purchasing COGS details, track payable terms, and record bank payouts.
            </p>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="mt-2 flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold shadow-apple-sm transition active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
              <span>Add Your First Supplier</span>
            </button>
          </div>
        </div>
      ) : (
        /* Suppliers Ledger Container */
        <div className="apple-card rounded-2xl border border-black/[0.06] shadow-apple-md overflow-hidden space-y-4 p-5">
          {/* Controls & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#86868B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by supplier name, contact, phone, or GSTIN..."
                className="w-full pl-9 pr-8 py-2 bg-[#FAFAFC] border border-black/[0.06] rounded-full text-xs text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition shadow-apple-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search query"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] text-xs w-4 h-4 rounded-full flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs text-[#86868B] font-medium">
              Showing <strong className="text-[#1D1D1F]">{filteredSuppliers.length}</strong> of{" "}
              <strong className="text-[#1D1D1F]">{suppliers.length}</strong> active vendors
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[#FAFAFC] border-b border-black/[0.06] text-[11px] font-medium text-[#86868B]">
                  <th className="py-3 px-4">Supplier & ID</th>
                  <th className="py-3 px-4">Contact & location</th>
                  <th className="py-3 px-4">Payment terms</th>
                  <th className="py-3 px-4">Sourced goods (COGS)</th>
                  <th className="py-3 px-4">Paid till date</th>
                  <th className="py-3 px-4">Outstanding payable</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/[0.04] text-xs">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#86868B]">
                      No suppliers matching &quot;{searchQuery}&quot; found.
                    </td>
                  </tr>
                ) : (
                  paginatedSuppliers.map((sup) => {
                    const fin = supplierFinancials.get(sup.id) || {
                      sourcedCogs: 0,
                      totalPaid: 0,
                      outstanding: 0,
                    };

                    return (
                      <tr
                        key={sup.id}
                        className="hover:bg-black/[0.01] transition-colors duration-150 text-[#1D1D1F] group"
                      >
                        {/* 1. SUPPLIER & ID */}
                        <td className="py-3.5 px-4 align-middle">
                          <div>
                            <div className="font-semibold text-[#1D1D1F] text-xs flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-[#1D1D1F]" />
                              <span>{sup.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-[#86868B] bg-black/[0.04] px-1.5 py-0.2 rounded">
                                {sup.id}
                              </span>
                              {sup.gstin && (
                                <span className="font-mono text-[10px] text-[#86868B] truncate max-w-[140px]" title={sup.gstin}>
                                  GST: {sup.gstin}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. CONTACT & LOCATION */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="space-y-0.5 text-[11px]">
                            <div className="font-medium text-[#1D1D1F]">
                              {sup.contactPerson || "Primary Contact"}
                            </div>
                            <div className="text-[#86868B] flex items-center gap-2">
                              {sup.phone && <span>{sup.phone}</span>}
                              {sup.email && <span>• {sup.email}</span>}
                            </div>
                            {sup.address && (
                              <div className="text-[#86868B] text-[10px] truncate max-w-[200px]" title={sup.address}>
                                {sup.address}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. PAYMENT TERMS */}
                        <td className="py-3.5 px-4 align-middle">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                            {sup.paymentTerms || "Net 30"}
                          </span>
                          {sup.bankAccount && (
                            <div className="text-[10px] text-[#86868B] font-mono mt-1 truncate max-w-[150px]" title={sup.bankAccount}>
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
                                fin.outstanding > 0 ? "text-[#B25E00]" : "text-[#288548]"
                              }`}
                            >
                              {formatINR(fin.outstanding)}
                            </span>
                            <span
                              className={`block text-[10px] font-medium ${
                                fin.outstanding > 0 ? "text-[#B25E00]" : "text-[#288548]"
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
                              aria-label={`Record payout to ${sup.name}`}
                              title="Record Payout / Payment"
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#288548] border border-emerald-200/60 font-medium text-xs transition flex items-center gap-1 shadow-apple-sm btn-press cursor-pointer"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pay</span>
                            </button>

                            {/* Edit Supplier Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(sup)}
                              aria-label={`Edit ${sup.name}`}
                              title="Edit Supplier Details"
                              className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Supplier Button */}
                            <button
                              type="button"
                              onClick={() => setSupplierToDelete(sup)}
                              aria-label={`Delete ${sup.name}`}
                              title="Delete Supplier"
                              className="p-1.5 rounded-lg text-[#86868B] hover:text-[#D70015] hover:bg-rose-50 transition cursor-pointer"
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

          {/* Footer info & pagination bar */}
          <div className="px-4 sm:px-6 py-3.5 bg-[#FAFAFC] border-t border-black/[0.06] flex flex-col md:flex-row items-center justify-between text-xs text-[#86868B] gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-xs text-[#64748B]">
                {filteredSuppliers.length === suppliers.length ? (
                  <span>
                    <strong className="font-semibold text-[#1D1D1F] tabular-nums">{suppliers.length}</strong> total rows
                  </span>
                ) : (
                  <span>
                    <strong className="font-semibold text-[#1D1D1F] tabular-nums">{filteredSuppliers.length}</strong> of{" "}
                    <strong className="font-semibold text-[#1D1D1F] tabular-nums">{suppliers.length}</strong> total rows
                  </span>
                )}
              </div>


            </div>

            <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
              {/* Rows per page selector */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-[#1D1D1F] font-normal whitespace-nowrap">
                  Rows per page
                </span>
                <div className="relative inline-flex items-center">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Rows per page"
                    className="appearance-none bg-white border border-black/[0.1] hover:border-black/[0.2] text-xs font-semibold text-[#1D1D1F] pl-3 pr-7 py-1 rounded-lg shadow-apple-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2 pointer-events-none stroke-[2]" />
                </div>
              </div>

              {/* Page X of Y */}
              <div className="text-xs text-[#1D1D1F] font-normal whitespace-nowrap">
                Page <span className="font-semibold tabular-nums">{currentPage}</span> of{" "}
                <span className="font-semibold tabular-nums">{totalPages}</span>
              </div>

              {/* Four navigation buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  aria-label="First page"
                  title="First page"
                  className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4 stroke-[1.75]" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  title="Previous page"
                  className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  title="Next page"
                  className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 stroke-[1.75]" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  aria-label="Last page"
                  title="Last page"
                  className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* ADD NEW SUPPLIER MODAL                                                            */}
      {/* --------------------------------------------------------------------------------- */}
      <SupplierModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        mode="create"
        onSave={(supplier) => addSupplier(supplier)}
      />

      {/* --------------------------------------------------------------------------------- */}
      {/* EDIT SUPPLIER MODAL                                                               */}
      {/* --------------------------------------------------------------------------------- */}
      <SupplierModal
        isOpen={!!editingSupplier}
        onClose={() => setEditingSupplier(null)}
        mode="edit"
        initialSupplier={editingSupplier}
        onSave={(supplier) => updateSupplier(supplier)}
      />

      {/* --------------------------------------------------------------------------------- */}
      {/* RECORD PAYOUT / PAYMENT MODAL                                                     */}
      {/* --------------------------------------------------------------------------------- */}
      {/* RECORD PAYOUT / PAYMENT MODAL                                                     */}
      {/* --------------------------------------------------------------------------------- */}
      {mounted && payoutSupplier && createPortal(
        <div
          onClick={() => setPayoutSupplier(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.05]">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">Record Vendor Payout</h3>
                  <span className="text-xs text-[#86868B]">{payoutSupplier.name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayoutSupplier(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  Payout Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={payoutAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-sm font-semibold text-[#1D1D1F] tabular-nums focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">
                    Method
                  </label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 cursor-pointer"
                  >
                    <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT)</option>
                    <option value="UPI / QR">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  Bank Transaction / UTR Reference #
                </label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. UTR-982173921"
                  className="w-full px-3 py-2 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="Invoice settlement batch reference..."
                  className="w-full px-3 py-2 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.05]">
                <button
                  type="button"
                  onClick={() => setPayoutSupplier(null)}
                  className="px-4 py-2 text-[#6E6E73] hover:bg-black/[0.04] rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --------------------------------------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL                                                         */}
      {/* --------------------------------------------------------------------------------- */}
      {mounted && supplierToDelete && createPortal(
        <div
          onClick={() => setSupplierToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 text-[#D70015] flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F]">Delete Supplier?</h3>
                  <p className="text-xs text-[#86868B] mt-0.5">Supplier: <strong className="font-semibold text-[#1D1D1F]">{supplierToDelete.name}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                aria-label="Close dialog"
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Are you sure you want to permanently remove <strong className="text-[#1D1D1F]">{supplierToDelete.name}</strong> from your supplier directory? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.05]">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 text-[#6E6E73] hover:bg-black/[0.04] rounded-xl text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-[#D70015] hover:bg-[#c00013] text-white rounded-xl text-xs font-semibold shadow-apple-sm btn-press transition cursor-pointer"
              >
                Delete Supplier
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
