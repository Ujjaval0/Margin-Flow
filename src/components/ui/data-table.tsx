"use client";

import React, { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ArrowUpDown, Search, X } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Filter records...",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue).toLowerCase().trim();
      if (!query) return true;

      // 1. If searchKey is specified, prioritize checking that property on row.original
      if (searchKey) {
        const directVal = (row.original as Record<string, unknown>)[searchKey];
        if (
          directVal !== undefined &&
          directVal !== null &&
          String(directVal).toLowerCase().includes(query)
        ) {
          return true;
        }
      }

      // 2. Also search all top-level and nested primitive values in row.original
      const searchInObject = (obj: unknown, depth = 0): boolean => {
        if (depth > 2 || obj === null || obj === undefined) return false;
        if (typeof obj === "string" || typeof obj === "number") {
          return String(obj).toLowerCase().includes(query);
        }
        if (Array.isArray(obj)) {
          return obj.some((item) => searchInObject(item, depth + 1));
        }
        if (typeof obj === "object") {
          return Object.values(obj).some((val) => searchInObject(val, depth + 1));
        }
        return false;
      };

      return searchInObject(row.original);
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-3 w-full min-w-0">
      {searchKey && (
        <div className="flex items-center justify-between px-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#86868B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder={searchPlaceholder}
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="w-72 text-xs pl-8 pr-7 py-1.5 bg-white border border-black/[0.08] rounded-full focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] text-[#1D1D1F] placeholder-[#86868B] shadow-apple-sm transition"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-xs text-[#86868B]">
            {table.getRowModel().rows.length} of {data.length} records
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden shadow-apple-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1D1D1F]">
            <thead className="bg-[#FAFAFC] border-b border-black/[0.04] text-[#6E6E73] font-semibold text-xs tracking-tight">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <th
                        key={header.id}
                        className="px-5 py-3.5 whitespace-nowrap"
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            {...{
                              className: header.column.getCanSort()
                                ? "cursor-pointer select-none flex items-center gap-1.5 hover:text-[#1D1D1F]"
                                : "",
                              onClick: header.column.getToggleSortingHandler(),
                            }}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getCanSort() && (
                              <ArrowUpDown className="w-3 h-3 text-[#86868B]" />
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-black/[0.015] transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap tabular-nums">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-28 text-center text-[#86868B] font-medium"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Minimalist Apple Pagination */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#FAFAFC] border-t border-black/[0.04] text-xs text-[#86868B]">
          <div className="tabular-nums font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
              className="p-1.5 rounded-lg border border-black/[0.06] bg-white hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-apple-sm active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#1D1D1F]" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
              className="p-1.5 rounded-lg border border-black/[0.06] bg-white hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition shadow-apple-sm active:scale-95 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#1D1D1F]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
