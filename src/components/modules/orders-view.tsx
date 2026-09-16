"use client";

import React, { useState } from "react";
import {
  Order,
  OrderStatus,
  Marketplace,
} from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate, formatPercent } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  FileSpreadsheet,
  X,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { calculateOrderProfitability } from "@/domain/profitability-engine";

interface OrdersViewProps {
  selectedMarketplace: Marketplace | "ALL";
}

export function OrdersView({ selectedMarketplace }: OrdersViewProps) {
  const {
    orders,
    products,
    returns,
    settlements,
    claims,
    addOrder,
    updateOrderStatus,
  } = usePlatform();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);

  const filteredOrders = orders.filter(
    (o) => selectedMarketplace === "ALL" || o.marketplace === selectedMarketplace
  );

  // New Order Form state
  const [newMarketplace, setNewMarketplace] = useState<Marketplace>("Amazon India");
  const [newChannelOrderId, setNewChannelOrderId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerCity, setNewCustomerCity] = useState("Mumbai");
  const [newSku, setNewSku] = useState(products[0]?.sku || "");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newSellingPrice, setNewSellingPrice] = useState(999);
  const [newDiscount, setNewDiscount] = useState(0);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.sku === newSku);
    const snapshotCost = product ? product.currentCostPrice : 300;

    const orderId = `ORD-${Date.now().toString().slice(-4)}`;
    const created: Order = {
      id: orderId,
      channelOrderId: newChannelOrderId || `CH-${Date.now().toString().slice(-6)}`,
      marketplace: newMarketplace,
      orderDate: new Date().toISOString().split("T")[0],
      status: "CONFIRMED",
      customerName: newCustomerName || "Guest Buyer",
      customerCity: newCustomerCity,
      customerState: "Maharashtra",
      shippingFeeCharged: 0,
      marketplaceChargesEstimate: Math.round(newSellingPrice * newQuantity * 0.15),
      items: [
        {
          id: `ITEM-${Date.now().toString().slice(-3)}`,
          sku: newSku,
          productName: product?.name || "Catalog Product",
          quantity: Number(newQuantity),
          sellingPrice: Number(newSellingPrice),
          discount: Number(newDiscount),
          taxAmount: Math.round(newSellingPrice * newQuantity * 0.18 * 100) / 100,
          snapshotUnitCost: snapshotCost,
          returnedQuantity: 0,
        },
      ],
    };

    addOrder(created);
    setIsCreateOpen(false);
    setNewChannelOrderId("");
    setNewCustomerName("");
  };

  const handleSampleCsvImport = (channel: Marketplace) => {
    const batchId = Date.now().toString().slice(-3);
    const importedOrder: Order = {
      id: `ORD-CSV-${batchId}`,
      channelOrderId: `${channel.slice(0, 2).toUpperCase()}-CSV-${batchId}99`,
      marketplace: channel,
      orderDate: new Date().toISOString().split("T")[0],
      status: "CONFIRMED",
      customerName: `CSV Buyer (${channel})`,
      customerCity: "Pune",
      customerState: "Maharashtra",
      shippingFeeCharged: 40,
      marketplaceChargesEstimate: 180,
      items: [
        {
          id: `ITEM-CSV-${batchId}`,
          sku: products[1]?.sku || "ELEC-USBC-65W",
          productName: products[1]?.name || "65W GaN Fast Charger",
          quantity: 1,
          sellingPrice: 1299,
          discount: 50,
          taxAmount: 190.5,
          snapshotUnitCost: products[1]?.currentCostPrice || 420,
          returnedQuantity: 0,
        },
      ],
    };
    addOrder(importedOrder);
    setIsCsvImportOpen(false);
  };

  const columns: ColumnDef<Order>[] = [
    {
      accessorKey: "id",
      header: "Order / Ref",
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-bold text-blue-600 block text-xs">
            {row.original.id}
          </span>
          <span className="font-mono text-[11px] text-[#86868B]">
            {row.original.channelOrderId}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "marketplace",
      header: "Channel",
      cell: ({ row }) => {
        const mp = row.original.marketplace;
        const colorMap: Record<Marketplace, string> = {
          "Amazon India": "bg-amber-50 text-amber-800 border border-amber-200/80",
          Flipkart: "bg-blue-50 text-blue-800 border border-blue-200/80",
          Meesho: "bg-pink-50 text-pink-800 border border-pink-200/80",
          "Personal Website": "bg-emerald-50 text-emerald-800 border border-emerald-200/80",
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${colorMap[mp]}`}>
            {mp}
          </span>
        );
      },
    },
    {
      accessorKey: "orderDate",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-[#6E6E73] text-xs font-medium">
          {formatDate(row.original.orderDate)}
        </span>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-[#1D1D1F] text-xs">{row.original.customerName}</div>
          <div className="text-[11px] text-[#86868B]">{row.original.customerCity}</div>
        </div>
      ),
    },
    {
      id: "items",
      header: "Items & SKU",
      cell: ({ row }) => {
        const item = row.original.items[0];
        const extra = row.original.items.length - 1;
        return (
          <div>
            <div className="font-medium text-[#1D1D1F] text-xs line-clamp-1 max-w-[190px]">
              {item ? item.productName : "No Items"}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#86868B] font-mono mt-0.5">
              <span className="font-medium text-slate-700">{item?.sku}</span>
              <span>•</span>
              <span className="font-semibold text-slate-900">Qty {item?.quantity}</span>
              {extra > 0 && <span className="text-blue-600 font-semibold">+{extra} more</span>}
            </div>
          </div>
        );
      },
    },
    {
      id: "sellingPrice",
      header: "Net Revenue",
      cell: ({ row }) => {
        const total = row.original.items.reduce(
          (sum, i) => sum + i.sellingPrice * i.quantity - i.discount,
          0
        );
        return <span className="font-bold text-[#1D1D1F] text-xs">{formatINR(total)}</span>;
      },
    },
    {
      id: "snapshotCost",
      header: "COGS Basis",
      cell: ({ row }) => {
        const cogs = row.original.items.reduce(
          (sum, i) => sum + i.snapshotUnitCost * i.quantity,
          0
        );
        return (
          <span className="text-slate-600 text-xs font-mono font-medium" title="Locked historical unit cost">
            {formatINR(cogs)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const badgeColors: Record<OrderStatus, string> = {
          PENDING: "bg-slate-100 text-slate-700 border border-slate-200",
          CONFIRMED: "bg-blue-50 text-blue-700 border border-blue-200",
          SHIPPED: "bg-indigo-50 text-indigo-700 border border-indigo-200",
          DELIVERED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
          CANCELLED: "bg-rose-50 text-rose-700 border border-rose-200",
          RTO: "bg-amber-50 text-amber-800 border border-amber-200",
          RETURNED: "bg-orange-50 text-orange-800 border border-orange-200",
          PARTIALLY_RETURNED: "bg-purple-50 text-purple-800 border border-purple-200",
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeColors[status]}`}>
            {status.replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "P&L",
      cell: ({ row }) => {
        const order = row.original;
        return (
          <button
            onClick={() => setSelectedOrder(order)}
            className="px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] border border-blue-200/60 transition flex items-center gap-1"
          >
            <span>Unit P&L</span>
            <ArrowUpRight className="w-3 h-3 text-blue-600" />
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Orders Ledger
          </h1>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Operational order intake, channel synchronization, and historical snapshot costing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import Channel CSV</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={filteredOrders}
        searchKey="channelOrderId"
        searchPlaceholder="Search order ID, channel ref, customer..."
      />

      {/* Order Profitability Detail Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[11px] font-mono text-blue-600 font-semibold block">
                  {selectedOrder.marketplace} • {selectedOrder.channelOrderId}
                </span>
                <h2 className="text-base font-bold text-[#1D1D1F] tracking-tight mt-0.5">
                  Order P&L Breakdown: {selectedOrder.id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Order P&L Breakdown */}
              {(() => {
                const pnl = calculateOrderProfitability(
                  selectedOrder,
                  returns,
                  settlements,
                  claims
                );
                return (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="font-bold text-[#1D1D1F]">Order Profit Margin</span>
                      <span
                        className={`font-bold px-3 py-1 rounded-full text-xs border ${
                          pnl.contributionProfit >= 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        Net Profit: {formatINR(pnl.contributionProfit)} ({formatPercent(pnl.contributionMargin)})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                        <span className="text-slate-500 block text-[11px]">Gross Revenue</span>
                        <span className="font-bold text-blue-600 mt-0.5 block">{formatINR(pnl.grossSales)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                        <span className="text-slate-500 block text-[11px]">Snapshot COGS</span>
                        <span className="font-bold text-slate-700 mt-0.5 block">-{formatINR(pnl.cogs)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                        <span className="text-slate-500 block text-[11px]">Marketplace Fees</span>
                        <span className="font-bold text-rose-600 mt-0.5 block">-{formatINR(pnl.chargesDeducted)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                        <span className="text-slate-500 block text-[11px]">Return / RTO Loss</span>
                        <span className="font-bold text-rose-600 mt-0.5 block">-{formatINR(pnl.returnLoss)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                        <span className="text-slate-500 block text-[11px]">Dispute Recoveries</span>
                        <span className="font-bold text-emerald-600 mt-0.5 block">+{formatINR(pnl.claimRecovery)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-slate-100">
                        <span className="text-slate-500 block text-[11px]">Bank Settlement</span>
                        <span className="font-bold text-slate-900 mt-0.5 block">
                          {pnl.isSettled ? formatINR(pnl.settledAmount) : "Pending Settlement"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Line Items */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Line Items (Locked Snapshot)
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {selectedOrder.items.map((i) => (
                    <div key={i.id} className="p-3.5 bg-white flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#1D1D1F] block">{i.productName}</span>
                        <span className="font-mono text-slate-500 text-[11px]">
                          {i.sku} • Qty {i.quantity} (Returned: {i.returnedQuantity})
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#1D1D1F] block">
                          {formatINR(i.sellingPrice * i.quantity)}
                        </span>
                        <span className="text-[11px] text-emerald-600 font-medium">
                          Cost locked @ {formatINR(i.snapshotUnitCost)}/u
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Controls */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Transition Status
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(["CONFIRMED", "SHIPPED", "DELIVERED", "RTO", "RETURNED", "CANCELLED"] as OrderStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => {
                          updateOrderStatus(selectedOrder.id, st);
                          setSelectedOrder((prev) => (prev ? { ...prev, status: st } : null));
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedOrder.status === st
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {st.replace(/_/g, " ")}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Order Creation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">New Order Transaction</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Marketplace / Channel</label>
                <select
                  value={newMarketplace}
                  onChange={(e) => setNewMarketplace(e.target.value as Marketplace)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="Amazon India">Amazon India</option>
                  <option value="Flipkart">Flipkart</option>
                  <option value="Meesho">Meesho</option>
                  <option value="Personal Website">Personal Website</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Channel Order ID</label>
                <input
                  type="text"
                  placeholder="e.g. 402-991283-1122"
                  value={newChannelOrderId}
                  onChange={(e) => setNewChannelOrderId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Customer Name</label>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    placeholder="City"
                    value={newCustomerCity}
                    onChange={(e) => setNewCustomerCity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select SKU</label>
                <select
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} - {p.name} (Cost: ₹{p.currentCostPrice})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  * Historical purchasing cost will be snapshot and locked into this transaction.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-1.5 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-sm"
                >
                  Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Ingestion Modal */}
      {isCsvImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-bold text-[#1D1D1F] tracking-tight">Channel CSV Ingestion</h2>
              <button
                onClick={() => setIsCsvImportOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <p className="text-slate-500 mb-2">
                Select a channel template to simulate automatic column normalization:
              </p>
              {[
                { name: "Amazon India", label: "Amazon Order Report (.csv)", desc: "Normalizes ASINs and Easy Ship rates", color: "hover:border-amber-400 hover:bg-amber-50/50" },
                { name: "Flipkart", label: "Flipkart Sales Report (.xlsx)", desc: "Normalizes FSNs and Ekart logistics fees", color: "hover:border-blue-400 hover:bg-blue-50/50" },
                { name: "Meesho", label: "Meesho Orders Export (.csv)", desc: "Normalizes sub-orders & 0% fee promo", color: "hover:border-pink-400 hover:bg-pink-50/50" },
                { name: "Personal Website", label: "Website (Shopify / WooCommerce)", desc: "Direct format with Razorpay collection", color: "hover:border-emerald-400 hover:bg-emerald-50/50" },
              ].map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleSampleCsvImport(c.name as Marketplace)}
                  className={`w-full p-3.5 text-left rounded-2xl bg-slate-50 border border-slate-200 transition flex items-center justify-between group ${c.color}`}
                >
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">{c.label}</span>
                    <span className="text-[11px] text-slate-500">{c.desc}</span>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    Import →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
