"use client";

import React, { useState, useMemo } from "react";
import { Expense, ExpenseCategory } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, X, Pencil, Trash2, AlertTriangle } from "lucide-react";

export function ExpensesView() {
  const { expenses, addExpense, updateExpense, deleteExpense, deleteExpenses } = usePlatform();

  // Add Expense Modal State
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("Advertising");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(5000);
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<Expense["paymentMethod"]>("BANK_TRANSFER");
  const [isRecurring, setIsRecurring] = useState(false);

  // Edit Expense Modal State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState<ExpenseCategory>("Advertising");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState<number>(5000);
  const [editVendor, setEditVendor] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<Expense["paymentMethod"]>("BANK_TRANSFER");
  const [editIsRecurring, setEditIsRecurring] = useState(false);

  // Selection & Delete State
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

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

  const handleOpenEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditDate(exp.date);
    setEditCategory(exp.category);
    setEditDescription(exp.description);
    setEditAmount(exp.amount);
    setEditVendor(exp.vendor);
    setEditPaymentMethod(exp.paymentMethod);
    setEditIsRecurring(exp.isRecurring ?? false);
  };

  const handleUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    const updatedExp: Expense = {
      ...editingExpense,
      date: editDate || editingExpense.date,
      category: editCategory,
      description: editDescription.trim() || `${editCategory} expense`,
      amount: Number(editAmount) || 0,
      vendor: editVendor.trim() || "Vendor",
      paymentMethod: editPaymentMethod,
      isRecurring: editIsRecurring,
    };
    updateExpense(updatedExp);
    setEditingExpense(null);
  };

  const handleConfirmSingleDelete = () => {
    if (!expenseToDelete) return;
    deleteExpense(expenseToDelete.id);
    setSelectedExpenseIds((prev) => prev.filter((id) => id !== expenseToDelete.id));
    setExpenseToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedExpenseIds.length === 0) return;
    deleteExpenses(selectedExpenseIds);
    setSelectedExpenseIds([]);
    setIsBulkDeleteConfirmOpen(false);
  };

  const allSelected = expenses.length > 0 && selectedExpenseIds.length === expenses.length;
  const isIndeterminate = selectedExpenseIds.length > 0 && selectedExpenseIds.length < expenses.length;

  const columns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate;
              }}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedExpenseIds(expenses.map((exp) => exp.id));
                } else {
                  setSelectedExpenseIds([]);
                }
              }}
              aria-label="Select all"
              className="w-4 h-4 rounded border-black/[0.15] text-[#1D1D1F] focus:ring-[#0071E3]/20 cursor-pointer accent-[#1D1D1F]"
            />
          </div>
        ),
        cell: ({ row }) => {
          const isSelected = selectedExpenseIds.includes(row.original.id);
          return (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  const id = row.original.id;
                  setSelectedExpenseIds((prev) =>
                    prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
                  );
                }}
                aria-label={`Select expense ${row.original.description}`}
                className="w-4 h-4 rounded border-black/[0.15] text-[#1D1D1F] focus:ring-[#0071E3]/20 cursor-pointer accent-[#1D1D1F]"
              />
            </div>
          );
        },
      },
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-xs text-[#86868B] tabular-nums font-medium">
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
          <span className="text-[11px] text-[#86868B] font-medium">
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
          <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight tabular-nums">
            {formatINR(row.original.amount)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => handleOpenEdit(row.original)}
              aria-label={`Edit expense ${row.original.description}`}
              title="Edit Expense"
              className="w-7 h-7 rounded-full hover:bg-black/[0.05] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center justify-center transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setExpenseToDelete(row.original)}
              aria-label={`Delete expense ${row.original.description}`}
              title="Delete Expense"
              className="w-7 h-7 rounded-full hover:bg-rose-50 text-[#86868B] hover:text-[#D70015] flex items-center justify-center transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [expenses, selectedExpenseIds, allSelected, isIndeterminate]
  );

  const totalOpex = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
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
            <span className="text-base font-semibold text-[#1D1D1F] tabular-nums tracking-tight">{formatINR(totalOpex)}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddExpenseOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium rounded-full shadow-apple-sm btn-press transition cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Floating / Sticky Bulk Actions Bar */}
      {selectedExpenseIds.length > 0 && (
        <div className="apple-card border border-rose-500/20 bg-rose-500/[0.04] rounded-2xl p-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-apple-md">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-lg bg-[#1D1D1F] text-white font-bold text-xs flex items-center justify-center shadow-apple-sm">
              {selectedExpenseIds.length}
            </span>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              {selectedExpenseIds.length} expense{selectedExpenseIds.length > 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedExpenseIds([])}
              className="text-[11px] text-[#86868B] hover:text-[#1D1D1F] underline font-medium ml-1 transition-colors cursor-pointer"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#D70015] hover:bg-[#c00013] text-white text-xs font-semibold shadow-apple-sm btn-press transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedExpenseIds.length})</span>
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={expenses}
        searchKey="description"
        searchPlaceholder="Filter expenses by description, vendor..."
      />

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-slate-50/50">
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">Record Operating Overhead</h2>
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form id="add-expense-form" onSubmit={handleCreateExpense} className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
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
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] tabular-nums focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
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
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
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
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
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
                  className="w-4 h-4 rounded border-black/[0.15] text-[#1D1D1F] focus:ring-[#0071E3]/20 cursor-pointer accent-[#1D1D1F]"
                />
                <label htmlFor="recurring" className="text-xs text-[#6E6E73] cursor-pointer">
                  Recurring Monthly Expense
                </label>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-slate-50/50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-expense-form"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition-colors cursor-pointer"
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-md max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-black/[0.05] flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <Pencil className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                    Edit Operating Expense
                  </h2>
                  <p className="text-[11px] text-[#86868B]">{editingExpense.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                aria-label="Close dialog"
                className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              id="edit-expense-form"
              onSubmit={handleUpdateExpense}
              className="p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] tabular-nums focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-[#6E6E73] block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Meta Ads & Retargeting"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Vendor</label>
                  <input
                    type="text"
                    placeholder="Vendor Name"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    required
                  />
                </div>
                <div>
                  <label className="font-medium text-[#6E6E73] block mb-1">Payment Method</label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 bg-[#FAFAFC] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 cursor-pointer"
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
                  id="edit-recurring"
                  checked={editIsRecurring}
                  onChange={(e) => setEditIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-black/[0.15] text-[#1D1D1F] focus:ring-[#0071E3]/20 cursor-pointer accent-[#1D1D1F]"
                />
                <label htmlFor="edit-recurring" className="text-xs text-[#6E6E73] cursor-pointer">
                  Recurring Monthly Expense
                </label>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-black/[0.05] bg-slate-50/50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="px-4 py-2 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-expense-form"
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition-colors cursor-pointer"
              >
                Update Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-[#D70015] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1D1D1F]">Delete Operating Expense</h3>
                <p className="text-[11px] text-[#86868B]">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Are you sure you want to delete <strong className="text-[#1D1D1F]">{expenseToDelete.description}</strong> ({formatINR(expenseToDelete.amount)})?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-4 py-1.5 rounded-xl bg-[#D70015] hover:bg-[#c00013] text-white text-xs font-semibold shadow-apple-sm btn-press transition cursor-pointer"
              >
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-[#D70015] flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1D1D1F]">Delete {selectedExpenseIds.length} Expenses</h3>
                <p className="text-[11px] text-[#86868B]">Batch deletion confirmation.</p>
              </div>
            </div>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              Are you sure you want to delete all <strong className="text-[#1D1D1F]">{selectedExpenseIds.length} selected expenses</strong>? This will permanently remove them from the ledger and adjust the Total OPEX.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-[#6E6E73] hover:bg-black/[0.04] text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 rounded-xl bg-[#D70015] hover:bg-[#c00013] text-white text-xs font-semibold shadow-apple-sm btn-press transition cursor-pointer"
              >
                Delete All Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
