"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  AIProvider,
  AISettings,
  PROVIDER_REGISTRY,
  loadAISettings,
  saveAISettings,
  maskKey,
} from "@/lib/security/ai-vault";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const [settings, setSettings] = useState<AISettings>(loadAISettings());
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(settings.activeProvider);
  const [apiKey, setApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [jevApiKey, setJevApiKey] = useState<string>("");
  const [showJevKey, setShowJevKey] = useState<boolean>(false);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");
  const [modelInput, setModelInput] = useState<string>(settings.model || "");
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testState, setTestState] = useState<{ status: "idle" | "testing" | "ok" | "err"; msg?: string }>({
    status: "idle",
  });

  useEffect(() => {
    if (isOpen) {
      const current = loadAISettings();
      setSettings(current);
      setSelectedProvider(current.activeProvider);
      setApiKey(current.keys[current.activeProvider] || "");
      setJevApiKey(current.jevApiKey || "");
      setCustomBaseUrl(current.customBaseUrl || "");
      setModelInput(current.model || PROVIDER_REGISTRY[current.activeProvider]?.defaultModel || "");
      setShowKey(false);
      setShowJevKey(false);
      setTestState({ status: "idle" });
      setSavedSuccess(false);
    }
  }, [isOpen]);

  const handleProviderChange = (p: AIProvider) => {
    setSelectedProvider(p);
    setApiKey(settings.keys[p] || "");
    setShowKey(false);
    setTestState({ status: "idle" });
    setModelInput(PROVIDER_REGISTRY[p]?.defaultModel || "");
    setCustomBaseUrl(
      p === "custom" ? settings.customBaseUrl || "http://localhost:11434/v1" : ""
    );
  };

  const handleSave = () => {
    const updated: AISettings = {
      ...settings,
      activeProvider: selectedProvider,
      model: modelInput.trim() || PROVIDER_REGISTRY[selectedProvider]?.defaultModel || "",
      keys: {
        ...settings.keys,
        [selectedProvider]: apiKey.trim(),
      },
      customBaseUrl: customBaseUrl.trim() || undefined,
      jevApiKey: jevApiKey.trim() || undefined,
    };

    saveAISettings(updated);
    setSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleRemoveKey = () => {
    const updatedKeys = { ...settings.keys };
    delete updatedKeys[selectedProvider];
    const updated: AISettings = {
      ...settings,
      keys: updatedKeys,
    };
    saveAISettings(updated);
    setSettings(updated);
    setApiKey("");
    setTestState({ status: "idle" });
  };

  const handleTestKey = async () => {
    if (!apiKey.trim() && selectedProvider !== "custom") {
      setTestState({ status: "err", msg: "Please enter an API key first." });
      return;
    }

    setTestState({ status: "testing", msg: "Verifying key..." });
    const meta = PROVIDER_REGISTRY[selectedProvider];

    try {
      const res = await fetch("/api/ai-copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-ai-stream": "false",
          "x-ai-provider": selectedProvider,
          "x-ai-key": apiKey.trim(),
          "x-ai-model": modelInput.trim() || meta.defaultModel,
          "x-ai-base-url": customBaseUrl.trim(),
        },
        body: JSON.stringify({
          prompt: "Connection test. Respond with OK.",
          context: {
            marketplace: "ALL",
            datePreset: "Today",
            waterfall: { netRevenue: 100, netOperatingProfit: 25, netMarginPercent: 25 },
            trends: {},
            heroSkus: [],
            lossMakingSkus: [],
            channelComparison: [],
            settlementAging: { within7DaysAmount: 0, between8And14DaysAmount: 0, over14DaysOverdueAmount: 0, overdueOrderCount: 0 },
            damagedReturnsToClaim: [],
          },
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success && data.source === "LLM_PROVIDER") {
          setTestState({ status: "ok", msg: "Key verified & active." });
        } else {
          setTestState({
            status: "err",
            msg: data.diagnosticMessage || data.error || "Verification failed.",
          });
        }
      } else {
        const text = await res.text();
        if (res.ok && text.trim()) {
          setTestState({ status: "ok", msg: "Key verified & active." });
        } else {
          setTestState({ status: "err", msg: "Verification failed." });
        }
      }
    } catch (e: any) {
      setTestState({ status: "err", msg: e.message || "Network error." });
    }
  };

  if (!isOpen) return null;

  const currentMeta = PROVIDER_REGISTRY[selectedProvider];
  const hasSavedKey = Boolean(settings.keys[selectedProvider]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="apple-card bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-[460px] overflow-hidden">
        {/* Minimal Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                AI provider settings
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Bring your own key. Stored locally in your browser.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="w-7 h-7 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Clean Form */}
        <div className="p-5 space-y-4 text-xs">
          {/* Provider Select */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#1D1D1F] block">
              Provider
            </label>
            <div className="relative">
              <select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="w-full h-9 pl-3 pr-8 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-medium text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black appearance-none cursor-pointer"
              >
                {(Object.keys(PROVIDER_REGISTRY) as AIProvider[]).map((p) => {
                  const hasKey = Boolean(settings.keys[p]);
                  return (
                    <option key={p} value={p}>
                      {PROVIDER_REGISTRY[p].name} {hasKey ? "✓" : ""}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Custom Base URL if custom provider */}
          {selectedProvider === "custom" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#1D1D1F] block">
                Endpoint URL
              </label>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full h-9 px-3 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          )}

          {/* Model Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#1D1D1F] block">
              Model
            </label>
            {selectedProvider === "custom" ? (
              // Free-text input for Custom/Local — model names are arbitrary
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="e.g. llama3, mistral, qwen2.5"
                className="w-full h-9 px-3 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
              />
            ) : (
              <div className="relative">
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black appearance-none cursor-pointer"
                >
                  {currentMeta.recommendedModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#1D1D1F]">
                API Key
              </label>
              <a
                href={currentMeta.keyDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-0.5 font-medium"
              >
                <span>Get {currentMeta.name.split(" ")[0]} key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentMeta.placeholderKey}
                className="w-full h-9 pl-3 pr-9 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 transition"
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[10px] text-[#86868B] pt-0.5">
              Leave blank to use the built-in deterministic offline engine.
            </p>
          </div>

          {/* Jev System 1 Acceleration Key */}
          <div className="pt-2 border-t border-black/[0.05] space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#1D1D1F]">
                  TypeSafe / Jev acceleration
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-medium border border-[#0071E3]/20">
                  {jevApiKey ? "⚡ Jev Key Set" : "Local Tier Ready"}
                </span>
              </div>
              <a
                href="https://typesafe.ai"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-0.5 font-medium"
              >
                <span>Get Jev key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="relative flex items-center">
              <input
                type={showJevKey ? "text" : "password"}
                value={jevApiKey}
                onChange={(e) => setJevApiKey(e.target.value)}
                placeholder="ts_live_... (Optional — unlocks sub-100ms routing)"
                className="w-full h-9 pl-3 pr-9 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="button"
                onClick={() => setShowJevKey(!showJevKey)}
                aria-label={showJevKey ? "Hide key" : "Show key"}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 transition"
                title={showJevKey ? "Hide" : "Show"}
              >
                {showJevKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[10px] text-[#86868B] pt-0.5">
              Powers instant sub-100ms intent routing and CSV mapping. When blank, uses OpenRouter or the built-in local engine.
            </p>
          </div>

          {/* Inline Test Feedback */}
          {testState.status !== "idle" && (
            <div
              className={`py-1.5 px-3 rounded-xl text-[11px] flex items-center gap-2 ${
                testState.status === "testing"
                  ? "bg-[#F5F5F7] text-[#1D1D1F]"
                  : testState.status === "ok"
                  ? "bg-[#288548]/10 text-[#288548] border border-[#288548]/20"
                  : "bg-[#D70015]/10 text-[#D70015] border border-[#D70015]/20"
              }`}
            >
              {testState.status === "testing" && <RefreshCw className="w-3 h-3 animate-spin shrink-0" />}
              {testState.status === "ok" && <Check className="w-3 h-3 text-[#288548] shrink-0" />}
              {testState.status === "err" && <AlertCircle className="w-3 h-3 text-[#D70015] shrink-0" />}
              <span className="font-medium">{testState.msg}</span>
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="px-5 py-3.5 border-t border-black/[0.06] bg-[#FBFBFD] flex items-center justify-between">
          <div>
            {hasSavedKey && (
              <button
                type="button"
                onClick={handleRemoveKey}
                className="text-[11px] text-[#D70015] hover:text-black font-medium transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove key</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={testState.status === "testing"}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] transition cursor-pointer shadow-apple-sm btn-press"
            >
              Test
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white font-medium text-xs shadow-apple-sm btn-press transition cursor-pointer flex items-center gap-1"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#288548]" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
