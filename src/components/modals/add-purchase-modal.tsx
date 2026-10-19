"use client";

import { NumericInput } from "@/components/ui/numeric-input";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Truck, X } from "lucide-react";
import { Supplier, Product, PurchaseBill } from "@/domain/types";
import { formatINR } from "@/lib/utils";

export interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  onAddPurchase: (bill: PurchaseBill) => void;
}

export function AddPurchaseModal({
  isOpen,
  onClose,
  suppliers,
  products,
  onAddPurchase,
}: AddPurchaseModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      setMounted(false);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [purchaseSupplierId, setPurchaseSupplierId] = useState(suppliers[0]?.id || "");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [purchaseSku, setPurchaseSku] = useState(products[0]?.sku || "");
  const [purchaseQty, setPurchaseQty] = useState<number | "">("");
  const [purchaseUnitCost, setPurchaseUnitCost] = useState<number | "">(products[0]?.currentCostPrice ?? "");
  const [purchaseTaxRate, setPurchaseTaxRate] = useState(18);

  useEffect(() => {
    if (isOpen) {
      setPurchaseSupplierId(suppliers[0]?.id || "");
      setPurchaseInvoiceNo("");
      setPurchaseSku(products[0]?.sku || "");
      setPurchaseQty("");
      setPurchaseUnitCost(products[0]?.currentCostPrice ?? "");
      setPurchaseTaxRate(18);
    }
  }, [isOpen, suppliers, products]);

  if (!isOpen || !mounted) return null;

  const numQty = typeof purchaseQty === "number" ? purchaseQty : Number(purchaseQty) || 0;
  const numUnitCost = typeof purchaseUnitCost === "number" ? purchaseUnitCost : Number(purchaseUnitCost) || 0;
  const subtotal = numQty * numUnitCost;
  const taxes = Math.round(subtotal * (purchaseTaxRate / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxes) * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === purchaseSupplierId);

    const newBill: PurchaseBill = {
      id: `PUR-${Date.now().toString().slice(-5)}`,
      supplierId: purchaseSupplierId,
      supplierName: sup?.name || "Wholesale Supplier",
      invoiceNumber: purchaseInvoiceNo || `INV-${Date.now().toString().slice(-4)}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      sku: purchaseSku,
      quantity: numQty,
      unitCost: numUnitCost,
      taxes,
      totalAmount,
      paymentStatus: "PAID",
    };

    onAddPurchase(newBill);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] p-4 sm:p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-black/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">Add Supplier Purchase / Payment</h3>
              <p className="text-xs text-[#86868B]">Record wholesale inventory purchases and COGS liability.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#6E6E73] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-[#6E6E73] block mb-1">Wholesale Supplier</label>
              <select
                value={purchaseSupplierId}
                onChange={(e) => setPurchaseSupplierId(e.target.value)}
                className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 cursor-pointer"
              >
                {suppliers.length === 0 ? (
                  <option value="">No suppliers available</option>
                ) : (
                  suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="font-medium text-[#6E6E73] block mb-1">Invoice / Bill Ref</label>
              <input
                type="text"
                placeholder="e.g. INV-9921"
                value={purchaseInvoiceNo}
                onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
              />
            </div>
          </div>

          <div>
            <label className="font-medium text-[#6E6E73] block mb-1">Purchased Product SKU</label>
            <select
              value={purchaseSku}
              onChange={(e) => {
                setPurchaseSku(e.target.value);
                const prod = products.find((p) => p.sku === e.target.value);
                setPurchaseUnitCost(prod ? prod.currentCostPrice : "");
              }}
              className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 cursor-pointer"
            >
              {products.length === 0 ? (
                <option value="">No products available</option>
              ) : (
                products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} — {p.name} (Current Cost: ₹{p.currentCostPrice})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-medium text-[#6E6E73] block mb-1">Quantity</label>
              <NumericInput
                min="0"
                placeholder="0"
                value={purchaseQty}
                onChange={(e) => setPurchaseQty(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] tabular-nums focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
              />
            </div>
            <div>
              <label className="font-medium text-[#6E6E73] block mb-1">Unit Cost (₹)</label>
              <NumericInput
                min="0"
                step="any"
                placeholder="0.00"
                value={purchaseUnitCost}
                onChange={(e) => setPurchaseUnitCost(e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] tabular-nums focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
              />
            </div>
            <div>
              <label className="font-medium text-[#6E6E73] block mb-1">GST Tax Rate (%)</label>
              <select
                value={purchaseTaxRate}
                onChange={(e) => setPurchaseTaxRate(Number(e.target.value))}
                className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] tabular-nums focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 cursor-pointer"
              >
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={12}>12%</option>
                <option value={18}>18%</option>
                <option value={28}>28%</option>
              </select>
            </div>
          </div>

          {/* Purchase Calculation Summary */}
          <div className="p-3.5 bg-emerald-500/[0.05] border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[#1D1D1F] font-semibold block">Total Billed to Supplier:</span>
              <span className="text-[11px] text-[#288548] font-medium tabular-nums">
                Subtotal: {formatINR(subtotal)} + GST ({purchaseTaxRate}%): {formatINR(taxes)}
              </span>
            </div>
            <span className="text-base font-semibold text-[#288548] tabular-nums tracking-tight">
              {formatINR(totalAmount)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.05]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] font-medium text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium shadow-apple-sm btn-press transition-colors cursor-pointer"
            >
              Record Purchase
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
