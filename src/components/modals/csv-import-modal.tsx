"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  Download,
  FileText,
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

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [mappingResult, setMappingResult] = useState<CsvMappingResult | null>(null);
  const [activeTab, setActiveTab] = useState<"PREVIEW" | "COLUMNS">("PREVIEW");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setMappingResult(null);
    setActiveTab("PREVIEW");
    setIsProcessing(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = (uploadedFile: File) => {
    if (!uploadedFile.name.endsWith(".csv")) {
      alert("Please select a valid .csv file.");
      return;
    }

    setFile(uploadedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setIsProcessing(false);
          return;
        }

        // Run smart auto-detection and column mapping
        const result = detectAndMapCsv(text, products);
        setMappingResult(result);
      } catch (err: unknown) {
        console.error("CSV import error:", err);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setIsProcessing(false);
    };

    reader.readAsText(uploadedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    if (mappingResult && mappingResult.orders.length > 0) {
      onImportOrders(mappingResult.orders);
      handleClose();
    }
  };

  // Download Sample Template CSV
  const handleDownloadSample = (format: "GENERIC" | "AMAZON" | "FLIPKART" | "MEESHO") => {
    let headers: string[] = [];
    let sampleRows: string[][] = [];

    if (format === "AMAZON") {
      headers = [
        "order-id",
        "order-date",
        "seller-sku",
        "asin",
        "product-name",
        "quantity-purchased",
        "item-price",
        "item-tax",
        "shipping-fee",
        "ship-city",
        "ship-state",
        "order-status",
      ];
      sampleRows = [
        [
          "408-9921021-1293847",
          new Date().toISOString().split("T")[0],
          products[0]?.sku || "ELEC-WEM-01",
          "B08WEM01-IND",
          products[0]?.name || "Wireless Ergonomic Mouse",
          "1",
          "1499.00",
          "228.66",
          "40.00",
          "Bengaluru",
          "Karnataka",
          "Shipped",
        ],
        [
          "402-4410928-8820193",
          new Date().toISOString().split("T")[0],
          products[1]?.sku || "ELEC-USBC-65W",
          "B09GAN65W-BLK",
          products[1]?.name || "65W GaN Fast Charger",
          "2",
          "1299.00",
          "396.30",
          "0.00",
          "Mumbai",
          "Maharashtra",
          "Delivered",
        ],
      ];
    } else if (format === "FLIPKART") {
      headers = [
        "Order ID",
        "Order Date",
        "FSN",
        "SKU",
        "Product Title",
        "Quantity",
        "Final Sale Amount",
        "Taxes",
        "Customer City",
        "Customer State",
        "Order State",
      ];
      sampleRows = [
        [
          "OD329019283019200",
          new Date().toISOString().split("T")[0],
          "FLIP-CHG-65W",
          products[1]?.sku || "ELEC-USBC-65W",
          products[1]?.name || "65W GaN Fast Charger",
          "1",
          "1299.00",
          "198.15",
          "Ahmedabad",
          "Gujarat",
          "DELIVERED",
        ],
      ];
    } else if (format === "MEESHO") {
      headers = [
        "Sub Order No",
        "Order Date",
        "SKU",
        "Product Title",
        "Quantity",
        "Supplier Discounted Price",
        "State",
        "Status",
      ];
      sampleRows = [
        [
          "MSH-SUB-8819204",
          new Date().toISOString().split("T")[0],
          products[2]?.sku || "ELEC-ANC-EB",
          products[2]?.name || "Active Noise Cancelling TWS",
          "1",
          "2499.00",
          "Telangana",
          "Delivered",
        ],
      ];
    } else {
      headers = [
        "PLATFORM",
        "ORDER ID",
        "ORDER DATE",
        "SKU",
        "PRODUCT NAME",
        "QTY",
        "SELLING PRICE",
        "DISCOUNT",
        "TAX",
        "SHIPPING FEE",
        "CITY",
        "STATE",
        "STATUS",
      ];
      sampleRows = [
        [
          "Amazon India",
          "ORD-IMP-001",
          new Date().toISOString().split("T")[0],
          products[0]?.sku || "ELEC-WEM-01",
          products[0]?.name || "Wireless Ergonomic Mouse",
          "1",
          "1499",
          "100",
          "228.6",
          "40",
          "Bengaluru",
          "Karnataka",
          "DELIVERED",
        ],
      ];
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `marginflow_${format.toLowerCase()}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !mounted) return null;

  const orders = mappingResult?.orders || [];
  const detection = mappingResult?.detection;
  const errors = mappingResult?.errors || [];
  const warnings = mappingResult?.warnings || [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Smart CSV Auto-Mapper</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  AI Heuristics
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Auto-detects Amazon MTR, Flipkart, Meesho &amp; custom sheets with catalog COGS locking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {/* File Dropzone */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-purple-500 bg-purple-50/40 scale-[0.99]"
                  : "border-slate-200 hover:border-purple-300 hover:bg-slate-50/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Drag &amp; drop your marketplace export sheet (.csv)
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Auto-recognizes Amazon MTR, Flipkart Orders, Meesho, Shopify &amp; ERP reports
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <span className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition">
                  Browse File
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSample("AMAZON");
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Amazon MTR Template</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSample("FLIPKART");
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Flipkart Template</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSample("MEESHO");
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Meesho Template</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-xs text-slate-700">
                Scanning headers, identifying marketplace format &amp; linking SKUs...
              </p>
            </div>
          )}

          {/* Results Screen */}
          {file && !isProcessing && mappingResult && (
            <div className="space-y-4">
              {/* Top Detection Pill */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        {detection?.formatLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {Math.round((detection?.confidence || 0) * 100)}% Match
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {file.name} • {orders.length} orders parsed • {detection?.columnMappings.length} columns auto-mapped
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Ingestion KPI Badges */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Valid Orders
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {orders.length}
                  </span>
                  <span className="text-[10px] text-slate-500">Header on row #{Number(detection?.headerRowIndex || 0) + 1}</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Catalog SKUs Linked
                  </span>
                  <span className="text-base font-bold text-emerald-600 font-mono mt-0.5 block">
                    {detection?.matchedSkuCount} / {orders.length}
                  </span>
                  <span className="text-[10px] text-slate-500">Historical COGS locked</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Ingest Gross
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
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
                  <span className="text-[10px] text-slate-500">Ready to sync into store</span>
                </div>
              </div>

              {/* Errors & Warnings */}
              {errors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Import Warnings:</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* View Mode Toggle: Preview vs Column Mappings */}
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 pt-1">
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-full text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("PREVIEW")}
                    className={`px-3 py-1 rounded-full font-semibold transition flex items-center gap-1.5 ${
                      activeTab === "PREVIEW"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Normalized Orders Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("COLUMNS")}
                    className={`px-3 py-1 rounded-full font-semibold transition flex items-center gap-1.5 ${
                      activeTab === "COLUMNS"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Auto-Mapped Columns ({detection?.columnMappings.length})</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                  {activeTab === "PREVIEW" ? "Showing first 5 rows" : "Source ➔ MarginFlow Schema"}
                </span>
              </div>

              {/* Tab 1: Orders Preview */}
              {activeTab === "PREVIEW" && orders.length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">Platform</th>
                        <th className="px-3 py-2.5">Order ID</th>
                        <th className="px-3 py-2.5">SKU &amp; Title</th>
                        <th className="px-3 py-2.5 text-right">Qty</th>
                        <th className="px-3 py-2.5 text-right">Selling Price</th>
                        <th className="px-3 py-2.5 text-right">COGS (Unit)</th>
                        <th className="px-3 py-2.5 text-right">Gross Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 5).map((ord, idx) => {
                        const badge = getMarketplaceBadge(ord.marketplace);
                        const it = ord.items[0];
                        const total = (it?.sellingPrice || 0) * (it?.quantity || 1);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.pillClass}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-slate-900 text-[11px]">
                              {ord.id}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-mono font-medium text-slate-800 text-[11px]">
                                {it?.sku}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {it?.productName}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700">
                              {it?.quantity}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-700">
                              {formatINR(it?.sellingPrice || 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                              {formatINR(it?.snapshotUnitCost || 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
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
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">Source Header</th>
                        <th className="px-3 py-2.5">Target Field</th>
                        <th className="px-3 py-2.5">Sample Value</th>
                        <th className="px-3 py-2.5 text-right">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detection.columnMappings.map((col, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-mono text-slate-800 font-semibold">
                            {col.sourceHeader}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 text-purple-700 font-semibold">
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span>{col.targetLabel}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                            {col.sampleValues[0] || "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
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
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Download templates:</span>
            <button
              type="button"
              onClick={() => handleDownloadSample("AMAZON")}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline"
            >
              Amazon
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => handleDownloadSample("FLIPKART")}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline"
            >
              Flipkart
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => handleDownloadSample("MEESHO")}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold hover:underline"
            >
              Meesho
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={orders.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Import {orders.length} Verified Orders</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
