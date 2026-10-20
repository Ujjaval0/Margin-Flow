"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { claimWorkspaceTour, markWorkspaceTourShown, positionTourCard } from "@/lib/workspace-tour";

const storeSteps = [
  { target: "orders", title: "Start with your orders", body: "Add orders or import a file here to track sales across your marketplaces." },
  { target: "settlements", title: "See what you’ve been paid", body: "Match marketplace settlements to your orders and check fees or missing payments." },
  { target: "returns", title: "Keep track of returns", body: "Review returns here. Use Claims next to it to follow up on money you’re owed." },
];
const supplierSteps = [
  { target: "products", title: "Add your products", body: "Keep your product details and costs together here." },
  { target: "purchases", title: "Track purchases and bills", body: "Record purchases and manage supplier bills in one place." },
  { target: "reports", title: "See how things are going", body: "Review your analytics and profit and loss reports here." },
];
const assistantStep = { target: "assistant", title: "Meet Flow, your store assistant", body: "Open Flow, then its settings to choose an AI provider, add your API key and select a model. Built-in analysis also works without a key." };

export function WorkspaceTour({ ownerId, accountType, isSidebarOpen, onSidebarChange }: {
  ownerId: string;
  accountType: string;
  isSidebarOpen: boolean;
  onSidebarChange: (open: boolean) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const originalSidebar = useRef(isSidebarOpen);
  const previousFocus = useRef<HTMLElement | null>(null);
  if (step === null) originalSidebar.current = isSidebarOpen;
  const steps = [...(accountType === "SUPPLIER" ? supplierSteps : storeSteps), assistantStep];
  const current = step === null ? null : steps[step];

  const close = useCallback(() => {
    setStep(null);
    onSidebarChange(originalSidebar.current);
    previousFocus.current?.focus();
  }, [onSidebarChange]);

  useEffect(() => {
    setMounted(true);
    let active = true;
    claimWorkspaceTour(ownerId).then(show => {
      if (!active || !show) return;
      markWorkspaceTourShown(ownerId);
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setStep(0);
    });
    return () => { active = false; };
  }, [ownerId]);

  useEffect(() => {
    if (step === null) return;
    onSidebarChange(step < 3 ? true : window.innerWidth < 768 ? false : originalSidebar.current);
    nextRef.current?.focus();
  }, [step, onSidebarChange]);

  useEffect(() => () => {
    onSidebarChange(originalSidebar.current);
  }, [onSidebarChange]);

  useLayoutEffect(() => {
    if (!current || !mounted) return;
    const target = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!target) { close(); return; }
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      setAnchor(rect);
      setPosition(positionTourCard(rect, window.innerWidth, window.innerHeight, cardRef.current?.offsetHeight || 240));
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(target);
    if (cardRef.current) observer.observe(cardRef.current);
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    // The sidebar changes width during its existing 300ms transition.
    const timer = window.setTimeout(schedule, 320);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [current?.target, mounted, isSidebarOpen, close]);

  useEffect(() => {
    if (step === null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.key !== "Tab") return;
      const buttons = cardRef.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [step, close]);

  if (!mounted || !current || step === null) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-xs animate-in fade-in duration-150" onClick={close}>
      {anchor && <div aria-hidden="true" className="fixed pointer-events-none rounded-xl border-2 border-blue-500" style={{ left: anchor.left - 3, top: anchor.top - 3, width: anchor.width + 6, height: anchor.height + 6 }} />}
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="workspace-tour-title" aria-describedby="workspace-tour-body"
        onClick={event => event.stopPropagation()}
        className="apple-card fixed rounded-3xl border border-black/[0.08] bg-white p-5 text-[#1D1D1F] shadow-apple-lg max-h-[calc(100dvh-24px)] overflow-y-auto"
        style={position || { left: 12, top: 76, width: "calc(100% - 24px)", maxWidth: 320, visibility: "hidden" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[11px] font-medium text-[#86868B]">Quick tour · {step + 1} of 4</p>
          <button type="button" onClick={close} aria-label="Close quick tour" className="w-7 h-7 shrink-0 rounded-full bg-black/[0.04] hover:bg-black/[0.08] text-[#86868B] flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
        <h2 id="workspace-tour-title" className="text-sm font-semibold tracking-tight">{current.title}</h2>
        <p id="workspace-tour-body" className="mt-2 text-xs leading-relaxed text-[#6E6E73]">{current.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="min-h-9 px-2 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Skip tour</button>
          <button ref={nextRef} type="button" onClick={() => step === 3 ? close() : setStep(step + 1)} className="min-h-9 rounded-full bg-[#0071E3] hover:bg-[#0077ED] px-4 text-xs font-semibold text-white transition-colors">{step === 3 ? "Got it" : "Next"}</button>
        </div>
      </div>
    </div>, document.body
  );
}
