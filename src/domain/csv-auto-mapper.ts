import { Order, OrderItem, Marketplace, OrderStatus, Product } from "@/domain/types";
import { normalizeMarketplace } from "@/lib/marketplace-config";

export type MarketplaceSheetFormat =
  | "AMAZON_MTR"
  | "FLIPKART_ORDERS"
  | "FLIPKART_SETTLEMENT"
  | "MEESHO_ORDERS"
  | "MEESHO_GST"
  | "MEESHO_SETTLEMENT"
  | "MYNTRA_ORDERS"
  | "MYNTRA_SETTLEMENT"
  | "SHOPIFY_ORDERS"
  | "GENERIC_CSV";

export interface TargetFieldDef {
  field: keyof Order | "sku" | "productName" | "quantity" | "sellingPrice" | "discount" | "taxAmount" | "cogs" | "lineItemId";
  label: string;
  required: boolean;
  aliases: string[];
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  { field: "lineItemId", label: "Line Item ID", required: false, aliases: ["line item id", "order item id", "lineitem id", "order_item_id"] },
  { field: "id", label: "Order ID", required: true, aliases: ["orderid", "ordernumber", "order_id", "order id", "sub order no", "suborderno", "sub_order_no", "invoice number", "invoice no", "invoiceno", "packet id", "packet_id", "order release id", "order_release_id", "order no", "orderno", "order ref", "ref no"] },
  { field: "channelOrderId", label: "Channel Ref", required: false, aliases: ["channelorderid", "channelref", "channel order id", "sub_order_id", "packet_id", "order_release_id", "external id"] },
  { field: "marketplace", label: "Marketplace / Channel", required: false, aliases: ["marketplace", "platform", "channel", "source", "sales channel"] },
  { field: "orderDate", label: "Order Date", required: true, aliases: ["date", "orderdate", "purchasedate", "order date", "created at", "order_date", "invoice date", "order_release_date"] },
  { field: "status", label: "Order Status", required: false, aliases: ["status", "orderstatus", "order status", "deliverystatus", "delivery status", "order_state", "financial status"] },
  { field: "sku", label: "SKU", required: true, aliases: ["sku", "itemsku", "item_sku", "sellersku", "seller_sku", "product sku", "product_sku", "lineitem sku", "lineitem_sku", "fsn", "asin", "msku", "style_id", "styleid", "article_id", "articleid", "sku_code", "skucode", "vendor_sku", "vendorsku", "vendor_article_name", "item code", "itemcode", "item_code", "product code", "productcode", "product_code", "article", "articleno", "article_no", "model", "modelno", "style", "barcode"] },
  { field: "productName", label: "Product Title", required: false, aliases: ["productname", "product_name", "itemname", "item_name", "product", "title", "product title", "lineitem name", "description", "item description", "item_description", "vendor_article_name", "item"] },
  { field: "quantity", label: "Quantity", required: true, aliases: ["qty", "quantity", "units", "item qty", "item_quantity", "lineitem quantity", "pieces", "count"] },
  { field: "sellingPrice", label: "Selling Price / Gross", required: true, aliases: ["sellingprice", "selling_price", "price", "unitprice", "unit_price", "itemprice", "item-price", "selling price", "supplier discounted price", "supplier_discounted_price", "supplierdiscountedprice"] },
  { field: "discount", label: "Discount", required: false, aliases: ["discount", "discounts", "promodiscount", "item discount", "coupon discount"] },
  { field: "taxAmount", label: "GST / Taxes", required: false, aliases: ["tax", "taxamount", "gst", "total tax", "total_tax", "totaltax", "igst", "cgst", "sgst", "igst_amount", "cgst_amount", "sgst_amount"] },
  { field: "shippingFeeCharged", label: "Shipping Fee Charged", required: false, aliases: ["shippingfee", "shipping", "shippingfeecharged", "shipping charge", "delivery charge", "forward_delivery_charge"] },
  { field: "marketplaceChargesEstimate", label: "Marketplace Deductions", required: false, aliases: ["commission", "marketplace fee", "platform fee", "deductions", "fee", "referral fee", "meesho_commission", "meeshocommission", "myntra_commission", "myntracommission"] },
  { field: "customerName", label: "Customer Name", required: false, aliases: ["customername", "customer", "buyer", "buyername", "buyer name", "billing name", "recipient"] },
  { field: "customerCity", label: "Customer City", required: false, aliases: ["city", "customercity", "shipcity", "ship-city", "shipping city", "destination city", "delivery_city"] },
  { field: "customerState", label: "Customer State", required: false, aliases: ["state", "customerstate", "shipstate", "ship-state", "shipping state", "destination state", "place of supply", "end_customer_state", "endcustomerstate"] },
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

/** Multiple source files may repeat an order, but must agree on the same source line. */
export function consolidateCsvOrders(incoming: Order[]): Order[] {
  const orders: Order[] = [];
  for (const order of incoming) {
    const previous = orders.find(row => row.marketplace === order.marketplace && row.channelOrderId === order.channelOrderId);
    if (!previous) { orders.push({ ...order, items: [...order.items] }); continue; }
    if (previous.orderDate !== order.orderDate || previous.status !== order.status || previous.shippingFeeCharged !== order.shippingFeeCharged || previous.marketplaceChargesEstimate !== order.marketplaceChargesEstimate) throw new Error("Files contain conflicting values for the same order.");
    for (const item of order.items) {
      const existing = previous.items.find(line => line.id === item.id);
      if (!existing) previous.items.push(item);
      else if (existing.sku !== item.sku || existing.quantity !== item.quantity || existing.sellingPrice !== item.sellingPrice || existing.discount !== item.discount || existing.taxAmount !== item.taxAmount) throw new Error("Files contain conflicting values for the same source line.");
    }
  }
  return orders;
}

// RFC 4180 compliant CSV parser that handles quotes, multiline values, and escaping
export function parseRawCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;
  let closedQuote = false;

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
          closedQuote = true;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (closedQuote && !/[,\r\n\s]/.test(char)) throw new Error("Invalid characters after a quoted CSV cell.");
      if (char === '"') {
        if (currentVal.trim() || closedQuote) throw new Error("Invalid CSV quoting.");
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentVal.trim());
        currentVal = "";
        closedQuote = false;
      } else if (char === "\r") {
        // ignore CR
      } else if (char === "\n") {
        currentRow.push(currentVal.trim());
        if (currentRow.some((field) => field !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = "";
        closedQuote = false;
      } else {
        currentVal += char;
      }
    }
  }

  if (inQuotes) throw new Error("Unclosed CSV quote.");
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((field) => field !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Cleans currency values like "₹ 1,499.50", "₹1499", "(50.00)" -> -50, "-₹100" -> -100
export function cleanCurrency(val: unknown): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = String(val).trim();

  // Negative accounting format e.g. "(120.50)", "(₹120.50)", "-₹120.50", "- 120.50"
  const isNegative = /[-–—]/.test(s) || (s.includes("(") && s.includes(")"));
  s = s.replace(/[^0-9.]/g, "");
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

// Standardizes diverse date formats to YYYY-MM-DD
export function cleanDate(val: string): string {
  if (!val) return "";
  const s = val.trim();

  // Direct ISO: 2026-09-15 or 2026-09-15T12:00:00
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s) && Number.isFinite(Date.parse(s))) {
    const day = s.slice(0, 10);
    return Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day ? day : "";
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    const iso = `${year}-${month}-${day}`;
    return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso ? iso : "";
  }

  // Named months with a four-digit year are explicit; ambiguous short numeric dates reject.
  if (!/[a-z]/i.test(s) || !/\b\d{4}\b/.test(s)) return "";
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return "";
}

// Standardizes raw status string to OrderStatus
export function normalizeOrderStatus(rawStatus: string): OrderStatus {
  const s = (rawStatus || "").toLowerCase().trim();
  if (s.includes("undelivered")) return "SHIPPED";
  if (s === "delivered" || s === "completed") return "DELIVERED";
  if (s.includes("rto") || s.includes("return to origin") || s.includes("courier return")) return "RTO";
  if (s.includes("return") || s.includes("refund")) return "RETURNED";
  if (s.includes("cancel")) return "CANCELLED";
  if (s.includes("ship") || s.includes("dispatched") || s.includes("in transit")) return "SHIPPED";
  if (s.includes("pend") || s.includes("unfulfilled")) return "PENDING";
  return "PENDING";
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

  // Meesho Payment Settlement Report signature (TASK-5.1)
  const isMeeshoSettlement =
    (joined.includes("suborderno") || joined.includes("meesho")) &&
    (joined.includes("bankutr") || joined.includes("finalsettlementamount") || joined.includes("netamount") || joined.includes("settlementamount"));
  if (isMeeshoSettlement) {
    return {
      format: "MEESHO_SETTLEMENT",
      formatLabel: "Meesho Payment Settlement Report",
      defaultMarketplace: "Meesho",
      confidence: 0.98,
    };
  }

  // Meesho GST Tax Invoice / Orders Report signature (TASK-5.1)
  const isMeeshoOrders =
    joined.includes("suborderno") ||
    joined.includes("supplierdiscountedprice") ||
    (joined.includes("meesho") && (joined.includes("producttitle") || joined.includes("gstin")));
  if (isMeeshoOrders) {
    return {
      format: "MEESHO_ORDERS",
      formatLabel: "Meesho GST Tax Invoice / Orders Report",
      defaultMarketplace: "Meesho",
      confidence: 0.96,
    };
  }

  // Myntra Vendor Settlement Sheet signature (TASK-5.2)
  const isMyntraSettlement =
    (joined.includes("myntra") || joined.includes("styleid") || joined.includes("articleid") || joined.includes("skucode")) &&
    (joined.includes("settlementvalue") || joined.includes("myntracommission") || joined.includes("forwarddeliverycharge") || joined.includes("netpayable"));
  if (isMyntraSettlement) {
    return {
      format: "MYNTRA_SETTLEMENT",
      formatLabel: "Myntra Vendor Settlement Sheet",
      defaultMarketplace: "Myntra",
      confidence: 0.98,
    };
  }

  // Myntra Vendor Orders Report signature (TASK-5.2)
  const isMyntraOrders =
    (joined.includes("myntra") || joined.includes("orderreleaseid") || joined.includes("packetid")) &&
    (joined.includes("vendorarticlename") || joined.includes("stylecode") || joined.includes("storeid"));
  if (isMyntraOrders) {
    return {
      format: "MYNTRA_ORDERS",
      formatLabel: "Myntra Vendor Orders Report",
      defaultMarketplace: "Myntra",
      confidence: 0.96,
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
    defaultMarketplace: "Other",
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
export function detectAndMapCsv(
  rawText: string,
  products: Product[],
  customMappings?: AutoMappedColumn[]
): CsvMappingResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let rawRows: string[][] = [];
  try { rawRows = parseRawCsv(rawText); } catch { errors.push("Invalid CSV quoting."); }
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
      errors: [...errors, "The CSV file must contain a valid header row and at least one order record."],
      warnings: [],
    };
  }

  // 1. Locate header row
  const { rowIndex: headerRowIndex, headers: rawHeaders } = findHeaderRow(rawRows);
  const dataRows = rawRows.slice(headerRowIndex + 1).filter((r) => r.some((c) => c.trim() !== ""));

  // 2. Format signature detection
  const detectionMeta = detectFormatSignature(rawHeaders);

  // 3. Column auto-mapping (uses custom mappings if provided, else standard alias matcher)
  const columnMappings = customMappings || autoMapColumns(rawHeaders, dataRows);

  // Quick lookup map: targetField -> source column index
  const fieldToCol = new Map<string, number>();
  columnMappings.forEach((m) => fieldToCol.set(m.targetField, m.sourceIndex));

  // Exact master SKUs and marketplace-specific aliases; ambiguous matches stay unresolved.
  const productLookup = new Map<string, Product | null>();
  const aliasLookup = new Map<string, Product | null>();
  const add = (map: Map<string, Product | null>, key: string, product: Product) => {
    map.set(key, map.has(key) && map.get(key)?.sku !== product.sku ? null : product);
  };
  products.forEach(product => {
    add(productLookup, product.sku.toLowerCase().trim(), product);
    Object.entries(product.channelAliases || {}).forEach(([marketplace, alias]) => {
      if (alias) add(aliasLookup, JSON.stringify([marketplace, alias.toLowerCase().trim()]), product);
    });
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
    const sourceId = getVal("channelOrderId") || getVal("id");
    const sourceDate = cleanDate(getVal("orderDate"));
    const numeric = (field: string, fallback?: number) => {
      const value = getVal(field);
      if (!value) return fallback;
      if (!/^(?:[₹$€£]\s*)?-?\d[\d,]*(?:\.\d+)?$/.test(value)) return undefined;
      const parsed = cleanCurrency(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const quantity = numeric("quantity");
    const sellingPrice = numeric("sellingPrice");
    const discount = numeric("discount", 0);
    const taxAmount = numeric("taxAmount", 0);
    const shippingFeeCharged = numeric("shippingFeeCharged", 0);
    const marketplaceChargesEstimate = numeric("marketplaceChargesEstimate", 0);
    if (!rawSku || !sourceId || !sourceDate || quantity === undefined || !Number.isSafeInteger(quantity) || quantity <= 0 ||
        sellingPrice === undefined || sellingPrice < 0 || discount === undefined || discount < 0 || discount > sellingPrice * quantity ||
        taxAmount === undefined || taxAmount < 0 || shippingFeeCharged === undefined || shippingFeeCharged < 0 ||
        marketplaceChargesEstimate === undefined || marketplaceChargesEstimate < 0) {
      errors.push("Row " + rowNumber + ": requires an order reference, SKU, valid date, nonnegative unit price/amounts and positive whole quantity.");
      continue;
    }
    if (detectionMeta.format.includes("SETTLEMENT")) {
      errors.push("Row " + rowNumber + ": a settlement report cannot be imported as sales orders. Supply an order export with unit prices.");
      continue;
    }

    const rawMarketplace = getVal("marketplace");
    const marketplace: Marketplace = rawMarketplace ? normalizeMarketplace(rawMarketplace) : detectionMeta.defaultMarketplace;
    const matchedProduct = productLookup.get(rawSku.toLowerCase().trim()) || aliasLookup.get(JSON.stringify([marketplace, rawSku.toLowerCase().trim()]));

    if (matchedProduct) {
      matchedSkuCount++;
    } else {
      unmatchedSkuCount++;
    }

    const sku = matchedProduct ? matchedProduct.sku : rawSku.trim();
    const productName = getVal("productName") || matchedProduct?.name || `Product (${sku})`;

    // Zero financial guesswork: retain actual sheet deductions or 0 (no synthetic percentages)
    const channelOrderId = sourceId;
    const orderId = "CSV-" + encodeURIComponent(marketplace) + "-" + encodeURIComponent(channelOrderId);
    const orderDate = sourceDate;
    const status = normalizeOrderStatus(getVal("status"));
    const customerName = getVal("customerName");
    const customerCity = getVal("customerCity");
    const customerState = getVal("customerState");
    const historicalCost = matchedProduct?.costHistory?.find(cost => cost.validFrom.slice(0, 10) <= orderDate && (!cost.validTo || cost.validTo.slice(0, 10) >= orderDate));
    const snapshotUnitCost = historicalCost?.costPrice ?? 0;
    if (!historicalCost) warnings.push("Row " + rowNumber + ": historical cost is unknown for " + sku + "; no cost was invented.");
    if (!getVal("taxAmount")) warnings.push("Row " + rowNumber + ": tax was not supplied; recorded as 0, not inferred.");
    const signature = JSON.stringify([sku, getVal("lineItemId")]);
    const lineId = "LINE-" + encodeURIComponent(signature);

    const item: OrderItem = {
      id: lineId,
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

    const existing = orders.find(row => row.marketplace === marketplace && row.channelOrderId === channelOrderId);
    if (existing) {
      if (existing.orderDate !== orderDate || existing.status !== status || existing.shippingFeeCharged !== shippingFeeCharged || existing.marketplaceChargesEstimate !== marketplaceChargesEstimate) {
        errors.push("Row " + rowNumber + ": conflicting order-level fields for " + channelOrderId + ".");
      } else if (!existing.items.some(line => line.id === lineId)) existing.items.push(item);
      else if (JSON.stringify(existing.items.find(line => line.id === lineId)) !== JSON.stringify(item)) errors.push("Row " + rowNumber + ": ambiguous same-SKU lines; provide unique line item IDs.");
      else warnings.push("Row " + rowNumber + ": repeated identical line ignored for " + channelOrderId + ".");
    } else orders.push(order);
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
    orders: errors.length ? [] : orders,
    errors,
    warnings,
  };
}

