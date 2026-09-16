"use client";

import React, { useState } from "react";
import { usePlatform } from "@/domain/store";
import { formatINR, formatPercent } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Download } from "lucide-react";
import { SkuProfitability, MarketplaceProfitability } from "@/domain/profitability-engine";

export function ReportsView() {
  const { skuBreakdown, marketplaceBreakdown, profitability } = usePlatform();
  const [reportTab, setReportTab] = useState<"skus" | "marketplaces" | "monthly">("skus");

  const handleExportCSV = () => {
    alert("Exporting financial statement to CSV.");
  };

  const skuColumns: ColumnDef<SkuProfitability>[] = [
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-[#1D1D1F] text-xs">
          {row.original.sku}
        </span>
      ),
    },
    {
      accessorKey: "productName",
      header: "Product Title",
      cell: ({ row }) => (
        <span className="font-medium text-[#1D1D1F] text-xs line-clamp-1 max-w-[200px]">
          {row.original.productName}
        </span>
      ),
    },
    {
      accessorKey: "unitsSold",
      header: "Units Sold",
      cell: ({ row }) => (
        <span className="font-mono text-[#1D1D1F] text-xs">
          {row.original.unitsSold}
        </span>
      ),
    },
    {
      accessorKey: "revenue",
      header: "Net Revenue",
      cell: ({ row }) => (
        <span className="font-mono text-[#1D1D1F] text-xs">{formatINR(row.original.revenue)}</span>
      ),
    },
    {
      accessorKey: "cogs",
      header: "Snapshot COGS",
      cell: ({ row }) => (
        <span className="font-mono text-[#86868B] text-xs">{formatINR(row.original.cogs)}</span>
      ),
    },
    {
      accessorKey: "marketplaceCharges",
      header: "Fees",
      cell: ({ row }) => (
        <span className="font-mono text-[#D70015] text-xs">
          -{formatINR(row.original.marketplaceCharges)}
        </span>
      ),
    },
    {
      accessorKey: "returnLosses",
      header: "Return Loss",
      cell: ({ row }) => (
        <span className="font-mono text-[#D70015] text-xs">
          -{formatINR(row.original.returnLosses)}
        </span>
      ),
    },
    {
      accessorKey: "profit",
      header: "Contribution Profit",
      cell: ({ row }) => {
        const isProfitable = row.original.profit >= 0;
        return (
          <span
            className={`font-mono font-semibold text-xs ${
              isProfitable ? "text-[#288548]" : "text-[#D70015]"
            }`}
          >
            {formatINR(row.original.profit)}
          </span>
        );
      },
    },
    {
      accessorKey: "margin",
      header: "Margin",
      cell: ({ row }) => {
        const isProfitable = row.original.margin >= 0;
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isProfitable ? "bg-[#288548]/10 text-[#288548]" : "bg-[#D70015]/10 text-[#D70015]"
            }`}
          >
            {formatPercent(row.original.margin)}
          </span>
        );
      },
    },
    {
      accessorKey: "returnRate",
      header: "Return Rate",
      cell: ({ row }) => {
        const rate = row.original.returnRate;
        return (
          <span className="text-xs text-[#86868B] font-mono">
            {formatPercent(rate)}
          </span>
        );
      },
    },
  ];

  const marketplaceColumns: ColumnDef<MarketplaceProfitability>[] = [
    {
      accessorKey: "marketplace",
      header: "Sales Channel",
      cell: ({ row }) => (
        <span className="font-semibold text-[#1D1D1F] text-xs">{row.original.marketplace}</span>
      ),
    },
    {
      accessorKey: "orderCount",
      header: "Orders / Units",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[#6E6E73]">
          {row.original.orderCount} / {row.original.unitsSold}
        </span>
      ),
    },
    {
      accessorKey: "revenue",
      header: "Gross Revenue",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-[#1D1D1F] text-xs">
          {formatINR(row.original.revenue)}
        </span>
      ),
    },
    {
      accessorKey: "cogs",
      header: "Total COGS",
      cell: ({ row }) => (
        <span className="font-mono text-[#86868B] text-xs">{formatINR(row.original.cogs)}</span>
      ),
    },
    {
      accessorKey: "fees",
      header: "Commissions & Fees",
      cell: ({ row }) => (
        <span className="font-mono text-[#D70015] text-xs">-{formatINR(row.original.fees)}</span>
      ),
    },
    {
      accessorKey: "returnLosses",
      header: "Return & RTO Losses",
      cell: ({ row }) => (
        <span className="font-mono text-[#D70015] text-xs">
          -{formatINR(row.original.returnLosses)}
        </span>
      ),
    },
    {
      accessorKey: "claimRecoveries",
      header: "Recoveries",
      cell: ({ row }) => (
        <span className="font-mono text-[#288548] text-xs">
          +{formatINR(row.original.claimRecoveries)}
        </span>
      ),
    },
    {
      accessorKey: "contributionProfit",
      header: "Contribution Profit",
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-[#288548] text-xs">
          {formatINR(row.original.contributionProfit)}
        </span>
      ),
    },
    {
      accessorKey: "margin",
      header: "Channel Margin",
      cell: ({ row }) => (
        <span className="font-semibold text-[#288548] bg-[#288548]/10 px-2.5 py-0.5 rounded-full text-xs">
          {formatPercent(row.original.margin)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Analytics & Statements
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Audit-grade multi-dimensional profitability statements: by SKU, channel, and accounting periods.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-black/[0.04] p-1 rounded-full text-xs flex">
            <button
              onClick={() => setReportTab("skus")}
              className={`px-3 py-1 rounded-full font-medium transition ${
                reportTab === "skus"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              SKU Analysis
            </button>
            <button
              onClick={() => setReportTab("marketplaces")}
              className={`px-3 py-1 rounded-full font-medium transition ${
                reportTab === "marketplaces"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Channels
            </button>
            <button
              onClick={() => setReportTab("monthly")}
              className={`px-3 py-1 rounded-full font-medium transition ${
                reportTab === "monthly"
                  ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              P&L Ledger
            </button>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-black/[0.06] hover:bg-black/[0.02] text-[#1D1D1F] text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition"
          >
            <Download className="w-3.5 h-3.5 text-[#6E6E73]" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {reportTab === "skus" && (
        <DataTable
          columns={skuColumns}
          data={skuBreakdown}
          searchKey="sku"
          searchPlaceholder="Search report by SKU..."
        />
      )}

      {reportTab === "marketplaces" && (
        <DataTable
          columns={marketplaceColumns}
          data={marketplaceBreakdown}
          searchKey="marketplace"
          searchPlaceholder="Filter channel..."
        />
      )}

      {reportTab === "monthly" && (
        <div className="bg-white p-6 rounded-3xl border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
            <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Statement of Profit & Loss (September 2026)
            </h3>
            <span className="text-xs text-[#288548] bg-[#288548]/10 px-3 py-1 rounded-full font-medium">
              Net Margin: {formatPercent(profitability.netOperatingMargin)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAFAFC] text-[#86868B] font-medium uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Metric</th>
                  <th className="py-3 px-4">Accounting Treatment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">% Net Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                <tr>
                  <td className="py-3 px-4 font-semibold">Gross Sales</td>
                  <td className="py-3 px-4 text-[#86868B]">Order Selling Price × Units</td>
                  <td className="py-3 px-4 text-right font-mono font-medium">
                    {formatINR(profitability.grossSales)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">100.0%</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#6E6E73]">Discounts & Promotions</td>
                  <td className="py-3 px-4 text-[#86868B]">Channel coupon allowances</td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    -{formatINR(profitability.discounts)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    {formatPercent(profitability.discounts / Math.max(1, profitability.grossSales))}
                  </td>
                </tr>
                <tr className="bg-[#FAFAFC] font-semibold">
                  <td className="py-3 px-4">Net Sales</td>
                  <td className="py-3 px-4 text-[#86868B] font-normal">Gross Sales - Discounts</td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatINR(profitability.netSales)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">100.0%</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#6E6E73]">Cost of Goods Sold (COGS)</td>
                  <td className="py-3 px-4 text-[#86868B]">Snapshot historical purchasing cost</td>
                  <td className="py-3 px-4 text-right font-mono text-[#D70015]">
                    -{formatINR(profitability.cogs)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    {formatPercent(profitability.cogs / Math.max(1, profitability.netSales))}
                  </td>
                </tr>
                <tr className="bg-[#FAFAFC] font-semibold">
                  <td className="py-3 px-4 text-[#288548]">Gross Profit</td>
                  <td className="py-3 px-4 text-[#86868B] font-normal">Net Sales - COGS</td>
                  <td className="py-3 px-4 text-right font-mono text-[#288548]">
                    {formatINR(profitability.grossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#288548]">
                    {formatPercent(profitability.grossMargin)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#6E6E73]">Marketplace Fees & Deductions</td>
                  <td className="py-3 px-4 text-[#86868B]">Commissions and fixed closing fees</td>
                  <td className="py-3 px-4 text-right font-mono text-[#D70015]">
                    -{formatINR(profitability.marketplaceCharges)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    {formatPercent(profitability.marketplaceCharges / Math.max(1, profitability.netSales))}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#6E6E73]">Return, RTO & Damage Losses</td>
                  <td className="py-3 px-4 text-[#86868B]">Reverse logistics shipping + write-offs</td>
                  <td className="py-3 px-4 text-right font-mono text-[#D70015]">
                    -{formatINR(profitability.returnLosses + profitability.rtoLosses)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    {formatPercent((profitability.returnLosses + profitability.rtoLosses) / Math.max(1, profitability.netSales))}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#6E6E73]">Dispute Claim Recoveries</td>
                  <td className="py-3 px-4 text-[#86868B]">SAFE-T and carrier reimbursements</td>
                  <td className="py-3 px-4 text-right font-mono text-[#288548]">
                    +{formatINR(profitability.claimRecoveries)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    {formatPercent(profitability.claimRecoveries / Math.max(1, profitability.netSales))}
                  </td>
                </tr>
                <tr className="bg-[#FAFAFC] font-semibold">
                  <td className="py-3 px-4 text-[#1D1D1F]">Contribution Profit</td>
                  <td className="py-3 px-4 text-[#86868B] font-normal">
                    Gross Profit - Fees - Return Losses + Claims
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatINR(profitability.contributionProfit)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatPercent(profitability.contributionMargin)}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-[#6E6E73]">Operating Overhead (OPEX)</td>
                  <td className="py-3 px-4 text-[#86868B]">Advertising, rent, software</td>
                  <td className="py-3 px-4 text-right font-mono text-[#D70015]">
                    -{formatINR(profitability.operatingExpenses)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#86868B]">
                    {formatPercent(profitability.operatingExpenses / Math.max(1, profitability.netSales))}
                  </td>
                </tr>
                <tr className="bg-[#1D1D1F] text-white font-semibold text-xs">
                  <td className="py-3.5 px-4 rounded-l-xl">Net Operating Profit</td>
                  <td className="py-3.5 px-4 text-[#86868B] font-normal">
                    Contribution Profit - Operating Overhead
                  </td>
                  <td
                    className={`py-3.5 px-4 text-right font-mono ${
                      profitability.netOperatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatINR(profitability.netOperatingProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono rounded-r-xl">
                    {formatPercent(profitability.netOperatingMargin)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
