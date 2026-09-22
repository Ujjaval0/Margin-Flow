import { Order, OrderItem, Marketplace, OrderStatus, Product } from "@/domain/types";
import { normalizeMarketplace } from "@/lib/marketplace-config";

export type MarketplaceSheetFormat =
  | "AMAZON_MTR"
  | "FLIPKART_ORDERS"
  | "FLIPKART_SETTLEMENT"
  | "MEESHO_ORDERS"
  | "SHOPIFY_ORDERS"
  | "GENERIC_CSV";

export interface TargetFieldDef {
  field: keyof Order | "sku" | "productName" | "quantity" | "sellingPrice" | "discount" | "taxAmount" | "cogs";
  label: string;
  required: boolean;
  aliases: string[];
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  { field: "id", label: "Order ID", required: true, aliases: ["orderid", "ordernumber", "order_id", "order id", "id", "sub order no", "suborderno", "order item id", "invoice number"] },
  { field: "channelOrderId", label: "Channel Ref", required: false, aliases: ["channelorderid", "channelref", "channel order id", "sub_order_id", "external id", "asin", "fsn"] },
  { field: "marketplace", label: "Marketplace / Channel", required: false, aliases: ["marketplace", "platform", "channel", "source", "sales channel"] },
  { field: "orderDate", label: "Order Date", required: true, aliases: ["date", "orderdate", "purchasedate", "order date", "created at", "order_date", "invoice date"] },
  { field: "status", label: "Order Status", required: false, aliases: ["status", "orderstatus", "order status", "deliverystatus", "delivery status", "order_state", "financial status"] },
  { field: "sku", label: "SKU", required: true, aliases: ["sku", "itemsku", "sellersku", "seller_sku", "product sku", "lineitem sku", "fsn", "asin", "msku"] },
  { field: "productName", label: "Product Title", required: false, aliases: ["productname", "itemname", "product", "title", "product title", "lineitem name", "description"] },
  { field: "quantity", label: "Quantity", required: false, aliases: ["qty", "quantity", "units", "item qty", "lineitem quantity", "pieces"] },
  { field: "sellingPrice", label: "Selling Price / Gross", required: true, aliases: ["sellingprice", "grosssale", "price", "unitprice", "itemprice", "item-price", "selling price", "final sale amount", "supplier discounted price", "total price", "amount", "total"] },
  { field: "discount", label: "Discount", required: false, aliases: ["discount", "discounts", "promodiscount", "item discount", "coupon discount"] },
  { field: "taxAmount", label: "GST / Taxes", required: false, aliases: ["tax", "taxamount", "gst", "total tax", "igst", "cgst", "sgst", "tax rate"] },
  { field: "shippingFeeCharged", label: "Shipping Fee Charged", required: false, aliases: ["shippingfee", "shipping", "shippingfeecharged", "shipping charge", "delivery charge"] },
  { field: "marketplaceChargesEstimate", label: "Marketplace Deductions", required: false, aliases: ["commission", "marketplace fee", "platform fee", "deductions", "fee", "referral fee"] },
  { field: "customerName", label: "Customer Name", required: false, aliases: ["customername", "customer", "buyer", "buyername", "buyer name", "billing name", "recipient"] },
  { field: "customerCity", label: "Customer City", required: false, aliases: ["city", "customercity", "shipcity", "ship-city", "shipping city", "destination city"] },
  { field: "customerState", label: "Customer State", required: false, aliases: ["state", "customerstate", "shipstate", "ship-state", "shipping state", "destination state", "place of supply"] },
];

export interface AutoMappedColumn {
  targetField: string;
  targetLabel: string;
  sourceHeader: string;
  sourceIndex: number;
  confidence: number;
  sampleValues: string[];
}

export interface FormatDetectionResult {
  detectedFormat: MarketplaceSheetFormat;
  formatLabel: string;
  confidence: number;
  headerRowIndex: number;
  columnMappings: AutoMappedColumn[];
  rawHeaders: string[];
  totalRows: number;
  matchedSkuCount: number;
  unmatchedSkuCount: number;
  detectedMarketplace: Marketplace;
}

export interface CsvMappingResult {
  detection: FormatDetectionResult;
  orders: Order[];
  errors: string[];
  warnings: string[];
}

// RFC 4180 compliant CSV parser that handles quotes, multiline values, and escaping
export function parseRawCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === "\r") {
        // ignore CR
      } else if (char === "\n") {
        currentRow.push(currentVal.trim());
        if (currentRow.some((field) => field !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((field) => field !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Cleans currency values like "₹ 1,499.50", "₹1499", "(50.00)" -> -50
export function cleanCurrency(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = String(val).trim();

  // Negative accounting format e.g. "(120.50)"
  const isNegative = s.startsWith("(") && s.endsWith(")") || s.startsWith("-");
  s = s.replace(/[^0-9.]/g, "");
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

// Standardizes diverse date formats to YYYY-MM-DD
export function cleanDate(val: string): string {
  if (!val) return new Date().toISOString().split("T")[0];
  const s = val.trim();

  // Direct ISO: 2026-09-15 or 2026-09-15T12:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback to Date parser
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

// Standardizes raw status string to OrderStatus
export function normalizeOrderStatus(rawStatus: string): OrderStatus {
  const s = (rawStatus || "").toLowerCase().trim();
  if (s.includes("deliv") || s.includes("completed")) return "DELIVERED";
  if (s.includes("rto") || s.includes("return to origin") || s.includes("courier return")) return "RTO";
  if (s.includes("return") || s.includes("refund")) return "RETURNED";
  if (s.includes("cancel")) return "CANCELLED";
  if (s.includes("ship") || s.includes("dispatched") || s.includes("in transit")) return "SHIPPED";
  if (s.includes("pend") || s.includes("unfulfilled")) return "PENDING";
  return "CONFIRMED";
}

// Finds the most probable header row in the first 8 rows
export function findHeaderRow(rows: string[][]): { rowIndex: number; headers: string[] } {
  let bestRowIndex = 0;
  let bestScore = -1;

  const headerKeywords = [
    "order", "sku", "item", "price", "amount", "total", "qty", "quantity",
    "date", "status", "buyer", "customer", "state", "city", "tax", "gst",
    "asin", "fsn", "channel", "sub order", "discount", "fee", "tracking"
  ];

  const searchDepth = Math.min(8, rows.length);
  for (let r = 0; r < searchDepth; r++) {
    const row = rows[r];
    if (!row || row.length < 3) continue;

    let score = 0;
    row.forEach((cell) => {
      const lower = cell.toLowerCase().trim();
      if (!lower) return;
      // Bonus if matches header keywords
      for (const kw of headerKeywords) {
        if (lower.includes(kw)) {
          score += 3;
          break;
        }
      }
      // Deduct score if cell looks like pure number or currency
      if (/^₹?[\d,.]+$/.test(lower) && lower.length > 3) {
        score -= 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
    }
  }

  return {
    rowIndex: bestRowIndex,
    headers: rows[bestRowIndex] || [],
  };
}

// Detects sheet format (Amazon MTR, Flipkart, Meesho, Shopify, or Generic)
export function detectFormatSignature(headers: string[]): {
  format: MarketplaceSheetFormat;
  formatLabel: string;
  defaultMarketplace: Marketplace;
  confidence: number;
} {
  const norm = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));
  const joined = norm.join(" ");

  // Amazon MTR signature
  const isAmazon =
    (joined.includes("asin") || joined.includes("sellersku") || joined.includes("itemprice")) &&
    (joined.includes("orderid") || joined.includes("merchant") || joined.includes("amazon"));
  if (isAmazon) {
    return {
      format: "AMAZON_MTR",
      formatLabel: "Amazon Merchant Tax Report (MTR)",
      defaultMarketplace: "Amazon India",
      confidence: 0.98,
    };
  }

  // Flipkart Orders signature
  const isFlipkart =
    (joined.includes("fsn") || joined.includes("suborderid") || joined.includes("flipkart")) &&
    (joined.includes("finalsaleamount") || joined.includes("orderitemid") || joined.includes("orderid"));
  if (isFlipkart) {
    return {
      format: "FLIPKART_ORDERS",
      formatLabel: "Flipkart Order Export",
      defaultMarketplace: "Flipkart",
      confidence: 0.96,
    };
  }

  // Meesho Orders signature
  const isMeesho =
    joined.includes("suborderno") ||
    joined.includes("supplierdiscountedprice") ||
    (joined.includes("meesho") && joined.includes("producttitle"));
  if (isMeesho) {
    return {
      format: "MEESHO_ORDERS",
      formatLabel: "Meesho Supplier Orders Sheet",
      defaultMarketplace: "Meesho",
      confidence: 0.95,
    };
  }

  // Shopify signature
  const isShopify =
    (joined.includes("lineitemsku") || joined.includes("lineitemname")) &&
    (joined.includes("financialstatus") || joined.includes("fulfillmentstatus"));
  if (isShopify) {
    return {
      format: "SHOPIFY_ORDERS",
      formatLabel: "Shopify Orders Export",
      defaultMarketplace: "Personal Website",
      confidence: 0.94,
    };
  }

  return {
    format: "GENERIC_CSV",
    formatLabel: "Generic Multi-Channel CSV",
    defaultMarketplace: "Amazon India",
    confidence: 0.82,
  };
}

// Auto-maps headers to internal target fields
export function autoMapColumns(
  headers: string[],
  sampleRows: string[][]
): AutoMappedColumn[] {
  const cleanHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));
  const mappings: AutoMappedColumn[] = [];
  const mappedSourceIndices = new Set<number>();

  TARGET_FIELDS.forEach((tf) => {
    let bestIndex = -1;
    let highestScore = 0;

    cleanHeaders.forEach((cleanH, colIdx) => {
      if (mappedSourceIndices.has(colIdx)) return;

      tf.aliases.forEach((alias) => {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanH === cleanAlias) {
          if (highestScore < 1.0) {
            highestScore = 1.0;
            bestIndex = colIdx;
          }
        } else if (cleanH.includes(cleanAlias) || cleanAlias.includes(cleanH)) {
          if (highestScore < 0.8) {
            highestScore = 0.8;
            bestIndex = colIdx;
          }
        }
      });
    });

    if (bestIndex !== -1) {
      mappedSourceIndices.add(bestIndex);
      const samples = sampleRows
        .slice(0, 3)
        .map((r) => (r[bestIndex] || "").trim())
        .filter(Boolean);

      mappings.push({
        targetField: tf.field,
        targetLabel: tf.label,
        sourceHeader: headers[bestIndex],
        sourceIndex: bestIndex,
        confidence: highestScore,
        sampleValues: samples,
      });
    }
  });

  return mappings;
}

// Main high-performance Auto-Mapper executor
export function detectAndMapCsv(rawText: string, products: Product[]): CsvMappingResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawRows = parseRawCsv(rawText);
  if (rawRows.length < 2) {
    return {
      detection: {
        detectedFormat: "GENERIC_CSV",
        formatLabel: "Invalid CSV",
        confidence: 0,
        headerRowIndex: 0,
        columnMappings: [],
        rawHeaders: [],
        totalRows: 0,
        matchedSkuCount: 0,
        unmatchedSkuCount: 0,
        detectedMarketplace: "Amazon India",
      },
      orders: [],
      errors: ["The CSV file must contain a valid header row and at least one order record."],
      warnings: [],
    };
  }

  // 1. Locate header row
  const { rowIndex: headerRowIndex, headers: rawHeaders } = findHeaderRow(rawRows);
  const dataRows = rawRows.slice(headerRowIndex + 1).filter((r) => r.some((c) => c.trim() !== ""));

  // 2. Format signature detection
  const detectionMeta = detectFormatSignature(rawHeaders);

  // 3. Column auto-mapping
  const columnMappings = autoMapColumns(rawHeaders, dataRows);

  // Quick lookup map: targetField -> source column index
  const fieldToCol = new Map<string, number>();
  columnMappings.forEach((m) => fieldToCol.set(m.targetField, m.sourceIndex));

  // Build product lookup map: support master SKU, channel aliases, and clean SKUs
  const productLookup = new Map<string, Product>();
  products.forEach((p) => {
    productLookup.set(p.sku.toLowerCase().trim(), p);
    productLookup.set(p.sku.toLowerCase().replace(/[^a-z0-9]/g, ""), p);

    if (p.channelAliases) {
      Object.entries(p.channelAliases).forEach(([, aliasSku]) => {
        if (aliasSku) {
          productLookup.set(aliasSku.toLowerCase().trim(), p);
          productLookup.set(aliasSku.toLowerCase().replace(/[^a-z0-9]/g, ""), p);
        }
      });
    }
  });

  const orders: Order[] = [];
  let matchedSkuCount = 0;
  let unmatchedSkuCount = 0;

  // 4. Ingest and normalize records
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = headerRowIndex + 2 + i;

    const getVal = (field: string): string => {
      const idx = fieldToCol.get(field);
      return idx !== undefined && row[idx] !== undefined ? row[idx].trim() : "";
    };

    const rawSku = getVal("sku");
    if (!rawSku) {
      warnings.push(`Row ${rowNumber}: Skipped (Missing SKU identifier).`);
      continue;
    }

    // Match product catalog
    const cleanRawSku = rawSku.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchedProduct = productLookup.get(rawSku.toLowerCase().trim()) || productLookup.get(cleanRawSku);

    if (matchedProduct) {
      matchedSkuCount++;
    } else {
      unmatchedSkuCount++;
    }

    const sku = matchedProduct ? matchedProduct.sku : rawSku.trim();
    const productName = getVal("productName") || matchedProduct?.name || `Product (${sku})`;

    const quantity = Math.max(1, parseInt(getVal("quantity"), 10) || 1);
    const rawPrice = cleanCurrency(getVal("sellingPrice"));
    const sellingPrice = rawPrice > 0 ? rawPrice : 999;
    const discount = Math.max(0, cleanCurrency(getVal("discount")));
    const rawTax = cleanCurrency(getVal("taxAmount"));
    const taxAmount = rawTax > 0 ? rawTax : Math.round(sellingPrice * 0.18 * 100) / 100;
    const shippingFeeCharged = cleanCurrency(getVal("shippingFeeCharged"));

    // Marketplace deduction estimate
    let marketplaceChargesEstimate = cleanCurrency(getVal("marketplaceChargesEstimate"));
    const rawMarketplace = getVal("marketplace");
    const marketplace: Marketplace = rawMarketplace
      ? normalizeMarketplace(rawMarketplace)
      : detectionMeta.defaultMarketplace;

    if (marketplaceChargesEstimate === 0) {
      const feeRate =
        marketplace === "Amazon India" ? 0.15 :
        marketplace === "Flipkart" ? 0.15 :
        marketplace === "Meesho" ? 0.03 :
        marketplace === "Myntra" ? 0.22 : 0.03;
      marketplaceChargesEstimate = Math.round(sellingPrice * quantity * feeRate * 100) / 100;
    }

    const orderId = getVal("id") || `ORD-${Date.now().toString().slice(-4)}-${i + 1}`;
    const channelOrderId = getVal("channelOrderId") || `${marketplace.slice(0, 2).toUpperCase()}-${orderId}`;
    const orderDate = cleanDate(getVal("orderDate"));
    const status = normalizeOrderStatus(getVal("status"));
    const customerName = getVal("customerName") || "Direct Customer";
    const customerCity = getVal("customerCity") || "Mumbai";
    const customerState = getVal("customerState") || "Maharashtra";

    // Locked historical cost basis (COGS snapshot)
    const snapshotUnitCost = matchedProduct?.currentCostPrice ?? Math.round(sellingPrice * 0.4);

    const item: OrderItem = {
      id: `ITEM-INGEST-${Date.now().toString().slice(-5)}-${i + 1}`,
      sku,
      productName,
      quantity,
      sellingPrice,
      discount,
      taxAmount,
      snapshotUnitCost,
      returnedQuantity: 0,
    };

    const order: Order = {
      id: orderId,
      channelOrderId,
      marketplace,
      orderDate,
      status,
      customerName,
      customerCity,
      customerState,
      shippingFeeCharged,
      marketplaceChargesEstimate,
      items: [item],
    };

    orders.push(order);
  }

  if (orders.length === 0 && errors.length === 0) {
    errors.push("No valid order records could be extracted. Please check the sheet headers.");
  }

  const detection: FormatDetectionResult = {
    detectedFormat: detectionMeta.format,
    formatLabel: detectionMeta.formatLabel,
    confidence: detectionMeta.confidence,
    headerRowIndex,
    columnMappings,
    rawHeaders,
    totalRows: dataRows.length,
    matchedSkuCount,
    unmatchedSkuCount,
    detectedMarketplace: detectionMeta.defaultMarketplace,
  };

  return {
    detection,
    orders,
    errors,
    warnings,
  };
}
