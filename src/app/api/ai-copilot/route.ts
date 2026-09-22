import { NextRequest, NextResponse } from "next/server";
import { GroundedFinancialContext, CFO_SYSTEM_PROMPT, AIActionChip } from "@/domain/ai-context";
import { analyzeFinancialQuery } from "@/domain/deterministic-analyst";
import { AIProvider, PROVIDER_REGISTRY } from "@/lib/security/ai-vault";

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
    const model = req.headers.get("x-ai-model") || PROVIDER_REGISTRY[provider]?.defaultModel || "gemini-1.5-flash";
    const customBaseUrl = req.headers.get("x-ai-base-url") || "";

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
      });
    }

    // 2. Format Grounded Prompt with context
    const fullSystemInstruction = `${CFO_SYSTEM_PROMPT}

GROUNDED_FINANCIAL_CONTEXT (SOURCE OF TRUTH - ALL NUMBERS PRE-CALCULATED):
${JSON.stringify(context, null, 2)}`;

    // 3. Provider execution
    if (provider === "gemini") {
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
              temperature: 0.1, // Low temperature for high financial fidelity
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
          });
        }
      } catch (err) {
        // Silently fallback without logging key
        console.warn("Gemini provider call failed, falling back to local engine");
      }
    } else {
      // OpenAI / OpenRouter / NVIDIA / Mistral / GLM / Custom (OpenAI-compatible)
      try {
        let endpoint = customBaseUrl || PROVIDER_REGISTRY[provider]?.defaultBaseUrl || "https://api.openai.com/v1";
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
          });
        }
      } catch (err) {
        console.warn(`${provider} API call failed, falling back to local engine`);
      }
    }

    // Fallback if LLM provider returned non-200 or network error
    const fallback = analyzeFinancialQuery(prompt, context);
    return NextResponse.json({
      success: true,
      answer: fallback.answer,
      chips: fallback.chips,
      source: "LOCAL_DETERMINISTIC_FALLBACK",
      provider,
      model,
    });
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
