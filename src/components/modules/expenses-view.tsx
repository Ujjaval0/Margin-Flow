"use client";

import React, { useState } from "react";
import { Expense, ExpenseCategory } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X } from "lucide-react";

export function ExpensesView() {
  const { expenses, addExpense } = usePlatform();

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("Advertising");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(5000);
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<Expense["paymentMethod"]>("BANK_TRANSFER");
  const [isRecurring, setIsRecurring] = useState(false);

  const categories: ExpenseCategory[] = [
    "Advertising",
    "Salaries",
    "Rent",
    "Software",
    "Packaging",
    "Office",
    "Transportation",
    "Professional Services",
    "Utilities",
    "Other",
  ];

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const newExp: Expense = {
      id: `EXP-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split("T")[0],
      category,
      description: description || `${category} expense`,
      amount: Number(amount),
      vendor: vendor || "Vendor",
      paymentMethod,
      isRecurring,
    };
    addExpense(newExp);
    setIsAddExpenseOpen(false);
    setDescription("");
    setVendor("");
  };

  const columns: ColumnDef<Expense>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-xs text-[#6E6E73]">
          {formatDate(row.original.date)}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.04] text-[#1D1D1F]">
          {row.original.category}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description / Vendor",
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-[#1D1D1F] block text-xs">
            {row.original.description}
          </span>
          <span className="text-[11px] text-[#86868B]">Vendor: {row.original.vendor}</span>
        </div>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment",
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-[#86868B]">
          {row.original.paymentMethod.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      accessorKey: "isRecurring",
      header: "Nature",
      cell: ({ row }) => (
        <span className="text-xs text-[#6E6E73]">
          {row.original.isRecurring ? "Recurring" : "One-off"}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-[#1D1D1F] text-xs">
          {formatINR(row.original.amount)}
        </span>
      ),
    },
  ];

  const totalOpex = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Operating Expenses (OPEX)
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Operational overhead: Advertising, warehouse leases, and software licenses tracked separately from COGS.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-[#86868B] block">Total OPEX</span>
            <span className="text-base font-semibold text-[#1D1D1F]">{formatINR(totalOpex)}</span>
          </div>
          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        searchKey="description"
        searchPlaceholder="Filter expenses by description, vendor..."
      />

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-black/[0.06] w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-black/[0.05] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Record Operating Overhead</h2>
              <button
                onClick={() => setIsAddExpenseOpen(false)}
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl font-mono text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Meta Ads & Retargeting"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Vendor</label>
                  <input
                    type="text"
                    placeholder="Vendor Name"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs focus:outline-none"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-black/[0.1]"
                />
                <label htmlFor="recurring" className="text-[#6E6E73]">
                  Recurring Monthly Expense
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-1.5 rounded-full text-[#6E6E73] hover:bg-black/[0.03] text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#1D1D1F] hover:bg-black text-white rounded-full text-xs font-medium shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
