"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Package,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Product } from "@/domain/types";
import { formatINR } from "@/lib/utils";

export interface ProductBulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkAddProducts: (products: Product[]) => void;
  existingProducts: Product[];
}

interface ParsedProductRow {
  sku: string;
  mfn: string;
  mfn1: string;
  name: string;
  category: string;
  brand: string;
  costPrice: number;
  supplierId: string;
  stockQuantity: number;
  aliasAmazon: string;
  aliasFlipkart: string;
  aliasMeesho: string;
  isValid: boolean;
  error?: string;
}

export function ProductBulkUploadModal({
  isOpen,
  onClose,
  onBulkAddProducts,
  existingProducts,
}: ProductBulkUploadModalProps) {
  const [mounted, setMounted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleReset = () => {
    setFiles([]);
    setParsedRows([]);
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

  // Robust CSV parser supporting quotes & commas
  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const result: string[][] = [];

    for (const line of lines) {
      const row: string[] = [];
      let inQuotes = false;
      let curVal = "";

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          row.push(curVal.trim().replace(/^"|"$/g, ""));
          curVal = "";
        } else {
          curVal += char;
        }
      }
      row.push(curVal.trim().replace(/^"|"$/g, ""));
      result.push(row);
    }
    return result;
  };

  const processFiles = async (uploadedFiles: FileList | File[]) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    const fileArray = Array.from(uploadedFiles).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".txt")
    );

    if (fileArray.length === 0) {
      alert("Please upload valid .csv or .txt catalog files.");
      return;
    }

    setFiles((prev) => [...prev, ...fileArray]);
    setIsProcessing(true);

    const allRows: ParsedProductRow[] = [...parsedRows];
    const seenSkus = new Set(allRows.map((r) => r.sku));

    for (const curFile of fileArray) {
      try {
        const content = await curFile.text();
        if (!content.trim()) continue;

        const table = parseCSV(content);
        if (table.length < 2) continue;

        const headers = table[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));

        // Match column indices intelligently
        const findCol = (keywords: string[]) =>
          headers.findIndex((h) => keywords.some((kw) => h.includes(kw)));

        const skuIdx = findCol(["sku", "itemcode", "mastercode", "productcode", "article"]);
        const mfnIdx = findCol(["mfnnumber", "mfn", "mpn", "partnumber"]);
        const mfn1Idx = findCol(["mfn1", "mfnsecondary", "mfn2", "aliascode"]);
        const nameIdx = findCol(["name", "title", "productname", "itemdescription", "item"]);
        const costIdx = findCol(["cost", "cogs", "costprice", "purchaseprice", "unitcost", "price"]);
        const catIdx = findCol(["category", "dept"]);
        const brandIdx = findCol(["brand", "make"]);
        const supplierIdx = findCol(["supplier", "vendor", "supplierid"]);
        const stockIdx = findCol(["stock", "qty", "quantity", "inventory"]);
        const azIdx = findCol(["amazon", "asin"]);
        const fkIdx = findCol(["flipkart", "fsn"]);
        const mshIdx = findCol(["meesho"]);

        for (let i = 1; i < table.length; i++) {
          const row = table[i];
          if (row.length === 0 || row.every((c) => c === "")) continue;

          const rawSku = skuIdx !== -1 ? row[skuIdx] : "";
          const rawMfn = mfnIdx !== -1 ? row[mfnIdx] : "";
          const rawMfn1 = mfn1Idx !== -1 ? row[mfn1Idx] : "";
          const rawName = nameIdx !== -1 ? row[nameIdx] : "";
          const rawCost = costIdx !== -1 ? parseFloat(row[costIdx]?.replace(/[^0-9.]/g, "")) : 0;
          const rawCat = catIdx !== -1 && row[catIdx] ? row[catIdx] : "General";
          const rawBrand = brandIdx !== -1 && row[brandIdx] ? row[brandIdx] : "Catalog";
          const rawSupplier = supplierIdx !== -1 && row[supplierIdx] ? row[supplierIdx] : "Direct Supplier";
          const rawStock = stockIdx !== -1 ? parseInt(row[stockIdx]?.replace(/[^0-9]/g, ""), 10) || 50 : 50;

          const sku = rawSku.trim().toUpperCase() || (rawName ? `SKU-${rawName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase()}` : `SKU-${i}`);
          const name = rawName.trim() || `Item (${sku})`;
          const cost = isNaN(rawCost) || rawCost <= 0 ? 350 : rawCost;

          const aliasAz = azIdx !== -1 && row[azIdx] ? row[azIdx] : sku;
          const aliasFk = fkIdx !== -1 && row[fkIdx] ? row[fkIdx] : sku;
          const aliasMsh = mshIdx !== -1 && row[mshIdx] ? row[mshIdx] : sku;

          let isValid = true;
          let error = "";

          if (!sku) {
            isValid = false;
            error = "Missing SKU";
          } else if (!name) {
            isValid = false;
            error = "Missing Product Title";
          } else if (cost <= 0) {
            isValid = false;
            error = "Cost price must be > 0";
          }

          if (!seenSkus.has(sku)) {
            seenSkus.add(sku);
            allRows.push({
              sku,
              mfn: rawMfn.trim().toUpperCase(),
              mfn1: rawMfn1.trim().toUpperCase(),
              name,
              category: rawCat,
              brand: rawBrand,
              costPrice: cost,
              supplierId: rawSupplier,
              stockQuantity: rawStock,
              aliasAmazon: aliasAz,
              aliasFlipkart: aliasFk,
              aliasMeesho: aliasMsh,
              isValid,
              error,
            });
          }
        }
      } catch (err) {
        console.error(`Failed to parse product CSV ${curFile.name}:`, err);
      }
    }

    setParsedRows(allRows);
    setIsProcessing(false);
  };

  const handleDownloadSample = () => {
    const headers = [
      "SKU",
      "MFN Number",
      "MFN-1",
      "Product Title",
      "COGS (Unit Cost)",
      "Category",
      "Brand",
      "Supplier ID",
      "Stock Qty",
      "Amazon SKU",
      "Flipkart SKU",
      "Meesho SKU",
    ];

    const sampleRows = [
      [
        "ELEC-KBD-RGB",
        "MFN-KBD-900",
        "MFN1-KBD-900-RGB",
        "RGB Mechanical Gaming Keyboard",
        "750",
        "Computer Peripherals",
        "VoltTech",
        "SUP-001",
        "120",
        "B08KEYB-RGB",
        "FLIP-KBD-MECH",
        "MSHO-KBD-991",
      ],
      [
        "ELEC-PD-30W",
        "MFN-PWR-030",
        "MFN1-PWR-030-A",
        "30W Mini GaN USB-C Adapter",
        "280",
        "Mobile Accessories",
        "VoltTech",
        "SUP-002",
        "250",
        "B09MINI30W",
        "FLIP-CHG-30W",
        "MSHO-30W-CHG",
      ],
      [
        "ELEC-HUB-7IN1",
        "MFN-HUB-701",
        "MFN1-HUB-701-SLV",
        "7-in-1 Aluminium USB-C Multiport Hub",
        "950",
        "Computer Peripherals",
        "VoltTech",
        "SUP-001",
        "75",
        "B07HUB7IN1-IND",
        "FLIP-HUB-7IN1",
        "MSHO-HUB-771",
      ],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `marginflow_products_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    const productsToImport: Product[] = validRows.map((r) => {
      const generatedId = `PROD-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
      return {
        id: generatedId,
        sku: r.sku,
        mfn: r.mfn || undefined,
        mfn1: r.mfn1 || undefined,
        name: r.name,
        category: r.category,
        brand: r.brand,
        currentCostPrice: r.costPrice,
        supplierId: r.supplierId,
        active: true,
        stockQuantity: r.stockQuantity,
        channelAliases: {
          "Amazon India": r.aliasAmazon || r.sku,
          Flipkart: r.aliasFlipkart || r.sku,
          Meesho: r.aliasMeesho || r.sku,
          "Personal Website": r.sku,
        },
        costHistory: [
          {
            validFrom: new Date().toISOString().split("T")[0],
            costPrice: r.costPrice,
            notes: "Imported via bulk product SKU upload",
          },
        ],
      };
    });

    onBulkAddProducts(productsToImport);
    handleClose();
  };

  if (!isOpen || !mounted) return null;

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.length - validCount;

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
              <Package className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                <span>Bulk Upload Products &amp; SKUs</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                  MFN Enabled
                </span>
              </h2>
              <p className="text-[11px] text-[#86868B]">
                Upload CSV catalog with Master SKU, MFN Number, MFN-1, and baseline COGS.
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
          {/* File Dropzone */}
          {files.length === 0 && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processFiles(e.dataTransfer.files);
                }
              }}
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
                accept=".csv,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processFiles(e.target.files);
                    e.target.value = "";
                  }
                }}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1D1D1F]">
                Drag &amp; drop your catalog CSV spreadsheet(s)
              </p>
              <p className="text-xs text-[#86868B] mt-1 font-medium">
                Supports single or multiple CSV files (.csv, .txt) with SKU, MFN, Title, COGS &amp; Aliases
              </p>

              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white font-medium text-xs shadow-apple-sm btn-press transition">
                  Browse files
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSample();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] font-medium text-xs border border-black/[0.06] shadow-apple-sm btn-press transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#86868B]" />
                  <span>Download sample template (.csv)</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing Spinner */}
          {isProcessing && (
            <div className="py-12 text-center text-[#86868B] space-y-2">
              <div className="w-8 h-8 border-2 border-[#1D1D1F] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-medium text-xs text-[#1D1D1F]">
                Scanning CSV headers and validating product SKU records...
              </p>
            </div>
          )}

          {/* Results Preview */}
          {files.length > 0 && !isProcessing && parsedRows.length > 0 && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 bg-[#F5F5F7] rounded-2xl border border-black/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#288548]/10 border border-[#288548]/20 text-[#288548] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-[#1D1D1F] text-xs">
                      {files.length > 1
                        ? `${files.length} catalog files (${files.map((f) => f.name).slice(0, 2).join(", ")}${files.length > 2 ? "..." : ""})`
                        : files[0]?.name}
                    </span>
                    <p className="text-[11px] text-[#86868B] mt-0.5 tabular-nums">
                      {validCount} valid products ready to import · {errorCount} errors
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-[#0071E3] font-medium px-3.5 py-1.5 rounded-xl border border-[#0071E3]/20 bg-[#0071E3]/5 hover:bg-[#0071E3]/10 shadow-apple-sm btn-press transition cursor-pointer"
                  >
                    + Add files
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-[#1D1D1F] font-medium px-3.5 py-1.5 rounded-xl border border-black/[0.06] bg-white hover:bg-[#F5F5F7] shadow-apple-sm btn-press transition cursor-pointer"
                  >
                    Change files
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-black/[0.06] rounded-2xl overflow-hidden shadow-apple-sm bg-white">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F5F7] text-[#6E6E73] border-b border-black/[0.06] text-[11px] font-medium sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5">SKU</th>
                        <th className="px-3 py-2.5">MFN / MFN-1</th>
                        <th className="px-3 py-2.5">Product Title</th>
                        <th className="px-3 py-2.5 text-right">COGS (₹)</th>
                        <th className="px-3 py-2.5">Supplier</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className={row.isValid ? "hover:bg-[#F5F5F7]/50" : "bg-rose-50/40"}>
                          <td className="px-3 py-2 font-mono font-semibold text-[#1D1D1F] text-[11px]">
                            {row.sku || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-mono text-[11px] text-[#0071E3] font-medium">
                              {row.mfn || "—"}
                            </div>
                            {row.mfn1 && (
                              <div className="text-[10px] text-[#86868B] font-mono">
                                {row.mfn1}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-[#1D1D1F] text-[11px] truncate max-w-xs">
                              {row.name || "—"}
                            </div>
                            <div className="text-[10px] text-[#86868B]">
                              {row.brand} • {row.category}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-[#1D1D1F] tabular-nums">
                            {formatINR(row.costPrice)}
                          </td>
                          <td className="px-3 py-2 text-[#6E6E73] text-[11px]">
                            {row.supplierId}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.isValid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#288548]/10 text-[#288548] border border-[#288548]/20">
                                Ready
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D70015]/10 text-[#D70015] border border-[#D70015]/20" title={row.error}>
                                {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#FBFBFD] border-t border-black/[0.06] flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadSample}
            className="text-xs text-[#0071E3] hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV template</span>
          </button>

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
              disabled={validCount === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-[#1D1D1F] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Import {validCount} products</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
