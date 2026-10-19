"use client";

import { invoiceToOrder, type InvoiceSource } from "@/domain/invoice-order";
import { money } from "@/domain/order-financials";


import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  Sparkles,
  FileScan,
  FileUp,
  X,
  FileText,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Order, Product, Supplier, Marketplace } from "@/domain/types";
import { formatINR } from "@/lib/utils";
import { getMarketplaceBadge } from "@/lib/marketplace-config";
import { detectAndMapCsv } from "@/domain/csv-auto-mapper";
import { loadAISettings } from "@/lib/security/ai-vault";
import { usePlatform } from "@/domain/store";

export interface InvoiceAutoParseModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  existingOrders?: Order[];
  onImportOrders: (orders: Order[]) => void | Promise<void>;
}

interface ParsedInvoiceItem {
  id: string;
  order: Order;
  fileName: string;
  fileType: "PDF" | "CSV" | "TXT";
  isExistingInLedger?: boolean;
}

interface ExtractedInvoiceResult {
  text: string;
  parsedData?: InvoiceSource;
}

// Helper: Extract text & multimodal structured data from uploaded file (.pdf, .csv, .txt, images)
async function extractInvoiceFromFile(file: File, ownerId: string | null): Promise<ExtractedInvoiceResult> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  // Plain text or CSV files can be read directly if needed
  if (extension === "csv") {
    try {
      const text = await file.text();
      if (text.trim()) return { text };
    } catch {
      // fallback
    }
  }

  // Digital PDF, image, or text: use server route to extract real digital PDF text & multimodal OCR
  try {
    const aiSettings = loadAISettings(ownerId);
    const formData = new FormData();
    formData.append("files", file);

    const headers: Record<string, string> = {};
    const activeProvider = aiSettings?.activeProvider || "gemini";
    const apiKey = aiSettings?.keys?.[activeProvider] || aiSettings?.keys?.gemini || "";

    headers["x-ai-provider"] = activeProvider;
    if (apiKey) {
      headers["x-ai-key"] = apiKey;
      headers["x-gemini-api-key"] = apiKey;
    }
    if (aiSettings?.model) {
      headers["x-ai-model"] = aiSettings.model;
      headers["x-gemini-model"] = aiSettings.model;
    }

    const res = await fetch("/api/extract-invoice-text", {
      method: "POST",
      headers,
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.results?.[0]) {
        return {
          text: data.results[0].text || "",
          parsedData: data.results[0].parsedData,
        };
      }
    }
  } catch (err) {
    console.warn("Server text extraction failed, falling back to client read:", err);
  }

  try {
    const text = await file.text();
    return { text: text || "" };
  } catch {
    return { text: "" };
  }
}


// Posting uses the same strict source arithmetic regardless of extraction provider.
function createOrderFromExtractedData(extracted:ExtractedInvoiceResult,fileName:string,products:Product[],_suppliers:Supplier[],_indexOffset=0):Order {
  return invoiceToOrder(extracted,fileName,products);
}

export function InvoiceAutoParseModal({
  isOpen,
  onClose,
  products,
  suppliers,
  existingOrders = [],
  onImportOrders,
}: InvoiceAutoParseModalProps) {
  const { verifiedOwnerId } = usePlatform();
  const [mounted, setMounted] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedInvoiceItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [skippedDuplicates, setSkippedDuplicates] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleReset = () => {
    setParsedItems([]);
    setIsProcessing(false);
    setProgress({ current: 0, total: 0 });
    setSkippedDuplicates(0);
    setIsDragging(false);
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

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    // Snapshot files to a native array immediately so DOM mutations won't empty it
    const fileArray = Array.from(files);

    // 1. Pre-API File Deduplication (filter out exact duplicate files in batch & already loaded)
    const seenSignatures = new Set(parsedItems.map((p) => p.fileName.toLowerCase()));
    const uniqueFiles: File[] = [];
    let dupeFilesSkipped = 0;

    for (const f of fileArray) {
      const sig = `${f.name.toLowerCase()}-${f.size}`;
      if (seenSignatures.has(sig)) {
        dupeFilesSkipped++;
      } else {
        seenSignatures.add(sig);
        uniqueFiles.push(f);
      }
    }

    if (dupeFilesSkipped > 0) {
      setSkippedDuplicates((prev) => prev + dupeFilesSkipped);
    }

    if (uniqueFiles.length === 0) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: uniqueFiles.length });

    // Parallel worker pool: 5 simultaneous workers for maximum throughput without rate-limiting
    const CONCURRENCY_LIMIT = 5;
    let completed = 0;
    let cursor = 0;
    const newItems: ParsedInvoiceItem[] = [];

    const runWorker = async () => {
      while (cursor < uniqueFiles.length) {
        const i = cursor++;
        const file = uniqueFiles[i];
        const ext = file.name.split(".").pop()?.toLowerCase();
        const fileType: "PDF" | "CSV" | "TXT" =
          ext === "pdf" ? "PDF" : ext === "csv" ? "CSV" : "TXT";

        try {
          // Check if CSV contains multiple tabular rows with headers
          if (ext === "csv") {
            const text = await file.text();
            const mapped = detectAndMapCsv(text, products);
            if (mapped.orders.length > 0) {
              mapped.orders.forEach((ord, ordIdx) => {
                const isExisting = existingOrders.some(
                  (eo) =>
                    (ord.channelOrderId && eo.channelOrderId === ord.channelOrderId) ||
                    (ord.id && eo.id === ord.id)
                );
                newItems.push({
                  id: `INV-ITEM-${Date.now()}-${i}-${ordIdx}`,
                  order: ord,
                  fileName: `${file.name} (Row ${ordIdx + 1})`,
                  fileType: "CSV",
                  isExistingInLedger: isExisting,
                });
              });
              continue;
            }
          }

          // Single invoice file (PDF, TXT, or single-invoice CSV) via multimodal extraction
          const extraction = await extractInvoiceFromFile(file, verifiedOwnerId);
          const order = createOrderFromExtractedData(extraction, file.name, products, suppliers, i);

          // Deduplication: Avoid adding duplicate order IDs within current batch
          const orderRef = order.channelOrderId || order.id;
          const isDuplicateInBatch =
            orderRef &&
            (newItems.some((item) => (item.order.channelOrderId || item.order.id) === orderRef) ||
              parsedItems.some((item) => (item.order.channelOrderId || item.order.id) === orderRef));

          if (!isDuplicateInBatch) {
            const isExisting = existingOrders.some(
              (eo) =>
                (order.channelOrderId && eo.channelOrderId === order.channelOrderId) ||
                (order.id && eo.id === order.id)
            );

            newItems.push({
              id: `INV-ITEM-${Date.now()}-${i}`,
              order,
              fileName: file.name,
              fileType,
              isExistingInLedger: isExisting,
            });
          } else {
            setSkippedDuplicates((prev) => prev + 1);
          }
        } catch (err) {
          console.error(`Error parsing invoice file ${file.name}:`, err);
          alert(file.name+': '+(err instanceof Error?err.message:'Invoice could not be parsed. No record was posted.'));
        } finally {
          completed++;
          setProgress({ current: completed, total: uniqueFiles.length });
        }
      }
    };

    const workerCount = Math.min(CONCURRENCY_LIMIT, uniqueFiles.length);
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    setParsedItems((prev) => [...prev, ...newItems]);
    setIsProcessing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      e.target.value = "";
      processFiles(selectedFiles);
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
      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    }
  };

  const handleRemoveItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmImport = async () => {
    if (parsedItems.length === 0) return;
    const seen = new Set<string>();
    const ordersToImport: Order[] = [];
    for (const item of parsedItems) {
      const key = JSON.stringify([item.order.marketplace, item.order.channelOrderId || item.order.id]);
      if (!seen.has(key)) {
        seen.add(key);
        ordersToImport.push(item.order);
      }
    }
    try {
      await onImportOrders(ordersToImport);
      handleClose();
    } catch (error) { alert(error instanceof Error ? error.message : "Import failed. Please retry."); }
  };

  if (!isOpen || !mounted) return null;

  // Metrics summary
  const totalOrders = parsedItems.length;
  const totalGross = parsedItems.reduce(
    (sum, item) => sum + item.order.items.reduce((iSum, i) => iSum + i.sellingPrice * i.quantity, 0),
    0
  );
  const totalSettlement = parsedItems.some(item => item.order.settlementAmount === undefined) ? null
    : parsedItems.reduce((sum, item) => sum + (item.order.settlementAmount || 0), 0);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-2xl h-[580px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] flex items-center justify-center shrink-0">
              <FileScan className="w-4 h-4 text-[#0071E3]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                Auto-parse from Invoice
              </h2>
              <p className="text-[11px] text-[#86868B]">
                Upload marketplace invoices to auto-fill order details
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.csv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* State 1: Empty State (No items parsed and not actively processing initial batch) */}
          {parsedItems.length === 0 && !isProcessing && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-[#0071E3] bg-[#0071E3]/5 scale-[0.99]"
                  : "border-black/[0.1] hover:border-[#0071E3]/50 bg-[#FAFAFC] hover:bg-[#F5F5F7]"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-white border border-black/[0.08] shadow-apple-sm flex items-center justify-center text-[#0071E3] mb-3">
                <FileUp className="w-6 h-6" />
              </div>
              <p className="font-semibold text-sm text-[#1D1D1F]">
                Drag &amp; drop invoices here, or <span className="text-[#0071E3] underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-[#86868B] mt-1 font-medium">
                Supports PDF, CSV, or TXT
              </p>
              <div className="mt-5">
                <span className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white font-medium text-xs shadow-apple-sm transition">
                  Browse files
                </span>
              </div>
            </div>
          )}

          {/* State 2: Processing initial batch (Empty items) */}
          {isProcessing && parsedItems.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-[#86868B] space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#0071E3] mx-auto" />
              <div>
                <p className="font-semibold text-sm text-[#1D1D1F]">
                  Extracting {progress.total} invoice{progress.total > 1 ? "s" : ""} in parallel...
                </p>
                <p className="text-xs text-[#86868B] mt-1">
                  {progress.current} of {progress.total} processed ({Math.round((progress.current / Math.max(1, progress.total)) * 100)}%)
                </p>
              </div>
              <div className="w-56 bg-[#0071E3]/15 rounded-full h-1.5 overflow-hidden mt-1">
                <div
                  className="bg-[#0071E3] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.current / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* State 3: Items exist */}
          {parsedItems.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              {/* Header Toolbar */}
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[#1D1D1F] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Parsed Orders</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/[0.05] text-[#1D1D1F] tabular-nums">
                    {parsedItems.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-[11px] font-medium text-[#1D1D1F] transition cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3 h-3 text-[#0071E3]" />
                    <span>Add more</span>
                  </button>
                  <span className="text-black/[0.15]">|</span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] font-medium text-red-600 hover:text-red-700 transition cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              {/* Compact Drag & Drop Strip */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border border-dashed rounded-xl py-2 px-3 text-center cursor-pointer transition shrink-0 flex items-center justify-center gap-2 ${
                  isDragging
                    ? "border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]"
                    : "border-black/[0.1] hover:border-[#0071E3]/40 bg-[#FAFAFC] hover:bg-[#F5F5F7] text-[#6E6E73]"
                }`}
              >
                <FileUp className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
                <span className="text-[11px]">
                  Drop more invoices here or <span className="text-[#0071E3] font-medium underline underline-offset-2">browse</span>
                </span>
              </div>

              {/* Processing Progress Bar (when adding more files to already parsed list) */}
              {isProcessing && (
                <div className="p-2.5 text-xs text-[#0071E3] bg-[#0071E3]/5 rounded-xl border border-[#0071E3]/15 space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0 text-[#0071E3]" />
                      <span>Extracting {progress.total} invoices...</span>
                    </span>
                    <span className="text-[10px] font-semibold text-[#1D1D1F]">
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-[#0071E3]/15 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-[#0071E3] h-1 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((progress.current / Math.max(1, progress.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Filtered duplicates alert */}
              {skippedDuplicates > 0 && (
                <div className="px-3 py-1.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 flex items-center justify-between shrink-0">
                  <span>{skippedDuplicates} duplicate file{skippedDuplicates > 1 ? "s" : ""} excluded</span>
                  <button
                    type="button"
                    onClick={() => setSkippedDuplicates(0)}
                    className="text-amber-600 hover:text-amber-800 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Scrollable list of parsed cards */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {parsedItems.map((item) => {
                  const mpBadge = getMarketplaceBadge(item.order.marketplace);
                  const itemPrimary = item.order.items[0];

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-xl border border-black/[0.08] shadow-apple-sm hover:border-black/[0.15] transition space-y-1.5 group"
                    >
                      {/* Row 1: Order ID, Channel Badge, Ledger Badge, Date, Delete Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-semibold text-xs text-[#1D1D1F] tracking-tight">
                            #{item.order.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${mpBadge.pillClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${mpBadge.dotClass}`} />
                            <span>{item.order.marketplace}</span>
                          </span>
                          {item.isExistingInLedger && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                              Already in Ledger
                            </span>
                          )}
                          <span className="text-[10px] text-[#86868B]">
                            {item.order.orderDate}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-6 h-6 rounded-lg text-[#86868B] hover:text-[#D70015] hover:bg-rose-50 flex items-center justify-center transition cursor-pointer shrink-0 active:scale-95"
                          title="Remove from batch"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Row 2: Product Name */}
                      <p className="text-xs font-medium text-[#1D1D1F] truncate" title={itemPrimary?.productName || "Invoiced Product"}>
                        {itemPrimary?.productName || "Invoiced Product"}
                      </p>

                      {/* Row 3: SKU, Quantity & Financials */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/[0.04]">
                        <div className="flex items-center gap-2 text-[#6E6E73] truncate">
                          <span className="truncate">SKU: <span className="text-[#1D1D1F] font-mono font-medium">{itemPrimary?.sku || "N/A"}</span></span>
                          <span className="text-black/[0.2]">•</span>
                          <span>Qty: <span className="text-[#1D1D1F] font-semibold">{itemPrimary?.quantity || 1}</span></span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[#6E6E73]">
                            Price: <strong className="text-[#1D1D1F] font-semibold">{formatINR(itemPrimary ? itemPrimary.sellingPrice * itemPrimary.quantity : 0)}</strong>
                          </span>
                          <span className="text-black/[0.15]">|</span>
                          <span className="text-[#6E6E73]">
                            Settlement: <strong className="text-emerald-700 font-semibold">{item.order.settlementAmount === undefined ? "Unavailable" : formatINR(item.order.settlementAmount)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-black/[0.06] bg-[#FBFBFD] flex items-center justify-between shrink-0">
          <div className="text-xs">
            {parsedItems.length > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-[#1D1D1F] font-semibold">
                  {totalOrders} order{totalOrders > 1 ? "s" : ""} extracted
                </span>
                <span className="text-black/[0.2]">•</span>
                <span className="text-[#6E6E73]">
                  Gross: <strong className="text-[#1D1D1F]">{formatINR(totalGross)}</strong>
                </span>
                <span className="text-black/[0.2]">•</span>
                <span className="text-[#6E6E73]">
                  Net Settlement: <strong className="text-emerald-700">{totalSettlement === null ? "Unavailable" : formatINR(totalSettlement)}</strong>
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-[#86868B]">
                Supports Amazon, Flipkart, Meesho &amp; D2C invoices
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-full border border-black/[0.08] hover:bg-black/[0.04] text-xs font-semibold text-[#1D1D1F] transition cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedItems.length === 0}
              onClick={handleConfirmImport}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#1D1D1F] hover:bg-black disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-white transition shadow-apple-sm active:scale-95 cursor-pointer"
            >
              <span>Import {parsedItems.length > 0 ? `${parsedItems.length} Order${parsedItems.length > 1 ? "s" : ""}` : "Orders"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
