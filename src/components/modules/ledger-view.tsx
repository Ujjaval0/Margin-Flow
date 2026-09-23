"use client";

import React, { useState, useMemo } from "react";
import { usePlatform } from "@/domain/store";
import {
  generateGeneralLedger,
  calculateTrialBalance,
  JournalEntry,
  TrialBalanceRow,
} from "@/domain/ledger-engine";
import { formatINR } from "@/lib/utils";
import {
  BookOpen,
  Scale,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
  Search,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";

export function LedgerView() {
  const { orders, returns, settlements, purchases, expenses } = usePlatform();
  const [activeTab, setActiveTab] = useState<"JOURNAL" | "TRIAL_BALANCE">("JOURNAL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Generate real-time balanced double-entry ledger & trial balance
  const generalLedger = useMemo(() => {
    return generateGeneralLedger(orders, returns, settlements, purchases, expenses);
  }, [orders, returns, settlements, purchases, expenses]);

  const trialBalance = useMemo(() => {
    return calculateTrialBalance(generalLedger);
  }, [generalLedger]);

  // Filter journal entries
  const filteredEntries = useMemo(() => {
    return generalLedger.filter((entry) => {
      const matchesSearch =
        entry.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.lines.some((l) =>
          l.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.accountCode.includes(searchQuery)
        );

      const matchesType =
        selectedTypeFilter === "ALL" || entry.referenceType === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [generalLedger, searchQuery, selectedTypeFilter]);

  // Filter trial balance rows
  const filteredTrialBalance = useMemo(() => {
    return trialBalance.rows.filter((row) => {
      const matchesSearch =
        row.accountCode.includes(searchQuery) ||
        row.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        selectedTypeFilter === "ALL" || row.type === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [trialBalance, searchQuery, selectedTypeFilter]);

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-black/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
              Double-Entry General Ledger
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {trialBalance.isBalanced ? "Balanced (Debits = Credits)" : "Imbalance Flagged"}
            </span>
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Statutory double-entry accounting: Every fulfillment, settlement, return, and purchase is posted as an immutable balanced journal entry.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-black/[0.04] p-1 rounded-full border border-black/[0.06] text-xs">
          <button
            onClick={() => setActiveTab("JOURNAL")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === "JOURNAL"
                ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            General Journal ({generalLedger.length})
          </button>
          <button
            onClick={() => setActiveTab("TRIAL_BALANCE")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
              activeTab === "TRIAL_BALANCE"
                ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Trial Balance ({trialBalance.rows.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868B]">Total Ledger Debits</span>
            <div className="w-7 h-7 rounded-xl bg-black/[0.04] flex items-center justify-center text-[#0071E3]">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-2 tracking-tight tabular-nums">
            {formatINR(trialBalance.totalDebits)}
          </div>
          <p className="text-[11px] text-[#86868B] mt-1">Across all posted assets and expenses</p>
        </div>

        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868B]">Total Ledger Credits</span>
            <div className="w-7 h-7 rounded-xl bg-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-2 tracking-tight tabular-nums">
            {formatINR(trialBalance.totalCredits)}
          </div>
          <p className="text-[11px] text-[#86868B] mt-1">Across all revenues, liabilities & equity</p>
        </div>

        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868B]">Audit Invariant Check</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-[#288548] mt-2 tracking-tight tabular-nums">
            {trialBalance.isBalanced ? "₹0.00 Variance" : formatINR(trialBalance.discrepancy)}
          </div>
          <p className="text-[11px] text-[#288548] mt-1">
            {trialBalance.isBalanced ? "100% Mathematically Balanced" : "Discrepancy detected"}
          </p>
        </div>

        <div className="apple-card p-5 rounded-2xl border border-black/[0.06] shadow-apple-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868B]">Active Ledger Accounts</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-800">
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-[#1D1D1F] mt-2 tracking-tight tabular-nums">
            {trialBalance.rows.length} Accounts
          </div>
          <p className="text-[11px] text-[#86868B] mt-1">Assets, Liabilities, COGS, Opex & Rev</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="apple-card p-3 rounded-2xl border border-black/[0.06] shadow-apple-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
          <input
            type="text"
            placeholder={
              activeTab === "JOURNAL"
                ? "Search by Reference, Account, SKU or Memo..."
                : "Search by Account Code or Name..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-[#FAFAFC] border border-black/[0.06] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#86868B]" />
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-xl bg-[#FAFAFC] border border-black/[0.06] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
          >
            {activeTab === "JOURNAL" ? (
              <>
                <option value="ALL">All Event Types</option>
                <option value="ORDER_FULFILLMENT">Order Fulfillments</option>
                <option value="SETTLEMENT_REMITTANCE">Settlement Remittances</option>
                <option value="CUSTOMER_RETURN">Customer Returns</option>
                <option value="PURCHASE_BILL">Purchase Bills</option>
                <option value="OPERATING_EXPENSE">Operating Expenses</option>
              </>
            ) : (
              <>
                <option value="ALL">All Account Classes</option>
                <option value="ASSET">Assets (1000s)</option>
                <option value="LIABILITY">Liabilities (2000s)</option>
                <option value="REVENUE">Revenues (4000s)</option>
                <option value="EXPENSE">Expenses & COGS (5000s & 6000s)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Tab 1: General Journal */}
      {activeTab === "JOURNAL" && (
        <div className="apple-card rounded-2xl border border-black/[0.06] overflow-hidden shadow-apple-md">
          <div className="divide-y divide-black/[0.06]">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedEntryId === entry.id;
              return (
                <div key={entry.id} className="transition-colors hover:bg-black/[0.01]">
                  {/* Summary Row */}
                  <div
                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label={isExpanded ? "Collapse transaction details" : "Expand transaction details"}
                        className="text-[#86868B] p-0.5 rounded hover:bg-black/[0.04] transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#1D1D1F]">
                            {entry.id}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] text-[#6E6E73]">
                            {entry.referenceType}
                          </span>
                          <span className="text-xs text-[#86868B]">
                            {new Date(entry.timestamp).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-[#6E6E73] mt-0.5">{entry.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div>
                        <span className="text-[11px] text-[#86868B] block">Total Amount</span>
                        <span className="text-xs font-semibold text-[#1D1D1F] tabular-nums">
                          {formatINR(entry.totalDebit)}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-[#288548] border border-emerald-200/60">
                        Balanced
                      </span>
                    </div>
                  </div>

                  {/* Expanded Detail Lines */}
                  {isExpanded && (
                    <div className="px-6 pb-4 pt-1 bg-[#FAFAFC] border-t border-black/[0.04]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-black/[0.06] text-[#86868B]">
                            <th className="py-2 text-left font-medium">Account Code</th>
                            <th className="py-2 text-left font-medium">Account Title & Description</th>
                            <th className="py-2 text-right font-medium">Debit</th>
                            <th className="py-2 text-right font-medium">Credit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04]">
                          {entry.lines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-black/[0.01]">
                              <td className="py-2 text-[#86868B] font-mono">{line.accountCode}</td>
                              <td className="py-2 text-[#1D1D1F]">
                                <span className="font-sans font-medium">{line.accountName}</span>
                                {line.memo && (
                                  <span className="block text-[11px] text-[#86868B] font-sans">
                                    {line.memo}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-right font-semibold text-[#1D1D1F] tabular-nums">
                                {line.debit > 0 ? formatINR(line.debit) : "—"}
                              </td>
                              <td className="py-2 text-right font-semibold text-[#1D1D1F] tabular-nums">
                                {line.credit > 0 ? formatINR(line.credit) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-black/[0.08] font-bold text-[#1D1D1F]">
                            <td colSpan={2} className="py-2 text-right font-sans font-semibold">
                              Posting Totals:
                            </td>
                            <td className="py-2 text-right tabular-nums">{formatINR(entry.totalDebit)}</td>
                            <td className="py-2 text-right tabular-nums">{formatINR(entry.totalCredit)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Trial Balance */}
      {activeTab === "TRIAL_BALANCE" && (
        <div className="apple-card rounded-2xl border border-black/[0.06] overflow-hidden shadow-apple-md">
          <div className="p-4 border-b border-black/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F]">Trial Balance Summary</h3>
              <p className="text-xs text-[#86868B]">
                Financial condition as of {new Date(trialBalance.asOf).toLocaleDateString("en-IN")}
              </p>
            </div>
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-black/[0.04] text-[#1D1D1F]">
              Standard Chart of Accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FAFAFC] text-[#86868B] font-medium">
                  <th className="py-2.5 px-4 text-left">Code</th>
                  <th className="py-2.5 px-4 text-left">Account Name</th>
                  <th className="py-2.5 px-4 text-left">Category</th>
                  <th className="py-2.5 px-4 text-right">Debit Balance</th>
                  <th className="py-2.5 px-4 text-right">Credit Balance</th>
                  <th className="py-2.5 px-4 text-right">Net Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredTrialBalance.map((row) => (
                  <tr key={row.accountCode} className="hover:bg-black/[0.01]">
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#1D1D1F]">
                      {row.accountCode}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[#1D1D1F]">{row.accountName}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/[0.04] text-[#6E6E73]">
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {row.totalDebit > 0 ? formatINR(row.totalDebit) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      {row.totalCredit > 0 ? formatINR(row.totalCredit) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-[#1D1D1F]">
                      {formatINR(row.netBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/[0.12] bg-[#FAFAFC] font-bold text-[#1D1D1F]">
                  <td colSpan={3} className="py-3 px-4 font-sans font-semibold text-right">
                    Trial Balance Totals:
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatINR(trialBalance.totalDebits)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatINR(trialBalance.totalCredits)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                      trialBalance.isBalanced ? "bg-emerald-50 text-[#288548] border border-emerald-200/60" : "bg-rose-50 text-[#D70015] border border-rose-200/60"
                    }`}>
                      {trialBalance.isBalanced ? "BALANCED" : "IMBALANCE"}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
