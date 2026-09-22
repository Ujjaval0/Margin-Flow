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
  Trash2,
  Building2,
  Package,
} from "lucide-react";

export function ProductsView() {
  const { products, suppliers, addProduct, deleteProduct, updateProductCost } = usePlatform();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditCostOpen, setIsEditCostOpen] = useState(false);
  const [newCost, setNewCost] = useState<number>(350);
  const [costChangeReason, setCostChangeReason] = useState<string>(
    "Supplier revision due to raw material adjustment"
  );

  // Add Product Modal State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Computer Peripherals");
  const [newBrand, setNewBrand] = useState("VoltTech");
  const [newCostPrice, setNewCostPrice] = useState("350");
  const [newSupplierId, setNewSupplierId] = useState(suppliers[0]?.id || "SUP-001");
  const [newStockQty, setNewStockQty] = useState("100");
  const [newAliasAz, setNewAliasAz] = useState("");
  const [newAliasFk, setNewAliasFk] = useState("");
  const [newAliasMsh, setNewAliasMsh] = useState("");

  const handleOpenAddProduct = () => {
    setNewSupplierId(suppliers[0]?.id || "SUP-001");
    setNewSku("");
    setNewName("");
    setNewCostPrice("350");
    setNewStockQty("100");
    setNewAliasAz("");
    setNewAliasFk("");
    setNewAliasMsh("");
    setIsAddProductOpen(true);
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim()) return;

    const formattedSku = newSku.trim().toUpperCase();
    const parsedCost = Math.max(0, parseFloat(newCostPrice) || 0);

    const newProd: Product = {
      id: `PROD-${Date.now().toString().slice(-4)}`,
      sku: formattedSku,
      name: newName.trim(),
      category: newCategory.trim() || "General",
      brand: newBrand.trim() || "Brand",
      currentCostPrice: parsedCost,
      supplierId: newSupplierId,
      active: true,
      stockQuantity: Math.max(0, parseInt(newStockQty) || 0),
      channelAliases: {
        "Amazon India": newAliasAz.trim() || formattedSku,
        Flipkart: newAliasFk.trim() || formattedSku,
        Meesho: newAliasMsh.trim() || formattedSku,
        "Personal Website": formattedSku,
      },
      costHistory: [
        {
          validFrom: new Date().toISOString().split("T")[0],
          costPrice: parsedCost,
          notes: "Initial product creation",
        },
      ],
    };

    addProduct(newProd);
    setIsAddProductOpen(false);
  };

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
          <span className="font-semibold text-[#1D1D1F] block text-xs tracking-tight">
            {row.original.sku}
          </span>
          <span className="text-[11px] text-[#86868B] tabular-nums">{row.original.id}</span>
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
          <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums block">
            {formatINR(row.original.currentCostPrice)}
          </span>
          <span className="text-[11px] text-[#86868B] block">Current window</span>
        </div>
      ),
    },
    {
      id: "supplier",
      header: "Wholesale Supplier",
      cell: ({ row }) => {
        const sup = suppliers.find(
          (s) => s.id === row.original.supplierId || s.name.toLowerCase() === row.original.supplierId.toLowerCase()
        );
        return (
          <div>
            <div className="font-semibold text-[#1D1D1F] text-xs flex items-center gap-1">
              <Building2 className="w-3 h-3 text-purple-600 shrink-0" />
              <span className="truncate max-w-[150px]">{sup?.name || row.original.supplierId || "Direct Supplier"}</span>
            </div>
            {sup && (
              <div className="text-[10px] text-[#86868B] font-mono">
                {sup.id} • {sup.paymentTerms}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "aliases",
      header: "Channel SKU Aliases",
      cell: ({ row }) => {
        const aliases = row.original.channelAliases;
        return (
          <div className="flex flex-wrap gap-1 text-[11px]">
            <span className="px-2 py-0.5 bg-black/[0.04] text-[#1D1D1F] font-medium rounded-md tabular-nums">
              AZ: {aliases["Amazon India"]}
            </span>
            <span className="px-2 py-0.5 bg-black/[0.04] text-[#1D1D1F] font-medium rounded-md tabular-nums">
              FK: {aliases["Flipkart"]}
            </span>
            <span className="px-2 py-0.5 bg-black/[0.04] text-[#1D1D1F] font-medium rounded-md tabular-nums">
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
              className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition cursor-pointer"
            >
              Timeline
            </button>
            <button
              onClick={() => handleOpenEditCost(prod)}
              className="px-3 py-1 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] font-medium text-[11px] transition cursor-pointer"
            >
              Revise Cost
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete product ${prod.sku} (${prod.name}) from catalog?`)) {
                  deleteProduct(prod.sku);
                }
              }}
              title="Delete Product"
              className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Product Catalog & Cost Basis
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Point-in-time historical cost basis preservation. Price changes create versioned windows without rewriting past margins.
          </p>
        </div>
        <button
          onClick={handleOpenAddProduct}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-full shadow-sm shadow-purple-600/20 transition cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span>Add New Product</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchKey="name"
        searchPlaceholder="Search catalog by SKU or title..."
      />

      {/* Historical Cost Drawer */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-black/[0.08] w-full max-w-lg max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-slate-50/50">
              <div>
                <span className="text-[11px] text-[#86868B] tabular-nums block">
                  {selectedProduct.sku}
                </span>
                <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight mt-0.5">
                  Cost Basis History: {selectedProduct.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 text-xs">
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
                            <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
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

            <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFC] flex justify-between items-center shrink-0">
              <button
                onClick={() => handleOpenEditCost(selectedProduct)}
                className="px-4 py-2 bg-black/[0.05] hover:bg-black/[0.1] text-[#1D1D1F] rounded-xl text-xs font-medium transition-colors"
              >
                Revise Cost Window
              </button>
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revise Cost Modal */}
      {isEditCostOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-black/[0.08] w-full max-w-md max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-slate-50/50">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                Update Purchasing Cost: {selectedProduct.sku}
              </h2>
              <button
                onClick={() => setIsEditCostOpen(false)}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form id="edit-cost-form" onSubmit={handleSubmitCost} className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
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
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-slate-50/50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditCostOpen(false)}
                className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-cost-form"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-colors"
              >
                Commit New Cost Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-black/[0.08] w-full max-w-lg max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                    Add New Catalog Product
                  </h2>
                  <p className="text-[11px] text-[#86868B]">
                    Configure master SKU, wholesale purchasing supplier, and default costs.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              id="add-product-form"
              onSubmit={handleAddProductSubmit}
              className="p-6 space-y-3.5 text-xs overflow-y-auto flex-1 min-h-0"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Master SKU *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ELEC-KEYB-RGB"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono font-medium uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Wholesale Supplier *
                  </label>
                  <select
                    value={newSupplierId}
                    onChange={(e) => setNewSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium cursor-pointer"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                    <option value="Direct Supplier">Direct Supplier / Spot Purchase</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Product Title / Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. RGB Mechanical Gaming Keyboard"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Peripherals"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VoltTech"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Unit Purchase Cost (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="350"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Warehouse Stock (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Marketplace Channel SKU Aliases (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Amazon India</span>
                    <input
                      type="text"
                      placeholder="e.g. B08KEYB-RGB"
                      value={newAliasAz}
                      onChange={(e) => setNewAliasAz(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Flipkart</span>
                    <input
                      type="text"
                      placeholder="e.g. FLIP-KEYB-RGB"
                      value={newAliasFk}
                      onChange={(e) => setNewAliasFk(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Meesho</span>
                    <input
                      type="text"
                      placeholder="e.g. MSHO-KEYB"
                      value={newAliasMsh}
                      onChange={(e) => setNewAliasMsh(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-slate-50/50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-product-form"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-purple-600/20 transition-colors cursor-pointer"
              >
                Create Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
