"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from "lucide-react";
import { Order, OrderItem, Marketplace, OrderStatus, Product } from "@/domain/types";
import { normalizeMarketplace, getMarketplaceBadge } from "@/lib/marketplace-config";
import { formatINR } from "@/lib/utils";

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onImportOrders: (orders: Order[]) => void;
}

// RFC 4180 compliant CSV parser
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === "\r") {
        // Skip CR
      } else if (char === "\n") {
        currentRow.push(currentVal.trim());
        if (currentRow.some((field) => field !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((field) => field !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function CsvImportModal({
  isOpen,
  onClose,
  products,
  onImportOrders,
}: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedOrders, setParsedOrders] = useState<Order[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setParsedOrders([]);
    setParseErrors([]);
    setIsProcessing(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Download Sample CSV template
  const handleDownloadSampleCsv = () => {
    const headers = [
      "PLATFORM",
      "DATE",
      "ORDER ID",
      "CHANNEL REF",
      "CUSTOMER NAME",
      "CITY",
      "STATE",
      "SKU",
      "PRODUCT NAME",
      "QTY",
      "SELLING PRICE",
      "DISCOUNT",
      "TAX",
      "SHIPPING FEE",
      "STATUS",
    ];

    const sampleRows = [
      [
        "Amazon India",
        new Date().toISOString().split("T")[0],
        "ORD-IMPORT-001",
        "408-1293847-9921021",
        "Aarav Sharma",
        "Bengaluru",
        "Karnataka",
        products[0]?.sku || "ELEC-WEM-64GB",
        products[0]?.name || "Wireless Ergonomic Mouse",
        "2",
        "1499",
        "100",
        "252",
        "40",
        "CONFIRMED",
      ],
      [
        "Flipkart",
        new Date().toISOString().split("T")[0],
        "ORD-IMPORT-002",
        "OD329019283019200",
        "Priya Patel",
        "Ahmedabad",
        "Gujarat",
        products[1]?.sku || "ELEC-USBC-65W",
        products[1]?.name || "65W GaN Fast Charger",
        "1",
        "1299",
        "50",
        "190.5",
        "0",
        "DELIVERED",
      ],
      [
        "Meesho",
        new Date().toISOString().split("T")[0],
        "ORD-IMPORT-003",
        "MSH-SUB-8819204",
        "Vikram Rao",
        "Hyderabad",
        "Telangana",
        products[2]?.sku || "ELEC-MECH-RGB",
        products[2]?.name || "Mechanical Gaming Keyboard RGB",
        "1",
        "2499",
        "0",
        "381.2",
        "0",
        "CONFIRMED",
      ],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_orders_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (uploadedFile: File) => {
    if (!uploadedFile.name.endsWith(".csv")) {
      setParseErrors(["Please select a valid .csv file."]);
      return;
    }

    setFile(uploadedFile);
    setIsProcessing(true);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setParseErrors(["The selected file is empty."]);
          setIsProcessing(false);
          return;
        }

        const rawRows = parseCsv(text);
        if (rawRows.length < 2) {
          setParseErrors(["The CSV file must contain a header row and at least one order row."]);
          setIsProcessing(false);
          return;
        }

        // Header normalization
        const headers = rawRows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));

        // Helper to find column index
        const findCol = (...names: string[]): number => {
          for (const name of names) {
            const clean = name.toLowerCase().replace(/[^a-z0-9]/g, "");
            const idx = headers.findIndex((h) => h === clean || h.includes(clean));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const platformIdx = findCol("platform", "marketplace", "channel");
        const dateIdx = findCol("date", "orderdate", "purchasedate");
        const orderIdIdx = findCol("orderid", "ordernumber", "id");
        const channelRefIdx = findCol("channelref", "channelorderid", "suborderid");
        const customerNameIdx = findCol("customername", "customer", "buyer", "buyername");
        const cityIdx = findCol("city", "customercity", "shipcity");
        const stateIdx = findCol("state", "customerstate", "shipstate");
        const skuIdx = findCol("sku", "itemsku", "sellersku");
        const productNameIdx = findCol("productname", "itemname", "product", "title");
        const qtyIdx = findCol("qty", "quantity", "units");
        const sellingPriceIdx = findCol("sellingprice", "grosssale", "price", "unitprice", "itemprice");
        const discountIdx = findCol("discount", "discounts", "promodiscount");
        const taxIdx = findCol("tax", "taxamount", "gst");
        const shippingFeeIdx = findCol("shippingfee", "shipping", "shippingfeecharged");
        const statusIdx = findCol("status", "orderstatus", "deliverystatus");

        const ordersList: Order[] = [];
        const errors: string[] = [];

        // Build product lookup map for rapid SKU cross-matching
        const productMap = new Map<string, Product>();
        products.forEach((p) => {
          productMap.set(p.sku.toLowerCase().trim(), p);
        });

        for (let r = 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0 || row.every((c) => c === "")) continue;

          const rowNum = r + 1;
          const rawSku = skuIdx !== -1 ? row[skuIdx] : "";
          if (!rawSku) {
            errors.push(`Row ${rowNum}: Missing required SKU.`);
            continue;
          }

          const matchedProduct = productMap.get(rawSku.toLowerCase().trim());
          const sku = matchedProduct ? matchedProduct.sku : rawSku.trim();
          const productName =
            (productNameIdx !== -1 ? row[productNameIdx] : "") ||
            matchedProduct?.name ||
            `Catalog SKU (${sku})`;

          const quantity = Math.max(1, parseInt(qtyIdx !== -1 ? row[qtyIdx] : "1", 10) || 1);
          const rawPrice = sellingPriceIdx !== -1 ? parseFloat(row[sellingPriceIdx]) : 0;
          const sellingPrice = !isNaN(rawPrice) && rawPrice > 0 ? rawPrice : 999;
          const discount = discountIdx !== -1 ? Math.max(0, parseFloat(row[discountIdx]) || 0) : 0;
          const rawTax = taxIdx !== -1 ? parseFloat(row[taxIdx]) : NaN;
          const taxAmount = !isNaN(rawTax) ? rawTax : Math.round(sellingPrice * 0.18);
          const shippingFeeCharged = shippingFeeIdx !== -1 ? Math.max(0, parseFloat(row[shippingFeeIdx]) || 0) : 0;

          const rawPlatform = platformIdx !== -1 ? row[platformIdx] : "Amazon India";
          const marketplace = normalizeMarketplace(rawPlatform || "Amazon India");

          const orderId =
            orderIdIdx !== -1 && row[orderIdIdx]
              ? row[orderIdIdx].trim()
              : `ORD-CSV-${Date.now().toString().slice(-4)}${r}`;

          const channelOrderId =
            channelRefIdx !== -1 && row[channelRefIdx]
              ? row[channelRefIdx].trim()
              : `${marketplace.slice(0, 2).toUpperCase()}-${Date.now().toString().slice(-4)}${r}`;

          const orderDate =
            dateIdx !== -1 && row[dateIdx]
              ? row[dateIdx].trim()
              : new Date().toISOString().split("T")[0];

          const customerName =
            customerNameIdx !== -1 && row[customerNameIdx]
              ? row[customerNameIdx].trim()
              : "Imported Customer";

          const customerCity = cityIdx !== -1 && row[cityIdx] ? row[cityIdx].trim() : "Mumbai";
          const customerState = stateIdx !== -1 && row[stateIdx] ? row[stateIdx].trim() : "Maharashtra";

          const rawStatus = statusIdx !== -1 ? row[statusIdx].trim().toUpperCase() : "CONFIRMED";
          const validStatuses: OrderStatus[] = [
            "PENDING",
            "CONFIRMED",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "RETURNED",
            "PARTIALLY_RETURNED",
            "RTO",
          ];
          const status: OrderStatus = validStatuses.includes(rawStatus as OrderStatus)
            ? (rawStatus as OrderStatus)
            : "CONFIRMED";

          const snapshotUnitCost = matchedProduct?.currentCostPrice || Math.round(sellingPrice * 0.4);

          // Estimate fees based on platform
          const feePercent = marketplace === "Amazon India" ? 0.15 : marketplace === "Flipkart" ? 0.15 : marketplace === "Myntra" ? 0.2 : 0.02;
          const marketplaceChargesEstimate = Math.round(sellingPrice * quantity * feePercent);

          const item: OrderItem = {
            id: `ITEM-CSV-${Date.now().toString().slice(-4)}-${r}`,
            sku,
            productName,
            quantity,
            sellingPrice,
            discount,
            taxAmount,
            snapshotUnitCost,
            returnedQuantity: 0,
          };

          const order: Order = {
            id: orderId,
            channelOrderId,
            marketplace,
            orderDate,
            status,
            customerName,
            customerCity,
            customerState,
            shippingFeeCharged,
            marketplaceChargesEstimate,
            items: [item],
          };

          ordersList.push(order);
        }

        if (ordersList.length === 0 && errors.length === 0) {
          errors.push("No valid order records could be extracted from the file.");
        }

        setParsedOrders(ordersList);
        setParseErrors(errors);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to parse CSV file.";
        setParseErrors([`CSV Parsing Exception: ${message}`]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setParseErrors(["Failed to read the file."]);
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
    if (parsedOrders.length > 0) {
      onImportOrders(parsedOrders);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Import Orders via CSV
              </h2>
              <p className="text-[11px] text-slate-500">
                Client-side ingestion with catalog SKU matching & financial validation
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
          {/* File Upload Zone */}
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
                Drag and drop your order CSV file here
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports Amazon, Flipkart, Meesho, Myntra, and direct channel report formats
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs transition">
                  Browse File
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSampleCsv();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* Processing Spinner */}
          {isProcessing && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-semibold text-xs text-slate-700">Parsing and cross-matching orders...</p>
            </div>
          )}

          {/* Parsed Results Overview */}
          {file && !isProcessing && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs truncate max-w-xs">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {(file.size / 1024).toFixed(1)} KB • {parsedOrders.length} valid orders
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-slate-200/50 transition"
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    title="Download template"
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/50 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Error Callouts */}
              {parseErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Parsing Warnings / Errors:</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5 max-h-24 overflow-y-auto">
                    {parseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Order Preview Table */}
              {parsedOrders.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Ready to Ingest ({parsedOrders.length} orders)</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Previewing first 5 rows</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2">Platform</th>
                          <th className="px-3 py-2">Order ID</th>
                          <th className="px-3 py-2">SKU & Item</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Gross Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedOrders.slice(0, 5).map((ord, idx) => {
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
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                                {formatINR(total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample Template</span>
          </button>

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
              disabled={parsedOrders.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Import {parsedOrders.length} Valid Orders</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
