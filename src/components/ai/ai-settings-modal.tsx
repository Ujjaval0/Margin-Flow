"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  Sparkles,
  Zap,
  Sliders,
  ShieldCheck,
} from "lucide-react";
import {
  AIProvider,
  AISettings,
  PROVIDER_REGISTRY,
  DiscoveredModel,
  loadAISettings,
  saveAISettings,
  purgeAISettings,
  fetchLiveModels,
  verifyConnection,
  getCachedModels,
} from "@/lib/security/ai-vault";

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const [settings, setSettings] = useState<AISettings>(loadAISettings());
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(settings.activeProvider);
  const [apiKey, setApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [modelInput, setModelInput] = useState<string>(settings.model || "");
  const [isCustomModelMode, setIsCustomModelMode] = useState<boolean>(false);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // TypeSafe Jev optional tier
  const [jevApiKey, setJevApiKey] = useState<string>("");
  const [showJevKey, setShowJevKey] = useState<boolean>(false);

  // Dynamic live models
  const [liveModels, setLiveModels] = useState<DiscoveredModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  // Verification state
  const [testState, setTestState] = useState<{
    status: "idle" | "testing" | "ok" | "err";
    msg?: string;
    latencyMs?: number;
  }>({ status: "idle" });

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const currentMeta = PROVIDER_REGISTRY[selectedProvider] || PROVIDER_REGISTRY["gemini"];
  const hasSavedKey = Boolean(settings.keys[selectedProvider]);

  // Combined available models: Live models + Recommended models
  const combinedModelsList = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string; isLive?: boolean }> = [];

    // Add live models first if fetched
    liveModels.forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({
          id: m.id,
          label: m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id,
          isLive: true,
        });
      }
    });

    // Add recommended models
    (currentMeta?.recommendedModels || []).forEach((mId) => {
      if (!seen.has(mId)) {
        seen.add(mId);
        list.push({
          id: mId,
          label: mId,
          isLive: false,
        });
      }
    });

    return list;
  }, [liveModels, currentMeta]);

  // Load initial settings when modal opens
  useEffect(() => {
    if (isOpen) {
      const current = loadAISettings();
      setSettings(current);
      setSelectedProvider(current.activeProvider);
      const activeKey = current.keys[current.activeProvider] || "";
      setApiKey(activeKey);
      setJevApiKey(current.jevApiKey || "");
      setCustomBaseUrl(current.customBaseUrl || "");

      const activeModel = current.model || PROVIDER_REGISTRY[current.activeProvider]?.defaultModel || "";
      setModelInput(activeModel);

      // Check if current model is in recommended list
      const recs = PROVIDER_REGISTRY[current.activeProvider]?.recommendedModels || [];
      const cached = getCachedModels(current.activeProvider);
      setLiveModels(cached);

      const isKnown = recs.includes(activeModel) || cached.some((m) => m.id === activeModel);
      setIsCustomModelMode(!isKnown && activeModel.length > 0 && current.activeProvider !== "custom");

      setShowKey(false);
      setShowJevKey(false);
      setTestState({ status: "idle" });
      setSavedSuccess(false);
      setShowAdvanced(Boolean(current.customBaseUrl));
    }
  }, [isOpen]);

  // Provider change handler
  const handleProviderChange = (p: AIProvider) => {
    setSelectedProvider(p);
    const existingKey = settings.keys[p] || "";
    setApiKey(existingKey);
    setShowKey(false);
    setTestState({ status: "idle" });

    // Load cached models for provider
    const cached = getCachedModels(p);
    setLiveModels(cached);

    const defaultM = PROVIDER_REGISTRY[p]?.defaultModel || "";
    setModelInput(defaultM);
    setIsCustomModelMode(p === "custom");

    setCustomBaseUrl(p === "custom" ? settings.customBaseUrl || "http://localhost:11434/v1" : "");
  };

  // Fetch live models on demand
  const handleFetchModels = async () => {
    if (!apiKey.trim() && selectedProvider !== "custom") {
      setTestState({
        status: "err",
        msg: "Enter your API key first to discover available models.",
      });
      return;
    }

    setIsFetchingModels(true);
    setTestState({ status: "testing", msg: "Querying provider model catalog..." });

    const result = await fetchLiveModels(selectedProvider, apiKey.trim(), customBaseUrl.trim());
    setIsFetchingModels(false);

    if (result.success && result.models.length > 0) {
      setLiveModels(result.models);
      setTestState({
        status: "ok",
        msg: `Found ${result.models.length} available models from ${PROVIDER_REGISTRY[selectedProvider].name}.`,
      });
      // If current model is empty, default to first or defaultModel
      if (!modelInput) {
        setModelInput(result.models[0]?.id || PROVIDER_REGISTRY[selectedProvider].defaultModel);
      }
    } else {
      setTestState({
        status: "err",
        msg: result.diagnosticMessage || "Could not retrieve models. Using curated defaults.",
      });
    }
  };

  // Test API Key & Model connection
  const handleTestConnection = async () => {
    if (!apiKey.trim() && selectedProvider !== "custom") {
      setTestState({ status: "err", msg: "Please enter an API key first." });
      return;
    }

    setTestState({ status: "testing", msg: "Verifying credentials & latency..." });

    const result = await verifyConnection(
      selectedProvider,
      apiKey.trim(),
      modelInput.trim(),
      customBaseUrl.trim()
    );

    if (result.success) {
      if (result.models && result.models.length > 0) {
        setLiveModels(result.models);
      }
      setTestState({
        status: "ok",
        msg: result.diagnosticMessage,
        latencyMs: result.latencyMs,
      });
    } else {
      setTestState({
        status: "err",
        msg: result.diagnosticMessage || "Verification failed.",
        latencyMs: result.latencyMs,
      });
    }
  };

  // Save updated settings
  const handleSave = () => {
    const finalModel = modelInput.trim() || PROVIDER_REGISTRY[selectedProvider]?.defaultModel || "";

    const updated: AISettings = {
      ...settings,
      activeProvider: selectedProvider,
      model: finalModel,
      keys: {
        ...settings.keys,
        [selectedProvider]: apiKey.trim(),
      },
      customBaseUrl: customBaseUrl.trim() || undefined,
      jevApiKey: jevApiKey.trim() || undefined,
      enableJevAcceleration: true,
    };

    saveAISettings(updated);
    setSettings(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 700);
  };

  // Remove key for current provider
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

  // Purge all keys
  const handlePurgeAll = () => {
    if (window.confirm("Purge all stored AI keys from this browser? This cannot be undone.")) {
      purgeAISettings();
      setSettings(loadAISettings());
      setApiKey("");
      setJevApiKey("");
      setTestState({ status: "idle" });
      onClose();
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="apple-card bg-white rounded-3xl shadow-apple-lg border border-black/[0.08] w-full max-w-[480px] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Apple-grade Header */}
        <div className="px-5 py-3.5 border-b border-black/[0.06] flex items-center justify-between bg-[#FBFBFD] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black/[0.04] flex items-center justify-center text-[#1D1D1F]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                AI Provider & Model Settings
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Bring your own key. Stored zero-knowledge in your browser.
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

        {/* Scrollable Form Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Provider Select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#1D1D1F] block">
                AI Service Provider
              </label>
              {hasSavedKey && (
                <span className="text-[10px] text-[#288548] font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Key configured
                </span>
              )}
            </div>

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

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#1D1D1F]">
                {currentMeta.name} API Key
              </label>
              <a
                href={currentMeta.keyDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-0.5 font-medium"
              >
                <span>Get API key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestState({ status: "idle" });
                }}
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
            <p className="text-[10px] text-[#86868B]">
              Leave blank to automatically use MarginFlow&apos;s offline deterministic engine.
            </p>
          </div>

          {/* Model Selection (Hybrid: Dropdown + Live Fetch + Custom Input) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-[#1D1D1F]">
                  Model
                </label>
                {liveModels.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#288548]/10 text-[#288548] font-medium border border-[#288548]/20">
                    Live ({liveModels.length})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  title="Query provider for active models"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isFetchingModels ? "animate-spin" : ""}`} />
                  <span>Fetch latest models</span>
                </button>

                {selectedProvider !== "custom" && (
                  <button
                    type="button"
                    onClick={() => setIsCustomModelMode(!isCustomModelMode)}
                    className="text-[10px] text-[#86868B] hover:text-[#1D1D1F] underline cursor-pointer"
                  >
                    {isCustomModelMode ? "Select list" : "Enter custom"}
                  </button>
                )}
              </div>
            </div>

            {isCustomModelMode || selectedProvider === "custom" ? (
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="e.g. anthropic/claude-3.7-sonnet or deepseek-r1"
                className="w-full h-9 px-3 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
              />
            ) : (
              <div className="relative">
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black appearance-none cursor-pointer"
                >
                  {combinedModelsList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} {m.isLive ? "• live" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Diagnostic Verification Status Pill */}
          {testState.status !== "idle" && (
            <div
              className={`p-2.5 rounded-xl text-[11px] flex items-start gap-2.5 transition animate-in fade-in duration-150 ${
                testState.status === "testing"
                  ? "bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.06]"
                  : testState.status === "ok"
                  ? "bg-[#288548]/10 text-[#288548] border border-[#288548]/20"
                  : "bg-[#D70015]/10 text-[#D70015] border border-[#D70015]/20"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {testState.status === "testing" && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {testState.status === "ok" && <Check className="w-3.5 h-3.5 text-[#288548]" />}
                {testState.status === "err" && <AlertCircle className="w-3.5 h-3.5 text-[#D70015]" />}
              </div>
              <div className="flex-1 leading-snug">
                <span className="font-semibold block">
                  {testState.status === "testing"
                    ? "Testing Connection..."
                    : testState.status === "ok"
                    ? `Connected ${testState.latencyMs ? `(${testState.latencyMs}ms)` : ""}`
                    : "Connection Notice"}
                </span>
                <span className="text-[10px] opacity-90">{testState.msg}</span>
              </div>
            </div>
          )}

          {/* TypeSafe / Jev Acceleration (Clearly Optional Tier) */}
          <div className="pt-2 border-t border-black/[0.05] space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#1D1D1F] flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#0071E3]" />
                  <span>Speed & Intent Acceleration</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-black/[0.04] text-[#1D1D1F] font-medium border border-black/[0.06]">
                  {jevApiKey ? "⚡ Jev Key Active" : "Local Tier (0ms)"}
                </span>
              </div>
              <a
                href="https://typesafe.ai"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#0071E3] hover:underline flex items-center gap-0.5 font-medium"
              >
                <span>TypeSafe Jev</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="relative flex items-center">
              <input
                type={showJevKey ? "text" : "password"}
                value={jevApiKey}
                onChange={(e) => setJevApiKey(e.target.value)}
                placeholder="ts_live_... (100% Optional)"
                className="w-full h-8 pl-3 pr-8 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs font-mono text-[#1D1D1F] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="button"
                onClick={() => setShowJevKey(!showJevKey)}
                aria-label={showJevKey ? "Hide key" : "Show key"}
                className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 transition"
              >
                {showJevKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>

            <p className="text-[10px] text-[#86868B] leading-tight">
              Optional. MarginFlow already includes a built-in 0ms local intent classifier. Add a TypeSafe Jev key only if you want remote System One routing.
            </p>
          </div>

          {/* Advanced Endpoint URL Collapsible */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-1 font-medium cursor-pointer"
            >
              <Sliders className="w-2.5 h-2.5" />
              <span>{showAdvanced ? "Hide endpoint settings" : "Custom endpoint / Base URL"}</span>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-2.5 bg-[#F5F5F7] rounded-xl space-y-1.5 border border-black/[0.04]">
                <label className="text-[10px] font-semibold text-[#1D1D1F] block">
                  Custom Base URL (vLLM, Ollama, Reverse Proxy)
                </label>
                <input
                  type="text"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder={currentMeta.defaultBaseUrl || "http://localhost:11434/v1"}
                  className="w-full h-8 px-2.5 bg-white rounded-lg border border-black/[0.08] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            )}
          </div>
        </div>

        {/* Minimal Apple-grade Footer */}
        <div className="px-5 py-3 border-t border-black/[0.06] bg-[#FBFBFD] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {hasSavedKey && (
              <button
                type="button"
                onClick={handleRemoveKey}
                className="text-[11px] text-[#D70015] hover:underline font-medium transition cursor-pointer flex items-center gap-1"
                title="Remove saved key for this provider"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove key</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePurgeAll}
              className="text-[10px] text-[#86868B] hover:text-black transition cursor-pointer"
              title="Purge all credentials"
            >
              Purge all
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testState.status === "testing"}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-black/[0.06] transition cursor-pointer shadow-apple-sm btn-press flex items-center gap-1.5"
            >
              {testState.status === "testing" ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test</span>
              )}
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
    </div>,
    document.body
  );
}
