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
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

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
    <div className="space-y-3">
      {searchKey && (
        <div className="flex items-center justify-between px-1">
          <input
            placeholder={searchPlaceholder}
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="w-72 text-xs px-3.5 py-1.5 bg-white border border-black/[0.06] rounded-full focus:outline-none focus:border-black/[0.2] text-[#1D1D1F] placeholder-[#86868B] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition"
          />
          <div className="text-xs text-[#86868B]">
            {table.getRowModel().rows.length} of {data.length} records
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-black/[0.05] bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1D1D1F]">
            <thead className="bg-[#FAFAFC] border-b border-black/[0.04] text-[#86868B] font-medium text-[11px] tracking-wider uppercase">
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
                      <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap">
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
          <div>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-lg border border-black/[0.06] bg-white hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#1D1D1F]" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-lg border border-black/[0.06] bg-white hover:bg-black/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#1D1D1F]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
