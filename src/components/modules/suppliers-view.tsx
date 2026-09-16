"use client";

import React, { useState } from "react";
import { Supplier, PurchaseBill } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X } from "lucide-react";

export function SuppliersView() {
  const { suppliers, purchases, products, addPurchase } = usePlatform();

  const [activeTab, setActiveTab] = useState<"purchases" | "suppliers">("purchases");
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);

  // New Purchase state
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [invoiceNumber, setInvoiceNumber] = useState("APX-INV-9925");
  const [sku, setSku] = useState(products[0]?.sku || "");
  const [quantity, setQuantity] = useState(100);
  const [unitCost, setUnitCost] = useState(380);
  const [taxRate, setTaxRate] = useState(18);

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === supplierId);
    const subtotal = quantity * unitCost;
    const taxes = Math.round(subtotal * (taxRate / 100));
    const totalAmount = subtotal + taxes;

    const newBill: PurchaseBill = {
      id: `PUR-${Date.now().toString().slice(-4)}`,
      supplierId,
      supplierName: sup?.name || "Supplier",
      invoiceNumber,
      invoiceDate: new Date().toISOString().split("T")[0],
      sku,
      quantity,
      unitCost,
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
          <span className="font-mono font-semibold text-[#1D1D1F] block text-xs">
            {row.original.invoiceNumber}
          </span>
          <span className="font-mono text-[11px] text-[#86868B]">{row.original.id}</span>
        </div>
      ),
    },
    {
      accessorKey: "supplierName",
      header: "Vendor",
      cell: ({ row }) => (
        <span className="font-medium text-xs text-[#1D1D1F]">
          {row.original.supplierName}
        </span>
      ),
    },
    {
      accessorKey: "sku",
      header: "SKU / Quantity",
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-[#1D1D1F] block text-xs">{row.original.sku}</span>
          <span className="text-[11px] text-[#86868B]">
            {row.original.quantity} units @ {formatINR(row.original.unitCost)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "taxes",
      header: "GST (ITC)",
      cell: ({ row }) => (
        <span className="font-mono text-[#86868B] text-xs">
          {formatINR(row.original.taxes)}
        </span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Total Billed",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-[#1D1D1F] text-xs">
          {formatINR(row.original.totalAmount)}
        </span>
      ),
    },
    {
      accessorKey: "paymentStatus",
      header: "Payment",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[#1D1D1F] font-medium">{row.original.paymentStatus}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Procurement & Purchases
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Vendor master records, inbound supplier purchase bills, and input tax credit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-black/[0.04] p-1 rounded-full text-xs flex">
            <button
              onClick={() => setActiveTab("purchases")}
              className={`px-3 py-1 rounded-full font-medium transition ${
                activeTab === "purchases"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Bills
            </button>
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`px-3 py-1 rounded-full font-medium transition ${
                activeTab === "suppliers"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Vendors
            </button>
          </div>
          <button
            onClick={() => setIsAddPurchaseOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Record Purchase</span>
          </button>
        </div>
      </div>

      {activeTab === "purchases" ? (
        <DataTable
          columns={purchaseColumns}
          data={purchases}
          searchKey="invoiceNumber"
          searchPlaceholder="Search bills by invoice or SKU..."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="bg-white p-6 rounded-3xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1D1D1F]">{sup.name}</h3>
                <span className="font-mono text-[11px] text-[#86868B]">{sup.id}</span>
              </div>
              <div className="text-[#6E6E73]">
                <span>Contact:</span> {sup.contactPerson} ({sup.phone})
              </div>
              <div className="text-[#6E6E73]">
                <span>GSTIN:</span> <span className="font-mono text-[#1D1D1F]">{sup.gstin}</span>
              </div>
              <div className="text-[#86868B]">{sup.address}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add Purchase Bill Modal */}
      {isAddPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-black/[0.06] w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Record Supplier Purchase Bill</h2>
              <button
                onClick={() => setIsAddPurchaseOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePurchase} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Select Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.gstin})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">SKU</label>
                  <select
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
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
                  <label className="font-medium text-[#6E6E73] block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">GST %</label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPurchaseOpen(false)}
                  className="px-4 py-1.5 rounded-full text-[#6E6E73] hover:bg-black/[0.03] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#1D1D1F] hover:bg-black text-white rounded-full text-xs font-medium shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
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
