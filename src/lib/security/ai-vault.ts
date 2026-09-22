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
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
      "gemini-2.5-flash-preview-05-20",
      "gemini-2.5-pro-preview-06-05",
    ],
    placeholderKey: "AIzaSy...",
    keyDocsUrl: "https://aistudio.google.com/app/apikey",
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
      "gpt-4.1-mini",
      "gpt-4.1",
      "gpt-4-turbo",
      "o3-mini",
      "o3",
      "o4-mini",
      "gpt-3.5-turbo",
    ],
    placeholderKey: "sk-proj-...",
    keyDocsUrl: "https://platform.openai.com/api-keys",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "anthropic/claude-3.5-haiku",
    recommendedModels: [
      "anthropic/claude-sonnet-4-5",
      "anthropic/claude-opus-4-5",
      "anthropic/claude-3.5-haiku",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/o3-mini",
      "google/gemini-2.5-pro-preview",
      "google/gemini-2.0-flash",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1",
      "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-large-2411",
      "google/gemini-2.0-flash-exp:free",
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
      "mistral-medium-latest",
      "mistral-large-latest",
      "mistral-saba-latest",
      "codestral-latest",
      "devstral-small-2505",
    ],
    placeholderKey: "mis_...",
    keyDocsUrl: "https://console.mistral.ai/api-keys/",
    defaultBaseUrl: "https://api.mistral.ai/v1",
  },
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    defaultModel: "meta/llama-3.1-70b-instruct",
    recommendedModels: [
      "meta/llama-3.3-70b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.1-8b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "mistralai/mistral-large-2-instruct",
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
      "glm-4-flash-250414",
      "glm-4-air",
      "glm-4-airx",
      "glm-4",
      "glm-4-long",
      "glm-z1-flash",
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
      "moonshot-v1-128k",
      "kimi-latest",
      "kimi-thinking-preview",
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
      "llama3",
      "llama3.1",
      "llama3.2",
      "mistral",
      "deepseek-r1",
      "deepseek-coder-v2",
      "qwen2.5",
      "qwen2.5-coder",
      "phi4",
      "gemma3",
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

/**
 * Load AI settings securely from client-side storage
 */
export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      activeProvider: parsed.activeProvider || "gemini",
      model: parsed.model || PROVIDER_REGISTRY[parsed.activeProvider as AIProvider]?.defaultModel || "gemini-1.5-flash",
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
