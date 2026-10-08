"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Send,
  Settings2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { usePlatform } from "@/domain/store";
import { serializeFinancialContext, AIActionChip } from "@/domain/ai-context";
import { loadAISettings, AISettings, PROVIDER_REGISTRY } from "@/lib/security/ai-vault";
import { computeAnomalyRadar } from "@/domain/anomaly-radar";
import { parseResponseAndChips } from "@/domain/deterministic-analyst";
import { formatINR } from "@/lib/utils";
import { AssistantEmblem } from "./assistant-emblem";
import { InfinityLoop } from "@/components/ui/infinity-loop";
import type { SkuEconomicsItem } from "@/components/modals/sku-drawer";

const AISettingsModal = dynamic(
  () => import("./ai-settings-modal").then((mod) => mod.AISettingsModal),
  { ssr: false }
);

const SkuDrawer = dynamic(
  () => import("@/components/modals/sku-drawer").then((mod) => mod.SkuDrawer),
  { ssr: false }
);

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  chips?: AIActionChip[];
  source?: string;
  diagnosticMessage?: string | null;
  timestamp: string;
}

function ChatLoadingIndicator() {
  return (
    <div
      role="status"
      aria-label="Loading response"
      className="py-1 px-1 inline-flex items-center animate-in fade-in duration-150 select-none"
    >
      <InfinityLoop className="w-6 h-6 text-[#1D1D1F]" />
    </div>
  );
}

function FormattedMessageText({ text, isUser }: { text?: string; isUser: boolean }) {
  if (!text || typeof text !== "string") {
    return null;
  }
  if (isUser) {
    return <p className="whitespace-pre-line text-xs">{text}</p>;
  }

  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs text-[#1D1D1F] leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          const headingText = trimmed.replace(/^#+\s+/, "");
          return (
            <h4
              key={idx}
              className="font-semibold text-xs text-[#1D1D1F] mt-2 pt-1 border-t border-black/[0.04] first:mt-0 first:pt-0 first:border-0"
            >
              {headingText}
            </h4>
          );
        }

        const romanMatch = trimmed.match(/^([IVXLCDM]+)\.\s+(.*)$/i);
        if (romanMatch) {
          const numeral = romanMatch[1].toUpperCase();
          const content = romanMatch[2];
          const parts = parseInlineFormatting(content);
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="text-[#1D1D1F] font-semibold text-[11px] shrink-0 select-none min-w-[20px]">{numeral}.</span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberMatch) {
          const num = numberMatch[1];
          const content = numberMatch[2];
          const parts = parseInlineFormatting(content);
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="text-[#1D1D1F] font-semibold text-[11px] shrink-0 select-none min-w-[16px]">{num}.</span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        const isBullet = /^[•\-*]\s+/.test(trimmed);
        const content = isBullet ? trimmed.replace(/^[•\-*]\s+/, "") : line;
        const parts = parseInlineFormatting(content);

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="text-[#86868B] font-bold text-[10px] mt-0.5 select-none shrink-0">•</span>
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return <p key={idx}>{parts}</p>;
      })}
    </div>
  );
}

function parseInlineFormatting(text?: string): React.ReactNode[] {
  if (!text || typeof text !== "string") {
    return [];
  }
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const segments = text.split(regex);

  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#1D1D1F]">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-black/[0.05] font-mono text-[11px] text-[#1D1D1F] font-medium"
        >
          {seg.slice(1, -1)}
        </code>
      );
    }
    return seg;
  });
}

export function CfoCopilot() {
  const router = useRouter();
  const platform = usePlatform();

  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings>(loadAISettings());
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inspectingSku, setInspectingSku] = useState<SkuEconomicsItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automated Financial Anomaly Radar (Zero Hallucinated Math)
  const anomalyBriefing = useMemo(() => {
    return computeAnomalyRadar({
      orders: platform.orders,
      returns: platform.returns,
      settlements: platform.settlements,
      products: platform.products,
      claims: platform.claims,
    });
  }, [platform.orders, platform.returns, platform.settlements, platform.products, platform.claims]);

  const handleGenerateAnomalyRadar = () => {
    if (anomalyBriefing.totalAnomaliesCount === 0) {
      const cleanMsg: ChatMessage = {
        id: `msg-asst-${Date.now()}`,
        sender: "assistant",
        text: "Zero operational anomalies detected. Carrier billing, marketplace fees, and settlements are on schedule.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, cleanMsg]);
      return;
    }

    const anomalySummary = anomalyBriefing.items
      .map((it, idx) => {
        const numerals = ["I", "II", "III", "IV", "V"];
        const num = numerals[idx] || "•";
        return `${num}. ${it.title} (${it.metricHighlight}): ${it.description}`;
      })
      .join("\n\n");

    const chips: AIActionChip[] = anomalyBriefing.items.slice(0, 2).map((it) => ({
      id: `chip-radar-${it.id}`,
      label: `${it.actionLabel} ➔`,
      type: "NAVIGATE",
      payload: { route: `/${it.actionModule}` },
    }));

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: "Scan operational anomalies",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const asstMsg: ChatMessage = {
      id: `msg-asst-${Date.now() + 1}`,
      sender: "assistant",
      text: `I reviewed your store numbers and identified ${anomalyBriefing.totalAnomaliesCount} operational areas with a total exposure of ${formatINR(anomalyBriefing.totalExposureAmount)}.\n\n${anomalySummary}`,
      chips,
      source: "MarginFlow Anomaly Engine",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
  };

  // Sync settings when updated in modal
  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      setAiSettings(e.detail || loadAISettings());
    };
    window.addEventListener("marginflow_ai_settings_updated", handleSettingsUpdate);
    return () => window.removeEventListener("marginflow_ai_settings_updated", handleSettingsUpdate);
  }, []);

  // Global event listener to open copilot from Navbar or anywhere
  useEffect(() => {
    const handleOpenCopilot = () => setIsOpen(true);
    window.addEventListener("marginflow_open_copilot", handleOpenCopilot);
    return () => window.removeEventListener("marginflow_open_copilot", handleOpenCopilot);
  }, []);

  // Keyboard shortcut Ctrl+J / Cmd+J to toggle copilot, and Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Initial clean welcome message (simple 2-line greeting, zero unprompted chips)
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "msg-init",
          sender: "assistant",
          text: "Hello! I'm Flow, your store assistant.\nAsk me anything about your sales, profits, returns, or store metrics.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, []);

  const handleSendMessage = async (queryText?: string) => {
    const query = (queryText || inputQuery).trim();
    if (!query || isLoading) return;

    const qLower = query.toLowerCase();

    // Client-side off-topic guardrail (saves API cost, instant response)
    const isOffTopic =
      qLower.includes("movie") ||
      qLower.includes("film") ||
      qLower.includes("cinema") ||
      qLower.includes("music") ||
      qLower.includes("song") ||
      qLower.includes("singer") ||
      qLower.includes("actor") ||
      qLower.includes("actress") ||
      qLower.includes("hollywood") ||
      qLower.includes("bollywood") ||
      qLower.includes("netflix") ||
      qLower.includes("spotify") ||
      qLower.includes("youtube") ||
      qLower.includes("cricket") ||
      qLower.includes("football") ||
      qLower.includes("sports") ||
      qLower.includes("ipl") ||
      qLower.includes("weather") ||
      qLower.includes("news") ||
      qLower.includes("politics") ||
      qLower.includes("election") ||
      qLower.includes("game") ||
      qLower.includes("gaming") ||
      qLower.includes("recipe") ||
      qLower.includes("cooking") ||
      qLower.includes("dating") ||
      qLower.includes("explicit") ||
      qLower.includes("porn") ||
      qLower.includes("sex");

    if (isOffTopic) {
      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        sender: "user",
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const guardrailMsg: ChatMessage = {
        id: `msg-guard-${Date.now() + 1}`,
        sender: "assistant",
        text: "I'm dedicated exclusively as your store assistant to help you understand and manage your MarginFlow data — such as your sales, profit margins, orders, returns, and inventory. Let me know what you'd like to explore in your numbers!",
        chips: [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg, guardrailMsg]);
      setInputQuery("");
      return;
    }

    if (
      qLower.includes("anomaly") ||
      qLower.includes("radar") ||
      qLower.includes("fee creep") ||
      qLower.includes("overcharge")
    ) {
      handleGenerateAnomalyRadar();
      setInputQuery("");
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      // 1. Serialize deterministic financial context
      const context = serializeFinancialContext({
        selectedMarketplace: platform.selectedMarketplace,
        datePreset: platform.datePreset,
        profitability: platform.profitability,
        profitabilityTrends: platform.profitabilityTrends,
        skuBreakdown: platform.skuBreakdown,
        marketplaceBreakdown: platform.marketplaceBreakdown,
        settlementAging: platform.settlementAging,
        returns: platform.returns,
        claims: platform.claims,
        orders: platform.orders,
      });

      // 2. Fetch from secure ephemeral proxy
      const activeKey = aiSettings.keys[aiSettings.activeProvider] || "";
      const res = await fetch("/api/ai-copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-provider": aiSettings.activeProvider,
          "x-ai-key": activeKey,
          "x-ai-model": aiSettings.model,
          "x-ai-base-url": aiSettings.customBaseUrl || "",
        },
        body: JSON.stringify({ prompt: query, context }),
      });

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success) {
          const assistantMsg: ChatMessage = {
            id: `msg-asst-${Date.now()}`,
            sender: "assistant",
            text: data.answer,
            chips: data.chips || [],
            source: data.source,
            diagnosticMessage: data.diagnosticMessage || null,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          throw new Error(data.error || "Failed to analyze query.");
        }
      } else {
        // Vercel AI SDK text stream
        const assistantMsgId = `msg-asst-${Date.now()}`;
        const sourceHeader = res.headers.get("x-ai-source") || "LLM_PROVIDER";

        const initialAssistantMsg: ChatMessage = {
          id: assistantMsgId,
          sender: "assistant",
          text: "",
          source: sourceHeader,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, initialAssistantMsg]);
        setIsLoading(false);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedText += chunk;

            // Strip action_chips fence from live visible text
            let visibleText = accumulatedText;
            const chipBlockStart = visibleText.indexOf("```action_chips");
            if (chipBlockStart !== -1) {
              visibleText = visibleText.slice(0, chipBlockStart).trimEnd();
            } else {
              const fenceStart = visibleText.indexOf("```json");
              if (fenceStart !== -1 && visibleText.includes('"type"')) {
                visibleText = visibleText.slice(0, fenceStart).trimEnd();
              }
            }

            // Strip markdown asterisks & headers from live streaming buffer
            visibleText = visibleText.replace(/\*\*(.*?)\*\*/g, "$1").replace(/^#+\s+/gm, "");

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, text: visibleText } : msg
              )
            );
          }
        }

        // Stream completed: finalize answer and parse action chips
        const { answer, chips } = parseResponseAndChips(accumulatedText, context);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, text: answer, chips } : msg
          )
        );
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: "assistant",
        text: `Unable to reach ${PROVIDER_REGISTRY[aiSettings.activeProvider]?.name || "AI Provider"}: ${err.message || "Network error"}. You can run this with the built-in offline engine or switch your provider in settings.`,
        chips: [
          {
            id: `chip-offline-${Date.now()}`,
            label: "⚡ Run with Offline Engine",
            type: "NAVIGATE",
            payload: { query },
          },
          {
            id: `chip-settings-${Date.now()}`,
            label: "⚙️ Switch AI Provider",
            type: "NAVIGATE",
            payload: { action: "OPEN_SETTINGS" },
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute Action Chips directly in the UI
  const handleChipClick = (chip: AIActionChip) => {
    if (chip.payload?.action === "OPEN_SETTINGS") {
      setIsSettingsOpen(true);
      return;
    }

    if (chip.payload?.query) {
      handleSendMessage(chip.payload.query);
      return;
    }

    if (chip.type === "SET_CHANNEL" && chip.payload?.channel) {
      platform.setSelectedMarketplace(chip.payload.channel);
      return;
    }

    if (chip.type === "NAVIGATE" && chip.payload?.route) {
      router.push(chip.payload.route);
      setIsOpen(false);
      return;
    }

    if (chip.type === "INSPECT_SKU" && chip.payload?.sku) {
      const target = platform.skuBreakdown.find((s) => s.sku === chip.payload.sku);
      if (target) {
        setInspectingSku({
          sku: target.sku,
          productName: target.productName,
          unitsSold: target.unitsSold,
          revenue: target.revenue,
          cogs: target.cogs,
          marketplaceCharges: target.marketplaceCharges,
          returnLosses: target.returnLosses,
          profit: target.profit,
          margin: target.margin,
          adSpend: target.adSpend,
          poas: target.poas,
          returnRate: target.returnRate,
        });
      }
      return;
    }

    if (chip.type === "DRAFT_CLAIM") {
      window.dispatchEvent(
        new CustomEvent("marginflow_open_dispute_modal", {
          detail: { returnId: chip.payload?.returnId },
        })
      );
      setIsOpen(false);
      return;
    }
  };

  const activeProviderMeta = PROVIDER_REGISTRY[aiSettings.activeProvider];
  const hasKey = Boolean(aiSettings.keys[aiSettings.activeProvider]);

  return (
    <>
      {/* Slide-Over Drawer Shell */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur */}
          <div
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white/95 backdrop-blur-xl shadow-apple-lg border-l border-black/[0.08] flex flex-col animate-in slide-in-from-right duration-250">
              {/* Apple-Inspired Minimalist Header */}
              <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <AssistantEmblem className="w-5 h-5 text-[#1D1D1F] shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                      Flow
                    </span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-black/[0.04] text-[#6E6E73]">
                      Store Assistant
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Minimal Provider Badge */}
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-2.5 py-1 rounded-full hover:bg-black/[0.04] text-[11px] font-medium text-[#6E6E73] flex items-center gap-1.5 transition cursor-pointer"
                    title="AI Settings"
                    aria-label="AI Settings"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-[#288548]" : "bg-black/20"}`}
                    />
                    <span>{hasKey ? activeProviderMeta.name.split(" ")[0] : "Local"}</span>
                    <Settings2 className="w-3 h-3 text-[#86868B]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close assistant"
                    className="w-7 h-7 rounded-full hover:bg-black/[0.04] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>



              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-[#F5F5F7]/40">
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  if (!isUser && !msg.text) {
                    return (
                      <div key={msg.id} className="flex flex-col items-start">
                        <ChatLoadingIndicator />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-[88%] leading-relaxed ${
                          isUser
                            ? "bg-[#1D1D1F] text-white rounded-tr-xs shadow-apple-sm"
                            : "bg-white border border-black/[0.06] text-[#1D1D1F] rounded-tl-xs shadow-apple-sm"
                        }`}
                      >
                        <FormattedMessageText text={msg.text} isUser={isUser} />

                        {/* Diagnostic Banner — shown when API failed and local engine answered */}
                        {!isUser && msg.diagnosticMessage && (
                          <div className="mt-2.5 pt-2 border-t border-black/[0.06] flex items-start gap-1.5">
                            <AlertCircle className="w-3 h-3 text-[#B25E00] shrink-0 mt-0.5" />
                            <p className="text-[10px] text-[#B25E00] leading-relaxed">
                              {msg.diagnosticMessage}
                            </p>
                          </div>
                        )}

                        {/* Interactive Action Chips */}
                        {msg.chips && msg.chips.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-black/[0.06] flex flex-wrap gap-1.5">
                            {msg.chips.map((chip) => (
                              <button
                                key={chip.id}
                                type="button"
                                onClick={() => handleChipClick(chip)}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-black/[0.03] active:scale-98 border border-black/[0.08] text-[11px] font-medium text-[#1D1D1F] flex items-center gap-1 shadow-apple-sm btn-press transition cursor-pointer"
                              >
                                <span>{chip.label}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-[#86868B]" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex flex-col items-start">
                    <ChatLoadingIndicator />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 border-t border-black/[0.06] bg-white/80 backdrop-blur-md shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage().catch((err) => {
                      console.error("Copilot message error:", err);
                    });
                  }}
                  className="flex items-center gap-2 bg-[#FAFAFC] border border-black/[0.08] rounded-xl px-2.5 py-1.5 focus-within:border-black/25 focus-within:bg-white transition shadow-apple-sm"
                >
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask about sales, profit margins, orders, returns..."
                    className="flex-1 h-8 px-1 text-xs bg-transparent text-[#1D1D1F] placeholder:text-[#86868B] outline-none border-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 shadow-none"
                    style={{ outline: "none", boxShadow: "none" }}
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!inputQuery.trim() || isLoading}
                    className="w-7 h-7 rounded-lg bg-[#1D1D1F] hover:bg-black disabled:opacity-30 text-white flex items-center justify-center transition cursor-pointer shrink-0 shadow-apple-sm btn-press"
                  >
                    <Send className="w-3 h-3" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* SKU Inspection Drawer (triggered via Action Chip) */}
      <SkuDrawer
        skuData={inspectingSku}
        onClose={() => setInspectingSku(null)}
        isAcknowledgedLossLeader={
          inspectingSku ? platform.acknowledgedLossLeaderSkus?.includes(inspectingSku.sku) : false
        }
        onToggleLossLeader={platform.toggleLossLeaderAcknowledgment}
      />
    </>
  );
}
