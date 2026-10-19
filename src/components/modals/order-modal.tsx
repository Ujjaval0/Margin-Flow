"use client";

import { businessDate } from "@/domain/report-scope";

import { createRecordId } from "@/domain/record-id";
import { getManualReturnCosts } from "@/domain/order-financials";

import { NumericInput } from "@/components/ui/numeric-input";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  Order,
  Marketplace,
  ReturnType,
  ReturnRecord,
  Claim,
  Product,
  Supplier,
} from "@/domain/types";
import { formatINR } from "@/lib/utils";
import { FormMarketplaceDropdown } from "@/components/ui/marketplace-dropdown";
import { buildFeeOrderLineInputs, calculateMarketplaceFeeEstimate, decimalRupeesToPaise, type FeeEstimateResult, type FeeOrderLineInput, type MarketplaceFeeRule } from "@/domain/marketplace-fees";
import { MarketplaceFeeRulesModal } from "@/components/modals/marketplace-fee-rules-modal";

const formatQuickRate = (rateBps: number) => `${(rateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

export interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "create" | "edit";
  initialOrder?: Order | null;
  defaultMarketplace?: Marketplace | "ALL";
  products: Product[];
  suppliers: Supplier[];
  onAddOrder?: (order: Order) => Promise<Order>;
  onUpdateOrder?: (order: Order) => Promise<Order>;
  onAddReturn?: (ret: ReturnRecord) => Promise<void>;
  onAddClaim?: (claim: Claim) => Promise<void>;
}

export function OrderModal({
  isOpen,
  onClose,
  mode = "create",
  initialOrder = null,
  defaultMarketplace = "ALL",
  products,
  suppliers,
  onAddOrder,
  onUpdateOrder,
  onAddReturn,
  onAddClaim,
}: OrderModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isFeeRulesOpen, setIsFeeRulesOpen] = useState(false);
  const feeRulesOpenRef = useRef(false);
  feeRulesOpenRef.current = isFeeRulesOpen;

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (feeRulesOpenRef.current) setIsFeeRulesOpen(false);
        else onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      setMounted(false);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);
  useEffect(() => { if (!isOpen) setIsFeeRulesOpen(false); }, [isOpen]);
  // Determine starting marketplace
  const startingMarketplace: Marketplace =
    initialOrder?.marketplace ||
    (defaultMarketplace !== "ALL" ? defaultMarketplace : "Amazon India");

  // Form State
  const [marketplace, setMarketplace] = useState<Marketplace>(startingMarketplace);
  const [orderId, setOrderId] = useState("");
  const [channelOrderId, setChannelOrderId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [sku, setSku] = useState("");
  const [mfn, setMfn] = useState("");
  const [mfn1, setMfn1] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [supplierName, setSupplierName] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [priceBasis, setPriceBasis] = useState("");
  const [recognitionDate, setRecognitionDate] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [fulfilmentMode, setFulfilmentMode] = useState("");
  const [accountingPolicies, setAccountingPolicies] = useState<{ marketplace: string; effective_from: string; effective_to?: string; prices_include_tax?: boolean; marketplace_fee_gst_rate_bps?: number; gst_registration_type?: string }[]>([]);
  const [feeRules, setFeeRules] = useState<MarketplaceFeeRule[]>([]);
  const [savedQuickRates, setSavedQuickRates] = useState<number[]>([]);
  const [quickRateSelection, setQuickRateSelection] = useState("");
  const [customQuickRate, setCustomQuickRate] = useState("");
  const [quickRateSaveError, setQuickRateSaveError] = useState("");
  const [savingQuickRate, setSavingQuickRate] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  // Return / RTO Sub-Form (mainly for create mode)
  const saveInFlight = useRef(false);
  const draftIds = useRef({ order: "", line: "", returned: "", claim: "" });
  const openIdentity = useRef("");
  const savedDraftOrder = useRef<Order | null>(null);
  const savedDraftReturn = useRef<ReturnRecord | null>(null);
  const savedDraftFingerprint = useRef("");
  const pendingReturnRequested = useRef(false);
  const [returnDate, setReturnDate] = useState("");
  const [isReturned, setIsReturned] = useState(false);
  const [returnType, setReturnType] = useState<ReturnType>("CUSTOMER_RETURN");
  const [returnFee, setReturnFee] = useState("0");
  const [returnReason, setReturnReason] = useState("");
  const [isDamagedClaim, setIsDamagedClaim] = useState(false);
  const [claimAmount, setClaimAmount] = useState("0");
  const [claimStatus, setClaimStatus] = useState<"Draft" | "Filed" | "Approved" | "Rejected">("Draft");
  const [approvedReimbursement, setApprovedReimbursement] = useState("0");

  // Sync state on open or change of initialOrder
  useEffect(() => {
    if (!isOpen) { openIdentity.current = ""; return; }
    const identity = mode + ":" + (initialOrder?.id || "new");
    if (openIdentity.current === identity) return;
    openIdentity.current = identity;
    draftIds.current = { order: createRecordId("ORD"), line: createRecordId("ITEM"), returned: createRecordId("RET"), claim: createRecordId("CLM") };
    savedDraftOrder.current = null; savedDraftReturn.current = null; savedDraftFingerprint.current = ""; pendingReturnRequested.current = false;
    setReturnDate("");
    setSaveError("");

    if (mode === "edit" && initialOrder) {
      setMarketplace(initialOrder.marketplace);
      setOrderId(initialOrder.id);
      setChannelOrderId(initialOrder.channelOrderId || "");
      setOrderDate(initialOrder.orderDate);
      const firstItem = initialOrder.items[0];
      setSku(firstItem?.sku || "");
      setMfn(firstItem?.mfn || "");
      setMfn1(firstItem?.mfn1 || "");
      setProductName(firstItem?.productName || "");
      setQuantity(String(firstItem?.quantity || 1));
      setUnitCost(String(firstItem?.snapshotUnitCost || 0));
      const sPrice = firstItem?.sellingPrice || 0;
      const sQty = firstItem?.quantity || 1;
      setSellingPrice(String(sPrice));
      setTaxAmount(initialOrder.taxEvidenceStatus === "RECORDED" || initialOrder.items.length > 1 ? String(firstItem?.taxAmount ?? 0) : "");
      setPriceBasis(initialOrder.pricesIncludeTax === undefined ? "" : initialOrder.pricesIncludeTax ? "INCLUSIVE" : "EXCLUSIVE");
      setRecognitionDate(initialOrder.revenueRecognisedDate || "");
      const isReturnedOrder = initialOrder.status === "CUSTOMER_RETURN" || initialOrder.status === "RETURNED" || initialOrder.status === "RTO";
      setSettlementAmount(initialOrder.settlementAmount === undefined || isReturnedOrder ? "" : String(initialOrder.settlementAmount));
      setFulfilmentMode(initialOrder.fulfilmentMode || "");
      const quickRateBps = initialOrder.quickFeeRateBps;
      setQuickRateSelection(quickRateBps == null ? "" : "CUSTOM");
      setCustomQuickRate(quickRateBps == null ? "" : (quickRateBps / 100).toFixed(2));
      setSupplierName(initialOrder.supplierName || "");
      setNotes(initialOrder.notes || "");
      setIsReturned(initialOrder.status === "RETURNED" || initialOrder.status === "RTO" || initialOrder.status === "CUSTOMER_RETURN" || initialOrder.status === "DAMAGED_RETURN");
    } else {
      // Create mode defaults
      setOrderId("");
      setChannelOrderId("");
      setOrderDate(businessDate());
      const initialProd = products[0];
      setSku(initialProd?.sku || "");
      setMfn(initialProd?.mfn || "");
      setMfn1(initialProd?.mfn1 || "");
      setProductName(initialProd?.name || "");
      setQuantity("1");
      setUnitCost(initialProd ? String(initialProd.currentCostPrice) : "");
      setSellingPrice("");
      setTaxAmount("");
      setPriceBasis("");
      setRecognitionDate("");
      setSettlementAmount("");
      setFulfilmentMode("");
      setQuickRateSelection("");
      setCustomQuickRate("");
      setQuickRateSaveError("");
      const initialSup = suppliers.find((s) => s.id === initialProd?.supplierId || s.name === initialProd?.supplierId);
      setSupplierName(initialSup ? initialSup.name : (suppliers[0]?.name || ""));
      setNotes("");
      setIsReturned(false);
      setReturnType("CUSTOMER_RETURN");
      setReturnFee("0");
      setReturnReason("");
      setIsDamagedClaim(false);
      setClaimAmount("0");
      setClaimStatus("Draft");
      setApprovedReimbursement("0");
    }
  }, [isOpen, mode, initialOrder]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch("/api/marketplace-fee-rules", { credentials: "same-origin", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (active && Array.isArray(result?.rules)) { setFeeRules(result.rules); setAccountingPolicies(result.accountingPolicies || []); } })
      .catch(() => { if (active) setFeeRules([]); });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch(`/api/marketplace-quick-rates?marketplace=${encodeURIComponent(marketplace)}`, { credentials: "same-origin", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (!active || !Array.isArray(result?.rates)) return;
        setSavedQuickRates(result.rates.map((rate: { rateBps: number }) => rate.rateBps).filter(Number.isInteger));
      })
      .catch(() => { if (active) setSavedQuickRates([]); });
    return () => { active = false; };
  }, [isOpen, marketplace]);

  const saveCustomQuickRate = async () => {
    setQuickRateSaveError("");
    try {
      const rateBps = decimalRupeesToPaise(customQuickRate);
      if (rateBps < 0 || rateBps > 10000) throw new Error("Rate must be between 0% and 100%.");
      setSavingQuickRate(true);
      const response = await fetch("/api/marketplace-quick-rates", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace, rateBps }),
      });
      const result = await response.json();
      if (!response.ok || !result?.rate) throw new Error(result?.error || "Quick rate could not be saved.");
      setSavedQuickRates(current => [...new Set([...current, rateBps])].sort((a, b) => a - b));
      setQuickRateSelection(String(rateBps));
      setCustomQuickRate("");
    } catch (error) {
      setQuickRateSaveError(error instanceof Error ? error.message : "Quick rate could not be saved.");
    } finally {
      setSavingQuickRate(false);
    }
  };

  if (!isOpen) return null;

  const handleSellingPriceChange = (val: string) => {
    setSellingPrice(val);
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
  };

  // Live Calculations
  const parsedQty = Math.max(1, parseFloat(quantity) || 1);
  const parsedUnitCost = Math.max(0, parseFloat(unitCost) || 0);
  const parsedSellingPrice = Math.max(0, parseFloat(sellingPrice) || 0);
  const parsedSettlementAmount = settlementAmount.trim() && Number.isFinite(Number(settlementAmount))
    ? Number(settlementAmount)
    : undefined;
  const formTaxAmount = taxAmount.trim() ? Number(taxAmount) : 0;
  const formDiscountAmount = mode === "edit" ? Number(initialOrder?.items[0]?.discount || 0) : 0;
  const preservedLineSubtotal = initialOrder?.items[0]?.quantity === parsedQty && initialOrder?.items[0]?.sellingPrice === parsedSellingPrice ? initialOrder.items[0].lineSubtotal : undefined;
  const feeOrderItems = mode === "edit" && initialOrder ? [
    { ...(initialOrder.items[0] || { id: "preview" }), sku: sku || "SKU-CUSTOM", productName: productName || "Order Item",
      quantity: parsedQty, sellingPrice: parsedSellingPrice, lineSubtotal: preservedLineSubtotal, discount: formDiscountAmount, taxAmount: formTaxAmount, snapshotUnitCost: parsedUnitCost },
    ...initialOrder.items.slice(1),
  ] : [{
    id: "preview", sku: sku || "CUSTOM-SKU", productName: productName || "Custom Order Item", quantity: parsedQty,
    sellingPrice: parsedSellingPrice, discount: 0, taxAmount: formTaxAmount, snapshotUnitCost: parsedUnitCost,
  }];
  const accountingPolicy = accountingPolicies.filter(policy => policy.marketplace === marketplace && String(policy.effective_from).slice(0, 10) <= orderDate &&
    (!policy.effective_to || String(policy.effective_to).slice(0, 10) >= orderDate)).sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  const pricesIncludeTax = initialOrder?.pricesIncludeTax ?? (priceBasis === "INCLUSIVE" ? true : priceBasis === "EXCLUSIVE" ? false : undefined);
  const feeGstRateBps = initialOrder?.marketplaceFeeGstRateBps ?? accountingPolicy?.marketplace_fee_gst_rate_bps ?? 1800;
  const registrationType = initialOrder?.gstRegistrationType ?? accountingPolicy?.gst_registration_type;
  let feeEstimate: FeeEstimateResult = { status: "NOT_CONFIGURED", totalPaise: null, components: [], reason: "No fee rule is configured." };
  let feeLines: FeeOrderLineInput[] = [];
  let estimatedGrossPaise = 0;
  let estimatedDiscountPaise = 0;
  let estimatedTaxPaise = 0;
  let estimatedCogsPaise = 0;
  let previewInputsValid = true;
  let quickFeeRateBps: number | null = null;
  try {
    if (quickRateSelection === "CUSTOM") {
      if (!customQuickRate.trim()) throw new Error("Enter a custom quick commission rate.");
      quickFeeRateBps = decimalRupeesToPaise(customQuickRate);
    } else if (quickRateSelection) {
      quickFeeRateBps = Number(quickRateSelection);
    }
    const categoriesBySku = new Map(products.map(product => [product.sku, product.category || ""]));
    feeLines = buildFeeOrderLineInputs(feeOrderItems, categoriesBySku, fulfilmentMode.trim() || null, pricesIncludeTax);
    estimatedGrossPaise = feeOrderItems.reduce((sum, item) => sum + (!("lineSubtotal" in item) || item.lineSubtotal === undefined ? decimalRupeesToPaise(String(item.sellingPrice)) * item.quantity : decimalRupeesToPaise(String(item.lineSubtotal))), 0);
    estimatedDiscountPaise = feeOrderItems.reduce((sum, item) => sum + decimalRupeesToPaise(String(item.discount || 0)), 0);
    estimatedTaxPaise = feeOrderItems.reduce((sum, item) => sum + decimalRupeesToPaise(String(item.taxAmount || 0)), 0);
    estimatedCogsPaise = feeOrderItems.reduce((sum, item) => sum + decimalRupeesToPaise(String(item.snapshotUnitCost)) * item.quantity, 0);
    feeEstimate = calculateMarketplaceFeeEstimate(feeRules, feeLines, marketplace, orderDate, quickFeeRateBps, feeGstRateBps);
  } catch { previewInputsValid = false; }
  const estimatedFeeAmount = previewInputsValid && feeEstimate.status === "CONFIGURED" ? feeEstimate.totalPaise / 100 : null;
  const estimatedUnits = feeOrderItems.reduce((sum, item) => sum + item.quantity, 0);
  const orderShippingPaise = mode === "edit" && initialOrder ? decimalRupeesToPaise(String(initialOrder.shippingFeeCharged || 0)) : 0;
  const estimatedSettlementPaise = isReturned || !previewInputsValid || (estimatedTaxPaise > 0 && pricesIncludeTax === undefined) || feeEstimate.status !== "CONFIGURED" ? null
    : estimatedGrossPaise - estimatedDiscountPaise + (pricesIncludeTax ? 0 : estimatedTaxPaise) + orderShippingPaise - feeEstimate.totalPaise;
  const estimatedTrueProfitPaise = estimatedSettlementPaise === null ? null : estimatedSettlementPaise - estimatedTaxPaise - decimalRupeesToPaise(String(initialOrder?.shippingTaxAmount || 0)) - estimatedCogsPaise
    + (registrationType === "REGULAR" && feeEstimate.status === "CONFIGURED" ? feeEstimate.components.reduce((sum, component) => sum + component.taxPaise, 0) : 0);
  const estimatedGross = previewInputsValid ? estimatedGrossPaise / 100 : null;
  const estimatedCogs = previewInputsValid ? estimatedCogsPaise / 100 : null;
  const estimatedSettlement = estimatedSettlementPaise === null ? null : estimatedSettlementPaise / 100;
  const estimatedTrueProfit = estimatedTrueProfitPaise === null ? null : estimatedTrueProfitPaise / 100;

  const handleSelectMfn = (mfnValue: string) => {
    setMfn(mfnValue);
    const clean = mfnValue.trim().toLowerCase();
    if (!clean) return;

    const prod = products.find(
      (p) =>
        (p.mfn && p.mfn.toLowerCase() === clean) ||
        (p.mfn1 && p.mfn1.toLowerCase() === clean) ||
        p.sku.toLowerCase() === clean
    );

    if (prod) {
      // As specified: "whenever we enter MFN number in add order section then COGS , Product Name , MFN-1 autofill"
      setProductName(prod.name);
      setUnitCost(String(prod.currentCostPrice));
      setMfn1(prod.mfn1 || "");
      setSku(prod.sku);



      if (prod.supplierId) {
        const sup = suppliers.find((s) => s.id === prod.supplierId || s.name === prod.supplierId);
        if (sup) setSupplierName(sup.name);
      }
    }
  };

  const handleSelectSku = (skuValue: string) => {
    setSku(skuValue);
    const prod = products.find((p) => p.sku === skuValue);
    if (prod) {
      setProductName(prod.name);
      setUnitCost(String(prod.currentCostPrice));
      if (prod.mfn) setMfn(prod.mfn);
      if (prod.mfn1) setMfn1(prod.mfn1);

      if (prod.supplierId) {
        const sup = suppliers.find((s) => s.id === prod.supplierId || s.name === prod.supplierId);
        if (sup) {
          setSupplierName(sup.name);
        }
      }
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError("");
    try {
      if (quickRateSelection && (quickFeeRateBps === null || !Number.isSafeInteger(quickFeeRateBps) || quickFeeRateBps < 0 || quickFeeRateBps > 10000)) throw new Error("Enter a valid quick commission rate from 0% to 100%.");
      const hasRecordedReturn = !!initialOrder && (!!initialOrder.returnIds?.length || initialOrder.items.some(item => item.returnedQuantity > 0) || ["RETURNED", "RTO", "CUSTOMER_RETURN", "DAMAGED_RETURN", "PARTIALLY_RETURNED", "CLAIM_PENDING", "CLAIM_APPROVED"].includes(initialOrder.status));
      const postReturn = savedDraftOrder.current ? pendingReturnRequested.current : isReturned && !hasRecordedReturn;
      const fingerprint = JSON.stringify([orderId, channelOrderId, marketplace, orderDate, sku, mfn, mfn1, productName, parsedQty, parsedSellingPrice, parsedUnitCost, parsedSettlementAmount, supplierName, notes, isReturned, returnDate, returnType, returnFee, returnReason, isDamagedClaim, claimAmount, claimStatus, taxAmount, priceBasis, recognitionDate]);
      if (savedDraftOrder.current && savedDraftFingerprint.current !== fingerprint) throw new Error("Part of this draft is already saved. Retry the unchanged draft, then edit its saved records.");
      if (postReturn && (!returnDate || returnDate < orderDate)) throw new Error("Enter the actual return date, on or after the order date.");
      const needsRecognitionDate = mode === "create" ? !(postReturn && returnType === "RTO") : initialOrder?.status === "DELIVERED" || !!initialOrder?.revenueRecognisedDate || postReturn && returnType !== "RTO";
      if (needsRecognitionDate && (!recognitionDate || recognitionDate < orderDate || recognitionDate > businessDate() || postReturn && recognitionDate > returnDate)) throw new Error("Enter the actual delivery / revenue recognition date, between the order date and today (and no later than its return).");
      if (!taxAmount.trim() || !Number.isFinite(formTaxAmount) || formTaxAmount < 0) throw new Error("Enter the tax amount from the original order, including explicit zero where applicable.");
      if (pricesIncludeTax === undefined) throw new Error("Confirm whether the original selling price includes tax.");
      if (!unitCost.trim() || !Number.isFinite(Number(unitCost)) || Number(unitCost) < 0) throw new Error("Enter the recorded unit cost.");
      if (!sellingPrice.trim() || !Number.isFinite(Number(sellingPrice)) || Number(sellingPrice) < 0) throw new Error("Enter the recorded selling price.");
      if (postReturn && !onAddReturn) throw new Error("Return recording is unavailable. The order has not been saved.");
      if (postReturn && Number(approvedReimbursement) > 0) throw new Error("Record the dated reimbursement in Claims after saving this return.");
      if (!sku || !Number.isSafeInteger(parsedQty) || parsedQty <= 0) throw new Error("A catalog SKU and whole quantity are required.");
      let savedOrder: Order;
      if (savedDraftOrder.current) { savedOrder = savedDraftOrder.current; }
      else if (mode === "edit" && initialOrder) {
        if (!onUpdateOrder) throw new Error("Order editing is unavailable.");
        savedOrder = await onUpdateOrder({
          ...initialOrder, channelOrderId: channelOrderId.trim() || initialOrder.channelOrderId,
          marketplace, fulfilmentMode: fulfilmentMode.trim() || undefined, quickFeeRateBps, orderDate,
          status: initialOrder.status, settlementAmount: parsedSettlementAmount,
          currency: "INR", taxEvidenceStatus: initialOrder.items.length > 1 ? initialOrder.taxEvidenceStatus : "RECORDED", pricesIncludeTax, revenueRecognisedDate: recognitionDate || initialOrder.revenueRecognisedDate,
          supplierName: supplierName || undefined, supplierId: suppliers.find(supplier => supplier.name === supplierName)?.id || initialOrder.supplierId, notes,
          items: [{ ...(initialOrder.items[0] || { id: draftIds.current.line }), sku, mfn: mfn || undefined, mfn1: mfn1 || undefined, productName: productName || "Order Item",
            quantity: parsedQty, sellingPrice: parsedSellingPrice, lineSubtotal: preservedLineSubtotal, discount: formDiscountAmount, taxAmount: formTaxAmount, snapshotUnitCost: parsedUnitCost,
            returnedQuantity: initialOrder.items[0]?.returnedQuantity || 0 }, ...initialOrder.items.slice(1)],
        });
      } else {
        if (!onAddOrder) throw new Error("Order creation is unavailable.");
        if (!orderId.trim()) throw new Error("The original order reference is required.");
        savedOrder = await onAddOrder({
          id: draftIds.current.order, channelOrderId: orderId.trim(), marketplace, fulfilmentMode: fulfilmentMode.trim() || undefined, quickFeeRateBps, orderDate,
          currency: "INR", taxEvidenceStatus: "RECORDED", pricesIncludeTax, revenueRecognisedDate: needsRecognitionDate ? recognitionDate : undefined,
          status: postReturn && returnType === "RTO" ? "SHIPPED" : "DELIVERED", customerName: "Direct Buyer", customerCity: "", customerState: "",
          shippingFeeCharged: 0, marketplaceChargesEstimate: 0, feeEstimateStatus: "NOT_CONFIGURED", feeEstimateTotalPaise: null, settlementAmount: parsedSettlementAmount,
          supplierName: supplierName || undefined, supplierId: suppliers.find(supplier => supplier.name === supplierName)?.id, notes,
          items: [{ id: draftIds.current.line, sku, mfn: mfn || undefined, mfn1: mfn1 || undefined, productName: productName || "Custom Order Item", quantity: parsedQty, sellingPrice: parsedSellingPrice,
            discount: 0, taxAmount: formTaxAmount, snapshotUnitCost: parsedUnitCost, returnedQuantity: 0 }],
        });
      }
      savedDraftOrder.current = savedOrder; savedDraftFingerprint.current = fingerprint; pendingReturnRequested.current = postReturn;
      // Persist dated return evidence before its dependent claim; retries retain the same identities.
      if (postReturn && onAddReturn) {
        const damaged = isDamagedClaim || returnType === "DAMAGED_RETURN" || returnType === "LOST_RETURN";
        const record: ReturnRecord = { id: draftIds.current.returned, orderId: savedOrder.id, channelOrderId: savedOrder.channelOrderId,
          marketplace, returnDate, returnType, returnReason: returnReason || "Return recorded by operator", sku, quantity: parsedQty, condition: damaged ? "DAMAGED" : "SELLABLE",
          restockStatus: damaged ? "WRITTEN_OFF" : "PENDING_RESTOCK", ...getManualReturnCosts(parsedUnitCost, parsedQty, damaged, Number(returnFee) || 0) };
        if (!savedDraftReturn.current) { await onAddReturn(record); savedDraftReturn.current = record; }
        if (isDamagedClaim && onAddClaim) {
          const status: Claim["status"] = claimStatus === "Draft" ? "NOT_FILED" : claimStatus === "Approved" ? "APPROVED" : claimStatus === "Rejected" ? "REJECTED" : "FILED";
          await onAddClaim({ id: draftIds.current.claim, orderId: savedOrder.id, returnId: record.id, marketplace,
            claimType: returnType === "LOST_RETURN" ? "LOST_IN_TRANSIT" : "DAMAGED_INVOICE", claimDate: returnDate,
            amountClaimed: Number(claimAmount) > 0 ? Number(claimAmount) : parsedUnitCost * parsedQty, amountRecovered: 0, status, notes: "Claim linked to recorded return" });
        }
      }
      onClose();
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Order could not be saved. Please retry."); }
    finally { saveInFlight.current = false; setSaving(false); }
  };

  if (!isOpen || !mounted) return null;

  return <>
    {createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="apple-card bg-white text-[#1D1D1F] rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]">
          <div>
            <h2 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              {mode === "edit" ? "Edit order" : "Add new order"}
            </h2>
            <p className="text-xs text-[#86868B] mt-0.5">
              {mode === "edit"
                ? `Order ID: ${initialOrder?.id} · Ref: ${channelOrderId || initialOrder?.channelOrderId || "N/A"}`
                : "Enter order details to sync inventory, COGS liabilities, and expected settlements."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order dialog"
            className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">

          {/* 1. Channel & Order Reference */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(180px,0.75fr)]">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Marketplace channel</label>
                <div className="flex flex-col gap-1">
                  <FormMarketplaceDropdown selected={marketplace} onChange={(mp) => {
                    setMarketplace(mp);
                    setQuickRateSelection("");
                    setCustomQuickRate("");
                    setQuickRateSaveError("");
                  }} />
                  <button type="button" onClick={() => setIsFeeRulesOpen(true)} className="self-end rounded-full px-2 py-1 text-[10px] font-semibold text-[#0071E3] hover:bg-blue-50">Manage fee rules</button>
                </div>
              </div>
              <div>
                <label htmlFor="quick-fee-rate" className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Quick commission rate (%)</label>
                <div className="flex flex-col gap-2">
                <select id="quick-fee-rate" value={quickRateSelection} onChange={event => {
                  setQuickRateSelection(event.target.value);
                  setCustomQuickRate("");
                  setQuickRateSaveError("");
                }} className="w-full max-w-[220px] px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black">
                    <option value="">No quick override</option>
                  {savedQuickRates.map(rate => <option key={rate} value={rate}>{formatQuickRate(rate)}</option>)}
                  <option value="CUSTOM">Add custom rate…</option>
                  </select>
                {quickRateSelection === "CUSTOM" && <div className="flex gap-2">
                  <NumericInput aria-label="Custom quick commission rate in percent" inputMode="decimal" step="0.01" min="0" max="100" required value={customQuickRate} onChange={event => setCustomQuickRate(event.target.value)} className="min-w-0 flex-1 px-3 py-2 bg-white border border-black/[0.08] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black" />
                  <button type="button" disabled={savingQuickRate || !customQuickRate.trim()} onClick={saveCustomQuickRate} className="shrink-0 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-[11px] font-semibold text-[#0071E3] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {savingQuickRate ? "Saving…" : "Save rate"}
                  </button>
                </div>}
                {quickRateSaveError && <p role="alert" className="text-[10px] text-[#D70015]">{quickRateSaveError}</p>}
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="order-fulfilment-mode" className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Fulfilment mode (optional)</label>
              <input id="order-fulfilment-mode" type="text" value={fulfilmentMode} onChange={event => setFulfilmentMode(event.target.value)} placeholder="Match the value used by your fee rule" className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  {mode === "edit" ? "Channel reference #" : "Order / reference #"}
                </label>
                <input
                  type="text"
                  value={mode === "edit" ? channelOrderId : orderId}
                  onChange={(e) =>
                    mode === "edit"
                      ? setChannelOrderId(e.target.value)
                      : setOrderId(e.target.value)
                  }
                  placeholder="e.g. 402-1829301-4492019"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium tabular-nums transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Transaction date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium tabular-nums transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. Product & Item Details */}
          <div className="space-y-3 pt-2 border-t border-black/[0.06]">
            {/* MFN Number lookup & MFN-1 field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FBFBFD] border border-black/[0.05] rounded-2xl">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  MFN Number <span className="text-[#0071E3] font-normal">(Auto-fills COGS, Product &amp; MFN-1)</span>
                </label>
                <input
                  type="text"
                  list="order-modal-catalog-mfns"
                  value={mfn}
                  onChange={(e) => handleSelectMfn(e.target.value)}
                  placeholder="e.g. MFN-WEM-010"
                  className="w-full px-3 py-2 bg-white border border-black/[0.08] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#0071E3] font-mono font-medium uppercase transition-all"
                />
                <datalist id="order-modal-catalog-mfns">
                  {products
                    .filter((p) => p.mfn)
                    .map((p) => (
                      <option key={p.id} value={p.mfn}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                </datalist>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  MFN-1 Identifier
                </label>
                <input
                  type="text"
                  value={mfn1}
                  onChange={(e) => setMfn1(e.target.value)}
                  placeholder="e.g. MFN1-WEM-010-A"
                  className="w-full px-3 py-2 bg-white border border-black/[0.08] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#0071E3] font-mono font-medium uppercase transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  SKU / item code
                </label>
                <input
                  type="text"
                  list="order-modal-catalog-skus"
                  value={sku}
                  onChange={(e) => handleSelectSku(e.target.value)}
                  placeholder="e.g. ELEC-WEM-01"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium tabular-nums transition-all"
                  required
                />
                <datalist id="order-modal-catalog-skus">
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Product title / name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Wireless Ergonomic Mouse"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium transition-all"
                  required
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Quantity
                </label>
                <NumericInput
                  min="1"
                  value={quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums text-center transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Wholesale Cost (COGS) Card */}
          <div className="apple-card p-4 rounded-2xl shadow-apple-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Wholesale cost (COGS)
              </span>
              <span className="text-xs font-medium text-[#86868B]">
                Total COGS: <span className="text-[#1D1D1F] font-semibold tabular-nums">{estimatedCogs === null ? "Unavailable" : formatINR(estimatedCogs)}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Wholesale supplier
                </label>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-medium cursor-pointer transition-all"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  <option value="Direct Supplier">Direct Supplier / Spot Purchase</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Unit purchase cost (₹)
                </label>
                <NumericInput
                  step="any"
                  min="0"
                  value={unitCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Platform Pricing & Settlement Card */}
          <div className="apple-card p-4 rounded-2xl shadow-apple-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                Platform financials &amp; settlement
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Unit selling price (₹)
                </label>
                <NumericInput
                  step="any"
                  min="0"
                  value={sellingPrice}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleSellingPriceChange(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                  Recorded settlement (₹)
                </label>
                <NumericInput
                  step="any"
                  min="0"
                  value={settlementAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  placeholder="Enter actual amount"
                  className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold tabular-nums transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Recorded item tax (₹)</label>
                <NumericInput min="0" step="0.01" value={taxAmount} onChange={event => setTaxAmount(event.target.value)} readOnly={(initialOrder?.items.length || 0) > 1} required className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Original selling price tax basis</label>
                <select value={initialOrder?.pricesIncludeTax === undefined ? priceBasis : initialOrder.pricesIncludeTax ? "INCLUSIVE" : "EXCLUSIVE"} onChange={event => setPriceBasis(event.target.value)} disabled={initialOrder?.pricesIncludeTax !== undefined} required className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black">
                  <option value="">Confirm from the original order</option>
                  <option value="INCLUSIVE">Tax included in selling price</option>
                  <option value="EXCLUSIVE">Tax added to selling price</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Actual delivery / revenue recognition date</label>
              <input type="date" value={recognitionDate} min={orderDate} max={businessDate()} onChange={event => setRecognitionDate(event.target.value)} required={!(isReturned && returnType === "RTO") && (mode === "create" || initialOrder?.status === "DELIVERED" || !!initialOrder?.revenueRecognisedDate)} className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black" />
            </div>

            {/* Live Financial Breakdown Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/[0.06] text-xs">
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Gross sales</span>
                <span className="font-semibold text-[#1D1D1F] tabular-nums tracking-tight">
                  {estimatedGross === null ? "Unavailable" : formatINR(estimatedGross)}
                </span>
              </div>
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">{quickRateSelection ? "Quick fee estimate" : "Estimated fees"}</span>
                <span className="font-semibold text-[#D70015] tabular-nums tracking-tight">
                  {!previewInputsValid ? "Unavailable" : estimatedFeeAmount === null ? "Not configured" : `−${formatINR(estimatedFeeAmount)}`}
                </span>
              </div>
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Expected payout</span>
                <span className="font-semibold text-[#0071E3] tabular-nums tracking-tight">
                  {estimatedSettlement === null ? "Unavailable" : formatINR(estimatedSettlement)}
                </span>
              </div>
              <div className="bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.04]">
                <span className="text-[10px] font-medium text-[#86868B] block">Est. true profit</span>
                <span
                  className={`font-semibold tabular-nums tracking-tight ${
                    estimatedTrueProfit !== null && estimatedTrueProfit >= 0 ? "text-[#288548]" : "text-[#D70015]"
                  }`}
                >
                  {estimatedTrueProfit === null ? "Unavailable" : formatINR(estimatedTrueProfit)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Mark as Returned / RTO Order */}
          <div className="apple-card p-4 rounded-2xl shadow-apple-sm border border-black/[0.06] space-y-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReturned}
                onChange={(e) => setIsReturned(e.target.checked)}
                className="w-4 h-4 rounded text-[#1D1D1F] focus:ring-black border-black/20 accent-[#1D1D1F] cursor-pointer"
              />
              <span className="font-semibold text-xs text-[#1D1D1F]">
                Mark as returned / RTO order
              </span>
            </label>

            {isReturned && (
              <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">Actual return date</label>
                  <input type="date" value={returnDate} min={orderDate} onChange={event => setReturnDate(event.target.value)} className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                      Return type
                    </label>
                    <select
                      value={returnType}
                      onChange={(e) => setReturnType(e.target.value as ReturnType)}
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black cursor-pointer font-medium"
                    >
                      <option value="CUSTOMER_RETURN">Customer Return (Delivered &amp; Returned)</option>
                      <option value="RTO">RTO (Undelivered / Doorstep Rejection)</option>
                      <option value="DAMAGED_RETURN">Damaged Return</option>
                      <option value="LOST_RETURN">Lost in Transit</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                      Return fee / logistics deduction (₹)
                    </label>
                    <NumericInput
                      step="any"
                      min="0"
                      value={returnFee}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setReturnFee(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl tabular-nums text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
                    Return reason / notes
                  </label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. wrong size, damaged packaging"
                    className="w-full px-3 py-2 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Damaged Claim Sub-Card */}
                <div className="p-3.5 rounded-xl border border-[#B25E00]/20 bg-[#B25E00]/5 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isDamagedClaim}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsDamagedClaim(checked);
                        if (checked && (!claimAmount || claimAmount === "0")) {
                          setClaimAmount(String(parsedUnitCost || parsedSellingPrice || 0));
                        }
                      }}
                      className="w-4 h-4 rounded text-[#B25E00] focus:ring-[#B25E00] border-[#B25E00]/40 accent-[#B25E00] cursor-pointer"
                    />
                    <span className="font-semibold text-xs text-[#B25E00]">
                      Returned product is damaged / defective (file SAFE-T claim)
                    </span>
                  </label>

                  {isDamagedClaim && (
                    <div className="grid grid-cols-3 gap-2.5 pt-1 animate-in fade-in duration-150">
                      <div>
                        <label className="text-[10px] font-semibold text-[#B25E00] block mb-1">
                          Claim amount filed
                        </label>
                        <NumericInput
                          step="any"
                          min="0"
                          value={claimAmount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setClaimAmount(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 bg-white border border-[#B25E00]/30 rounded-lg tabular-nums text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#B25E00] font-semibold shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-[#B25E00] block mb-1">
                          Claim status
                        </label>
                        <select
                          value={claimStatus}
                          onChange={(e) =>
                            setClaimStatus(
                              e.target.value as "Draft" | "Filed" | "Approved" | "Rejected"
                            )
                          }
                          className="w-full px-2.5 py-2 bg-white border border-[#B25E00]/30 rounded-lg text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#B25E00] font-semibold cursor-pointer shadow-2xs"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Filed">Filed</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-[#B25E00] block mb-1">
                          Approved reimbursement
                        </label>
                        <NumericInput
                          step="any"
                          min="0"
                          value={approvedReimbursement}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setApprovedReimbursement(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-2 bg-white border border-[#B25E00]/30 rounded-lg tabular-nums text-xs text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-[#B25E00] font-semibold shadow-2xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. General Order Notes */}
          <div>
            <label className="text-[11px] font-semibold text-[#1D1D1F] block mb-1">
              General order notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record packaging conditions, tracking numbers, or transaction notes..."
              className="w-full p-2.5 bg-[#F5F5F7] border border-black/[0.06] rounded-xl text-xs text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-1 focus:ring-black transition-all"
            />
          </div>

          {/* Sticky Actions Footer */}
          <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between gap-3">
            <div className="text-xs text-[#86868B]">
              <span className="font-semibold text-[#1D1D1F]">{estimatedUnits} unit{estimatedUnits === 1 ? "" : "s"}</span>
              <span className="mx-1.5 text-black/20">·</span>
              <span>Gross: <strong className="text-[#1D1D1F] tabular-nums font-semibold">{estimatedGross === null ? "Unavailable" : formatINR(estimatedGross)}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] text-xs font-medium shadow-apple-sm btn-press transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#1D1D1F] hover:bg-black text-white rounded-xl text-xs font-medium shadow-apple-sm btn-press transition cursor-pointer"
              >
                {saving ? "Saving…" : mode === "edit" ? "Update order" : "Submit order"}
              </button>
            </div>
          </div>
          {saveError && <p role="alert" className="text-xs text-[#D70015]">{saveError}</p>}
        </form>
      </div>
    </div>,
    document.body
  )}
  <MarketplaceFeeRulesModal isOpen={isFeeRulesOpen} onClose={() => setIsFeeRulesOpen(false)} marketplace={marketplace}
    products={products} onRulesChange={setFeeRules} />
  </>;
}
