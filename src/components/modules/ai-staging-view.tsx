"use client";

import React, { useState } from "react";
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
} from "lucide-react";

export function AIStagingView() {
  const {
    aiDocuments,
    updateStagedDocumentField,
    approveStagedDocument,
    rejectStagedDocument,
  } = usePlatform();

  const [selectedDocId, setSelectedDocId] = useState<string>(aiDocuments[0]?.id || "");
  const selectedDoc = aiDocuments.find((d) => d.id === selectedDocId) || aiDocuments[0];

  const handleFieldChange = (
    field: keyof AIStagedDocument["extractedData"],
    value: any
  ) => {
    if (!selectedDoc) return;
    updateStagedDocumentField(selectedDoc.id, field, value);
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
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              AI Document Extraction & HITL Sandbox
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-600" />
              Partition 7 Guardrails Active
            </span>
          </div>
          <p className="text-xs text-[#6E6E73] mt-0.5">
            Zero-hallucination architecture: Extracted data is quarantined in this staging sandbox until arithmetic invariants verify and a human confirms.
          </p>
        </div>
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

              <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-5 rounded-2xl border border-slate-800 leading-relaxed min-h-[360px] whitespace-pre-wrap select-text shadow-inner">
                {selectedDoc.rawTextPreview}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Vision Multimodal Ingestion</span>
              <span className="font-mono font-semibold text-slate-700">{selectedDoc.status}</span>
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

              <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 font-medium">Qty × Price - Discount + Tax = Total</span>
                <span className="font-bold text-slate-800">
                  Calc: ₹{selectedDoc.arithmeticValidation.calculatedTotal.toFixed(2)} | Decl: ₹
                  {selectedDoc.arithmeticValidation.declaredTotal.toFixed(2)}
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none"
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.discount?.value || 0}
                    onChange={(e) => handleFieldChange("discount", Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Taxes / GST (₹)</label>
                  <input
                    type="number"
                    value={selectedDoc.extractedData.taxAmount?.value || 0}
                    onChange={(e) => handleFieldChange("taxAmount", Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none"
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
                    className={`w-full p-2.5 rounded-xl font-mono text-xs font-bold focus:outline-none ${
                      selectedDoc.arithmeticValidation.passed
                        ? "bg-slate-50 border border-slate-200 text-slate-900"
                        : "bg-rose-50 border border-rose-300 text-rose-700"
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
    </div>
  );
}
