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
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ArrowUpDown,
  Search,
  X,
} from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  statusLegend?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Filter records...",
  statusLegend,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");
  const deferredGlobalFilter = React.useDeferredValue(globalFilter);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: deferredGlobalFilter,
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
        <div className="px-4 sm:px-6 py-3.5 bg-[#FAFAFC] border-t border-black/[0.06] flex flex-col md:flex-row items-center justify-between text-xs text-[#86868B] gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs text-[#64748B]">
              {table.getFilteredRowModel().rows.length === data.length ? (
                <span>
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">{data.length}</strong> total rows
                </span>
              ) : (
                <span>
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">{table.getFilteredRowModel().rows.length}</strong> of{" "}
                  <strong className="font-semibold text-[#1D1D1F] tabular-nums">{data.length}</strong> total rows
                </span>
              )}
            </div>

            {statusLegend && (
              <>
                <div className="h-3.5 w-px bg-black/[0.08] hidden sm:block" />
                {statusLegend}
              </>
            )}
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-end">
            {/* Rows per page selector */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[#1D1D1F] font-normal whitespace-nowrap">
                Rows per page
              </span>
              <div className="relative inline-flex items-center">
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value));
                  }}
                  aria-label="Rows per page"
                  className="appearance-none bg-white border border-black/[0.1] hover:border-black/[0.2] text-xs font-semibold text-[#1D1D1F] pl-3 pr-7 py-1 rounded-lg shadow-apple-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] transition cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute right-2 pointer-events-none stroke-[2]" />
              </div>
            </div>

            {/* Page X of Y */}
            <div className="text-xs text-[#1D1D1F] font-normal whitespace-nowrap">
              Page <span className="font-semibold tabular-nums">{table.getState().pagination.pageIndex + 1}</span> of{" "}
              <span className="font-semibold tabular-nums">{Math.max(1, table.getPageCount())}</span>
            </div>

            {/* Four navigation buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label="First page"
                title="First page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
                title="Previous page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
                title="Next page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 stroke-[1.75]" />
              </button>
              <button
                type="button"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label="Last page"
                title="Last page"
                className="w-8 h-8 rounded-lg border border-black/[0.08] bg-white hover:bg-black/[0.03] text-[#1D1D1F] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shadow-apple-sm transition active:scale-95 cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4 stroke-[1.75]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
