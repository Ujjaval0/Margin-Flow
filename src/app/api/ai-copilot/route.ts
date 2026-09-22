import { NextRequest, NextResponse } from "next/server";
import { GroundedFinancialContext, CFO_SYSTEM_PROMPT, AIActionChip } from "@/domain/ai-context";
import { analyzeFinancialQuery } from "@/domain/deterministic-analyst";
import { AIProvider, PROVIDER_REGISTRY } from "@/lib/security/ai-vault";

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
    return `You've hit the rate limit for ${providerName}. Wait a moment and try again — the local engine has answered your question in the meantime.`;
  }
  if (status === 400) {
    // Try to extract a model-related hint from the body
    const isModelError =
      body.includes("model") || body.includes("Model") || body.includes("not found");
    if (isModelError) {
      return `${providerName} rejected the request because the model name may be incorrect. Please check the model you selected in Settings.`;
    }
    return `${providerName} returned a bad request error (400). The query or configuration may be invalid. Check Settings and try again.`;
  }
  if (status === 502 || status === 503 || status === 504) {
    return `${providerName} is temporarily unavailable (service outage). The local engine answered your question instead — try again in a few minutes.`;
  }
  if (status === 500) {
    return `${providerName} encountered an internal server error. This is on their side. The local engine answered your question instead.`;
  }
  return `${providerName} returned an unexpected error (HTTP ${status}). The local engine answered your question instead.`;
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

    // Ephemeral in-flight headers (NEVER logged or persisted to disk/DB)
    const provider = (req.headers.get("x-ai-provider") || "gemini") as AIProvider;
    const apiKey = req.headers.get("x-ai-key") || "";
    const model = req.headers.get("x-ai-model") || PROVIDER_REGISTRY[provider]?.defaultModel || "gemini-2.0-flash";
    const customBaseUrl = req.headers.get("x-ai-base-url") || "";

    const providerMeta = PROVIDER_REGISTRY[provider];
    const providerName = providerMeta?.name || provider;

    // 1. If NO API key provided, execute local deterministic analyst instantly
    if (!apiKey.trim()) {
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

    // 2. Format Grounded Prompt with context
    const fullSystemInstruction = `${CFO_SYSTEM_PROMPT}

GROUNDED_FINANCIAL_CONTEXT (SOURCE OF TRUTH - ALL NUMBERS PRE-CALCULATED):
${JSON.stringify(context, null, 2)}`;

    // 3. Provider execution
    if (provider === "gemini") {
      let diagnosticMessage: string | null = null;
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: fullSystemInstruction },
                  { text: `USER OPERATOR QUESTION: ${prompt}` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 600,
            },
          }),
        });

        if (geminiRes.ok) {
          const json = await geminiRes.json();
          const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const { answer, chips } = parseResponseAndChips(rawText, context);
          return NextResponse.json({
            success: true,
            answer,
            chips,
            source: "LLM_PROVIDER",
            provider: "gemini",
            model,
            diagnosticMessage: null,
          });
        } else {
          const errBody = await geminiRes.text().catch(() => "");
          diagnosticMessage = translateProviderError(geminiRes.status, providerName, errBody);
          console.warn(`Gemini API error ${geminiRes.status} — falling back to local engine`);
        }
      } catch (err: any) {
        diagnosticMessage = `Could not reach ${providerName}. Check your internet connection. The local engine answered your question instead.`;
        console.warn("Gemini provider network failure, falling back to local engine");
      }

      // Fallback with diagnostic
      const fallback = analyzeFinancialQuery(prompt, context);
      return NextResponse.json({
        success: true,
        answer: fallback.answer,
        chips: fallback.chips,
        source: "LOCAL_DETERMINISTIC_FALLBACK",
        provider,
        model,
        diagnosticMessage,
      });

    } else {
      // OpenAI / DeepSeek / OpenRouter / NVIDIA / Mistral / GLM / Custom (OpenAI-compatible)
      let diagnosticMessage: string | null = null;
      try {
        let endpoint = customBaseUrl || providerMeta?.defaultBaseUrl || "https://api.openai.com/v1";
        if (endpoint.endsWith("/")) endpoint = endpoint.slice(0, -1);
        const chatUrl = `${endpoint}/chat/completions`;

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        };

        if (provider === "openrouter") {
          headers["HTTP-Referer"] = "https://marginflow.in";
          headers["X-Title"] = "MarginFlow Financial Intelligence";
        }

        const llmRes = await fetch(chatUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: fullSystemInstruction },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 600,
          }),
        });

        if (llmRes.ok) {
          const json = await llmRes.json();
          const rawText = json?.choices?.[0]?.message?.content || "";
          const { answer, chips } = parseResponseAndChips(rawText, context);
          return NextResponse.json({
            success: true,
            answer,
            chips,
            source: "LLM_PROVIDER",
            provider,
            model,
            diagnosticMessage: null,
          });
        } else {
          const errBody = await llmRes.text().catch(() => "");
          diagnosticMessage = translateProviderError(llmRes.status, providerName, errBody);
          console.warn(`${provider} API error ${llmRes.status} — falling back to local engine`);
        }
      } catch (err: any) {
        diagnosticMessage = `Could not reach ${providerName}. Check your internet connection. The local engine answered your question instead.`;
        console.warn(`${provider} provider network failure, falling back to local engine`);
      }

      // Fallback with diagnostic
      const fallback = analyzeFinancialQuery(prompt, context);
      return NextResponse.json({
        success: true,
        answer: fallback.answer,
        chips: fallback.chips,
        source: "LOCAL_DETERMINISTIC_FALLBACK",
        provider,
        model,
        diagnosticMessage,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to process Copilot query." },
      { status: 500 }
    );
  }
}

/**
 * Parses out Action Chips block from the LLM text output
 */
function parseResponseAndChips(
  rawText: string,
  context: GroundedFinancialContext
): { answer: string; chips: AIActionChip[] } {
  let answer = rawText.trim();
  let chips: AIActionChip[] = [];

  // Look for ```action_chips ... ``` block
  const chipBlockMatch = rawText.match(/```(?:action_chips|json)?\s*([\s\S]*?)\s*```/);
  if (chipBlockMatch) {
    try {
      const parsed = JSON.parse(chipBlockMatch[1]);
      if (Array.isArray(parsed)) {
        chips = parsed;
      }
      // Remove the code block from visible answer
      answer = answer.replace(/```(?:action_chips|json)?\s*[\s\S]*?\s*```/, "").trim();
    } catch {
      // ignore parse errors
    }
  }

  // If LLM did not generate chips, supply contextual default chips based on content
  if (chips.length === 0) {
    const defaultChips = analyzeFinancialQuery(answer, context).chips;
    chips = defaultChips.slice(0, 3);
  }

  return { answer, chips };
}
