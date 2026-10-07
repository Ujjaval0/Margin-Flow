"use client";

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

export interface InvoiceAutoParseModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  onImportOrders: (orders: Order[]) => void;
}

interface ParsedInvoiceItem {
  id: string;
  order: Order;
  fileName: string;
  fileType: "PDF" | "CSV" | "TXT";
}

// Helper: Extract text from uploaded file (.pdf, .csv, .txt, images)
async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  // Plain text or CSV files can be read directly in browser
  if (extension === "txt" || extension === "csv") {
    try {
      const text = await file.text();
      if (text.trim()) return text;
    } catch {
      // fallback
    }
  }

  // Digital PDF or image files: use server route to extract real digital PDF text & OCR
  try {
    const formData = new FormData();
    formData.append("files", file);
    const res = await fetch("/api/extract-invoice-text", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.results?.[0]?.text) {
        return data.results[0].text;
      }
    }
  } catch (err) {
    console.warn("Server text extraction failed, falling back to client read:", err);
  }

  try {
    return await file.text();
  } catch {
    return "";
  }
}

// Helper: Parse raw text into structured Order
function parseTextToOrder(
  text: string,
  fileName: string,
  products: Product[],
  suppliers: Supplier[],
  indexOffset = 0
): Order {
  const lower = text.toLowerCase();

  // 1. Marketplace channel detection
  let matchedMarketplace: Marketplace = "Amazon India";
  if (lower.includes("flipkart") || lower.includes("instakart")) matchedMarketplace = "Flipkart";
  else if (lower.includes("meesho") || lower.includes("fashnear")) matchedMarketplace = "Meesho";
  else if (lower.includes("myntra")) matchedMarketplace = "Myntra";
  else if (lower.includes("woocommerce")) matchedMarketplace = "WooCommerce";
  else if (lower.includes("amazon") || lower.includes("amzn")) matchedMarketplace = "Amazon India";
  else if (lower.includes("website") || lower.includes("shopify") || lower.includes("d2c")) matchedMarketplace = "Personal Website";
  else if (fileName.toLowerCase().includes("flipkart")) matchedMarketplace = "Flipkart";
  else if (fileName.toLowerCase().includes("meesho")) matchedMarketplace = "Meesho";
  else if (fileName.toLowerCase().includes("myntra")) matchedMarketplace = "Myntra";

  // 2. Order ID / Reference number detection across multi-channel standards
  const idMatch =
    text.match(/(?:order\s*id|order\s*#|invoice\s*#|invoice\s*no|ref\s*#)[:.\s]*([A-Z0-9\-_]{6,30})/i) ||
    text.match(/\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/i) ||
    text.match(/\b(OD[0-9]{15,22})\b/i) ||
    text.match(/\b(MSH-[A-Z0-9\-]+)\b/i) ||
    text.match(/\b([0-9]{11,14}(?:_[0-9]+)?)\b/i) ||
    text.match(/#([0-9]{4,8})/);

  const cleanBaseName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 10).toUpperCase();
  const extractedOrderId = idMatch
    ? idMatch[1].trim()
    : `INV-${cleanBaseName || Date.now().toString().slice(-6)}`;

  // 3. Date detection (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  const dateMatch =
    text.match(/\b(202\d[-/][01]\d[-/][0-3]\d)\b/) ||
    text.match(/\b([0-3]?\d[-/][01]?\d[-/]202\d)\b/) ||
    text.match(/(?:date|order\s*date|invoice\s*date)[:.\s]*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})/i) ||
    text.match(/(?:date|order\s*date|invoice\s*date)[:.\s]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})/i);

  let extractedDate = new Date().toISOString().split("T")[0];
  if (dateMatch) {
    const raw = dateMatch[1];
    if (raw.length === 10 && raw.startsWith("202")) {
      extractedDate = raw.replace(/\//g, "-");
    } else if (raw.includes("/") || raw.includes("-")) {
      const sep = raw.includes("/") ? "/" : "-";
      const parts = raw.split(sep);
      if (parts[2]?.length === 4) {
        extractedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      } else if (parts[0]?.length === 4) {
        extractedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      }
    }
  }

  // 4. Product matching from text
  let matchedProd: Product = products[0] || {
    id: "PROD-GEN",
    sku: "SKU-AUTO",
    name: "Catalog Item",
    category: "General",
    brand: "Generic",
    currentCostPrice: 350,
    costHistory: [],
    supplierId: "SUP-001",
    active: true,
    channelAliases: {},
    mfn: "MFN-GEN",
    mfn1: "MFN1-GEN",
  };

  for (const p of products) {
    if (
      (p.mfn && text.toUpperCase().includes(p.mfn.toUpperCase())) ||
      (p.mfn1 && text.toUpperCase().includes(p.mfn1.toUpperCase())) ||
      text.toUpperCase().includes(p.sku.toUpperCase()) ||
      (p.name && text.toLowerCase().includes(p.name.toLowerCase().slice(0, 15)))
    ) {
      matchedProd = p;
      break;
    }
  }

  // 5. Quantity & Price extraction (with robust comma support e.g. ₹1,499.00)
  const qtyMatch = text.match(/(?:qty|quantity|units)[:.\s]*([0-9]+)/i);
  const parsedQtyVal = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;

  const priceMatch =
    text.match(/(?:grand\s*total|invoice\s*(?:total|value|amount)|total\s*amount|net\s*payable|net\s*amount|total|amount|selling\s*price|item\s*price)[:.\s]*₹?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/₹\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);

  const parsedPriceVal = priceMatch
    ? Math.max(0, parseFloat(priceMatch[1].replace(/,/g, "")))
    : Math.round(matchedProd.currentCostPrice * 2.5);

  // 6. Indian Customer State & City Detection
  const stateKeywords = [
    "Maharashtra", "Karnataka", "Delhi", "Tamil Nadu", "Gujarat", "Uttar Pradesh",
    "Telangana", "Haryana", "West Bengal", "Rajasthan", "Kerala", "Madhya Pradesh",
    "Punjab", "Bihar", "Odisha", "Andhra Pradesh", "Assam", "Goa", "Jharkhand"
  ];
  let detectedState = "Maharashtra";
  let detectedCity = "Mumbai";
  for (const state of stateKeywords) {
    if (lower.includes(state.toLowerCase())) {
      detectedState = state;
      detectedCity = state === "Delhi" ? "New Delhi" : state === "Karnataka" ? "Bengaluru" : state === "Tamil Nadu" ? "Chennai" : state === "Gujarat" ? "Ahmedabad" : state === "Telangana" ? "Hyderabad" : "Metro City";
      break;
    }
  }

  const nameMatch = text.match(/(?:bill\s*to|ship\s*to|buyer\s*name|customer\s*name)[:.\s]*([A-Za-z\s]{3,25})/i);
  const customerName = nameMatch ? nameMatch[1].trim() : "Direct Buyer";

  const comm = 20;
  const gSales = parsedPriceVal * parsedQtyVal;
  const commDeduction = Math.round(gSales * (comm / 100));
  const netSettlement = Math.round(gSales * (1 - comm / 100));

  const sup = matchedProd.supplierId
    ? suppliers.find((s) => s.id === matchedProd.supplierId || s.name === matchedProd.supplierId)
    : suppliers[0];

  const uniqueSuffix = `${Date.now().toString().slice(-4)}${indexOffset}`;

  const newOrder: Order = {
    id: extractedOrderId,
    channelOrderId: extractedOrderId,
    marketplace: matchedMarketplace,
    orderDate: extractedDate,
    status: "DELIVERED",
    customerName,
    customerCity: detectedCity,
    customerState: detectedState,
    shippingFeeCharged: 0,
    marketplaceChargesEstimate: commDeduction,
    settlementAmount: netSettlement,
    settlementPercent: 100 - comm,
    commissionPercent: comm,
    supplierName: sup?.name,
    supplierId: sup?.id,
    notes: `Auto-parsed from invoice file: ${fileName}`,
    items: [
      {
        id: `ITEM-${uniqueSuffix}`,
        sku: matchedProd.sku,
        mfn: matchedProd.mfn || undefined,
        mfn1: matchedProd.mfn1 || undefined,
        productName: matchedProd.name,
        quantity: parsedQtyVal,
        sellingPrice: parsedPriceVal,
        discount: 0,
        taxAmount: Math.round(parsedPriceVal * parsedQtyVal * 0.18 * 100) / 100,
        snapshotUnitCost: matchedProd.currentCostPrice,
        returnedQuantity: 0,
      },
    ],
  };

  return newOrder;
}

export function InvoiceAutoParseModal({
  isOpen,
  onClose,
  products,
  suppliers,
  onImportOrders,
}: InvoiceAutoParseModalProps) {
  const [mounted, setMounted] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedInvoiceItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleReset = () => {
    setParsedItems([]);
    setIsProcessing(false);
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

    setIsProcessing(true);
    const newItems: ParsedInvoiceItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop()?.toLowerCase();
      const fileType: "PDF" | "CSV" | "TXT" =
        ext === "pdf" ? "PDF" : ext === "csv" ? "CSV" : "TXT";

      try {
        const text = await extractTextFromFile(file);

        // Check if CSV contains multiple tabular rows with headers
        if (ext === "csv") {
          const text = await file.text();
          const mapped = detectAndMapCsv(text, products);
          if (mapped.orders.length > 0) {
            mapped.orders.forEach((ord, ordIdx) => {
              newItems.push({
                id: `INV-ITEM-${Date.now()}-${i}-${ordIdx}`,
                order: ord,
                fileName: `${file.name} (Row ${ordIdx + 1})`,
                fileType: "CSV",
              });
            });
            continue;
          }
        }

        // Single invoice file (PDF, TXT, or single-invoice CSV)
        const order = parseTextToOrder(text, file.name, products, suppliers, i);
        newItems.push({
          id: `INV-ITEM-${Date.now()}-${i}`,
          order,
          fileName: file.name,
          fileType,
        });
      } catch (err) {
        console.error(`Error parsing invoice file ${file.name}:`, err);
        const fallbackOrder = parseTextToOrder("", file.name, products, suppliers, i);
        newItems.push({
          id: `INV-ITEM-${Date.now()}-${i}`,
          order: fallbackOrder,
          fileName: file.name,
          fileType,
        });
      }
    }

    setParsedItems((prev) => [...prev, ...newItems]);
    setIsProcessing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
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

  const handleRemoveItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) return;
    onImportOrders(parsedItems.map((item) => item.order));
    handleClose();
  };

  if (!isOpen || !mounted) return null;

  // Metrics summary
  const totalOrders = parsedItems.length;
  const totalGross = parsedItems.reduce(
    (sum, item) => sum + item.order.items.reduce((iSum, i) => iSum + i.sellingPrice * i.quantity, 0),
    0
  );
  const totalSettlement = parsedItems.reduce((sum, item) => sum + (item.order.settlementAmount || 0), 0);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]">
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
            className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {/* File Upload Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-[#0071E3] bg-[#0071E3]/5 scale-[0.99]"
                : "border-black/[0.12] hover:border-[#0071E3]/60 bg-[#FAFAFC] hover:bg-[#F5F5F7]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2 text-xs text-[#6E6E73]">
              <div className="w-10 h-10 rounded-2xl bg-white border border-black/[0.08] shadow-apple-sm flex items-center justify-center text-[#0071E3]">
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm text-[#1D1D1F]">
                  Drag &amp; drop invoices here, or <span className="text-[#0071E3] underline underline-offset-2">browse</span>
                </p>
                <p className="text-[11px] text-[#86868B] mt-0.5">
                  Supports PDF, CSV, or TXT
                </p>
              </div>
            </div>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2.5 py-4 text-xs font-medium text-[#0071E3] bg-[#0071E3]/5 rounded-xl border border-[#0071E3]/15">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Parsing and extracting invoice order data...</span>
            </div>
          )}

          {/* Parsed Orders List */}
          {parsedItems.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[#1D1D1F] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Parsed Orders ({parsedItems.length})</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#0071E3] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add more files</span>
                  </button>
                  <span className="text-black/[0.15]">|</span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {parsedItems.map((item) => {
                  const mpBadge = getMarketplaceBadge(item.order.marketplace);
                  const itemPrimary = item.order.items[0];

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-white rounded-xl border border-black/[0.08] shadow-apple-sm flex items-start justify-between gap-3 hover:border-black/[0.15] transition"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span className="w-7 h-7 rounded-lg bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center font-bold text-[10px] shrink-0 uppercase mt-0.5">
                          {item.fileType}
                        </span>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-[#1D1D1F] truncate">
                              #{item.order.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${mpBadge.pillClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${mpBadge.dotClass}`} />
                              <span>{item.order.marketplace}</span>
                            </span>
                            <span className="text-[10px] text-[#86868B]">
                              {item.order.orderDate}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#6E6E73] truncate">
                            <span className="font-medium text-[#1D1D1F]">
                              {itemPrimary?.productName || "Order Item"}
                            </span>
                            <span className="mx-1.5 text-black/[0.2]">•</span>
                            <span>SKU: {itemPrimary?.sku || "N/A"}</span>
                            <span className="mx-1.5 text-black/[0.2]">•</span>
                            <span>Qty: {itemPrimary?.quantity || 1}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-[#1D1D1F] font-semibold">
                              Selling Price: {formatINR(itemPrimary ? itemPrimary.sellingPrice * itemPrimary.quantity : 0)}
                            </span>
                            <span className="text-[#86868B]">
                              Est. Settlement: {formatINR(item.order.settlementAmount || 0)}
                            </span>
                            <span className="text-[10px] text-[#86868B] italic truncate max-w-[150px]">
                              from {item.fileName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-[#86868B] hover:text-red-600 p-1 rounded-lg hover:bg-black/[0.04] transition cursor-pointer shrink-0"
                        title="Remove from batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-black/[0.06] bg-[#FBFBFD] flex items-center justify-between">
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
                  Net Settlement: <strong className="text-emerald-700">{formatINR(totalSettlement)}</strong>
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
              className="px-4 py-2 rounded-full border border-black/[0.08] hover:bg-black/[0.02] text-xs font-semibold text-[#1D1D1F] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={parsedItems.length === 0}
              onClick={handleConfirmImport}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#1D1D1F] hover:bg-black disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-white transition shadow-apple-sm active:scale-[0.98] cursor-pointer"
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
