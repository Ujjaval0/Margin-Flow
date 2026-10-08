"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  Table,
  Check,
  ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Order, Product } from "@/domain/types";
import { getMarketplaceBadge } from "@/lib/marketplace-config";
import { formatINR } from "@/lib/utils";
import {
  detectAndMapCsv,
  CsvMappingResult,
  TARGET_FIELDS,
} from "@/domain/csv-auto-mapper";

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onImportOrders: (orders: Order[]) => void;
}

export function CsvImportModal({
  isOpen,
  onClose,
  products,
  onImportOrders,
}: CsvImportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [mappingResult, setMappingResult] = useState<CsvMappingResult | null>(null);
  const [activeTab, setActiveTab] = useState<"PREVIEW" | "COLUMNS">("PREVIEW");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleReset = () => {
    setFiles([]);
    setMappingResult(null);
    setActiveTab("PREVIEW");
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = React.useCallback(() => {
    handleReset();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const processFiles = async (uploadedFiles: FileList | File[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    const fileArray = Array.from(uploadedFiles).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ext === "csv" || ext === "xlsx" || ext === "xls";
    });

    if (fileArray.length === 0) {
      alert("Please select valid CSV or Excel files (.csv, .xlsx, .xls).");
      return;
    }

    setFiles((prev) => [...prev, ...fileArray]);
    setIsProcessing(true);

    const allOrders: Order[] = mappingResult?.orders ? [...mappingResult.orders] : [];
    let combinedDetection: any = mappingResult?.detection ? { ...mappingResult.detection } : null;
    const allErrors: string[] = mappingResult?.errors ? [...mappingResult.errors] : [];
    const allWarnings: string[] = mappingResult?.warnings ? [...mappingResult.warnings] : [];

    for (const curFile of fileArray) {
      const ext = curFile.name.split(".").pop()?.toLowerCase();
      try {
        let text = "";
        if (ext === "xlsx" || ext === "xls") {
          const buffer = await curFile.arrayBuffer();
          const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          text = XLSX.utils.sheet_to_csv(firstSheet);
        } else {
          text = await curFile.text();
        }

        if (!text.trim()) continue;

        // Run smart auto-detection and column mapping
        const result = detectAndMapCsv(text, products);

        if (!combinedDetection) {
          combinedDetection = result.detection;
        } else {
          combinedDetection.totalRows += result.detection.totalRows;
          combinedDetection.matchedSkuCount += result.detection.matchedSkuCount;
          combinedDetection.unmatchedSkuCount += result.detection.unmatchedSkuCount;
        }

        allOrders.push(...result.orders);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      } catch (err: any) {
        console.error(`Spreadsheet import error on ${curFile.name}:`, err);
        allErrors.push(`${curFile.name}: ${err?.message || "Error reading file"}`);
      }
    }

    if (combinedDetection) {
      setMappingResult({
        detection: combinedDetection,
        orders: allOrders,
        errors: allErrors,
        warnings: allWarnings,
      });
    }

    setIsProcessing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      processFiles(fileList);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleConfirmImport = () => {
    if (mappingResult && mappingResult.orders.length > 0) {
      onImportOrders(mappingResult.orders);
      handleClose();
    }
  };

  if (!isOpen || !mounted) return null;

  const orders = mappingResult?.orders || [];
  const detection = mappingResult?.detection;
  const errors = mappingResult?.errors || [];
  const warnings = mappingResult?.warnings || [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Import CSV or Excel
              </h2>
              <p className="text-[11px] text-[#86868B]">
                Auto-maps orders and pricing from CSV or Excel spreadsheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close spreadsheet import dialog"
            className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {/* File Dropzone */}
          {files.length === 0 && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-[#0071E3] bg-[#0071E3]/5 scale-[0.99]"
                  : "border-black/[0.1] hover:border-[#0071E3]/40 hover:bg-[#F5F5F7]/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1D1D1F]">
                Drag &amp; drop your marketplace export sheet(s)
              </p>
              <p className="text-xs text-[#86868B] mt-1 font-medium">
                Supports single or multiple CSV or Excel files (.csv, .xlsx, .xls)
              </p>

              <div className="mt-5 flex items-center justify-center">
                <span className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white font-medium text-xs shadow-apple-sm btn-press transition">
                  Browse files
                </span>
              </div>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="py-12 text-center text-[#86868B] space-y-2">
              <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-medium text-xs text-[#1D1D1F]">
                Scanning headers, identifying marketplace format &amp; linking SKUs...
              </p>
            </div>
          )}

          {/* Results Screen */}
          {files.length > 0 && !isProcessing && mappingResult && (
            <div className="space-y-4">
              {/* Top Detection Pill */}
              <div className="p-4 bg-[#F5F5F7] rounded-2xl border border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#288548]/10 border border-[#288548]/20 text-[#288548] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1D1D1F] text-xs">
                        {detection?.formatLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#288548]/10 text-[#288548] border border-[#288548]/20 tabular-nums">
                        {Math.round((detection?.confidence || 0) * 100)}% match
                      </span>
                    </div>
                    <p className="text-[11px] text-[#86868B] mt-0.5 tabular-nums">
                      {files.length > 1
                        ? `${files.length} sheets (${files.map((f) => f.name).slice(0, 2).join(", ")}${files.length > 2 ? "..." : ""})`
                        : files[0]?.name}{" "}
                      · {orders.length} orders parsed · {detection?.columnMappings.length} columns auto-mapped
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-[#0071E3] font-medium px-3.5 py-1.5 rounded-xl border border-[#0071E3]/20 bg-[#0071E3]/5 hover:bg-[#0071E3]/10 shadow-apple-sm btn-press transition cursor-pointer"
                  >
                    + Add sheets
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-[#1D1D1F] font-medium px-3.5 py-1.5 rounded-xl border border-black/[0.06] bg-white hover:bg-[#F5F5F7] shadow-apple-sm btn-press transition cursor-pointer"
                  >
                    Change file
                  </button>
                </div>
              </div>

              {/* Ingestion KPI Badges */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="apple-card p-3 rounded-2xl shadow-apple-sm">
                  <span className="text-[10px] font-semibold text-[#86868B] block">
                    Valid orders
                  </span>
                  <span className="text-base font-semibold text-[#1D1D1F] tabular-nums tracking-tight mt-0.5 block">
                    {orders.length}
                  </span>
                  <span className="text-[10px] text-[#86868B] tabular-nums">Header on row #{Number(detection?.headerRowIndex || 0) + 1}</span>
                </div>

                <div className="apple-card p-3 rounded-2xl shadow-apple-sm">
                  <span className="text-[10px] font-semibold text-[#86868B] block">
                    Catalog SKUs linked
                  </span>
                  <span className="text-base font-semibold text-[#288548] tabular-nums tracking-tight mt-0.5 block">
                    {detection?.matchedSkuCount} / {orders.length}
                  </span>
                  <span className="text-[10px] text-[#86868B]">Historical COGS locked</span>
                </div>

                <div className="apple-card p-3 rounded-2xl shadow-apple-sm">
                  <span className="text-[10px] font-semibold text-[#86868B] block">
                    Total ingest gross
                  </span>
                  <span className="text-base font-semibold text-[#1D1D1F] tabular-nums tracking-tight mt-0.5 block">
                    {formatINR(
                      orders.reduce(
                        (acc, o) =>
                          acc +
                          o.items.reduce(
                            (ia, it) => ia + (it.sellingPrice || 0) * (it.quantity || 1),
                            0
                          ),
                        0
                      )
                    )}
                  </span>
                  <span className="text-[10px] text-[#86868B]">Ready to sync into store</span>
                </div>
              </div>

              {/* Errors & Warnings */}
              {errors.length > 0 && (
                <div className="p-3 bg-[#D70015]/10 border border-[#D70015]/20 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-[#D70015] font-semibold text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Import warnings:</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] text-[#D70015] space-y-0.5">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* View Mode Toggle: Preview vs Column Mappings */}
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-2 pt-1">
                <div className="inline-flex items-center bg-[#F5F5F7] p-1 rounded-full text-xs border border-black/[0.06]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("PREVIEW")}
                    className={`px-3 py-1 rounded-full font-medium transition flex items-center gap-1.5 ${
                      activeTab === "PREVIEW"
                        ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                        : "text-[#6E6E73] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Normalized orders preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("COLUMNS")}
                    className={`px-3 py-1 rounded-full font-medium transition flex items-center gap-1.5 ${
                      activeTab === "COLUMNS"
                        ? "bg-white text-[#1D1D1F] shadow-apple-sm"
                        : "text-[#6E6E73] hover:text-[#1D1D1F]"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Auto-mapped columns ({detection?.columnMappings.length})</span>
                  </button>
                </div>
                <span className="text-[11px] text-[#86868B]">
                  {activeTab === "PREVIEW" ? "Showing first 5 rows" : "Source ➔ MarginFlow schema"}
                </span>
              </div>

              {/* Tab 1: Orders Preview */}
              {activeTab === "PREVIEW" && orders.length > 0 && (
                <div className="border border-black/[0.06] rounded-2xl overflow-hidden shadow-apple-sm bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F5F7] text-[#6E6E73] border-b border-black/[0.06] text-[11px] font-medium">
                      <tr>
                        <th className="px-3 py-2.5">Platform</th>
                        <th className="px-3 py-2.5">Order ID</th>
                        <th className="px-3 py-2.5">SKU &amp; title</th>
                        <th className="px-3 py-2.5 text-right">Qty</th>
                        <th className="px-3 py-2.5 text-right">Selling price</th>
                        <th className="px-3 py-2.5 text-right">COGS (unit)</th>
                        <th className="px-3 py-2.5 text-right">Gross total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {orders.slice(0, 5).map((ord, idx) => {
                        const badge = getMarketplaceBadge(ord.marketplace);
                        const it = ord.items[0];
                        const total = (it?.sellingPrice || 0) * (it?.quantity || 1);
                        return (
                          <tr key={idx} className="hover:bg-[#F5F5F7]/50">
                            <td className="px-3 py-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.pillClass}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-[#1D1D1F] text-[11px]">
                              {ord.id}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-mono font-medium text-[#1D1D1F] text-[11px]">
                                {it?.sku}
                              </div>
                              <div className="text-[10px] text-[#86868B] truncate max-w-[150px]">
                                {it?.productName}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-[#1D1D1F] tabular-nums">
                              {it?.quantity}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-[#1D1D1F] tabular-nums">
                              {formatINR(it?.sellingPrice || 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-[#86868B] tabular-nums">
                              {formatINR(it?.snapshotUnitCost || 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-[#1D1D1F] tabular-nums">
                              {formatINR(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Column Mappings Breakdown */}
              {activeTab === "COLUMNS" && detection && (
                <div className="border border-black/[0.06] rounded-2xl overflow-hidden shadow-apple-sm bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F5F7] text-[#6E6E73] border-b border-black/[0.06] text-[11px] font-medium">
                      <tr>
                        <th className="px-3 py-2.5">Source header</th>
                        <th className="px-3 py-2.5">Target field</th>
                        <th className="px-3 py-2.5">Sample value</th>
                        <th className="px-3 py-2.5 text-right">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {detection.columnMappings.map((col, idx) => (
                        <tr key={idx} className="hover:bg-[#F5F5F7]/50">
                          <td className="px-3 py-2 font-mono text-[#1D1D1F] font-semibold">
                            {col.sourceHeader}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 text-[#0071E3] font-semibold">
                              <ArrowRight className="w-3 h-3 text-[#86868B]" />
                              <span>{col.targetLabel}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-[#86868B] font-mono text-[11px] truncate max-w-xs">
                            {col.sampleValues[0] || "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#288548] bg-[#288548]/10 px-2 py-0.5 rounded-full border border-[#288548]/20 tabular-nums">
                              <Check className="w-3 h-3" />
                              <span>{Math.round(col.confidence * 100)}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#FBFBFD] border-t border-black/[0.06] flex items-center justify-between">
          <div className="text-xs text-[#86868B]">
            {orders.length > 0 ? (
              <span className="font-medium text-[#1D1D1F]">
                {orders.length} order{orders.length > 1 ? "s" : ""} parsed &amp; verified
              </span>
            ) : (
              <span>Supports CSV &amp; Excel sheets (.csv, .xlsx, .xls)</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] rounded-xl text-xs font-medium shadow-apple-sm btn-press transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={orders.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-[#1D1D1F] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Import {orders.length} verified orders</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
