/**
 * Jev System One Client (TypeSafe AI Architecture)
 * 
 * Non-autoregressive decision engine powering ultra-fast, structured decisions
 * for Flow Copilot triage, guardrails, and CSV schema auto-mapping.
 * 
 * 3-Tier Multi-Engine Architecture:
 * - Tier 1: Direct TypeSafe System One API (https://api.typesafe.ai/v1/systemone)
 * - Tier 2: OpenRouter TypeSafe Bridge (typesafe/ namespace on OpenRouter)
 * - Tier 3: Local Calibrated Zero-Latency Fallback (0ms deterministic reasoning)
 */

export type JevIntent =
  | "pnl_diagnostic"
  | "anomaly_audit"
  | "sku_inspection"
  | "settlement_aging"
  | "returns_claim"
  | "general_chat";

export interface JevTriageResult {
  is_off_topic: number; // Noul: Probability [0.0 - 1.0]
  intent: JevIntent;    // Choice: Primary classified intent
  needs_generative_synthesis: number; // Noul: Probability [0.0 - 1.0]
  urgency: "Low" | "Medium" | "High"; // Score
  tierUsed: "TYPESAFE_DIRECT" | "OPENROUTER_BRIDGE" | "LOCAL_SYSTEM_ONE";
  latencyMs: number;
}

export interface JevHeaderMatchResult {
  matchedCandidate: string | null;
  confidence: number;
  tierUsed: "TYPESAFE_DIRECT" | "OPENROUTER_BRIDGE" | "LOCAL_SYSTEM_ONE";
}

interface JevClientOptions {
  jevApiKey?: string;
  openRouterKey?: string;
}

/**
 * Local Deterministic System One Evaluator (Tier 3 Fallback)
 * Executes calibrated probability scoring in 0ms with zero network requests.
 */
function evaluateLocalSystemOne(prompt: string): Omit<JevTriageResult, "latencyMs" | "tierUsed"> {
  const q = prompt.toLowerCase().trim();

  // 1. Off-Topic Probability (Noul)
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

  // 2. Intent Classification (Choice)
  let intent: JevIntent = "general_chat";
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

  // 3. Needs Generative Synthesis (Noul)
  // Queries like "scan anomalies" or "show profit" are purely deterministic.
  // Questions starting with "why", "how should I", "advise", or long multi-sentence queries need LLM voice.
  let needsGenerativeScore = 0.20;
  if (
    q.startsWith("why") ||
    q.startsWith("how") ||
    q.startsWith("explain") ||
    q.includes("advise") ||
    q.includes("recommend") ||
    q.includes("strategy") ||
    q.length > 80
  ) {
    needsGenerativeScore = 0.85;
  } else if (
    q === "hi" ||
    q === "hello" ||
    q === "hey" ||
    q.includes("scan") ||
    q.includes("audit") ||
    q.includes("show")
  ) {
    needsGenerativeScore = 0.15;
  }

  // 4. Urgency Score
  let urgency: "Low" | "Medium" | "High" = "Low";
  if (q.includes("urgent") || q.includes("immediately") || q.includes("loss") || q.includes("fraud") || q.includes("bleeding")) {
    urgency = "High";
  } else if (q.includes("why") || q.includes("alert") || q.includes("drop") || q.includes("overdue")) {
    urgency = "Medium";
  }

  return {
    is_off_topic,
    intent,
    needs_generative_synthesis: needsGenerativeScore,
    urgency,
  };
}

/**
 * Evaluates chat prompt triage using Jev System One 3-Tier engine.
 */
export async function evaluateChatTriage(
  prompt: string,
  options?: JevClientOptions
): Promise<JevTriageResult> {
  const startTime = Date.now();
  const directKey = options?.jevApiKey || process.env.TYPESAFE_API_KEY || "";
  const openRouterKey = options?.openRouterKey || "";

  // ----------------------------------------------------
  // Tier 1: Direct TypeSafe Jev API
  // ----------------------------------------------------
  if (directKey) {
    try {
      const response = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: prompt,
          model: "jev-latest",
          questions: {
            is_off_topic: {
              type: "noul",
              prompt: "Does this message pertain to movies, entertainment, sports, or non-ecommerce topics?",
            },
            intent: {
              type: "choice",
              instructions: "Classify the user intent into one e-commerce store management category",
              options: [
                "pnl_diagnostic",
                "anomaly_audit",
                "sku_inspection",
                "settlement_aging",
                "returns_claim",
                "general_chat",
              ],
            },
            needs_generative_synthesis: {
              type: "noul",
              prompt: "Does answering this require open-ended narrative prose and conversational advice rather than a direct data card?",
            },
            urgency: {
              type: "score",
              scale: ["Low", "Medium", "High"],
              prompt: "How urgent is this operational request?",
            },
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const answers = data.answers || {};
        return {
          is_off_topic: answers.is_off_topic ?? 0.05,
          intent: answers.intent ?? "general_chat",
          needs_generative_synthesis: answers.needs_generative_synthesis ?? 0.5,
          urgency: answers.urgency ?? "Low",
          tierUsed: "TYPESAFE_DIRECT",
          latencyMs: Date.now() - startTime,
        };
      }
    } catch (err) {
      console.warn("TypeSafe Jev direct API request failed, falling back to next tier:", err);
    }
  }

  // ----------------------------------------------------
  // Tier 2: OpenRouter TypeSafe Bridge
  // ----------------------------------------------------
  if (openRouterKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://marginflow.in",
          "X-Title": "MarginFlow Jev Bridge",
        },
        body: JSON.stringify({
          model: "typesafe/jev-latest",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a System One decision evaluator. Output strict JSON with:
{"is_off_topic": float 0-1, "intent": "pnl_diagnostic"|"anomaly_audit"|"sku_inspection"|"settlement_aging"|"returns_claim"|"general_chat", "needs_generative_synthesis": float 0-1, "urgency": "Low"|"Medium"|"High"}`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          return {
            is_off_topic: typeof parsed.is_off_topic === "number" ? parsed.is_off_topic : 0.05,
            intent: parsed.intent || "general_chat",
            needs_generative_synthesis: typeof parsed.needs_generative_synthesis === "number" ? parsed.needs_generative_synthesis : 0.5,
            urgency: parsed.urgency || "Low",
            tierUsed: "OPENROUTER_BRIDGE",
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err) {
      console.warn("OpenRouter TypeSafe bridge request failed, falling back to local Tier 3:", err);
    }
  }

  // ----------------------------------------------------
  // Tier 3: Local Deterministic System One Engine (0ms)
  // ----------------------------------------------------
  const localDecision = evaluateLocalSystemOne(prompt);
  return {
    ...localDecision,
    tierUsed: "LOCAL_SYSTEM_ONE",
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Resolves an ambiguous or non-standard CSV column header into canonical schema.
 * Uses Jev's Choice primitive across candidate canonical keys.
 */
export async function evaluateCsvHeaderMatch(
  header: string,
  candidates: string[],
  options?: JevClientOptions
): Promise<JevHeaderMatchResult> {
  const directKey = options?.jevApiKey || process.env.TYPESAFE_API_KEY || "";
  const cleanedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Direct TypeSafe Jev API
  if (directKey) {
    try {
      const response = await fetch("https://api.typesafe.ai/v1/systemone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${directKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: `Raw CSV Column Header: "${header}"`,
          model: "jev-latest",
          questions: {
            canonical_field: {
              type: "choice",
              instructions: "Which standard e-commerce order field does this header represent?",
              options: [...candidates, "unmapped_other"],
            },
            confidence: {
              type: "noul",
              prompt: "Is this match highly confident?",
            },
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const choice = data.answers?.canonical_field;
        const conf = data.answers?.confidence ?? 0.8;
        if (choice && choice !== "unmapped_other" && candidates.includes(choice)) {
          return {
            matchedCandidate: choice,
            confidence: conf,
            tierUsed: "TYPESAFE_DIRECT",
          };
        }
      }
    } catch (err) {
      console.warn("Jev CSV header resolution failed, falling back to local matching:", err);
    }
  }

  // 2. Local Deterministic Schema Matcher (Tier 3)
  for (const candidate of candidates) {
    const cleanCand = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanedHeader.includes(cleanCand) || cleanCand.includes(cleanedHeader)) {
      return {
        matchedCandidate: candidate,
        confidence: 0.95,
        tierUsed: "LOCAL_SYSTEM_ONE",
      };
    }
  }

  return {
    matchedCandidate: null,
    confidence: 0.0,
    tierUsed: "LOCAL_SYSTEM_ONE",
  };
}
