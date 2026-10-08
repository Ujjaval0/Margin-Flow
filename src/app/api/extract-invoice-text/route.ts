import { NextRequest, NextResponse } from "next/server";

interface ExtractedInvoiceData {
  orderId: string;
  invoiceNumber: string;
  orderDate: string;
  marketplace: string;
  customerName: string;
  customerCity: string;
  customerState: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxAmount: number;
  totalAmount: number;
  shippingFee: number;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawFiles: File[] = [];

    const filesList = formData.getAll("files");
    const fileList = formData.getAll("file");

    for (const item of [...filesList, ...fileList]) {
      if (item && typeof item === "object" && "name" in item && "size" in item) {
        rawFiles.push(item as File);
      }
    }

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided." },
        { status: 400 }
      );
    }

    const provider = (req.headers.get("x-ai-provider") || "gemini").toLowerCase();
    const headerApiKey = req.headers.get("x-ai-key") || req.headers.get("x-gemini-api-key");
    const requestedModel = (req.headers.get("x-ai-model") || req.headers.get("x-gemini-model") || "").trim();

    const apiKey =
      (headerApiKey && headerApiKey.trim()) ||
      (provider === "openai" ? process.env.OPENAI_API_KEY : "") ||
      (provider === "groq" ? process.env.GROQ_API_KEY : "") ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      "";

    let modelName = requestedModel.startsWith("models/") ? requestedModel.replace("models/", "") : requestedModel;
    if (!modelName) {
      modelName = provider === "openai" ? "gpt-4o-mini" : provider === "groq" ? "llama-3.3-70b-versatile" : "gemini-2.5-flash";
    }
    if (provider === "gemini" && !modelName.toLowerCase().includes("gemini")) {
      modelName = "gemini-2.5-flash";
    }

    const results: Array<{
      fileName: string;
      fileType: string;
      text: string;
      parsedData?: ExtractedInvoiceData;
      success: boolean;
      error?: string;
    }> = [];

    for (const file of rawFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isPdf = ext === "pdf" || file.type === "application/pdf";
      const isImage =
        [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"].includes(`.${ext}`) ||
        file.type.startsWith("image/");

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        let parsedData: ExtractedInvoiceData | undefined = undefined;
        let extractedText = "";

        // 1. If API key is available, execute extraction via Gemini multimodal or OpenAI-compatible provider
        if (apiKey) {
          try {
            const prompt = `You are an expert e-commerce financial auditor and statutory tax invoice parser for Indian marketplace commerce.
Extract the transaction details accurately from the provided document.
Return strict JSON matching this exact structure:
{
  "orderId": "string (Channel order ID or invoice number, e.g. Amazon 408-1234567-8901234, Flipkart OD..., Meesho MSH..., or Invoice Number)",
  "invoiceNumber": "string",
  "orderDate": "YYYY-MM-DD",
  "marketplace": "Amazon India | Flipkart | Meesho | Myntra | WooCommerce | Personal Website | Other",
  "customerName": "string (Buyer or customer name)",
  "customerCity": "string",
  "customerState": "string (Indian state if available)",
  "productName": "string (The EXACT, real product or item name listed on this invoice. NEVER invent or default to a mouse or placeholder)",
  "sku": "string (The exact SKU/model or a clean alphanumeric code generated from the product title)",
  "quantity": 1,
  "unitPrice": 0.00, // IMPORTANT: The gross retail selling price per unit as printed on the invoice (e.g. 1799.00). Do NOT back-calculate or subtract taxes from the unit price.
  "taxRate": 18, // The percentage tax rate applied on this product (e.g. 0, 3, 5, 12, 18, 28)
  "taxAmount": 0.00, // The exact rupee tax amount if stated or calculated (e.g. 274.42)
  "totalAmount": 0.00, // The final invoice total paid / payable (e.g. 1799.00)
  "shippingFee": 0.00
}`;

            // Fast digital text extraction first (saves 85%+ API cost & 5x faster for digital PDFs)
            let digitalText = "";
            if (isPdf) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { PDFParse } = require("pdf-parse");
                const parser = new PDFParse({ data: buffer });
                const res = await parser.getText();
                await parser.destroy();
                digitalText = res?.text?.trim() || "";
              } catch {
                digitalText = "";
              }
            } else if (!isImage) {
              digitalText = buffer.toString("utf-8");
            }

            if (provider === "gemini") {
              // If digital text is rich (>80 chars), send pure text tokens: 10x faster & 85% cheaper than multimodal images
              let parts: any[] = [];
              if (digitalText && digitalText.length >= 80) {
                parts = [
                  { text: `${prompt}\n\nInvoice text content:\n${digitalText}` },
                ];
              } else if (isPdf) {
                const isBinaryPdf = buffer.slice(0, 4).toString("ascii").startsWith("%PDF");
                if (isBinaryPdf) {
                  parts = [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: "application/pdf",
                        data: buffer.toString("base64"),
                      },
                    },
                  ];
                } else {
                  parts = [{ text: `${prompt}\n\nInvoice text:\n${buffer.toString("utf-8")}` }];
                }
              } else if (isImage) {
                const mime = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
                parts = [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mime,
                      data: buffer.toString("base64"),
                    },
                  },
                ];
              } else {
                parts = [{ text: `${prompt}\n\nInvoice text:\n${digitalText || buffer.toString("utf-8")}` }];
              }

              const geminiSchema = {
                type: "OBJECT",
                properties: {
                  orderId: { type: "STRING" },
                  invoiceNumber: { type: "STRING" },
                  orderDate: { type: "STRING" },
                  marketplace: { type: "STRING" },
                  customerName: { type: "STRING" },
                  customerCity: { type: "STRING" },
                  customerState: { type: "STRING" },
                  productName: { type: "STRING" },
                  sku: { type: "STRING" },
                  quantity: { type: "NUMBER" },
                  unitPrice: { type: "NUMBER" },
                  taxRate: { type: "NUMBER" },
                  taxAmount: { type: "NUMBER" },
                  totalAmount: { type: "NUMBER" },
                  shippingFee: { type: "NUMBER" },
                },
                required: ["orderId", "productName", "quantity", "unitPrice", "totalAmount"],
              };

              let geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                      responseMimeType: "application/json",
                      responseSchema: geminiSchema,
                    },
                  }),
                }
              );

              if (!geminiRes.ok && modelName !== "gemini-2.0-flash") {
                geminiRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [{ parts }],
                      generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: geminiSchema,
                      },
                    }),
                  }
                );
              }

              if (geminiRes.ok) {
                const geminiData = await geminiRes.json();
                const rawJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (rawJsonText) {
                  const parsed = JSON.parse(rawJsonText);
                  if (parsed && (parsed.productName || parsed.orderId || parsed.totalAmount)) {
                    parsedData = {
                      orderId: String(parsed.orderId || ""),
                      invoiceNumber: String(parsed.invoiceNumber || parsed.orderId || ""),
                      orderDate: String(parsed.orderDate || new Date().toISOString().split("T")[0]),
                      marketplace: String(parsed.marketplace || "Personal Website"),
                      customerName: String(parsed.customerName || "Customer"),
                      customerCity: String(parsed.customerCity || "Mumbai"),
                      customerState: String(parsed.customerState || "Maharashtra"),
                      productName: String(parsed.productName || "Invoiced Product"),
                      sku: String(parsed.sku || "SKU-AUTO"),
                      quantity: Number(parsed.quantity) || 1,
                      unitPrice: Number(parsed.unitPrice) || Number(parsed.totalAmount) || 0,
                      taxRate: parsed.taxRate !== undefined ? Number(parsed.taxRate) : undefined,
                      taxAmount: Number(parsed.taxAmount) || 0,
                      totalAmount: Number(parsed.totalAmount) || Number(parsed.unitPrice) || 0,
                      shippingFee: Number(parsed.shippingFee) || 0,
                    };
                    extractedText = rawJsonText;
                  }
                }
              }
            } else {
              // Universal OpenAI-compatible Chat Completion API (OpenAI, Groq, OpenRouter, DeepSeek, Mistral)
              const endpointMap: Record<string, { url: string; defaultModel: string }> = {
                openai: { url: "https://api.openai.com/v1/chat/completions", defaultModel: "gpt-4o-mini" },
                groq: { url: "https://api.groq.com/openai/v1/chat/completions", defaultModel: "llama-3.3-70b-versatile" },
                openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", defaultModel: "google/gemini-2.0-flash" },
                deepseek: { url: "https://api.deepseek.com/v1/chat/completions", defaultModel: "deepseek-chat" },
                mistral: { url: "https://api.mistral.ai/v1/chat/completions", defaultModel: "mistral-small-latest" },
              };
              const target = endpointMap[provider] || endpointMap.openai;
              const modelToUse = modelName && modelName.trim() ? modelName.trim() : target.defaultModel;
              const docContent = digitalText || (isImage ? "[Scanned Invoice Image]" : buffer.toString("utf-8"));

              const aiRes = await fetch(target.url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: modelToUse,
                  response_format: provider === "openai" ? {
                    type: "json_schema",
                    json_schema: {
                      name: "invoice_extraction",
                      strict: true,
                      schema: {
                        type: "object",
                        properties: {
                          orderId: { type: "string" },
                          invoiceNumber: { type: "string" },
                          orderDate: { type: "string" },
                          marketplace: { type: "string" },
                          customerName: { type: "string" },
                          customerCity: { type: "string" },
                          customerState: { type: "string" },
                          productName: { type: "string" },
                          sku: { type: "string" },
                          quantity: { type: "number" },
                          unitPrice: { type: "number" },
                          taxRate: { type: "number" },
                          taxAmount: { type: "number" },
                          totalAmount: { type: "number" },
                          shippingFee: { type: "number" },
                        },
                        required: [
                          "orderId", "invoiceNumber", "orderDate", "marketplace",
                          "customerName", "customerCity", "customerState", "productName",
                          "sku", "quantity", "unitPrice", "taxRate", "taxAmount",
                          "totalAmount", "shippingFee"
                        ],
                        additionalProperties: false,
                      },
                    },
                  } : { type: "json_object" },
                  messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: `Extract invoice data from the following document content:\n\n${docContent || file.name}` },
                  ],
                }),
              });

              if (aiRes.ok) {
                const aiData = await aiRes.json();
                const rawJsonText = aiData.choices?.[0]?.message?.content;
                if (rawJsonText) {
                  const parsed = JSON.parse(rawJsonText);
                  if (parsed && (parsed.productName || parsed.orderId || parsed.totalAmount)) {
                    parsedData = {
                      orderId: String(parsed.orderId || ""),
                      invoiceNumber: String(parsed.invoiceNumber || parsed.orderId || ""),
                      orderDate: String(parsed.orderDate || new Date().toISOString().split("T")[0]),
                      marketplace: String(parsed.marketplace || "Personal Website"),
                      customerName: String(parsed.customerName || "Customer"),
                      customerCity: String(parsed.customerCity || "Mumbai"),
                      customerState: String(parsed.customerState || "Maharashtra"),
                      productName: String(parsed.productName || "Invoiced Product"),
                      sku: String(parsed.sku || "SKU-AUTO"),
                      quantity: Number(parsed.quantity) || 1,
                      unitPrice: Number(parsed.unitPrice) || Number(parsed.totalAmount) || 0,
                      taxRate: parsed.taxRate !== undefined ? Number(parsed.taxRate) : undefined,
                      taxAmount: Number(parsed.taxAmount) || 0,
                      totalAmount: Number(parsed.totalAmount) || Number(parsed.unitPrice) || 0,
                      shippingFee: Number(parsed.shippingFee) || 0,
                    };
                    extractedText = rawJsonText;
                  }
                }
              }
            }
          } catch (aiErr: any) {
            console.warn(`${provider} invoice extraction error:`, aiErr.message);
          }
        }

        // 2. Fallback text extraction if AI didn't return parsedData
        if (!parsedData) {
          if (isPdf) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { PDFParse } = require("pdf-parse");
              const parser = new PDFParse({ data: buffer });
              const res = await parser.getText();
              await parser.destroy();
              extractedText = res?.text?.trim() || "";
            } catch {
              // If PDFParse failed, try reading utf-8 string if text-based
              const textSample = buffer.toString("utf-8");
              if (textSample.includes("INVOICE") || textSample.includes("BILL") || textSample.includes("Order")) {
                extractedText = textSample;
              }
            }
          } else if (isImage) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const Tesseract = require("tesseract.js");
              const { data } = await Tesseract.recognize(buffer, "eng", { logger: () => {} });
              extractedText = data?.text?.trim() || "";
            } catch (tessErr: any) {
              console.warn("OCR fallback error:", tessErr);
            }
          } else {
            extractedText = buffer.toString("utf-8");
          }
        }

        results.push({
          fileName: file.name,
          fileType: ext.toUpperCase(),
          text: extractedText,
          parsedData,
          success: true,
        });
      } catch (err: any) {
        console.warn(`Extraction error for ${file.name}:`, err);
        results.push({
          fileName: file.name,
          fileType: ext.toUpperCase(),
          text: "",
          success: false,
          error: err.message || "Failed to extract text from file.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Error in /api/extract-invoice-text:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to extract invoice text." },
      { status: 500 }
    );
  }
}
