import { NextRequest, NextResponse } from "next/server";
import { streamText, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { GroundedFinancialContext, CFO_SYSTEM_PROMPT } from "@/domain/ai-context";
import { analyzeFinancialQuery } from "@/domain/deterministic-analyst";
import { AIProvider, PROVIDER_REGISTRY } from "@/lib/security/ai-vault";

type ChatIntent =
  | "pnl_diagnostic"
  | "anomaly_audit"
  | "sku_inspection"
  | "settlement_aging"
  | "returns_claim"
  | "general_chat";

interface ChatTriageResult {
  is_off_topic: number;
  intent: ChatIntent;
  needs_generative_synthesis: number;
  urgency: "Low" | "Medium" | "High";
}

/**
 * Local deterministic chat triage — classifies intent, off-topic probability,
 * and whether the query needs generative prose or a direct data card.
 */
function triageChat(prompt: string): ChatTriageResult {
  const q = prompt.toLowerCase().trim();

  // 1. Off-Topic Probability
  const offTopicKeywords = [
    "movie", "film", "cinema", "music", "song", "singer", "actor", "actress",
    "hollywood", "bollywood", "taylor swift", "netflix", "spotify", "cricket",
    "ipl", "football", "sports", "recipe", "cooking", "dating", "porn", "sex",
    "explicit", "politics", "election", "weather"
  ];
  let offTopicMatches = 0;
  for (const kw of offTopicKeywords) {
    if (q.includes(kw)) offTopicMatches++;
  }
  const is_off_topic = offTopicMatches > 0 ? Math.min(1.0, 0.75 + offTopicMatches * 0.15) : 0.05;

  // 2. Intent Classification
  let intent: ChatIntent = "general_chat";
  if (
    q.includes("anomaly") ||
    q.includes("radar") ||
    q.includes("fee creep") ||
    q.includes("overcharge") ||
    q.includes("weight bump") ||
    q.includes("leakage")
  ) {
    intent = "anomaly_audit";
  } else if (
    q.includes("profit") ||
    q.includes("margin") ||
    q.includes("loss") ||
    q.includes("revenue") ||
    q.includes("sales") ||
    q.includes("waterfall") ||
    q.includes("poas") ||
    q.includes("roas")
  ) {
    intent = "pnl_diagnostic";
  } else if (
    q.includes("settlement") ||
    q.includes("aging") ||
    q.includes("overdue") ||
    q.includes("payout") ||
    q.includes("disbursement")
  ) {
    intent = "settlement_aging";
  } else if (
    q.includes("claim") ||
    q.includes("safe-t") ||
    q.includes("safet") ||
    q.includes("dispute") ||
    q.includes("damaged return")
  ) {
    intent = "returns_claim";
  } else if (
    q.includes("sku") ||
    q.includes("product") ||
    q.includes("item") ||
    q.includes("asin") ||
    q.includes("fsn")
  ) {
    intent = "sku_inspection";
  }

  // 3. Needs Generative Synthesis
  let needs_generative_synthesis = 0.20;
  if (
    q.startsWith("why") ||
    q.startsWith("how") ||
    q.startsWith("explain") ||
    q.includes("advise") ||
    q.includes("recommend") ||
    q.includes("strategy") ||
    q.length > 80
  ) {
    needs_generative_synthesis = 0.85;
  } else if (
    q === "hi" ||
    q === "hello" ||
    q === "hey" ||
    q.includes("scan") ||
    q.includes("audit") ||
    q.includes("show")
  ) {
    needs_generative_synthesis = 0.15;
  }

  // 4. Urgency
  let urgency: "Low" | "Medium" | "High" = "Low";
  if (q.includes("urgent") || q.includes("immediately") || q.includes("loss") || q.includes("fraud") || q.includes("bleeding")) {
    urgency = "High";
  } else if (q.includes("why") || q.includes("alert") || q.includes("drop") || q.includes("overdue")) {
    urgency = "Medium";
  }

  return { is_off_topic, intent, needs_generative_synthesis, urgency };
}

/**
 * Translates provider HTTP error codes into plain-English diagnostic messages
 * that are safe to surface directly to the merchant and developer.
 * Never includes the API key in any message.
 */
function translateProviderError(status: number, providerName: string, body: string): string {
  if (status === 401 || status === 403) {
    return `Your ${providerName} API key is invalid or has been revoked. Please open Settings, check the key, and try again.`;
  }
  if (status === 429) {
    return `You've hit the rate limit or credit quota for ${providerName}. Please check your account credits or wait a moment.`;
  }
  if (status === 400) {
    const isModelError =
      body.includes("model") || body.includes("Model") || body.includes("not found");
    if (isModelError) {
      return `${providerName} rejected the request because the model name may be incorrect. Please check the model you selected in Settings.`;
    }
    return `${providerName} returned a bad request error (400). The query or configuration may be invalid. Check Settings and try again.`;
  }
  if (status === 502 || status === 503 || status === 504) {
    return `${providerName} is temporarily unavailable (service outage). Try again in a few minutes.`;
  }
  if (status === 500) {
    return `${providerName} encountered an internal server error. This is on their side.`;
  }
  return body ? `${providerName}: ${body}` : `${providerName} returned an unexpected error (HTTP ${status}).`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, context }: { prompt: string; context: GroundedFinancialContext } = body;

    if (!prompt || !context) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: prompt and context" },
        { status: 400 }
      );
    }

    // Ephemeral in-flight headers (fallback to server GEMINI_API_KEY if not sent)
    const provider = (req.headers.get("x-ai-provider") || "gemini") as AIProvider;
    const apiKey =
      req.headers.get("x-ai-key") ||
      (provider === "gemini" ? process.env.GEMINI_API_KEY : "") ||
      "";
    const rawModel = req.headers.get("x-ai-model");
    const model =
      rawModel ||
      (provider === "gemini" ? "gemini-2.0-flash" : PROVIDER_REGISTRY[provider]?.defaultModel || "gemini-2.0-flash");
    const customBaseUrl = req.headers.get("x-ai-base-url") || "";

    const providerMeta = PROVIDER_REGISTRY[provider];
    const providerName = providerMeta?.name || provider;

    const wantsStream =
      req.headers.get("x-ai-stream") !== "false" &&
      !req.headers.get("accept")?.includes("application/json");

    // 0. Local deterministic chat triage (intent classification, off-topic filter)
    const triage = triageChat(prompt);

    // Guardrail Check: Probabilistic off-topic filter in sub-80ms (zero LLM tokens)
    if (triage.is_off_topic > 0.80) {
      return NextResponse.json({
        success: true,
        answer: "I'm dedicated exclusively as your store assistant to help you understand and manage your MarginFlow data—such as your sales, profit margins, orders, returns, and inventory. Let me know what you'd like to explore in your numbers!",
        chips: [],
        source: "LOCAL_GUARDRAIL",
        provider: "deterministic",
        model: "local-triage",
        diagnosticMessage: null,
      });
    }

    // Fast-Path Deterministic Execution:
    // When query is a direct operational scan or data summary and does not require open-ended generative prose
    const isDirectAudit =
      triage.intent === "anomaly_audit" ||
      (triage.intent === "settlement_aging" && triage.needs_generative_synthesis < 0.35) ||
      (triage.intent === "pnl_diagnostic" && triage.needs_generative_synthesis < 0.25);

    if (isDirectAudit && wantsStream) {
      const fastResult = analyzeFinancialQuery(prompt, context);
      return NextResponse.json({
        success: true,
        answer: fastResult.answer,
        chips: fastResult.chips,
        source: "LOCAL_FAST_PATH",
        provider: "deterministic",
        model: `intent:${triage.intent}`,
        diagnosticMessage: null,
      });
    }

    // 1. If NO API key provided, execute local deterministic analyst instantly
    if (!apiKey.trim() && provider !== "custom") {
      const result = analyzeFinancialQuery(prompt, context);
      return NextResponse.json({
        success: true,
        answer: result.answer,
        chips: result.chips,
        source: "LOCAL_DETERMINISTIC",
        provider: "deterministic",
        model: "offline-engine",
        diagnosticMessage: null,
      });
    }

    // 2. Format Grounded Prompt with context + triage tags
    const fullSystemInstruction = `${CFO_SYSTEM_PROMPT}

CHAT_TRIAGE (Pre-classified Context):
- Primary Intent: ${triage.intent}
- Urgency: ${triage.urgency}

GROUNDED_FINANCIAL_CONTEXT (SOURCE OF TRUTH - ALL NUMBERS PRE-CALCULATED):
${JSON.stringify(context, null, 2)}`;

    // 3. Provider model instantiation via Vercel AI SDK
    try {
      let languageModel;

      if (provider === "gemini") {
        const google = createGoogleGenerativeAI({ apiKey });
        languageModel = google(model);
      } else {
        // OpenAI / Groq / DeepSeek / OpenRouter / NVIDIA / Mistral / Moonshot / Custom
        let endpoint = customBaseUrl || providerMeta?.defaultBaseUrl || "https://api.openai.com/v1";
        if (endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);

        const openai = createOpenAI({
          apiKey,
          baseURL: endpoint,
          headers: provider === "openrouter" ? {
            "HTTP-Referer": "https://marginflow.in",
            "X-Title": "MarginFlow Financial Intelligence",
          } : undefined,
        });

        // Use standard .chat() endpoint (/chat/completions) for OpenAI-compatible providers
        languageModel = openai.chat(model);
      }

      // 4. Non-streaming JSON mode (used for key verification and test queries)
      if (!wantsStream) {
        const result = await generateText({
          model: languageModel,
          system: fullSystemInstruction,
          prompt: `USER OPERATOR QUESTION: ${prompt}`,
          temperature: 0.1,
          maxOutputTokens: 200,
        });

        return NextResponse.json({
          success: true,
          answer: result.text,
          chips: [],
          source: "LLM_PROVIDER",
          provider,
          model,
          diagnosticMessage: null,
        });
      }

      // 5. Stream response using Vercel AI SDK (for Flow Chatbot)
      const result = streamText({
        model: languageModel,
        system: fullSystemInstruction,
        prompt: `USER OPERATOR QUESTION: ${prompt}`,
        temperature: 0.1,
        maxOutputTokens: 2048,
      });

      return result.toTextStreamResponse({
        headers: {
          "x-ai-source": "LLM_PROVIDER",
          "x-ai-provider": provider,
          "x-ai-model": model,
        },
      });
    } catch (providerError: any) {
      console.warn(`${provider} error in Vercel AI SDK, handling fallback:`, providerError);

      const status = providerError?.status || providerError?.statusCode || 500;
      const rawMsg = providerError?.message || providerError?.responseBody || "";
      const diagnosticMessage = translateProviderError(status, providerName, rawMsg);

      // If client explicitly requested non-streaming (testing credentials in Settings modal)
      if (!wantsStream) {
        return NextResponse.json(
          {
            success: false,
            error: diagnosticMessage,
            diagnosticMessage,
            provider,
            model,
          },
          { status: 400 }
        );
      }

      // Otherwise, fallback to local deterministic analyst so user experience continues seamlessly
      const fallback = analyzeFinancialQuery(prompt, context);
      return NextResponse.json({
        success: true,
        answer: fallback.answer,
        chips: [
          ...fallback.chips,
          {
            id: `chip-switch-${Date.now()}`,
            label: "⚙️ Switch AI Provider",
            type: "NAVIGATE",
            payload: { action: "OPEN_SETTINGS" },
          },
        ],
        source: "LOCAL_DETERMINISTIC_FALLBACK",
        provider,
        model,
        diagnosticMessage,
      });
    }
  } catch (error: any) {
    console.error("Copilot route error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to process Copilot query.", stack: error?.stack },
      { status: 500 }
    );
  }
}
