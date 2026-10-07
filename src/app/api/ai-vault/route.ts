import { NextRequest, NextResponse } from "next/server";
import { AIProvider, PROVIDER_REGISTRY } from "@/lib/security/ai-vault";

export interface NormalizedModel {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isRecommended?: boolean;
}

interface VaultResponse {
  success: boolean;
  latencyMs: number;
  status: number;
  provider: AIProvider;
  diagnosticMessage: string;
  models?: NormalizedModel[];
  testedModel?: string;
  error?: string;
}

function translateVaultError(status: number, providerName: string, bodyText: string): string {
  if (status === 401) {
    return `Your ${providerName} API key is invalid or has been revoked. Please check your key.`;
  }
  if (status === 403) {
    return `Your ${providerName} key does not have permission to access models or this endpoint.`;
  }
  if (status === 429) {
    return `Credit quota exceeded or rate limit reached on ${providerName}. Please check your account credits.`;
  }
  if (status === 404) {
    return `${providerName} endpoint or model was not found (404). Check provider URL settings.`;
  }
  if (status >= 500) {
    return `${providerName} is experiencing a server outage (HTTP ${status}). Try again shortly.`;
  }
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const msg = parsed?.error?.message || parsed?.message || parsed?.error;
      if (typeof msg === "string" && msg.trim()) {
        return `${providerName}: ${msg.trim()}`;
      }
    } catch {
      // not json
    }
  }
  return `${providerName} returned error (HTTP ${status}).`;
}

/**
 * Filter and format models specifically for chat/copilot usage
 */
function filterChatModels(provider: AIProvider, rawList: Array<{ id: string; name?: string; context_length?: number }>): NormalizedModel[] {
  const recommendedSet = new Set(PROVIDER_REGISTRY[provider]?.recommendedModels || []);

  const excludedKeywords = [
    "embedding",
    "embed",
    "whisper",
    "tts",
    "dall-e",
    "moderation",
    "audio",
    "vision-preview",
    "transcription",
    "realtime",
    "bge-",
    "rerank",
    "text-similarity",
  ];

  return rawList
    .filter((m) => {
      const idLower = m.id.toLowerCase();
      // Exclude obvious non-chat models
      return !excludedKeywords.some((ex) => idLower.includes(ex));
    })
    .map((m) => {
      const isRecommended = recommendedSet.has(m.id);
      return {
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.context_length,
        isRecommended,
      };
    })
    .sort((a, b) => {
      // Sort recommended models to top, then alphabetical
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return a.id.localeCompare(b.id);
    });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let provider: AIProvider = "gemini";

  try {
    const body = await req.json().catch(() => ({}));
    const action: "verify" | "models" = body.action || req.headers.get("x-vault-action") || "verify";
    provider = (body.provider || req.headers.get("x-ai-provider") || "gemini") as AIProvider;
    const apiKey = (body.apiKey || req.headers.get("x-ai-key") || "").trim();
    const model = (body.model || req.headers.get("x-ai-model") || "").trim();
    const customBaseUrl = (body.customBaseUrl || req.headers.get("x-ai-base-url") || "").trim();

    const providerMeta = PROVIDER_REGISTRY[provider];
    const providerName = providerMeta?.name || provider;

    if (!apiKey && provider !== "custom") {
      return NextResponse.json<VaultResponse>(
        {
          success: false,
          latencyMs: 0,
          status: 400,
          provider,
          diagnosticMessage: `Please enter an API key for ${providerName}.`,
          error: "API key is required.",
        },
        { status: 400 }
      );
    }

    // Set 8-second timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let modelsEndpoint = "";
    let requestHeaders: Record<string, string> = {};

    switch (provider) {
      case "gemini":
        modelsEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        break;

      case "groq":
        modelsEndpoint = "https://api.groq.com/openai/v1/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "deepseek":
        modelsEndpoint = "https://api.deepseek.com/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "openai":
        modelsEndpoint = "https://api.openai.com/v1/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "openrouter":
        modelsEndpoint = "https://openrouter.ai/api/v1/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        requestHeaders["HTTP-Referer"] = "https://marginflow.in";
        requestHeaders["X-Title"] = "MarginFlow Key Verification";
        break;

      case "mistral":
        modelsEndpoint = "https://api.mistral.ai/v1/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "nvidia":
        modelsEndpoint = "https://integrate.api.nvidia.com/v1/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "glm":
        modelsEndpoint = "https://open.bigmodel.cn/api/paas/v4/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "moonshot":
        modelsEndpoint = "https://api.moonshot.cn/v1/models";
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "custom": {
        let base = customBaseUrl || "http://localhost:11434/v1";
        if (base.endsWith("/")) base = base.slice(0, -1);
        modelsEndpoint = `${base}/models`;
        if (apiKey) requestHeaders["Authorization"] = `Bearer ${apiKey}`;
        break;
      }

      default:
        return NextResponse.json<VaultResponse>(
          {
            success: false,
            latencyMs: 0,
            status: 400,
            provider,
            diagnosticMessage: `Unknown provider: ${provider}`,
            error: "Unsupported provider",
          },
          { status: 400 }
        );
    }

    try {
      const response = await fetch(modelsEndpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...requestHeaders,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const status = response.status;
      const responseText = await response.text();

      if (!response.ok) {
        const diagMsg = translateVaultError(status, providerName, responseText);
        return NextResponse.json<VaultResponse>(
          {
            success: false,
            latencyMs,
            status,
            provider,
            diagnosticMessage: diagMsg,
            error: diagMsg,
          },
          { status: response.status }
        );
      }

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = {};
      }

      // Parse models list based on provider format
      let rawModels: Array<{ id: string; name?: string; context_length?: number }> = [];

      if (provider === "gemini") {
        if (Array.isArray(parsedData.models)) {
          rawModels = parsedData.models
            .filter((m: any) => {
              const methods: string[] = m.supportedGenerationMethods || [];
              return methods.includes("generateContent");
            })
            .map((m: any) => ({
              id: m.name ? m.name.replace(/^models\//, "") : "",
              name: m.displayName || m.name,
              description: m.description,
            }))
            .filter((m: any) => m.id);
        }
      } else if (Array.isArray(parsedData.data)) {
        // OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Moonshot, NVIDIA, GLM
        rawModels = parsedData.data.map((m: any) => ({
          id: m.id || m.name,
          name: m.name || m.id,
          context_length: m.context_length || m.max_tokens,
        }));
      } else if (Array.isArray(parsedData.models)) {
        // Ollama /tags or alternative format
        rawModels = parsedData.models.map((m: any) => ({
          id: m.name || m.model || m.id,
          name: m.name || m.id,
        }));
      }

      const normalizedModels = filterChatModels(provider, rawModels);

      // Verify specific model validity if requested
      let modelSpecificNote = "";
      if (model && normalizedModels.length > 0) {
        const hasModel = normalizedModels.some((m) => m.id === model);
        if (!hasModel) {
          modelSpecificNote = ` (Note: "${model}" is not in provider list, but custom IDs may still be accepted).`;
        }
      }

      const countMsg = normalizedModels.length > 0
        ? `Found ${normalizedModels.length} models (${latencyMs}ms).`
        : `Connected successfully (${latencyMs}ms).`;

      return NextResponse.json<VaultResponse>({
        success: true,
        latencyMs,
        status: 200,
        provider,
        testedModel: model || providerMeta?.defaultModel,
        diagnosticMessage: `Verified & active. ${countMsg}${modelSpecificNote}`,
        models: normalizedModels,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (fetchError.name === "AbortError") {
        return NextResponse.json<VaultResponse>(
          {
            success: false,
            latencyMs,
            status: 408,
            provider,
            diagnosticMessage: `Connection timed out after 8s. Check your network or provider status.`,
            error: "Request timed out",
          },
          { status: 408 }
        );
      }

      return NextResponse.json<VaultResponse>(
        {
          success: false,
          latencyMs,
          status: 500,
          provider,
          diagnosticMessage: `Failed to reach ${providerName}: ${fetchError.message || "Network error"}`,
          error: fetchError.message || "Network error",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json<VaultResponse>(
      {
        success: false,
        latencyMs,
        status: 500,
        provider,
        diagnosticMessage: error?.message || "Unexpected server error during verification.",
        error: error?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
