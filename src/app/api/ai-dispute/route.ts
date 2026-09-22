import { NextRequest, NextResponse } from "next/server";
import { formatINR } from "@/lib/utils";

export interface DisputePacketPayload {
  marketplace: string;
  orderId: string;
  channelOrderId: string;
  sku: string;
  productName: string;
  returnType: string;
  condition: string;
  returnReason: string;
  awbNumber?: string;
  quantity: number;
  snapshotUnitCost: number;
  returnShippingCost: number;
  customerReturnFee?: number;
  salvageValue?: number;
  deliveredDate?: string;
  returnReceivedDate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const data: DisputePacketPayload = await req.json();

    const {
      marketplace,
      orderId,
      channelOrderId,
      sku,
      productName,
      returnType,
      condition,
      returnReason,
      awbNumber,
      quantity = 1,
      snapshotUnitCost = 0,
      returnShippingCost = 0,
      customerReturnFee = 0,
      salvageValue = 0,
    } = data;

    // Strict Invariant: Deterministic Math Only!
    const cogsLoss = Math.round(snapshotUnitCost * quantity * 100) / 100;
    const reverseShippingLoss = Math.round((returnShippingCost + (customerReturnFee || 0)) * 100) / 100;
    const salvageCredit = Math.round((salvageValue || 0) * 100) / 100;
    const totalClaimAmount = Math.max(0, Math.round((cogsLoss + reverseShippingLoss - salvageCredit) * 100) / 100);

    // Marketplace Policy Nuance
    const isAmazon = marketplace.toLowerCase().includes("amazon");
    const isFlipkart = marketplace.toLowerCase().includes("flipkart");
    const isMeesho = marketplace.toLowerCase().includes("meesho");

    let policyName = "Standard Marketplace Dispute";
    let slaDays = 14;
    let claimType: "DAMAGED_INVOICE" | "WRONG_RETURN_ITEM" | "LOST_IN_TRANSIT" = "DAMAGED_INVOICE";

    if (isAmazon) {
      policyName = "Amazon India SAFE-T Claim (Seller Assurance for E-Commerce Transactions)";
      slaDays = 30;
      if (returnReason.toLowerCase().includes("wrong") || returnReason.toLowerCase().includes("different")) {
        claimType = "WRONG_RETURN_ITEM";
      } else if (returnReason.toLowerCase().includes("lost") || returnType === "LOST_RETURN") {
        claimType = "LOST_IN_TRANSIT";
      }
    } else if (isFlipkart) {
      policyName = "Flipkart Seller Protection Fund (SPF) Claim";
      slaDays = 14;
      if (returnReason.toLowerCase().includes("wrong")) claimType = "WRONG_RETURN_ITEM";
    } else if (isMeesho) {
      policyName = "Meesho Supplier Support Return Dispute Ticket";
      slaDays = 7;
    }

    // Policy-compliant dispute narrative
    const claimTitle = isAmazon
      ? `SAFE-T Claim: Damaged/Defective Return for Order ${channelOrderId || orderId}`
      : `${marketplace} Seller Protection Claim: Damaged Return for Order ${channelOrderId || orderId}`;

    const disputeNarrative = `Dear ${marketplace} Seller Support / Dispute Claims Team,

I am writing to formally log a reimbursement claim under the ${policyName} policy for Order ID: ${channelOrderId || orderId}.

1. INCIDENT & TRANSACTION SUMMARY:
• Master Order Ref: ${orderId}
• Marketplace Order ID: ${channelOrderId || orderId}
• Product SKU: ${sku} (${productName})
• Quantity: ${quantity} unit(s)
• Courier Tracking / AWB: ${awbNumber || "Verified Reverse Courier Track"}
• Return Classification: ${returnType.replace(/_/g, " ")} (${condition})
• Buyer Return Stated Reason: "${returnReason || "Customer Damaged / Defective"}"

2. PHYSICAL CONDITION & QC INSPECTION:
Upon unboxing and physical intake inspection at our fulfillment facility, the returned unit was verified to be ${condition}. The product is physically compromised, unsellable, and cannot be salvaged into new inventory. 
Per ${marketplace} Merchant Policy, sellers are protected against customer-induced damage, transit abuse, and illegitimate returns.

3. QUANTIFIED REIMBURSEMENT BREAKDOWN (INR):
• Product Cost Basis (COGS Snapshot): ₹${cogsLoss.toFixed(2)} (₹${snapshotUnitCost.toFixed(2)} × ${quantity})
• Non-Recoverable Reverse Shipping & Processing Fees: ₹${reverseShippingLoss.toFixed(2)}
• Salvage Recovery Value: -₹${salvageCredit.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL REIMBURSEMENT AMOUNT CLAIMED: ₹${totalClaimAmount.toFixed(2)}

4. EVIDENCE ENCLOSED:
We have documented and archived high-resolution evidence including:
[x] Clear photograph of outer shipping box showing courier AWB label
[x] Clear high-resolution photographs of damaged product and serial tag
[x] Original tax invoice and verified purchase cost snapshot
[x] Physical warehouse unboxing intake inspection timestamp

Please process this credit to our registered seller payout account within the statutory ${slaDays}-day SLA.

Sincerely,
Authorized Seller Operations & Finance`;

    const evidenceChecklist = [
      `Photographic evidence of outer shipping package with readable AWB: ${awbNumber || "AWB"}`,
      "High-resolution photograph of the damaged product and intact seal/tags",
      `Original Tax Invoice / Bill showing unit cost of ₹${snapshotUnitCost.toFixed(2)}`,
      "Warehouse unboxing video or intake log timestamp",
    ];

    return NextResponse.json({
      success: true,
      data: {
        claimTitle,
        claimType,
        policyName,
        slaDays,
        itemization: {
          cogsLoss,
          reverseShippingLoss,
          salvageCredit,
          totalClaimAmount,
        },
        disputeNarrative,
        evidenceChecklist,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to generate dispute packet." },
      { status: 500 }
    );
  }
}
