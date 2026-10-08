"use client";

import React, { useState } from "react";
import { PurchaseBill } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import dynamic from "next/dynamic";

const AddPurchaseModal = dynamic(
  () => import("@/components/modals/add-purchase-modal").then((mod) => mod.AddPurchaseModal),
  { ssr: false }
);

export function PurchasesView() {
  const { suppliers, purchases, products, addPurchase } = usePlatform();
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);

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
        <span className="text-sm font-semibold text-[#86868B] tracking-tight tabular-nums">
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
          <span className="w-1.5 h-1.5 rounded-full bg-[#288548]" />
          <span className="text-[#288548] font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-[10px]">
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
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Purchases & Inbound Bills
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Procurement records, inbound supplier purchase bills, and input tax credit (ITC) tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddPurchaseOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold shadow-apple-sm transition active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>Record Purchase Bill</span>
        </button>
      </div>

      <DataTable
        columns={purchaseColumns}
        data={purchases}
        searchKey="invoiceNumber"
        searchPlaceholder="Search bills by invoice or SKU..."
      />

      {/* Add Purchase Bill Modal */}
      <AddPurchaseModal
        isOpen={isAddPurchaseOpen}
        onClose={() => setIsAddPurchaseOpen(false)}
        suppliers={suppliers}
        products={products}
        onAddPurchase={(bill) => addPurchase(bill)}
      />
    </div>
  );
}
