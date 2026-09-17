"use client";

import React, { useState } from "react";
import { PurchaseBill } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X } from "lucide-react";

export function PurchasesView() {
  const { suppliers, purchases, products, addPurchase } = usePlatform();

  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);

  // New Purchase state
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [sku, setSku] = useState(products[0]?.sku || "");
  const [quantity, setQuantity] = useState("100");
  const [unitCost, setUnitCost] = useState("380");
  const [taxRate, setTaxRate] = useState("18");

  const parsedQty = parseFloat(quantity) || 1;
  const parsedUnitCost = parseFloat(unitCost) || 0;
  const parsedTaxRate = parseFloat(taxRate) || 0;

  const subtotal = parsedQty * parsedUnitCost;
  const taxes = Math.round(subtotal * (parsedTaxRate / 100));
  const totalAmount = subtotal + taxes;

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === supplierId);

    const newBill: PurchaseBill = {
      id: `PUR-${Date.now().toString().slice(-4)}`,
      supplierId,
      supplierName: sup?.name || "Direct Supplier",
      invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-4)}`,
      invoiceDate: new Date().toISOString().split("T")[0],
      sku,
      quantity: parsedQty,
      unitCost: parsedUnitCost,
      taxes,
      totalAmount,
      paymentStatus: "PAID",
    };

    addPurchase(newBill);
    setIsAddPurchaseOpen(false);
  };

  const purchaseColumns: ColumnDef<PurchaseBill>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice / Bill Ref",
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-[#1D1D1F] block text-xs tracking-tight">
            {row.original.invoiceNumber}
          </span>
          <span className="text-[11px] text-[#86868B] tabular-nums">{row.original.id}</span>
        </div>
      ),
    },
    {
      accessorKey: "supplierName",
      header: "Vendor / Supplier",
      cell: ({ row }) => (
        <span className="font-semibold text-xs text-[#1D1D1F]">
          {row.original.supplierName}
        </span>
      ),
    },
    {
      accessorKey: "sku",
      header: "SKU / Quantity",
      cell: ({ row }) => (
        <div>
          <span className="text-[#1D1D1F] block text-xs font-semibold">{row.original.sku}</span>
          <span className="text-[11px] text-[#86868B] tabular-nums">
            <span className="font-semibold text-[#1D1D1F]">{row.original.quantity}</span> units @ {formatINR(row.original.unitCost)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "taxes",
      header: "GST (ITC)",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-slate-600 tracking-tight tabular-nums">
          {formatINR(row.original.taxes)}
        </span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Total Billed",
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
          {formatINR(row.original.totalAmount)}
        </span>
      ),
    },
    {
      accessorKey: "paymentStatus",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-emerald-800 font-semibold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px]">
            {row.original.paymentStatus}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Purchases & Inbound Bills
          </h1>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Procurement records, inbound supplier purchase bills, and input tax credit (ITC) tracking.
          </p>
        </div>
        <button
          onClick={() => setIsAddPurchaseOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-full shadow-sm shadow-purple-600/20 transition"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span>Record Purchase Bill</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-1">
        <DataTable
          columns={purchaseColumns}
          data={purchases}
          searchKey="invoiceNumber"
          searchPlaceholder="Search bills by invoice or SKU..."
        />
      </div>

      {/* Add Purchase Bill Modal */}
      {isAddPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Record Purchase Bill</h2>
              <button
                type="button"
                onClick={() => setIsAddPurchaseOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePurchase} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Select Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.gstin ? `(${s.gstin})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">SKU</label>
                  <select
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                  >
                    {products.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={unitCost}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">GST Rate (%)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={taxRate}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 flex items-center justify-between text-xs tabular-nums">
                <span className="font-medium">Subtotal: <strong className="text-slate-800 font-semibold">{formatINR(subtotal)}</strong></span>
                <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Total: {formatINR(totalAmount)}</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPurchaseOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/20 transition"
                >
                  Save Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
