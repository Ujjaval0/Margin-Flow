"use client";

import React, { useState, useRef, useMemo } from "react";
import { AIStagedDocument } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import {
  FileText,
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Loader2,
  Search,
  Trash2,
  ArrowUpRight,
  CheckCheck,
  Eye,
  Edit3,
  FileCheck,
  Plus,
} from "lucide-react";
import { processDocumentOCR, generateSampleBillText } from "@/domain/ocr-engine";

export function AIStagingView() {
  const {
    aiDocuments,
    addStagedDocument,
    addStagedDocuments,
    updateStagedDocumentField,
    approveStagedDocument,
    batchApproveStagedDocuments,
    rejectStagedDocument,
    deleteStagedDocument,
  } = usePlatform();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "NEEDS_REVIEW" | "DISCREPANCY" | "COMMITTED"
  >("ALL");

  // Selected document state
  const [selectedDocId, setSelectedDocId] = useState<string>(
    aiDocuments[0]?.id || ""
  );

  // Inspector tab: fields editor vs source scan
  const [activeTab, setActiveTab] = useState<"FIELDS" | "RAW_SCAN">("FIELDS");

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<
    "SUPPLIER_BILL" | "INVOICE" | "SETTLEMENT_REPORT"
  >("SUPPLIER_BILL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return aiDocuments.filter((doc) => {
      // Status filter
      if (statusFilter === "NEEDS_REVIEW") {
        if (doc.status !== "STAGED_NEEDS_REVIEW" || !doc.arithmeticValidation.passed) {
          return false;
        }
      } else if (statusFilter === "DISCREPANCY") {
        if (doc.arithmeticValidation.passed || doc.status === "APPROVED_POSTED") {
          return false;
        }
      } else if (statusFilter === "COMMITTED") {
        if (doc.status !== "APPROVED_POSTED") {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.fileName.toLowerCase().includes(q);
        const matchesInv = doc.extractedData.invoiceNumber?.value
          ?.toLowerCase()
          .includes(q);
        const matchesOrder = doc.extractedData.orderId?.value
          ?.toLowerCase()
          .includes(q);
        const matchesVendor = doc.extractedData.vendorName?.value
          ?.toLowerCase()
          .includes(q);
        const matchesSku = doc.extractedData.sku?.value
          ?.toLowerCase()
          .includes(q);
        return Boolean(
          matchesName || matchesInv || matchesOrder || matchesVendor || matchesSku
        );
      }
      return true;
    });
  }, [aiDocuments, statusFilter, searchQuery]);

  // Current active document
  const selectedDoc = useMemo(() => {
    return (
      aiDocuments.find((d) => d.id === selectedDocId) ||
      filteredDocuments[0] ||
      aiDocuments[0]
    );
  }, [aiDocuments, selectedDocId, filteredDocuments]);

  // Stats for badge counters
  const counts = useMemo(() => {
    return {
      all: aiDocuments.length,
      needsReview: aiDocuments.filter(
        (d) => d.status === "STAGED_NEEDS_REVIEW" && d.arithmeticValidation.passed
      ).length,
      discrepancies: aiDocuments.filter(
        (d) => !d.arithmeticValidation.passed && d.status !== "APPROVED_POSTED"
      ).length,
      committed: aiDocuments.filter((d) => d.status === "APPROVED_POSTED").length,
    };
  }, [aiDocuments]);

  // Verified documents ready to batch-approve
  const verifiedPendingIds = useMemo(() => {
    return aiDocuments
      .filter(
        (d) => d.status === "STAGED_NEEDS_REVIEW" && d.arithmeticValidation.passed
      )
      .map((d) => d.id);
  }, [aiDocuments]);

  // Live Field Change Handler
  const handleFieldChange = (
    field: keyof AIStagedDocument["extractedData"],
    value: any
  ) => {
    if (!selectedDoc) return;
    updateStagedDocumentField(selectedDoc.id, field, value);
  };

  // Upload Batch Handler (supports 1 file or up to 50 files)
  const processUploadedFiles = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadError("");
    setUploadStep(`Uploading ${filesToUpload.length} document${filesToUpload.length > 1 ? "s" : ""}...`);

    try {
      const formData = new FormData();
      filesToUpload.forEach((f) => formData.append("files", f));
      formData.append("fileType", selectedFileType);

      const response = await fetch("/api/upload-bill", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Upload error: ${response.statusText}`);
      }

      setUploadStep("Processing extraction & arithmetic check...");
      const data = await response.json();

      if (data.success && Array.isArray(data.stagedDocuments) && data.stagedDocuments.length > 0) {
        addStagedDocuments(data.stagedDocuments);
        setSelectedDocId(data.stagedDocuments[0].id);
        setIsUploading(false);
        setIsUploadModalOpen(false);
        setSelectedFiles([]);
        setUploadStep("");
      } else if (data.success && data.stagedDocument) {
        addStagedDocument(data.stagedDocument);
        setSelectedDocId(data.stagedDocument.id);
        setIsUploading(false);
        setIsUploadModalOpen(false);
        setSelectedFiles([]);
        setUploadStep("");
      } else {
        throw new Error(data.error || "Failed to extract documents.");
      }
    } catch (err: any) {
      console.warn("Server upload fallback triggered:", err);
      setUploadStep("Processing documents...");
      try {
        const parsedDocs: AIStagedDocument[] = [];
        for (const file of filesToUpload) {
          const text = await file.text().catch(() => "");
          const stagedDoc = processDocumentOCR(file.name, text, selectedFileType);
          parsedDocs.push(stagedDoc);
        }

        if (parsedDocs.length > 0) {
          addStagedDocuments(parsedDocs);
          setSelectedDocId(parsedDocs[0].id);
          setIsUploading(false);
          setIsUploadModalOpen(false);
          setSelectedFiles([]);
          setUploadStep("");
        } else {
          throw new Error("No readable documents found.");
        }
      } catch (fallbackErr: any) {
        setIsUploading(false);
        setUploadError(fallbackErr.message || "Failed to parse files.");
      }
    }
  };

  // Add files to selection queue
  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newFiles = Array.from(fileList);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 1-Click Samples
  const handleLoadSample = (type: "SUPPLIER" | "AMAZON" | "FLIPKART") => {
    let fileName = "";
    let sampleContent = "";
    let billType: "SUPPLIER_BILL" | "INVOICE" = "SUPPLIER_BILL";

    if (type === "SUPPLIER") {
      fileName = `Apex_Wholesale_Bill_${Date.now().toString().slice(-4)}.pdf`;
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
      fileName = `Amazon_Invoice_${Date.now().toString().slice(-4)}.pdf`;
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
      fileName = `Flipkart_B2B_Courier_${Date.now().toString().slice(-4)}.pdf`;
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
    processUploadedFiles([mockFile]);
  };

  return (
    <div className="space-y-6 w-full max-w-[1536px] min-w-0 mx-auto animate-in fade-in duration-300">
      {/* ─── Apple Editorial Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-black/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">
              Document verification
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] text-[11px] font-medium border border-black/[0.06]">
              {aiDocuments.length} Documents
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5 font-normal">
            Review auto-extracted bills and invoices, adjust numbers, and post confirmed entries to your books.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {verifiedPendingIds.length > 1 && (
            <button
              onClick={() => batchApproveStagedDocuments(verifiedPendingIds)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#288548]/10 hover:bg-[#288548]/15 text-[#288548] text-xs font-medium rounded-full border border-[#288548]/20 shadow-apple-sm btn-press transition cursor-pointer"
              title="Post all balanced documents at once"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Commit all verified ({verifiedPendingIds.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedFiles([]);
              setUploadError("");
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-full shadow-apple-sm btn-press transition cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload documents</span>
          </button>
        </div>
      </div>

      {/* ─── Apple Segmented Filter Control & Search ─── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Apple Segmented Pills */}
        <div className="bg-[#F5F5F7] p-1 rounded-full border border-black/[0.06] flex items-center gap-0.5 text-xs self-start">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                statusFilter === "ALL" ? "bg-[#F5F5F7] text-[#1D1D1F]" : "bg-white/80 text-[#6E6E73]"
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("NEEDS_REVIEW")}
            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "NEEDS_REVIEW"
                ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
            }`}
          >
            <span>Needs review</span>
            {counts.needsReview > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#B25E00]/10 text-[#B25E00]">
                {counts.needsReview}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter("DISCREPANCY")}
            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "DISCREPANCY"
                ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
            }`}
          >
            <span>Discrepancies</span>
            {counts.discrepancies > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[#D70015]/10 text-[#D70015]">
                {counts.discrepancies}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter("COMMITTED")}
            className={`px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "COMMITTED"
                ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
            }`}
          >
            <span>Committed</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                statusFilter === "COMMITTED"
                  ? "bg-[#F5F5F7] text-[#1D1D1F]"
                  : "bg-white/80 text-[#6E6E73]"
              }`}
            >
              {counts.committed}
            </span>
          </button>
        </div>

        {/* Minimal Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
          <input
            type="text"
            placeholder="Search invoice, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F5F5F7] border border-black/[0.06] rounded-full focus:outline-none focus:bg-white focus:border-[#0071E3] text-[#1D1D1F] placeholder-[#86868B] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── Two-Column Master-Detail Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Document Queue List (4 cols) */}
        <div className="lg:col-span-4 apple-card rounded-2xl border border-black/[0.08] shadow-apple-md flex flex-col max-h-[760px] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-black/[0.06] flex items-center justify-between bg-white">
            <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
              Document queue ({filteredDocuments.length})
            </span>
            <button
              onClick={() => {
                setSelectedFiles([]);
                setIsUploadModalOpen(true);
              }}
              className="text-xs font-medium text-[#0071E3] hover:text-[#0077ED] flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add files</span>
            </button>
          </div>

          <div className="p-2 space-y-1.5 overflow-y-auto flex-1 min-h-[280px]">
            {filteredDocuments.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-[#86868B]">
                <FileText className="w-8 h-8 stroke-[1.2] mb-2 opacity-40" />
                <p className="text-xs font-medium text-[#1D1D1F]">No documents match</p>
                <p className="text-[11px] text-[#86868B] mt-0.5">
                  Try adjusting filters or upload new files.
                </p>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const isSelected = doc.id === selectedDoc?.id;
                const isCommitted = doc.status === "APPROVED_POSTED";
                const isRejected = doc.status === "REJECTED";
                const hasMathError = !doc.arithmeticValidation.passed && !isCommitted;
                const totalDeclared = doc.extractedData.totalAmount?.value || 0;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`group relative p-3 rounded-xl cursor-pointer border transition-all text-left ${
                      isSelected
                        ? "bg-[#0071E3]/5 border-[#0071E3] ring-1 ring-[#0071E3]/20 shadow-apple-sm border-l-[3.5px] border-l-[#0071E3]"
                        : "bg-white hover:bg-[#F5F5F7] border-black/[0.06] hover:border-black/[0.12]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                              isSelected
                                ? "bg-white text-[#0071E3] border border-blue-200/60 shadow-apple-sm"
                                : "bg-[#F5F5F7] text-[#6E6E73]"
                            }`}
                          >
                            {doc.fileType.replace("_", " ")}
                          </span>
                          <span className="text-[11px] truncate font-mono text-[#86868B]">
                            {doc.extractedData.invoiceNumber?.value || "Draft"}
                          </span>
                        </div>

                        <h4 className="text-xs font-semibold truncate mt-1 text-[#1D1D1F]">
                          {doc.fileName}
                        </h4>

                        <div className="text-[11px] truncate mt-0.5 text-[#6E6E73]">
                          {doc.extractedData.vendorName?.value ||
                            doc.extractedData.productName?.value ||
                            "Supplier Bill"}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold tabular-nums text-[#1D1D1F]">
                          {formatINR(totalDeclared)}
                        </div>

                        <div className="mt-1">
                          {isCommitted ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#6E6E73] border border-black/[0.06]">
                              Committed
                            </span>
                          ) : isRejected ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#86868B] border border-black/[0.06]">
                              Rejected
                            </span>
                          ) : hasMathError ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#D70015]/10 text-[#D70015] border border-[#D70015]/20">
                              Math mismatch
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#288548]/10 text-[#288548] border border-[#288548]/20">
                              Ready to commit
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Discard button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStagedDocument(doc.id);
                      }}
                      aria-label="Discard document"
                      className="absolute right-2 top-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition hover:bg-[#D70015]/10 text-[#86868B] hover:text-[#D70015] cursor-pointer"
                      title="Discard document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* Right Column: Selected Document Inspector & Editor (8 cols) */}
        <div className="lg:col-span-8 apple-card rounded-2xl border border-black/[0.08] shadow-apple-md p-6 space-y-6">
          {selectedDoc ? (
            <>
              {/* Document Header & Mode Switch */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                      {selectedDoc.fileType.replace("_", " ")}
                    </span>
                    <span className="text-xs text-[#86868B] font-mono">
                      ID: {selectedDoc.id}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-[#1D1D1F] mt-1 tracking-tight">
                    {selectedDoc.fileName}
                  </h2>
                </div>

                {/* Apple Segmented View Toggle */}
                <div className="bg-[#F5F5F7] p-1 rounded-full border border-black/[0.06] flex items-center gap-0.5 text-xs">
                  <button
                    onClick={() => setActiveTab("FIELDS")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                      activeTab === "FIELDS"
                        ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                        : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#0071E3]" />
                    <span>Extracted fields</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("RAW_SCAN")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                      activeTab === "RAW_SCAN"
                        ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                        : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-[#86868B]" />
                    <span>Document text preview</span>
                  </button>
                </div>
              </div>

              {/* Minimal Arithmetic Banner */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  selectedDoc.arithmeticValidation.passed
                    ? "bg-[#288548]/5 border-[#288548]/20"
                    : "bg-[#D70015]/5 border-[#D70015]/20"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {selectedDoc.arithmeticValidation.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#288548] shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-[#D70015] shrink-0" />
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-[#1D1D1F]">
                        {selectedDoc.arithmeticValidation.passed
                          ? "Calculations match document total"
                          : "Calculation discrepancy detected"}
                      </h4>
                      <p className="text-xs text-[#6E6E73] mt-0.5 font-normal">
                        {selectedDoc.arithmeticValidation.message}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 shadow-apple-sm ${
                      selectedDoc.arithmeticValidation.passed
                        ? "bg-white text-[#288548] border-[#288548]/25"
                        : "bg-white text-[#D70015] border-[#D70015]/25"
                    }`}
                  >
                    {selectedDoc.arithmeticValidation.passed ? "VERIFIED" : "MISMATCH"}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-black/[0.06] flex flex-wrap items-center justify-between text-xs tabular-nums text-[#6E6E73]">
                  <span>Formula: (Qty × Rate) - Discount + Tax</span>
                  <span>
                    Calculated:{" "}
                    <strong className="text-[#1D1D1F]">
                      ₹{selectedDoc.arithmeticValidation.calculatedTotal.toFixed(2)}
                    </strong>{" "}
                    | Declared on bill:{" "}
                    <strong className="text-[#1D1D1F]">
                      ₹{selectedDoc.arithmeticValidation.declaredTotal.toFixed(2)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* View Tab 1: Clean Form Fields */}
              {activeTab === "FIELDS" ? (
                <div className="space-y-5">
                  {/* Group 1: Document Details */}
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block">
                      1. Document &amp; supplier information
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Invoice / bill number
                        </label>
                        <input
                          type="text"
                          value={selectedDoc.extractedData.invoiceNumber?.value || ""}
                          onChange={(e) =>
                            handleFieldChange("invoiceNumber", e.target.value)
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                          placeholder="e.g. INV-2026-001"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Order ID / ref #
                        </label>
                        <input
                          type="text"
                          value={selectedDoc.extractedData.orderId?.value || ""}
                          onChange={(e) =>
                            handleFieldChange("orderId", e.target.value)
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                          placeholder="e.g. ORD-48912"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={selectedDoc.extractedData.orderDate?.value || ""}
                          onChange={(e) =>
                            handleFieldChange("orderDate", e.target.value)
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Vendor / channel name
                        </label>
                        <input
                          type="text"
                          value={
                            selectedDoc.extractedData.vendorName?.value ||
                            selectedDoc.extractedData.marketplace?.value ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange("vendorName", e.target.value)
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                          placeholder="e.g. Apex Electronics Ltd"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Product & Item Line */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block">
                      2. Item &amp; line item breakdown
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Master SKU
                        </label>
                        <input
                          type="text"
                          value={selectedDoc.extractedData.sku?.value || ""}
                          onChange={(e) => handleFieldChange("sku", e.target.value)}
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                          placeholder="e.g. ELEC-WEM-01"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Item description
                        </label>
                        <input
                          type="text"
                          value={selectedDoc.extractedData.productName?.value || ""}
                          onChange={(e) =>
                            handleFieldChange("productName", e.target.value)
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                          placeholder="Product title"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={selectedDoc.extractedData.quantity?.value || 1}
                          onChange={(e) =>
                            handleFieldChange("quantity", Number(e.target.value))
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Unit rate (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedDoc.extractedData.unitPrice?.value || 0}
                          onChange={(e) =>
                            handleFieldChange("unitPrice", Number(e.target.value))
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group 3: Financials & Totals */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block">
                      3. Financial totals &amp; taxes
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Discount (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedDoc.extractedData.discount?.value || 0}
                          onChange={(e) =>
                            handleFieldChange("discount", Number(e.target.value))
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                        />
                      </div>

                      <div>
                        <label className="font-medium text-[#1D1D1F] block mb-1">
                          Taxes / GST (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedDoc.extractedData.taxAmount?.value || 0}
                          onChange={(e) =>
                            handleFieldChange("taxAmount", Number(e.target.value))
                          }
                          className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs font-semibold tabular-nums focus:bg-white focus:outline-none focus:border-[#0071E3] transition text-[#1D1D1F]"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-[#1D1D1F] block mb-1">
                          Declared total (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedDoc.extractedData.totalAmount?.value || 0}
                          onChange={(e) =>
                            handleFieldChange("totalAmount", Number(e.target.value))
                          }
                          className={`w-full p-2.5 rounded-xl text-xs font-bold tabular-nums focus:outline-none transition ${
                            selectedDoc.arithmeticValidation.passed
                              ? "bg-[#F5F5F7] border border-black/[0.06] text-[#1D1D1F] focus:bg-white focus:border-[#0071E3]"
                              : "bg-[#D70015]/5 border border-[#D70015]/25 text-[#D70015] focus:bg-white focus:border-[#D70015]"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* View Tab 2: Document Text Scan */
                <div className="space-y-2">
                  <span className="text-xs text-[#86868B]">
                    Source text captured during document scan:
                  </span>
                  <div className="bg-[#F5F5F7] text-[#1D1D1F] font-mono text-xs p-4 rounded-xl border border-black/[0.06] whitespace-pre-wrap select-text leading-relaxed max-h-[360px] overflow-y-auto">
                    {selectedDoc.rawTextPreview || "No text available for this document."}
                  </div>
                </div>
              )}

              {/* Action Footer */}
              <div className="pt-4 border-t border-black/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteStagedDocument(selectedDoc.id)}
                    className="px-3.5 py-1.5 text-xs text-[#86868B] hover:text-[#D70015] hover:bg-[#D70015]/10 rounded-full transition flex items-center gap-1.5 cursor-pointer btn-press"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </button>

                  {selectedDoc.status !== "APPROVED_POSTED" && (
                    <button
                      onClick={() => rejectStagedDocument(selectedDoc.id)}
                      className="px-3.5 py-1.5 text-xs text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-full transition border border-black/[0.06] cursor-pointer btn-press"
                    >
                      Mark rejected
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedDoc.status === "APPROVED_POSTED" ? (
                    <span className="text-xs font-semibold text-[#288548] bg-[#288548]/10 border border-[#288548]/20 px-4 py-1.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Committed to books</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => approveStagedDocument(selectedDoc.id)}
                      disabled={!selectedDoc.arithmeticValidation.passed}
                      className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-35 disabled:cursor-not-allowed text-white rounded-full text-xs font-medium shadow-apple-sm transition flex items-center gap-1.5 active:scale-[0.98] btn-press cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Commit to books</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-[#86868B]">
              <FileText className="w-10 h-10 stroke-[1.2] mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-[#1D1D1F]">No document selected</p>
              <p className="text-xs text-[#86868B] mt-0.5">
                Select a document from the queue or upload a new file.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── UPLOAD MODAL (Apple Minimalism) ─── */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !isUploading && setIsUploadModalOpen(false)}
        >
          <div
            className="apple-card w-full max-w-xl rounded-3xl shadow-apple-lg border border-black/[0.08] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Upload bills &amp; invoices
                </h3>
                <p className="text-xs text-[#6E6E73] mt-0.5 font-normal">
                  Select single or multiple files (up to 50 documents per batch).
                </p>
              </div>
              <button
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                disabled={isUploading}
                aria-label="Close upload dialog"
                className="w-7 h-7 rounded-full bg-[#F5F5F7] hover:bg-neutral-200 flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Document Category Pills */}
            <div>
              <label className="text-xs font-medium text-[#1D1D1F] block mb-1.5">
                Document category:
              </label>
              <div className="bg-[#F5F5F7] p-1 rounded-full border border-black/[0.06] flex items-center gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedFileType("SUPPLIER_BILL")}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs transition-all cursor-pointer ${
                    selectedFileType === "SUPPLIER_BILL"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                      : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                  }`}
                >
                  Supplier bill
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFileType("INVOICE")}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs transition-all cursor-pointer ${
                    selectedFileType === "INVOICE"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                      : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                  }`}
                >
                  Customer invoice
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFileType("SETTLEMENT_REPORT")}
                  className={`flex-1 py-1.5 px-3 rounded-full text-xs transition-all cursor-pointer ${
                    selectedFileType === "SETTLEMENT_REPORT"
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                      : "text-[#6E6E73] hover:text-[#1D1D1F] font-medium"
                  }`}
                >
                  Settlement
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleFilesAdded(e.dataTransfer.files);
                }
              }}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-[#0071E3] bg-[#0071E3]/5 scale-[0.99]"
                  : "border-black/[0.12] hover:border-black/[0.25] bg-[#F5F5F7]/40 hover:bg-[#F5F5F7]/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                onChange={(e) => handleFilesAdded(e.target.files)}
                className="hidden"
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center py-3 animate-in fade-in">
                  <Loader2 className="w-8 h-8 text-[#0071E3] animate-spin mb-2" />
                  <span className="text-xs font-semibold text-[#1D1D1F]">{uploadStep}</span>
                  <span className="text-[11px] text-[#86868B] mt-0.5">
                    Extracting structured records...
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-2">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-[#1D1D1F]">
                    Click to browse or drop files here
                  </span>
                  <span className="text-[11px] text-[#86868B] mt-0.5">
                    Single or multiple files (PDF, PNG, JPG, CSV — up to 50 documents)
                  </span>
                </>
              )}
            </div>

            {/* Selected Files Queue Preview */}
            {selectedFiles.length > 0 && !isUploading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-[#1D1D1F]">
                  <span>Selected files ({selectedFiles.length})</span>
                  <button
                    onClick={() => setSelectedFiles([])}
                    className="text-[#D70015] hover:underline text-[11px] cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-[#F5F5F7] rounded-2xl border border-black/[0.06]">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white rounded-xl border border-black/[0.06] shadow-apple-sm text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                        <span className="truncate font-medium text-[#1D1D1F]">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-[#86868B] shrink-0 tabular-nums">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button
                        onClick={() => removeSelectedFile(idx)}
                        aria-label="Remove file"
                        className="text-[#86868B] hover:text-[#D70015] p-1 rounded-md transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-2xl bg-[#D70015]/5 border border-[#D70015]/20 text-[#D70015] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="px-4 py-2 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-full transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedFiles.length === 0 || isUploading}
                onClick={() => processUploadedFiles(selectedFiles)}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-35 disabled:cursor-not-allowed text-white text-xs font-medium rounded-full shadow-apple-sm transition flex items-center gap-1.5 active:scale-[0.98] btn-press cursor-pointer"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>
                  {selectedFiles.length > 1
                    ? `Upload & process ${selectedFiles.length} documents`
                    : "Upload & process"}
                </span>
              </button>
            </div>

            {/* 1-Click Samples */}
            <div className="pt-2 border-t border-black/[0.06]">
              <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block mb-1.5">
                Quick sample bills:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleLoadSample("SUPPLIER")}
                  className="p-3 rounded-2xl border border-black/[0.06] hover:border-[#0071E3]/40 bg-white hover:bg-[#0071E3]/5 text-left transition shadow-apple-sm btn-press disabled:opacity-50 cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-[#1D1D1F] flex items-center justify-between">
                    <span>Wholesale bill</span>
                    <ArrowUpRight className="w-3 h-3 text-[#86868B]" />
                  </div>
                  <div className="text-[10px] text-[#6E6E73] mt-0.5 tabular-nums">Apex Electronics (₹21,830)</div>
                </button>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleLoadSample("AMAZON")}
                  className="p-3 rounded-2xl border border-black/[0.06] hover:border-[#0071E3]/40 bg-white hover:bg-[#0071E3]/5 text-left transition shadow-apple-sm btn-press disabled:opacity-50 cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-[#1D1D1F] flex items-center justify-between">
                    <span>Amazon invoice</span>
                    <ArrowUpRight className="w-3 h-3 text-[#86868B]" />
                  </div>
                  <div className="text-[10px] text-[#6E6E73] mt-0.5 tabular-nums">Polo Shirt (₹2,003.64)</div>
                </button>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleLoadSample("FLIPKART")}
                  className="p-3 rounded-2xl border border-black/[0.06] hover:border-[#0071E3]/40 bg-white hover:bg-[#0071E3]/5 text-left transition shadow-apple-sm btn-press disabled:opacity-50 cursor-pointer"
                >
                  <div className="text-[11px] font-medium text-[#1D1D1F] flex items-center justify-between">
                    <span>Flipkart courier</span>
                    <ArrowUpRight className="w-3 h-3 text-[#86868B]" />
                  </div>
                  <div className="text-[10px] text-[#6E6E73] mt-0.5 tabular-nums">LED Lamp (₹10,384)</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
