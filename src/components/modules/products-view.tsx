"use client";

import React, { useState } from "react";
import { Product } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  History,
  X,
  Plus,
} from "lucide-react";

export function ProductsView() {
  const { products, updateProductCost } = usePlatform();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditCostOpen, setIsEditCostOpen] = useState(false);
  const [newCost, setNewCost] = useState<number>(350);
  const [costChangeReason, setCostChangeReason] = useState<string>(
    "Supplier revision due to raw material adjustment"
  );

  const handleOpenEditCost = (prod: Product) => {
    setSelectedProduct(prod);
    setNewCost(prod.currentCostPrice);
    setIsEditCostOpen(true);
  };

  const handleSubmitCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    updateProductCost(selectedProduct.sku, Number(newCost), costChangeReason);
    setIsEditCostOpen(false);

    const updated = products.find((p) => p.sku === selectedProduct.sku);
    if (updated) setSelectedProduct(updated);
  };

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "sku",
      header: "SKU / Code",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-semibold text-[#1D1D1F] block text-xs">
            {row.original.sku}
          </span>
          <span className="text-[11px] text-[#86868B]">{row.original.id}</span>
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: "Product Title",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-[#1D1D1F] text-xs line-clamp-1">{row.original.name}</div>
          <div className="text-[11px] text-[#86868B]">
            {row.original.brand} • {row.original.category}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "currentCostPrice",
      header: "Active Cost (COGS)",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-semibold text-[#1D1D1F] text-xs">
            {formatINR(row.original.currentCostPrice)}
          </span>
          <span className="text-[11px] text-[#86868B] block">Current window</span>
        </div>
      ),
    },
    {
      id: "aliases",
      header: "Channel SKU Aliases",
      cell: ({ row }) => {
        const aliases = row.original.channelAliases;
        return (
          <div className="flex flex-wrap gap-1 text-[11px] font-mono">
            <span className="px-2 py-0.5 bg-black/[0.04] text-[#1D1D1F] rounded-md">
              AZ: {aliases["Amazon India"]}
            </span>
            <span className="px-2 py-0.5 bg-black/[0.04] text-[#1D1D1F] rounded-md">
              FK: {aliases["Flipkart"]}
            </span>
            <span className="px-2 py-0.5 bg-black/[0.04] text-[#1D1D1F] rounded-md">
              MSH: {aliases["Meesho"]}
            </span>
          </div>
        );
      },
    },
    {
      id: "historyCount",
      header: "Cost Versions",
      cell: ({ row }) => (
        <span className="text-xs text-[#86868B] font-medium">
          {row.original.costHistory.length} revisions
        </span>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const prod = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedProduct(prod)}
              className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition"
            >
              Timeline
            </button>
            <button
              onClick={() => handleOpenEditCost(prod)}
              className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition"
            >
              Revise Cost
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Product Catalog & Cost Basis
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Point-in-time historical cost basis preservation. Price changes create versioned windows without rewriting past margins.
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchKey="name"
        searchPlaceholder="Search catalog by SKU or title..."
      />

      {/* Historical Cost Drawer */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-black/[0.06] w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between">
              <div>
                <span className="font-mono text-[11px] text-[#86868B] block">
                  {selectedProduct.sku}
                </span>
                <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                  Cost Basis History: {selectedProduct.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="p-4 bg-[#FAFAFC] rounded-2xl border border-black/[0.04] text-[#6E6E73] leading-relaxed">
                <span className="font-medium text-[#1D1D1F] block mb-0.5">Immutability Principle</span>
                Orders placed in past months locked the unit cost active at that exact timestamp. When suppliers raise prices, previous order margins remain untouched and authentic.
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Cost Windows Timeline
                </h3>
                <div className="border border-black/[0.05] rounded-2xl divide-y divide-black/[0.04] overflow-hidden">
                  {selectedProduct.costHistory.map((h, idx) => {
                    const isCurrent = !h.validTo;
                    return (
                      <div key={idx} className="p-4 bg-white flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1D1D1F] text-sm">
                              {formatINR(h.costPrice)}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[#86868B] block mt-0.5">
                            {formatDate(h.validFrom)} → {h.validTo ? formatDate(h.validTo) : "Present"}
                          </span>
                          {h.notes && (
                            <span className="text-[11px] text-[#86868B] italic block mt-1">
                              {h.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex justify-between items-center">
              <button
                onClick={() => handleOpenEditCost(selectedProduct)}
                className="px-4 py-1.5 bg-black/[0.05] hover:bg-black/[0.1] text-[#1D1D1F] rounded-full text-xs font-medium transition"
              >
                Revise Cost Window
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-1.5 bg-[#1D1D1F] text-white rounded-full text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revise Cost Modal */}
      {isEditCostOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-black/[0.06] w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                Update Purchasing Cost: {selectedProduct.sku}
              </h2>
              <button
                onClick={() => setIsEditCostOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitCost} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-[#FAFAFC] border border-black/[0.04] rounded-2xl">
                <span className="text-[#86868B] block">Current Purchasing Cost:</span>
                <span className="font-semibold text-[#1D1D1F] text-base mt-0.5 block">
                  {formatINR(selectedProduct.currentCostPrice)}
                </span>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  New Unit Purchasing Cost (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl font-mono text-xs focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">
                  Revision Reason (Audited)
                </label>
                <textarea
                  value={costChangeReason}
                  onChange={(e) => setCostChangeReason(e.target.value)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                  rows={2}
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditCostOpen(false)}
                  className="px-4 py-1.5 rounded-full text-[#6E6E73] hover:bg-black/[0.03] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#1D1D1F] hover:bg-black text-white rounded-full text-xs font-medium shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                >
                  Commit New Cost Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
