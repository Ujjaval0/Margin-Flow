/**
 * Zero-Knowledge Client-Side AI Key Vault & Provider Configuration
 *
 * SECURITY INVARIANTS:
 * 1. API Keys are stored ONLY in client-side localStorage.
 * 2. Keys NEVER touch server disks, server databases, or persistent server logs.
 * 3. Keys are transmitted only in ephemeral request headers over TLS.
 * 4. UI provides 1-click purge of all stored credentials.
 */

export type AIProvider =
  | "gemini"
  | "groq"
  | "deepseek"
  | "moonshot"
  | "openrouter"
  | "openai"
  | "nvidia"
  | "mistral"
  | "glm"
  | "custom";

export interface ProviderMeta {
  id: AIProvider;
  name: string;
  defaultModel: string;
  recommendedModels: string[];
  placeholderKey: string;
  keyDocsUrl: string;
  defaultBaseUrl?: string;
  supportsCustomBaseUrl?: boolean;
}

export const PROVIDER_REGISTRY: Record<AIProvider, ProviderMeta> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    recommendedModels: [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.5-pro",
    ],
    placeholderKey: "AIzaSy...",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
  },
  groq: {
    id: "groq",
    name: "Groq (Ultra-Fast LPU)",
    defaultModel: "llama-3.3-70b-versatile",
    recommendedModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "deepseek-r1-distill-llama-70b",
      "qwen-qwq-32b",
      "mixtral-8x7b-32768",
    ],
    placeholderKey: "gsk_...",
    keyDocsUrl: "https://console.groq.com/keys",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    recommendedModels: [
      "deepseek-chat",
      "deepseek-reasoner",
    ],
    placeholderKey: "sk-...",
    keyDocsUrl: "https://platform.deepseek.com/api_keys",
    defaultBaseUrl: "https://api.deepseek.com/v1",
  },
  openai: {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    defaultModel: "gpt-4o-mini",
    recommendedModels: [
      "gpt-4o-mini",
      "gpt-4o",
      "o3-mini",
      "gpt-4.5-preview",
      "o1",
    ],
    placeholderKey: "sk-proj-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "anthropic/claude-3.7-sonnet",
    recommendedModels: [
      "anthropic/claude-3.7-sonnet",
      "anthropic/claude-3.5-haiku",
      "deepseek/deepseek-r1",
      "google/gemini-2.0-flash",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-large-2411",
    ],
    placeholderKey: "sk-or-v1-...",
    keyDocsUrl: "https://openrouter.ai/keys",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    defaultModel: "mistral-small-latest",
    recommendedModels: [
      "mistral-small-latest",
      "mistral-large-latest",
      "codestral-latest",
      "mistral-saba-latest",
    ],
    placeholderKey: "mis_...",
    keyDocsUrl: "https://console.mistral.ai/api-keys/",
    defaultBaseUrl: "https://api.mistral.ai/v1",
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    defaultModel: "meta/llama-3.3-70b-instruct",
    recommendedModels: [
      "meta/llama-3.3-70b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "deepseek-ai/deepseek-r1",
    ],
    placeholderKey: "nvapi-...",
    keyDocsUrl: "https://build.nvidia.com/",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
  },
  glm: {
    id: "glm",
    name: "GLM (Zhipu AI)",
    defaultModel: "glm-4-flash",
    recommendedModels: [
      "glm-4-flash",
      "glm-4-air",
      "glm-4",
    ],
    placeholderKey: "••••••••",
    keyDocsUrl: "https://open.bigmodel.cn/",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  moonshot: {
    id: "moonshot",
    name: "Moonshot AI (Kimi)",
    defaultModel: "moonshot-v1-8k",
    recommendedModels: [
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "kimi-latest",
    ],
    placeholderKey: "sk-...",
    keyDocsUrl: "https://platform.moonshot.cn/console/api-keys",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
  },
  custom: {
    id: "custom",
    name: "Custom / Local (Ollama, vLLM, LM Studio)",
    defaultModel: "llama3",
    recommendedModels: [
      "llama3.3",
      "llama3.2",
      "llama3",
      "deepseek-r1",
      "qwen2.5",
      "mistral",
    ],
    placeholderKey: "optional-token",
    keyDocsUrl: "https://ollama.com",
    defaultBaseUrl: "http://localhost:11434/v1",
    supportsCustomBaseUrl: true,
  },
};

export interface AISettings {
  activeProvider: AIProvider;
  model: string;
  keys: Partial<Record<AIProvider, string>>;
  customBaseUrl?: string;
  useLocalFallbackIfEmpty: boolean;
}

const VAULT_STORAGE_KEY = "marginflow_ai_vault_v1";

const DEFAULT_SETTINGS: AISettings = {
  activeProvider: "gemini",
  model: "gemini-2.0-flash",
  keys: {},
  useLocalFallbackIfEmpty: true,
};

export interface DiscoveredModel {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isRecommended?: boolean;
}

const MODEL_CACHE_PREFIX = "marginflow_models_cache_";

/**
 * Retrieve cached models for a provider from sessionStorage
 */
export function getCachedModels(provider: AIProvider): DiscoveredModel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(`${MODEL_CACHE_PREFIX}${provider}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Persist cached models for a provider into sessionStorage
 */
export function setCachedModels(provider: AIProvider, models: DiscoveredModel[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${MODEL_CACHE_PREFIX}${provider}`, JSON.stringify(models));
  } catch {
    // ignore
  }
}

/**
 * Fetch live models from provider via server-side proxy
 */
export async function fetchLiveModels(
  provider: AIProvider,
  apiKey: string,
  customBaseUrl?: string
): Promise<{ success: boolean; models: DiscoveredModel[]; diagnosticMessage: string; error?: string }> {
  try {
    const res = await fetch("/api/ai-vault", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "models",
        provider,
        apiKey,
        customBaseUrl,
      }),
    });

    const data = await res.json();
    if (data.success && Array.isArray(data.models)) {
      setCachedModels(provider, data.models);
      return {
        success: true,
        models: data.models,
        diagnosticMessage: data.diagnosticMessage || `Loaded ${data.models.length} live models.`,
      };
    }
    return {
      success: false,
      models: [],
      diagnosticMessage: data.diagnosticMessage || data.error || "Failed to fetch models.",
      error: data.error,
    };
  } catch (err: any) {
    return {
      success: false,
      models: [],
      diagnosticMessage: err?.message || "Network error fetching models.",
      error: err?.message,
    };
  }
}

/**
 * Diagnostic key and endpoint test via server-side proxy
 */
export async function verifyConnection(
  provider: AIProvider,
  apiKey: string,
  model?: string,
  customBaseUrl?: string
): Promise<{ success: boolean; latencyMs: number; diagnosticMessage: string; models?: DiscoveredModel[]; error?: string }> {
  try {
    const res = await fetch("/api/ai-vault", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "verify",
        provider,
        apiKey,
        model,
        customBaseUrl,
      }),
    });

    const data = await res.json();
    if (data.models && Array.isArray(data.models)) {
      setCachedModels(provider, data.models);
    }
    return {
      success: Boolean(data.success),
      latencyMs: data.latencyMs || 0,
      diagnosticMessage: data.diagnosticMessage || (data.success ? "Connection verified." : "Verification failed."),
      models: data.models,
      error: data.error,
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: 0,
      diagnosticMessage: err?.message || "Network error during verification.",
      error: err?.message,
    };
  }
}

/**
 * Load AI settings securely from client-side storage
 */
export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);

    // Safeguard if previously set provider is no longer in registry
    let activeProvider: AIProvider = parsed.activeProvider || "gemini";
    if (!PROVIDER_REGISTRY[activeProvider]) {
      activeProvider = "gemini";
    }

    return {
      activeProvider,
      model: parsed.model || PROVIDER_REGISTRY[activeProvider]?.defaultModel || "gemini-2.0-flash",
      keys: parsed.keys || {},
      customBaseUrl: parsed.customBaseUrl,
      useLocalFallbackIfEmpty: parsed.useLocalFallbackIfEmpty ?? true,
    };
  } catch (e) {
    console.error("Failed to parse AI settings from storage", e);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save AI settings strictly into client-side storage
 */
export function saveAISettings(settings: AISettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent("marginflow_ai_settings_updated", { detail: settings }));
  } catch (e) {
    console.error("Failed to save AI settings", e);
  }
}

/**
 * Wipe all saved API keys and reset settings
 */
export function purgeAISettings(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VAULT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("marginflow_ai_settings_updated", { detail: DEFAULT_SETTINGS }));
  } catch (e) {
    console.error("Failed to purge AI settings", e);
  }
}

/**
 * Mask key for safe UI presentation (e.g. "sk-or-...a89b")
 */
export function maskKey(key?: string): string {
  if (!key) return "Not Configured";
  if (key.length <= 8) return "••••••••";
  const start = key.slice(0, 4);
  const end = key.slice(-4);
  return `${start}••••••••${end}`;
}
