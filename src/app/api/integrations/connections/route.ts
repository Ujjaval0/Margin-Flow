import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/security/session";
import {
  getConnectionsForUser,
  saveConnection,
  disconnectConnection,
} from "@/lib/security/marketplace-vault";

/**
 * GET /api/integrations/connections
 * Retrieves list of connected channels for the authenticated merchant.
 * Metadata only — never returns raw secrets or encrypted tokens to the client.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to access marketplace connections." },
        { status: 401 }
      );
    }
    const connections = await getConnectionsForUser(userId);

    return NextResponse.json({
      success: true,
      connections,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to retrieve marketplace connections.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/connections
 * Vaults new marketplace credentials encrypted with AES-256-GCM.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to configure marketplace credentials." },
        { status: 401 }
      );
    }
    const body = await req.json();
    const { marketplace, sellerId, marketplaceId, authType, credentials } = body;

    if (!marketplace || typeof marketplace !== "string") {
      return NextResponse.json(
        { success: false, error: "Marketplace identifier is required." },
        { status: 400 }
      );
    }

    if (!credentials || typeof credentials !== "object" || Object.keys(credentials).length === 0) {
      return NextResponse.json(
        { success: false, error: "Marketplace credentials dictionary is required." },
        { status: 400 }
      );
    }

    const saved = await saveConnection(userId, {
      marketplace,
      sellerId,
      marketplaceId,
      authType,
      credentials,
    });

    return NextResponse.json({
      success: true,
      message: `${marketplace} credentials safely encrypted and vaulted.`,
      connection: saved,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to vault marketplace credentials.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/connections
 * Revokes and deletes a vaulted marketplace connection.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getSessionUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required to modify marketplace connections." },
        { status: 401 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const searchParams = req.nextUrl.searchParams;

    const marketplace = body.marketplace || searchParams.get("marketplace");
    const sellerId = body.sellerId || searchParams.get("sellerId") || undefined;

    if (!marketplace) {
      return NextResponse.json(
        { success: false, error: "Marketplace parameter is required for disconnection." },
        { status: 400 }
      );
    }

    await disconnectConnection(userId, marketplace, sellerId);

    return NextResponse.json({
      success: true,
      message: `${marketplace} has been disconnected and its stored credentials removed.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to disconnect channel.",
      },
      { status: 500 }
    );
  }
}
