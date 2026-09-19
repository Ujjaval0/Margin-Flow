"use client";

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
    return () => setMounted(false);
  }, []);

  const [purchaseSupplierId, setPurchaseSupplierId] = useState(suppliers[0]?.id || "");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("INV-2026-901");
  const [purchaseSku, setPurchaseSku] = useState(products[0]?.sku || "");
  const [purchaseQty, setPurchaseQty] = useState(100);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState(products[0]?.currentCostPrice || 350);
  const [purchaseTaxRate, setPurchaseTaxRate] = useState(18);

  if (!isOpen || !mounted) return null;

  const subtotal = purchaseQty * purchaseUnitCost;
  const taxes = Math.round(subtotal * (purchaseTaxRate / 100));
  const totalAmount = subtotal + taxes;

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
      quantity: Number(purchaseQty),
      unitCost: Number(purchaseUnitCost),
      taxes,
      totalAmount,
      paymentStatus: "PAID",
    };

    onAddPurchase(newBill);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Supplier Purchase / Payment</h3>
              <p className="text-xs text-slate-500">Record wholesale inventory purchases and COGS liability.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Wholesale Supplier</label>
              <select
                value={purchaseSupplierId}
                onChange={(e) => setPurchaseSupplierId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.contactPerson})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Invoice / Bill Ref</label>
              <input
                type="text"
                placeholder="e.g. INV-9921"
                value={purchaseInvoiceNo}
                onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Purchased Product SKU</label>
            <select
              value={purchaseSku}
              onChange={(e) => {
                setPurchaseSku(e.target.value);
                const prod = products.find((p) => p.sku === e.target.value);
                if (prod) setPurchaseUnitCost(prod.currentCostPrice);
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} — {p.name} (Current Cost: ₹{p.currentCostPrice})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={purchaseQty}
                onChange={(e) => setPurchaseQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Unit Cost (₹)</label>
              <input
                type="number"
                min="1"
                value={purchaseUnitCost}
                onChange={(e) => setPurchaseUnitCost(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">GST Tax Rate (%)</label>
              <select
                value={purchaseTaxRate}
                onChange={(e) => setPurchaseTaxRate(parseInt(e.target.value) || 18)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
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
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-emerald-900 font-bold block">Total Billed to Supplier:</span>
              <span className="text-[11px] text-emerald-700 font-medium">
                Subtotal: {formatINR(subtotal)} + GST ({purchaseTaxRate}%): {formatINR(taxes)}
              </span>
            </div>
            <span className="text-lg font-bold text-emerald-900 font-mono">
              {formatINR(totalAmount)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs"
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
