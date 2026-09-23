"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Copy,
  Check,
  FileText,
  Clock,
  ExternalLink,
  DollarSign,
  AlertCircle,
  Package,
} from "lucide-react";
import { ReturnRecord, Claim } from "@/domain/types";
import { usePlatform } from "@/domain/store";
import { formatINR, formatDate } from "@/lib/utils";

interface DisputePacketModalProps {
  returnRecord: ReturnRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DisputePacketModal({
  returnRecord,
  isOpen,
  onClose,
}: DisputePacketModalProps) {
  const platform = usePlatform();
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimData, setClaimData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null);

  // When modal opens with a return record, generate the dispute packet
  useEffect(() => {
    if (isOpen && returnRecord) {
      setSubmittedClaimId(null);
      setCopied(false);
      setIsLoading(true);

      // Find matching order item to get locked historical unit cost
      const order = platform.orders.find((o) => o.id === returnRecord.orderId || o.channelOrderId === returnRecord.channelOrderId);
      const orderItem = order?.items.find((i) => i.sku === returnRecord.sku);
      const snapshotUnitCost = orderItem?.snapshotUnitCost || 450; // fallback default if wholesale item

      fetch("/api/ai-dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketplace: returnRecord.marketplace,
          orderId: returnRecord.orderId,
          channelOrderId: returnRecord.channelOrderId,
          sku: returnRecord.sku,
          productName: returnRecord.productName || "Product",
          returnType: returnRecord.returnType,
          condition: returnRecord.condition,
          returnReason: returnRecord.returnReason,
          awbNumber: returnRecord.awbNumber,
          quantity: returnRecord.quantity,
          snapshotUnitCost,
          returnShippingCost: returnRecord.returnShippingCost,
          customerReturnFee: returnRecord.customerReturnFee || 0,
          salvageValue: returnRecord.inventoryRecoveryValue || 0,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setClaimData(data.data);
          }
        })
        .catch((err) => {
          console.error("Dispute generation error:", err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, returnRecord, platform.orders]);

  if (!isOpen || !returnRecord) return null;

  const handleCopyText = async () => {
    if (!claimData?.disputeNarrative) return;
    try {
      await navigator.clipboard.writeText(claimData.disputeNarrative);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCommitToClaimsLedger = () => {
    if (!claimData || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const newClaimId = `CLM-AUTO-${Date.now().toString().slice(-6)}`;
      const newClaim: Claim = {
        id: newClaimId,
        orderId: returnRecord.orderId,
        returnId: returnRecord.id,
        marketplace: returnRecord.marketplace,
        claimType: claimData.claimType,
        claimDate: new Date().toISOString().split("T")[0],
        amountClaimed: claimData.itemization.totalClaimAmount,
        amountRecovered: 0,
        status: "FILED",
        notes: claimData.disputeNarrative,
      };

      // 1. Add claim to ledger
      platform.addClaim(newClaim);

      // 2. Link claimId back to the return record
      platform.updateReturn({
        ...returnRecord,
        claimId: newClaimId,
      });

      setSubmittedClaimId(newClaimId);
    } catch (e) {
      console.error("Failed to commit claim", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAmazon = returnRecord.marketplace.toLowerCase().includes("amazon");
  const isFlipkart = returnRecord.marketplace.toLowerCase().includes("flipkart");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="apple-card rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-black/[0.06] flex items-center justify-between shrink-0 bg-[#FBFBFD]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                {isAmazon
                  ? "Amazon SAFE-T Dispute Packet Generator"
                  : isFlipkart
                  ? "Flipkart SPF Claim Packet Generator"
                  : `${returnRecord.marketplace} Dispute Claim Packet`}
              </h2>
              <p className="text-[11px] text-[#86868B]">
                Order: {returnRecord.channelOrderId} • SKU: {returnRecord.sku}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#6E6E73] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#86868B] space-y-2">
              <div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono">Compiling legal evidence & loss formulas...</p>
            </div>
          ) : claimData ? (
            <>
              {/* Filing Window Alert Pill */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-600/20 text-[#B25E00]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#B25E00] shrink-0" />
                  <span className="font-semibold text-xs">
                    Statutory Filing Window: {claimData.slaDays} Days
                  </span>
                </div>
                {returnRecord.claimDeadline && (
                  <span className="text-[11px] font-mono text-[#B25E00]">
                    Deadline: {formatDate(returnRecord.claimDeadline)}
                  </span>
                )}
              </div>

              {/* Itemized Financial Loss Calculation */}
              <div className="border border-black/[0.06] rounded-2xl p-4 bg-[#FBFBFD] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-black/[0.05]">
                  <span className="text-[11px] font-semibold text-[#1D1D1F]">
                    Deterministic financial loss itemization
                  </span>
                  <span className="text-[11px] text-[#288548] font-medium">P7 Guardrail Verified</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-black/[0.04]">
                    <span className="text-[10px] text-[#86868B] block">Product COGS</span>
                    <span className="font-semibold text-[#1D1D1F] text-sm tabular-nums">
                      {formatINR(claimData.itemization.cogsLoss)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/[0.04]">
                    <span className="text-[10px] text-[#86868B] block">Courier Shipping</span>
                    <span className="font-semibold text-[#1D1D1F] text-sm tabular-nums">
                      {formatINR(claimData.itemization.reverseShippingLoss)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-black/[0.04]">
                    <span className="text-[10px] text-[#86868B] block">Salvage Credit</span>
                    <span className="font-semibold text-[#D70015] text-sm tabular-nums">
                      -{formatINR(claimData.itemization.salvageCredit)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-[#288548] font-semibold block">Total Claim Amount</span>
                    <span className="font-semibold text-[#288548] text-base tabular-nums">
                      {formatINR(claimData.itemization.totalClaimAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Formatted Dispute Narrative */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#1D1D1F]">
                    Formatted Claim Rationale (Paste to Seller Central)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="text-[11px] text-[#0071E3] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#288548]" />
                        <span className="text-[#288548]">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Claim Text</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={claimData.disputeNarrative}
                  className="w-full p-3 bg-[#F5F5F7] rounded-2xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] leading-relaxed focus:outline-none"
                />
              </div>

              {/* Evidence Checklist */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#1D1D1F]">
                  Mandatory Evidence Checklist
                </span>
                <ul className="space-y-1 bg-[#FBFBFD] p-3 rounded-2xl border border-black/[0.04]">
                  {claimData.evidenceChecklist.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-[11px] text-[#6E6E73]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Success Notification if submitted */}
              {submittedClaimId && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-600/20 text-[#288548] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#288548]" />
                    <span className="font-semibold text-xs">
                      Claim recorded successfully into ledger as: {submittedClaimId}
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-[#D70015]">Failed to compile claim packet.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/[0.06] bg-[#FBFBFD] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[#6E6E73] hover:text-[#1D1D1F] font-medium text-xs transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              disabled={!claimData}
              className="px-4 py-2 rounded-xl bg-white border border-black/[0.08] hover:bg-[#F5F5F7] text-[#1D1D1F] font-medium text-xs shadow-apple-sm btn-press transition cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#288548]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Claim Text"}</span>
            </button>

            <button
              type="button"
              onClick={handleCommitToClaimsLedger}
              disabled={!claimData || Boolean(submittedClaimId) || isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black disabled:opacity-50 text-white font-medium text-xs tracking-tight shadow-apple-sm btn-press transition cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {submittedClaimId ? "Recorded in Claims" : isSubmitting ? "Filing..." : "File into Claims Ledger"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
