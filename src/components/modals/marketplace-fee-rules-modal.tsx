"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, X } from "lucide-react";
import { MARKETPLACE_LIST } from "@/lib/marketplace-config";
import { decimalRupeesToPaise, type FeeCalculationBase, type FeeCalculationMethod, type FeeTaxTreatment, type MarketplaceFeeRule } from "@/domain/marketplace-fees";
import type { Marketplace, Product } from "@/domain/types";

type FeeComponentDraft = {
  name: string;
  componentType: string;
  method: FeeCalculationMethod;
  rate: string;
  amount: string;
  calculationBase: FeeCalculationBase;
  taxTreatment: FeeTaxTreatment;
  taxRate: string;
};

type FeeRuleDraft = {
  marketplace: Marketplace;
  sku: string;
  productCategory: string;
  fulfilmentMode: string;
  minUnitPrice: string;
  maxUnitPrice: string;
  effectiveFrom: string;
  components: FeeComponentDraft[];
};

const newComponent = (): FeeComponentDraft => ({ name: "Platform fee", componentType: "COMMISSION", method: "PERCENT",
  rate: "", amount: "", calculationBase: "ITEM_AFTER_DISCOUNT", taxTreatment: "NO_TAX", taxRate: "" });
const newDraft = (marketplace: Marketplace): FeeRuleDraft => ({ marketplace, sku: "", productCategory: "", fulfilmentMode: "",
  minUnitPrice: "", maxUnitPrice: "", effectiveFrom: new Date().toISOString().slice(0, 10), components: [newComponent()] });
const fieldClass = "w-full rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20";
const labelClass = "mb-1 block text-[11px] font-medium text-[#6E6E73]";

function ruleDate(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function toDraft(rule: MarketplaceFeeRule): FeeRuleDraft {
  return { marketplace: rule.marketplace, sku: rule.sku || "", productCategory: rule.productCategory || "",
    fulfilmentMode: rule.fulfilmentMode || "", minUnitPrice: rule.minUnitPricePaise == null ? "" : (rule.minUnitPricePaise / 100).toFixed(2),
    maxUnitPrice: rule.maxUnitPricePaise == null ? "" : (rule.maxUnitPricePaise / 100).toFixed(2),
    effectiveFrom: ruleDate(rule.effectiveFrom), components: rule.components.map(component => ({
      name: component.name, componentType: component.componentType, method: component.method,
      rate: component.rateBps === undefined ? "" : (component.rateBps / 100).toFixed(2),
      amount: component.amountPaise === undefined ? "" : (component.amountPaise / 100).toFixed(2),
      calculationBase: component.calculationBase || "ITEM_AFTER_DISCOUNT", taxTreatment: component.taxTreatment,
      taxRate: component.taxRateBps === undefined ? "" : (component.taxRateBps / 100).toFixed(2),
    })) };
}

export function MarketplaceFeeRulesModal({ isOpen, onClose, marketplace, products, onRulesChange }: {
  isOpen: boolean;
  onClose: () => void;
  marketplace: Marketplace;
  products: Product[];
  onRulesChange: (rules: MarketplaceFeeRule[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [rules, setRules] = useState<MarketplaceFeeRule[]>([]);
  const [draft, setDraft] = useState<FeeRuleDraft>(() => newDraft(marketplace));
  const [editingRule, setEditingRule] = useState<MarketplaceFeeRule | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || []);
    focusables()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements = focusables();
        if (!elements.length) return;
        if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); previousFocus?.focus(); };
  }, [isOpen, onClose]);

  const loadRules = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/marketplace-fee-rules", { credentials: "same-origin", cache: "no-store" });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || "Fee rules could not be loaded.");
      const fetched = result.rules as MarketplaceFeeRule[];
      setRules(fetched);
      onRulesChange(fetched);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Fee rules could not be loaded.");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) void loadRules(); }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const resetEditor = () => { setDraft(newDraft(marketplace)); setEditingRule(null); setArchiveId(null); setError(""); };
  const editRule = (rule: MarketplaceFeeRule) => {
    const nextDay = new Date(`${ruleDate(rule.effectiveFrom)}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    setDraft({ ...toDraft(rule), effectiveFrom: nextDay.toISOString().slice(0, 10) });
    setEditingRule(rule);
    setArchiveId(null);
    setError("");
  };
  const updateComponent = (index: number, change: Partial<FeeComponentDraft>) => setDraft(current => ({
    ...current, components: current.components.map((component, componentIndex) => componentIndex === index ? { ...component, ...change } : component),
  }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const components = draft.components.map((component, sequence) => ({
        name: component.name,
        componentType: component.componentType,
        method: component.method,
        ...(component.method === "PERCENT" ? { rateBps: decimalRupeesToPaise(component.rate), calculationBase: component.calculationBase }
          : { amountPaise: decimalRupeesToPaise(component.amount) }),
        taxTreatment: component.taxTreatment,
        ...(component.taxTreatment === "TAXABLE" ? { taxRateBps: decimalRupeesToPaise(component.taxRate) } : {}),
        sequence,
      }));
      const payload = { marketplace: draft.marketplace, sku: draft.sku.trim() || null, productCategory: draft.productCategory.trim() || null,
        fulfilmentMode: draft.fulfilmentMode.trim() || null,
        minUnitPricePaise: draft.minUnitPrice.trim() ? decimalRupeesToPaise(draft.minUnitPrice) : null,
        maxUnitPricePaise: draft.maxUnitPrice.trim() ? decimalRupeesToPaise(draft.maxUnitPrice) : null,
        effectiveFrom: draft.effectiveFrom, components };
      const response = await fetch("/api/marketplace-fee-rules", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editingRule ? "update" : "create", rule: payload, ruleId: editingRule?.id }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || "Fee rule could not be saved.");
      resetEditor();
      await loadRules();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Fee rule could not be saved.");
    } finally { setSaving(false); }
  };

  const archiveRule = async (ruleId: string) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/marketplace-fee-rules", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", ruleId }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || "Fee rule could not be archived.");
      setArchiveId(null);
      await loadRules();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Fee rule could not be archived.");
    } finally { setSaving(false); }
  };

  const activeRules = rules.filter(rule => rule.status === "ACTIVE");
  const categories = Array.from(new Set(products.map(product => product.category).filter((value): value is string => Boolean(value))));

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fee-rules-title" onClick={event => event.stopPropagation()}
        className="apple-card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white text-[#1D1D1F] shadow-apple-lg animate-in zoom-in-95 duration-150">
        <header className="flex items-center justify-between border-b border-black/[0.06] bg-[#FBFBFD] px-6 py-4">
          <div><h2 id="fee-rules-title" className="text-base font-semibold tracking-tight">Marketplace fee rules</h2>
            <p className="mt-0.5 text-xs text-[#86868B]">Configure the charges used for fee estimates.</p></div>
          <button type="button" onClick={onClose} aria-label="Close fee rules" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-[#6E6E73] hover:bg-black/[0.08]"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section aria-label="Existing active rules" className="space-y-3 border-b border-black/[0.06] p-5 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Active rules</h3>
              <button type="button" onClick={resetEditor} className="inline-flex items-center gap-1 rounded-full bg-[#1D1D1F] px-3 py-1.5 text-[11px] font-semibold text-white"><Plus className="h-3 w-3" /> New rule</button></div>
            {loading ? <p className="text-xs text-[#86868B]">Loading rules…</p> : activeRules.length === 0 ? <p className="rounded-xl bg-[#F5F5F7] p-3 text-xs text-[#6E6E73]">No active rules yet. Add one to enable fee estimates.</p> :
              <ul className="space-y-2">{activeRules.map(rule => <li key={rule.id} className="rounded-xl border border-black/[0.06] p-3">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{rule.marketplace} · v{rule.version}</p>
                  <p className="mt-1 text-[11px] text-[#6E6E73]">{[rule.sku, rule.productCategory, rule.fulfilmentMode].filter(Boolean).join(" · ") || "All products and fulfilment"}</p>
                  <p className="text-[10px] text-[#86868B]">Effective {ruleDate(rule.effectiveFrom)}{rule.effectiveTo ? ` to ${ruleDate(rule.effectiveTo)}` : " onward"}</p></div>
                  <div className="flex shrink-0 gap-1"><button type="button" onClick={() => editRule(rule)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-[#0071E3] hover:bg-blue-50">Edit</button>
                    <button type="button" onClick={() => setArchiveId(archiveId === rule.id ? null : rule.id)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-[#D70015] hover:bg-rose-50">Archive</button></div></div>
                {archiveId === rule.id && <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 p-2 text-[10px] text-rose-900"><span>Stop using this rule for new estimates?</span><button type="button" disabled={saving} onClick={() => void archiveRule(rule.id)} className="font-semibold underline">Confirm archive</button></div>}
              </li>)}</ul>}
          </section>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{editingRule ? `Edit rule · v${editingRule.version + 1}` : "New rule"}</h3>
              {editingRule && <button type="button" onClick={resetEditor} className="text-[11px] font-medium text-[#6E6E73]">Cancel edit</button>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass} htmlFor="fee-marketplace">Marketplace</label><select id="fee-marketplace" className={fieldClass} value={draft.marketplace} onChange={event => setDraft(current => ({ ...current, marketplace: event.target.value as Marketplace }))}>{MARKETPLACE_LIST.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
              <div><label className={labelClass} htmlFor="fee-start">Effective from</label><input id="fee-start" className={fieldClass} type="date" required value={draft.effectiveFrom} onChange={event => setDraft(current => ({ ...current, effectiveFrom: event.target.value }))} /></div>
              <div><label className={labelClass} htmlFor="fee-sku">SKU (optional)</label><input id="fee-sku" className={fieldClass} list="fee-rule-skus" value={draft.sku} onChange={event => setDraft(current => ({ ...current, sku: event.target.value }))} /><datalist id="fee-rule-skus">{products.map(product => <option key={product.sku} value={product.sku}>{product.name}</option>)}</datalist></div>
              <div><label className={labelClass} htmlFor="fee-category">Product category (optional)</label><input id="fee-category" className={fieldClass} list="fee-rule-categories" value={draft.productCategory} onChange={event => setDraft(current => ({ ...current, productCategory: event.target.value }))} /><datalist id="fee-rule-categories">{categories.map(category => <option key={category} value={category} />)}</datalist></div>
              <div><label className={labelClass} htmlFor="fee-fulfilment">Fulfilment mode (optional)</label><input id="fee-fulfilment" className={fieldClass} value={draft.fulfilmentMode} onChange={event => setDraft(current => ({ ...current, fulfilmentMode: event.target.value }))} placeholder="Use the same value on orders" /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className={labelClass} htmlFor="fee-min-price">Min unit price (₹)</label><input id="fee-min-price" className={fieldClass} inputMode="decimal" value={draft.minUnitPrice} onChange={event => setDraft(current => ({ ...current, minUnitPrice: event.target.value }))} /></div>
                <div><label className={labelClass} htmlFor="fee-max-price">Max (exclusive, ₹)</label><input id="fee-max-price" className={fieldClass} inputMode="decimal" value={draft.maxUnitPrice} onChange={event => setDraft(current => ({ ...current, maxUnitPrice: event.target.value }))} /></div></div>
            </div>
            <div className="space-y-3 border-t border-black/[0.06] pt-3"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold">Charge components</h4>
              <button type="button" onClick={() => setDraft(current => ({ ...current, components: [...current.components, newComponent()] }))} className="text-[11px] font-medium text-[#0071E3]">Add component</button></div>
              {draft.components.map((component, index) => <fieldset key={index} className="space-y-2 rounded-xl border border-black/[0.06] p-3"><legend className="sr-only">Fee component {index + 1}</legend>
                <div className="grid grid-cols-2 gap-2"><div><label className={labelClass} htmlFor={`fee-name-${index}`}>Name</label><input id={`fee-name-${index}`} className={fieldClass} required value={component.name} onChange={event => updateComponent(index, { name: event.target.value })} /></div>
                  <div><label className={labelClass} htmlFor={`fee-type-${index}`}>Charge type</label><input id={`fee-type-${index}`} className={fieldClass} required value={component.componentType} onChange={event => updateComponent(index, { componentType: event.target.value })} placeholder="COMMISSION, LOGISTICS…" /></div>
                  <div><label className={labelClass} htmlFor={`fee-method-${index}`}>Calculation</label><select id={`fee-method-${index}`} className={fieldClass} value={component.method} onChange={event => updateComponent(index, { method: event.target.value as FeeCalculationMethod })}><option value="PERCENT">Percentage</option><option value="FIXED_ORDER">Fixed per order</option><option value="PER_UNIT">Per unit</option></select></div>
                  {component.method === "PERCENT" ? <><div><label className={labelClass} htmlFor={`fee-rate-${index}`}>Rate (%)</label><input id={`fee-rate-${index}`} className={fieldClass} inputMode="decimal" required value={component.rate} onChange={event => updateComponent(index, { rate: event.target.value })} /></div>
                    <div className="col-span-2"><label className={labelClass} htmlFor={`fee-base-${index}`}>Calculate percentage on</label><select id={`fee-base-${index}`} className={fieldClass} value={component.calculationBase} onChange={event => updateComponent(index, { calculationBase: event.target.value as FeeCalculationBase })}><option value="ITEM_BEFORE_DISCOUNT">Item value before discount</option><option value="ITEM_AFTER_DISCOUNT">Item value after discount</option><option value="ITEM_EXCLUDING_TAX">Item value excluding tax</option></select></div></>
                    : <div><label className={labelClass} htmlFor={`fee-amount-${index}`}>Amount (₹)</label><input id={`fee-amount-${index}`} className={fieldClass} inputMode="decimal" required value={component.amount} onChange={event => updateComponent(index, { amount: event.target.value })} /></div>}
                  <div><label className={labelClass} htmlFor={`fee-tax-treatment-${index}`}>Fee tax</label><select id={`fee-tax-treatment-${index}`} className={fieldClass} value={component.taxTreatment} onChange={event => updateComponent(index, { taxTreatment: event.target.value as FeeTaxTreatment })}><option value="NO_TAX">No tax</option><option value="TAXABLE">Add tax</option><option value="TAX_INCLUDED">Tax included</option></select></div>
                  {component.taxTreatment === "TAXABLE" && <div><label className={labelClass} htmlFor={`fee-tax-rate-${index}`}>Tax rate (%)</label><input id={`fee-tax-rate-${index}`} className={fieldClass} inputMode="decimal" required value={component.taxRate} onChange={event => updateComponent(index, { taxRate: event.target.value })} /></div>}
                </div>
                {draft.components.length > 1 && <button type="button" onClick={() => setDraft(current => ({ ...current, components: current.components.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-1 text-[10px] font-medium text-[#D70015]"><Trash2 className="h-3 w-3" /> Remove component</button>}
              </fieldset>)}
            </div>
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-3"><button type="button" onClick={onClose} className="rounded-full bg-black/[0.04] px-4 py-2 text-xs font-medium hover:bg-black/[0.08]">Close</button>
              <button type="submit" disabled={saving} className="rounded-full bg-[#1D1D1F] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : editingRule ? "Save new version" : "Save rule"}</button></div>
          </form>
        </div>
      </section>
    </div>, document.body);
}
