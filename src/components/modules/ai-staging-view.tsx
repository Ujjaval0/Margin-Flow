"use client";

import React, { useState, useRef } from "react";
import {
  AIStagedDocument,
} from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import {
  FileText,
  Check,
  X,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Loader2,
  FolderCheck,
  FilePlus2,
  CheckCircle,
  ArrowUpRight,
  Upload,
} from "lucide-react";
import { processDocumentOCR, generateSampleBillText } from "@/domain/ocr-engine";

export function AIStagingView() {
  const {
    aiDocuments,
    addStagedDocument,
    updateStagedDocumentField,
    approveStagedDocument,
    rejectStagedDocument,
  } = usePlatform();

  const [selectedDocId, setSelectedDocId] = useState<string>(aiDocuments[0]?.id || "");
  const selectedDoc = aiDocuments.find((d) => d.id === selectedDocId) || aiDocuments[0];

  // Upload Modal & OCR Processing State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<"SUPPLIER_BILL" | "INVOICE" | "SETTLEMENT_REPORT">("SUPPLIER_BILL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFieldChange = (
    field: keyof AIStagedDocument["extractedData"],
    value: any
  ) => {
    if (!selectedDoc) return;
    updateStagedDocumentField(selectedDoc.id, field, value);
  };

  // Upload and OCR Ingestion Handler
  const uploadBillFile = async (file: File) => {
    setIsUploading(true);
    setUploadError("");
    setUploadStep("Storing file to public/uploads/bills/ ...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", selectedFileType);

      const response = await fetch("/api/upload-bill", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload server error: ${response.statusText}`);
      }

      setUploadStep("Running Vision OCR & Entity Extraction ...");
      const data = await response.json();

      if (data.success && data.stagedDocument) {
        setUploadStep("Validating GST & arithmetic invariants ...");
        setTimeout(() => {
          addStagedDocument(data.stagedDocument);
          setSelectedDocId(data.stagedDocument.id);
          setIsUploading(false);
          setIsUploadModalOpen(false);
          setUploadStep("");
        }, 500);
      } else {
        throw new Error(data.error || "OCR extraction failed");
      }
    } catch (err: any) {
      console.warn("API route upload error, using direct client-side OCR fallback:", err);
      // Client-side fallback to guarantee flawless offline execution
      setUploadStep("Extracting text via client-side OCR engine ...");
      try {
        const text = await file.text();
        const stagedDoc = processDocumentOCR(file.name, text, selectedFileType);
        addStagedDocument(stagedDoc);
        setSelectedDocId(stagedDoc.id);
        setIsUploading(false);
        setIsUploadModalOpen(false);
        setUploadStep("");
      } catch (clientErr: any) {
        setIsUploading(false);
        setUploadError(clientErr.message || "Failed to process bill.");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadBillFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadBillFile(e.dataTransfer.files[0]);
    }
  };

  // Load predefined realistic sample bills for 1-click testing
  const handleLoadSample = (type: "SUPPLIER" | "AMAZON" | "FLIPKART") => {
    let fileName = "";
    let sampleContent = "";
    let billType: "SUPPLIER_BILL" | "INVOICE" = "SUPPLIER_BILL";

    if (type === "SUPPLIER") {
      fileName = `Apex_Electronics_Wholesale_Bill_${Date.now().toString().slice(-4)}.pdf`;
      billType = "SUPPLIER_BILL";
      sampleContent = generateSampleBillText(
        fileName,
        `APX-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        new Date().toISOString().split("T")[0],
        "Apex Electronics Components Pvt Ltd",
        "ELEC-WEM-01",
        "Wireless Ergonomic Mouse (Batch 42)",
        50,
        380,
        500,
        3330,
        21830
      );
    } else if (type === "AMAZON") {
      fileName = `Amazon_Tax_Invoice_ORD_${Date.now().toString().slice(-4)}.pdf`;
      billType = "INVOICE";
      sampleContent = generateSampleBillText(
        fileName,
        `AMZ-IND-${Math.floor(100000 + Math.random() * 900000)}`,
        new Date().toISOString().split("T")[0],
        "Amazon Seller Services India Pvt Ltd",
        "APP-POLO-M",
        "Men Dry-Fit Polo T-Shirt",
        2,
        899,
        100,
        305.64,
        2003.64
      );
    } else {
      fileName = `Flipkart_B2B_Courier_Bill_${Date.now().toString().slice(-4)}.pdf`;
      billType = "SUPPLIER_BILL";
      sampleContent = generateSampleBillText(
        fileName,
        `FK-B2B-${Math.floor(10000 + Math.random() * 90000)}`,
        new Date().toISOString().split("T")[0],
        "Instakart Logistics Private Limited",
        "HOME-LED-10W",
        "Smart LED Ambient Lamp (10W)",
        20,
        450,
        200,
        1584,
        10384
      );
    }

    const mockFile = new File([sampleContent], fileName, { type: "application/pdf" });
    uploadBillFile(mockFile);
  };

  const getConfidenceBadge = (confidence?: number, isAnomaly?: boolean) => {
    if (confidence === undefined) return null;
    const pct = (confidence * 100).toFixed(0);

    if (isAnomaly || confidence < 0.75) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          {pct}% (Anomaly)
        </span>
      );
    }
    if (confidence < 0.9) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          {pct}% conf
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        {pct}% verified
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              AI Document Extraction &amp; HITL Sandbox
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-600" />
              Partition 7 Guardrails Active
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Zero-hallucination architecture: Uploaded bills are saved to the directory, extracted via OCR, and quarantined for arithmetic verification.
          </p>
        </div>

        {/* Upload Bill / Invoice Action Button */}
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-sm transition active:scale-[0.98]"
        >
          <UploadCloud className="w-4 h-4 text-purple-300" />
          <span>Upload Bill / Invoice</span>
        </button>
      </div>

      {/* Document Queue Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {aiDocuments.map((doc) => {
          const isSelected = doc.id === selectedDoc?.id;
          const isReviewed = doc.status === "APPROVED_POSTED";
          const hasMathError = !doc.arithmeticValidation.passed;

          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDocId(doc.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap border shadow-xs ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${isSelected ? "text-purple-300" : "text-slate-400"}`} />
              <span>{doc.fileName}</span>
              {hasMathError && !isReviewed && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  Math Discrepancy
                </span>
              )}
              {isReviewed && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  Committed
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDoc ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Clean Paper Document Preview */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Source Document Scan
                  </span>
                  <h3 className="text-xs font-bold text-slate-900">{selectedDoc.fileName}</h3>
                </div>
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                  {selectedDoc.fileType}
                </span>
              </div>

              <div className="bg-slate-50 text-slate-800 font-mono text-xs p-5 rounded-2xl border border-slate-200 leading-relaxed min-h-[360px] whitespace-pre-wrap select-text shadow-xs">
                {selectedDoc.rawTextPreview}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Vision Multimodal Ingestion</span>
              <span className="font-semibold text-slate-700">{selectedDoc.status}</span>
            </div>
          </div>

          {/* RIGHT: Extracted Fields & Arithmetic Guardrail */}
          <div className="lg:col-span-7 space-y-4">
            {/* Guardrail Status Card with clear colors */}
            <div
              className={`p-5 rounded-3xl border transition-all ${
                selectedDoc.arithmeticValidation.passed
                  ? "bg-emerald-50/70 border-emerald-300 shadow-sm"
                  : "bg-rose-50/70 border-rose-300 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  {selectedDoc.arithmeticValidation.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {selectedDoc.arithmeticValidation.passed
                        ? "Deterministic Math Invariant Verified"
                        : "Mathematical Discrepancy Quarantined"}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {selectedDoc.arithmeticValidation.message}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    selectedDoc.arithmeticValidation.passed
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-rose-100 text-rose-800 border-rose-300"
                  }`}
                >
                  {selectedDoc.arithmeticValidation.passed ? "PASSED" : "BLOCKED"}
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between text-xs tabular-nums">
                <span className="text-slate-600 font-medium">Qty × Price - Discount + Tax = Total</span>
                <span className="font-semibold text-slate-800">
                  Calc: <strong className="text-[#1D1D1F]">₹{selectedDoc.arithmeticValidation.calculatedTotal.toFixed(2)}</strong> | Decl: <strong className="text-[#1D1D1F]">₹{selectedDoc.arithmeticValidation.declaredTotal.toFixed(2)}</strong>
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Extracted Fields & Provenance
                </h3>
                <span className="text-[11px] text-slate-400">
                  Edit values below to re-evaluate mathematical invariants live
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">Order ID</label>
                    {getConfidenceBadge(selectedDoc.extractedData.orderId?.confidence)}
                  </div>
                  <input
                    type="text"
                    value={selectedDoc.extractedData.orderId?.value || ""}
                    onChange={(e) => handleFieldChange("orderId", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">Invoice Number</label>
                    {getConfidenceBadge(selectedDoc.extractedData.invoiceNumber?.confidence)}
                  </div>
                  <input
                    type="text"
                    value={selectedDoc.extractedData.invoiceNumber?.value || ""}
                    onChange={(e) => handleFieldChange("invoiceNumber", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">Master SKU</label>
                    {getConfidenceBadge(selectedDoc.extractedData.sku?.confidence)}
                  </div>
                  <input
                    type="text"
                    value={selectedDoc.extractedData.sku?.value || ""}
                    onChange={(e) => handleFieldChange("sku", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">Product Name</label>
                    {getConfidenceBadge(selectedDoc.extractedData.productName?.confidence)}
                  </div>
                  <input
                    type="text"
                    value={selectedDoc.extractedData.productName?.value || ""}
                    onChange={(e) => handleFieldChange("productName", e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">Quantity</label>
                    {getConfidenceBadge(selectedDoc.extractedData.quantity?.confidence)}
                  </div>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.quantity?.value || 1}
                    onChange={(e) => handleFieldChange("quantity", Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">Unit Rate (₹)</label>
                    {getConfidenceBadge(selectedDoc.extractedData.unitPrice?.confidence)}
                  </div>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.unitPrice?.value || 0}
                    onChange={(e) => handleFieldChange("unitPrice", Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.discount?.value || 0}
                    onChange={(e) => handleFieldChange("discount", Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Taxes / GST (₹)</label>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.taxAmount?.value || 0}
                    onChange={(e) => handleFieldChange("taxAmount", Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold tabular-nums text-[#1D1D1F] focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex justify-between mb-1 items-center">
                    <label className="font-semibold text-slate-700">
                      Grand Total Declared on Document (₹)
                    </label>
                    {getConfidenceBadge(
                      selectedDoc.extractedData.totalAmount?.confidence,
                      selectedDoc.extractedData.totalAmount?.isFlaggedAnomaly
                    )}
                  </div>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.totalAmount?.value || 0}
                    onChange={(e) => handleFieldChange("totalAmount", Number(e.target.value))}
                    className={`w-full p-2.5 rounded-xl text-xs font-semibold tabular-nums focus:outline-none ${
                      selectedDoc.arithmeticValidation.passed
                        ? "bg-slate-50 border border-slate-200 text-[#1D1D1F]"
                        : "bg-rose-50 border border-rose-300 text-[#D70015]"
                    }`}
                  />
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Verified extractions post to the immutable financial ledger.</span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDoc.status !== "APPROVED_POSTED" ? (
                    <>
                      <button
                        onClick={() => rejectStagedDocument(selectedDoc.id)}
                        className="px-4 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        Reject Document
                      </button>
                      <button
                        onClick={() => approveStagedDocument(selectedDoc.id)}
                        disabled={!selectedDoc.arithmeticValidation.passed}
                        className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Commit to Ledger</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Committed to Production
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── MODAL: Upload Bill & OCR Extraction ─── */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 drawer-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !isUploading && setIsUploadModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    Directory Ingestion &amp; OCR
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Upload Bill / Invoice Document
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uploaded files are stored to <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">public/uploads/bills/</code> and processed through the OCR extraction engine.
                </p>
              </div>
              <button
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Category Selector (Image 2 Pill Control) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">
                Document Category:
              </label>
              <div className="bg-[#F1F3F5] p-1 rounded-full border border-slate-200/50 flex items-center gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedFileType("SUPPLIER_BILL")}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all text-center ${
                    selectedFileType === "SUPPLIER_BILL"
                      ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  Supplier Bill
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFileType("INVOICE")}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all text-center ${
                    selectedFileType === "INVOICE"
                      ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFileType("SETTLEMENT_REPORT")}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all text-center ${
                    selectedFileType === "SETTLEMENT_REPORT"
                      ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                      : "text-slate-600 hover:text-slate-900 font-medium"
                  }`}
                >
                  Settlement
                </button>
              </div>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-purple-500 bg-purple-50/50 scale-[0.99]"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center py-2 animate-in fade-in">
                  <Loader2 className="w-9 h-9 text-purple-600 animate-spin mb-3" />
                  <span className="text-xs font-bold text-slate-800">{uploadStep}</span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    AI OCR Extraction &amp; Arithmetic Invariant Verification in progress...
                  </span>
                  <div className="w-48 h-1.5 bg-slate-200 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-purple-600 animate-pulse w-3/4 rounded-full" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 shadow-xs">
                    <UploadCloud className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    Click to browse or drag &amp; drop your bill here
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 max-w-sm">
                    Supports PDF, PNG, JPG, or Text Invoice documents (up to 15MB). Automatically parsed into structured fields.
                  </span>
                </>
              )}
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Quick 1-Click Demo Samples */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Or test immediately with 1-click sample bills:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleLoadSample("SUPPLIER")}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition disabled:opacity-50 shadow-2xs group"
                >
                  <div className="text-[11px] font-bold text-slate-800 group-hover:text-purple-700 flex items-center justify-between">
                    <span>Wholesale Bill</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-purple-600" />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Apex Electronics (₹21,830)
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleLoadSample("AMAZON")}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition disabled:opacity-50 shadow-2xs group"
                >
                  <div className="text-[11px] font-bold text-slate-800 group-hover:text-blue-700 flex items-center justify-between">
                    <span>Amazon Invoice</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Order Tax Invoice (₹2,003.64)
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleLoadSample("FLIPKART")}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition disabled:opacity-50 shadow-2xs group"
                >
                  <div className="text-[11px] font-bold text-slate-800 group-hover:text-emerald-700 flex items-center justify-between">
                    <span>Flipkart Courier</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    LED Ambient Lamp (₹10,384)
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
