"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { createPortal } from "react-dom";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { Marketplace } from "@/domain/types";
const CsvImportModal = dynamic(
  () => import("@/components/modals/csv-import-modal").then(mod => mod.CsvImportModal),
  { ssr: false }
);
import {
  RefreshCw,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  ShoppingBag,
  Store,
  Layers,
  ArrowRight,
  Upload,
  Globe,
  Lock,
  X,
  SlidersHorizontal,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  Terminal,
  Info,
  AlertCircle,
} from "lucide-react";

interface ChannelConfig {
  id: string;
  name: string;
  marketplace: Marketplace;
  category: string;
  endpoint: string;
  defaultTab: "webhook" | "api" | "csv";
  supportedModes: Array<"webhook" | "api" | "csv">;
}

const CHANNELS: ChannelConfig[] = [
  {
    id: "shopify",
    name: "Shopify",
    marketplace: "Personal Website",
    category: "Direct Storefront",
    endpoint: "/api/webhooks/shopify",
    defaultTab: "api",
    supportedModes: ["api", "webhook", "csv"],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    marketplace: "WooCommerce",
    category: "WordPress Store",
    endpoint: "/api/webhooks/woocommerce",
    defaultTab: "api",
    supportedModes: ["api", "webhook", "csv"],
  },
  {
    id: "amazon",
    name: "Amazon India",
    marketplace: "Amazon India",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "api",
    supportedModes: ["api", "csv"],
  },
  {
    id: "flipkart",
    name: "Flipkart",
    marketplace: "Flipkart",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "api",
    supportedModes: ["api", "csv"],
  },
  {
    id: "meesho",
    name: "Meesho",
    marketplace: "Meesho",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "csv",
    supportedModes: ["csv"],
  },
  {
    id: "myntra",
    name: "Myntra",
    marketplace: "Myntra",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "csv",
    supportedModes: ["csv"],
  },
];

const CATALOG_PLATFORMS = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Cloud storefront with real-time order and inventory webhooks.",
    icon: ShoppingBag,
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "WordPress e-commerce integration via REST API and webhooks.",
    icon: Store,
  },
  {
    id: "amazon",
    name: "Amazon India",
    description: "Merchant Tax Report (MTR) and date range report ingestion.",
    icon: Layers,
  },
  {
    id: "flipkart",
    name: "Flipkart",
    description: "Seller Hub settlement reconciliation sheets and developer API.",
    icon: Zap,
  },
  {
    id: "meesho",
    name: "Meesho",
    description: "Upload Official Supplier Report (Payment Settlement & GST Tax Invoice).",
    icon: Globe,
  },
  {
    id: "myntra",
    name: "Myntra",
    description: "Upload Vendor Settlement Sheet (PPMP/Omni API available).",
    icon: ShoppingBag,
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Headless and storefront order webhook receiver.",
    icon: ExternalLink,
    comingSoon: true,
  },
];

const CHANNEL_LOGOS: Record<string, string> = {
  shopify: "/integrations/shopify.svg",
  woocommerce: "/integrations/woocommerce.png",
  amazon: "/integrations/logo-amazon.svg",
  flipkart: "/integrations/flipkart-icon.svg",
  meesho: "/integrations/meesho.svg",
  myntra: "/integrations/myntra-2.svg",
};

interface StoredChannelCredentials {
  connectionId?: string;
  credentialStatus?: string;
  authType?: string;
  webhookPath?: string;
  vaulted?: boolean;
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  webhookSecret?: string;
  appId?: string;
  appSecret?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  sellerId?: string;
  supplierId?: string;
  apiKey?: string;
  apiUrl?: string;
  connected?: boolean;
  lastSyncedAt?: string;
  totalOrdersInStore?: number;
}

function channelHasValidCredentials(channelId: string, creds?: StoredChannelCredentials): boolean {
  if (!creds) return false;
  if (creds.vaulted) return true;
  switch (channelId) {
    case "shopify":
      return Boolean(creds.storeUrl?.trim() && creds.consumerKey?.trim());
    case "woocommerce":
      return Boolean(creds.storeUrl?.trim() && creds.consumerKey?.trim() && creds.consumerSecret?.trim());
    case "amazon":
      return Boolean(creds.clientId?.trim() && creds.clientSecret?.trim() && creds.refreshToken?.trim());
    case "flipkart":
      return Boolean(creds.appId?.trim() && creds.appSecret?.trim());
    case "meesho":
      return Boolean(creds.supplierId?.trim() && creds.apiKey?.trim());
    case "myntra":
      return Boolean(creds.supplierId?.trim() && creds.apiKey?.trim());
    default:
      return false;
  }
}

const STORAGE_CHANNELS_KEY = "MARGINFLOW_CHANNEL_CONFIGS_V1";

export function WebhookSimulatorView() {
  const { orders, products, addOrder, syncExternalOrders, refreshFromDatabase } = usePlatform();

  // Dynamic connection & active state per channel
  // Green dot = Active / Connected; Black dot = Inactive / Deactivated
  const [channelCredentials, setChannelCredentials] = useState<Record<string, StoredChannelCredentials>>({});
  const [connectedChannels, setConnectedChannels] = useState<Record<string, boolean>>({
    shopify: false,
    woocommerce: false,
    amazon: false,
    flipkart: false,
    meesho: false,
    myntra: false,
  });

  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load saved channel connections from server vault on client mount
  // Enforces Zero Client-Side Master Secrets (TASK-2.3)
  useEffect(() => {
    async function initVaultConnections() {
      // 1. Fetch live vaulted connections from server
      try {
        const res = await fetch("/api/integrations/connections");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.connections)) {
            const serverConnected: Record<string, boolean> = {
              shopify: false,
              woocommerce: false,
              amazon: false,
              flipkart: false,
              meesho: false,
              myntra: false,
            };
            const serverMeta: Record<string, StoredChannelCredentials> = {};

            data.connections.forEach((conn: any) => {
              const ch = CHANNELS.find(
                (c) =>
                  c.name.toLowerCase() === conn.marketplace.toLowerCase() ||
                  c.id === conn.marketplace.toLowerCase() ||
                  (conn.marketplace === "Amazon India" && c.id === "amazon")
              );
              if (ch && conn.isActive) {
                serverConnected[ch.id] = conn.credentialStatus === "VERIFIED";
                serverMeta[ch.id] = {
                  connectionId: conn.id, storeUrl: conn.storeUrl, credentialStatus: conn.credentialStatus, authType: conn.authType,
                  webhookPath: conn.webhookPath,
                  vaulted: true,
                  connected: conn.credentialStatus === "VERIFIED",
                  sellerId: conn.sellerId,
                  lastSyncedAt: conn.lastSyncedAt,
                };
              }
            });

            setConnectedChannels((prev) => ({ ...prev, ...serverConnected }));
            setChannelCredentials((prev) => ({ ...prev, ...serverMeta }));
          }
        }
      } catch (err) {
        console.warn("Failed to load server vaulted connections:", err);
      }

      // 2. Cleanse any legacy secrets from browser localStorage
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(STORAGE_CHANNELS_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === "object") {
              const sanitized: Record<string, any> = {};
              Object.keys(parsed).forEach((k) => {
                const item = parsed[k];
                if (item) {
                  sanitized[k] = {
                    storeUrl: item.storeUrl,
                    sellerId: item.sellerId || item.supplierId,
                    connected: Boolean(item.connected),
                    lastSyncedAt: item.lastSyncedAt,
                    totalOrdersInStore: item.totalOrdersInStore,
                  };
                }
              });
              localStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(sanitized));
            }
          }
        } catch (e) {
          console.error("Failed to sanitize local storage channel configs:", e);
        }
      }
    }

    initVaultConnections();
  }, []);

  const saveChannelCredentials = (channelId: string, creds: StoredChannelCredentials) => {
    // Zero Client-Side Master Secrets: Strip sensitive tokens before saving to state or localStorage
    const safeMetadata: StoredChannelCredentials = {
      storeUrl: creds.storeUrl,
      sellerId: creds.sellerId || creds.supplierId,
      connected: creds.connected,
      lastSyncedAt: creds.lastSyncedAt,
      totalOrdersInStore: creds.totalOrdersInStore,
    };

    setChannelCredentials((prev) => {
      const next = { ...prev, [channelId]: { ...(prev[channelId] || {}), ...safeMetadata } };
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(next));
        }
      } catch (err) {
        console.error("Failed to save channel metadata:", err);
      }
      return next;
    });
  };

  const vaultCredentialsOnServer = async (marketplace: string, credentials: Record<string, any>) => {
    const channel = CHANNELS.find(candidate => candidate.name === marketplace);
    if (!channel) throw new Error("Unsupported platform.");
    const response = await fetch("/api/integrations/connections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace, connectionId: channelCredentials[channel.id]?.connectionId, credentials }),
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.connection) throw new Error(result.error || "Could not securely save the store credentials.");
    const connection = result.connection;
    const metadata: StoredChannelCredentials = { connectionId: connection.id, storeUrl: connection.storeUrl,
      vaulted: true, connected: connection.credentialStatus === "VERIFIED", credentialStatus: connection.credentialStatus,
      authType: connection.authType, webhookPath: connection.webhookPath, sellerId: connection.sellerId, lastSyncedAt: connection.lastSyncedAt };
    setChannelCredentials(previous => ({ ...previous, [channel.id]: metadata }));
    setConnectedChannels(previous => ({ ...previous, [channel.id]: Boolean(metadata.connected) }));
    return metadata;
  };

  // Real-time dynamic aggregation based on the actual platform orders
  const channelMetrics = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {
      shopify: { count: 0, revenue: 0 },
      woocommerce: { count: 0, revenue: 0 },
      amazon: { count: 0, revenue: 0 },
      flipkart: { count: 0, revenue: 0 },
      meesho: { count: 0, revenue: 0 },
      myntra: { count: 0, revenue: 0 },
    };

    orders.forEach((o) => {
      let key: string | null = null;
      if (o.marketplace === "Personal Website") key = "shopify";
      else if (o.marketplace === "WooCommerce") key = "woocommerce";
      else if (o.marketplace === "Amazon India") key = "amazon";
      else if (o.marketplace === "Flipkart") key = "flipkart";
      else if (o.marketplace === "Meesho") key = "meesho";
      else if (o.marketplace === "Myntra") key = "myntra";

      if (key && stats[key]) {
        stats[key].count += 1;
        const orderRev = o.items.reduce(
          (sum, it) => sum + (it.sellingPrice * it.quantity - (it.discount || 0)),
          0
        );
        stats[key].revenue += orderRev;
      }
    });

    return stats;
  }, [orders]);

  const totalOrders = orders.length;
  const totalRevenue = useMemo(() => {
    return orders.reduce(
      (sum, o) =>
        sum + o.items.reduce((s, it) => s + (it.sellingPrice * it.quantity - (it.discount || 0)), 0),
      0
    );
  }, [orders]);

  const activeChannelsCount = useMemo(() => {
    return Object.values(connectedChannels).filter(Boolean).length;
  }, [connectedChannels]);

  const [verifyingChannelId, setVerifyingChannelId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Setup / Configuration Modal
  const [setupModalChannel, setSetupModalChannel] = useState<ChannelConfig | null>(null);
  const [setupTab, setSetupTab] = useState<"webhook" | "api" | "csv">("webhook");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);

  // Form states for credentials
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [shopifyClientId, setShopifyClientId] = useState("");
  const [shopifyClientSecret, setShopifyClientSecret] = useState("");
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);
  const [flipkartAppId, setFlipkartAppId] = useState("");
  const [flipkartAppSecret, setFlipkartAppSecret] = useState("");
  const [amazonClientId, setAmazonClientId] = useState("");
  const [amazonClientSecret, setAmazonClientSecret] = useState("");
  const [amazonRefreshToken, setAmazonRefreshToken] = useState("");
  const [amazonSellerId, setAmazonSellerId] = useState("");

  // Add Store Catalog Modal
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);

  // CSV Ingestion Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [hasOpenedCsv, setHasOpenedCsv] = useState(false);

  const closeSetup = () => {
    setSetupModalChannel(null);
    setCustomApiKey(""); setWebhookSecret(""); setSigningSecret("");
    setShopifyClientId(""); setShopifyClientSecret("");
    setFlipkartAppId(""); setFlipkartAppSecret("");
    setAmazonClientId(""); setAmazonClientSecret(""); setAmazonRefreshToken("");
  };

  // Keyboard dismissal (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (setupModalChannel) closeSetup();
        if (isAddStoreOpen) setIsAddStoreOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setupModalChannel, isAddStoreOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (title: string, message: string) => {
    setNotification({ title, message });
  };

  // Status pill click: Never flip to Active on click when inactive!
  const handleStatusBadgeClick = (channel: ChannelConfig) => {
    const isActive = Boolean(connectedChannels[channel.id]);
    if (!isActive) {
      // Must not activate directly! Open configuration modal to enter third-party credentials.
      openConfigForChannel(channel);
      showToast(
        "Credentials Required",
        `Enter your ${channel.name} API credentials and verify connection to activate.`
      );
      return;
    }
    // If active, open configure modal to manage settings or disconnect
    openConfigForChannel(channel);
  };

  const handleDisconnectChannel = async (channelId: string) => {
    const channel = CHANNELS.find((c) => c.id === channelId);
    const channelName = channel?.name || "Channel";
    const marketplace = channelId === "amazon" ? "Amazon India" : channelName;

    try {
      const response = await fetch("/api/integrations/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplace, connectionId: channelCredentials[channelId]?.connectionId }),
      });
      if (!response.ok || !(await response.json()).success) throw new Error("Could not disconnect channel.");
      setConnectedChannels((prev) => ({ ...prev, [channelId]: false }));
      setChannelCredentials((prev) => ({ ...prev, [channelId]: { connected: false } }));
    } catch (e) {
      showToast("Disconnection Failed", "Could not disconnect channel. Please retry.");
      return;
    }

    showToast("Channel Disconnected", `${channelName} has been disconnected and is now Inactive.`);
  };

  const getFullWebhookUrl = (endpoint: string) => {
    const channel = CHANNELS.find((candidate) => candidate.endpoint === endpoint);
    const ownedPath = channel ? channelCredentials[channel.id]?.webhookPath : undefined;
    if (!ownedPath) return "";
    if (typeof window !== "undefined") {
      return `${window.location.origin}${ownedPath || endpoint}`;
    }
    return `https://your-domain.com${endpoint}`;
  };

  // Quick verify status check — strictly tests valid third-party credentials
  const handleVerifyChannel = async (channel: ChannelConfig) => {
    if (!channel.supportedModes.includes("api")) { openConfigForChannel(channel); return; }
    setVerifyingChannelId(channel.id);
    openConfigForChannel(channel);
    try {
      const id = channelCredentials[channel.id]?.connectionId;
      if (!id) { showToast("Credentials required", "Configure and save this store first."); return; }
      const response = await fetch(`/api/integrations/${channel.id}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test_connection", connectionId: id }) });
      const data = await response.json();
      setApiTestResult({ success: response.ok && data.success, message: data.message || data.error || "Store verification completed." });
    } catch { setApiTestResult({ success: false, message: "Store verification failed. Please retry." }); }
    finally { setVerifyingChannelId(null); }
  };

  // Webhook ping test (endpoint reachability test only — does not connect third-party accounts)
  const handleTestPing = async () => {
    if (!setupModalChannel) return;
    if (!channelCredentials[setupModalChannel.id]?.webhookPath) {
      showToast("Save connection first", "Save and verify your API credentials before configuring webhook delivery.");
      return;
    }
    setIsTestingPing(true);
    setPingSuccess(false);
    try {
      const res = await fetch(getFullWebhookUrl(setupModalChannel.endpoint), {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPingSuccess(true);
        showToast("Handshake Verified", `${setupModalChannel.name} webhook receiver responded with HTTP 200 OK.`);
      } else {
        showToast("Ping Failed", data.error || `Endpoint responded with HTTP ${res.status}`);
      }
    } catch (err: any) {
      showToast("Endpoint Error", `Could not reach endpoint: ${err.message}`);
    } finally {
      setIsTestingPing(false);
    }
  };

  // Verify and persist first; subsequent synchronization uses only a server-owned connection ID.
  const configuredCredentials = (id: string): Record<string, string> => id === "woocommerce"
    ? { storeUrl: customApiUrl, consumerKey: customApiKey, consumerSecret: webhookSecret, webhookSecret: signingSecret }
    : id === "shopify" ? { shopDomain: customApiUrl, accessToken: customApiKey, clientId: shopifyClientId, clientSecret: shopifyClientSecret, webhookSecret: signingSecret }
    : id === "amazon" ? { clientId: amazonClientId, clientSecret: amazonClientSecret, refreshToken: amazonRefreshToken, sellerId: amazonSellerId }
    : { appId: flipkartAppId, appSecret: flipkartAppSecret };

  const clearCredentialInputs = () => {
    setCustomApiKey(""); setWebhookSecret(""); setSigningSecret(""); setShopifyClientId(""); setShopifyClientSecret("");
    setAmazonClientId(""); setAmazonClientSecret(""); setAmazonRefreshToken(""); setFlipkartAppId(""); setFlipkartAppSecret("");
  };

  const ensureSavedConnection = async (id: string) => {
    const saved = channelCredentials[id];
    if (saved?.connectionId && saved.credentialStatus === "VERIFIED" && !isUpdatingCredentials) return saved;
    const channel = CHANNELS.find(candidate => candidate.id === id)!;
    const metadata = await vaultCredentialsOnServer(channel.name, configuredCredentials(id));
    clearCredentialInputs(); setIsUpdatingCredentials(false);
    return metadata;
  };

  const testConfiguredConnection = async (id: string) => {
    setIsTestingApi(true); setApiTestResult(null);
    try {
      const alreadySaved = channelCredentials[id]?.connectionId && !isUpdatingCredentials;
      const connection = await ensureSavedConnection(id);
      if (alreadySaved) {
        const response = await fetch(`/api/integrations/${id}/sync`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test_connection", connectionId: connection.connectionId }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Store verification failed.");
      }
      setConnectedChannels(previous => ({ ...previous, [id]: true }));
      setApiTestResult({ success: true, message: "Order access verified. Credentials are encrypted and saved for future use." });
    } catch (error: any) { setApiTestResult({ success: false, message: error.message || "Could not verify the store." }); }
    finally { setIsTestingApi(false); }
  };

  const syncConfiguredConnection = async (id: string) => {
    setIsSyncingOrders(true); setApiTestResult(null);
    try {
      const connection = await ensureSavedConnection(id);
      const response = await fetch(`/api/integrations/${id}/sync`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch_orders", connectionId: connection.connectionId, background: true }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Could not queue synchronization.");
      setApiTestResult({ success: true, message: "Credentials saved. Synchronization continues securely on the server, including after you close this page." });
      for (let attempt = 0; data.taskId && attempt < 12; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/integrations/jobs?id=${encodeURIComponent(data.taskId)}`, { cache: "no-store" });
        if (!statusResponse.ok) break;
        const status = (await statusResponse.json()).task;
        if (["FAILED", "REAUTH_REQUIRED"].includes(status?.status)) throw new Error(status.error || "Store synchronization needs attention.");
        if (["succeeded", "partial"].includes(status?.result?.status)) {
          await refreshFromDatabase();
          setApiTestResult({ success: true, message: `Synchronization complete: ${status.result.importedCount || 0} new, ${status.result.updatedCount || 0} updated, ${status.result.skippedCount || 0} awaiting reconciliation.` });
          break;
        }
      }
    } catch (error: any) { setApiTestResult({ success: false, message: error.message || "Could not synchronize the store." }); }
    finally { setIsSyncingOrders(false); }
  };

  const handleTestWooCommerceConnection = () => testConfiguredConnection("woocommerce");
  const handleSyncWooCommerceOrders = () => syncConfiguredConnection("woocommerce");
  const handleTestShopifyConnection = () => testConfiguredConnection("shopify");
  const handleSyncShopifyOrders = () => syncConfiguredConnection("shopify");
  const handleTestFlipkartConnection = () => testConfiguredConnection("flipkart");
  const handleSyncFlipkartOrders = () => syncConfiguredConnection("flipkart");
  const handleTestAmazonConnection = () => testConfiguredConnection("amazon");
  const handleSyncAmazonOrders = () => syncConfiguredConnection("amazon");

  const handleAuthorizeChannel = async () => {
    if (!setupModalChannel) return;
    setIsTestingApi(true);
    try {
      const search = new URLSearchParams(setupModalChannel.id === "shopify" ? { shop: customApiUrl } : {});
      const response = await fetch(`/api/integrations/${setupModalChannel.id}/connect?${search}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || "Could not start authorization.");
      window.location.assign(data.authorizationUrl);
    } catch (error: any) { setApiTestResult({ success: false, message: error.message || "Could not start authorization." }); }
    finally { setIsTestingApi(false); }
  };

  const saveSigningSecret = async () => {
    if (!setupModalChannel || !signingSecret.trim() || !channelCredentials[setupModalChannel.id]?.connectionId) return;
    setIsTestingApi(true);
    try {
      await vaultCredentialsOnServer(setupModalChannel.name, { webhookSecret: signingSecret });
      setSigningSecret("");
      showToast("Signing secret saved", "Use the same secret in your store's webhook configuration.");
    } catch (error: any) { showToast("Could not save signing secret", error.message || "Please retry."); }
    finally { setIsTestingApi(false); }
  };

  const handleCopy = (text: string, isCurl: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isCurl) {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const openConfigForChannel = (channel: ChannelConfig) => {
    setSetupModalChannel(channel);
    setIsUpdatingCredentials(false);
    setSigningSecret(""); setShopifyClientId(""); setShopifyClientSecret("");
    setSetupTab(channel.defaultTab);
    setPingSuccess(false);
    setApiTestResult(null);

    const creds = channelCredentials[channel.id];
    if (creds) {
      setCustomApiUrl(creds.storeUrl || "");
      setCustomApiKey(creds.consumerKey || "");
      setWebhookSecret(creds.consumerSecret || creds.webhookSecret || "");
      setFlipkartAppId(creds.appId || "");
      setFlipkartAppSecret(creds.appSecret || "");
      setAmazonClientId(creds.clientId || "");
      setAmazonClientSecret(creds.clientSecret || "");
      setAmazonRefreshToken(creds.refreshToken || "");
      setAmazonSellerId(creds.sellerId || "");
    } else {
      setCustomApiUrl("");
      setCustomApiKey("");
      setWebhookSecret("");
      setFlipkartAppId("");
      setFlipkartAppSecret("");
      setAmazonClientId("");
      setAmazonClientSecret("");
      setAmazonRefreshToken("");
      setAmazonSellerId("");
    }
  };

  // Reuse the local platform logos in the existing icon slot.
  const renderSimpleIcon = (id: string) => {
    const logo = CHANNEL_LOGOS[id];
    if (logo) {
      return (
        <Image
          src={logo}
          alt=""
          aria-hidden="true"
          width={32}
          height={32}
          className={id === "woocommerce" ? "w-8 h-auto object-contain" : "w-5 h-5 object-contain"}
        />
      );
    }

    const iconClass = "w-4 h-4 text-[#1D1D1F] stroke-[1.75]";
    switch (id) {
      default:
        return <SlidersHorizontal className={iconClass} />;
    }
  };

  return (
    <div className="space-y-4 w-full max-w-[1440px] min-w-0 mx-auto animate-in fade-in duration-150 pb-12">
      {/* Toast Notification — Portaled to document.body so it NEVER affects or shifts page structure */}
      {mounted && notification && createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto flex items-center gap-3 bg-white/95 backdrop-blur-md text-[#1D1D1F] px-4.5 py-2.5 rounded-full shadow-apple-lg border border-black/[0.08] animate-in slide-in-from-bottom-3 fade-in duration-200">
          <span className="w-1.5 h-1.5 rounded-full bg-[#288548] shrink-0" />
          <div className="text-xs font-medium text-[#1D1D1F] whitespace-nowrap">
            <span className="font-semibold">{notification.title}</span> — {notification.message}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[#86868B] hover:text-[#1D1D1F] ml-1 p-0.5 rounded-full hover:bg-black/[0.05] cursor-pointer transition active:scale-95"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="pb-2 border-b border-black/[0.04]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
          Store Integrations
        </h1>
        <p className="text-xs sm:text-sm text-[#86868B] mt-1">
          Marketplace SP-API Connectors, Couriers &amp; Webhooks
        </p>
      </div>

      {/* Clean Minimal Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="apple-card rounded-2xl p-4 shadow-apple-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#86868B] font-medium">Configured Channels</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {activeChannelsCount} Active
            </span>
          </div>
          <div className="text-xl font-semibold tracking-tight text-[#1D1D1F] mt-1 tabular-nums">
            {CHANNELS.length} channels
          </div>
        </div>

        <div className="apple-card rounded-2xl p-4 shadow-apple-sm flex flex-col justify-between">
          <span className="text-xs text-[#86868B] font-medium">Total Orders (Live)</span>
          <div className="text-xl font-semibold tracking-tight text-[#1D1D1F] mt-1 tabular-nums">
            {totalOrders} orders
          </div>
        </div>

        <div className="apple-card rounded-2xl p-4 shadow-apple-sm flex flex-col justify-between">
          <span className="text-xs text-[#86868B] font-medium">Gross Revenue (Live)</span>
          <div className="text-xl font-semibold tracking-tight text-[#1D1D1F] mt-1 tabular-nums">
            {formatINR(totalRevenue)}
          </div>
        </div>
      </div>

      {/* Store Cards Grid: Clean, Simplistic & Informative with Dynamic Green/Black Status Dot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
        {CHANNELS.map((channel) => {
          const metrics = channelMetrics[channel.id] || { count: 0, revenue: 0 };
          const isVerifying = verifyingChannelId === channel.id;
          const isFileBased = channel.id === "amazon" || channel.id === "flipkart" || channel.id === "meesho";
          const isActive = Boolean(connectedChannels[channel.id]);

          return (
            <div
              key={channel.id}
              className="apple-card rounded-2xl p-4.5 shadow-apple-sm hover:shadow-apple-md transition-all duration-150 flex flex-col justify-between"
            >
              <div>
                {/* Header: Simplistic Icon + Name + Category + Dynamic Status Dot */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center shrink-0">
                      {renderSimpleIcon(channel.id)}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#1D1D1F] truncate">
                        {channel.name}
                      </h3>
                      <p className="text-[11px] text-[#86868B] truncate mt-0.5">
                        {channel.category}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Status Pill: Never toggles blindly to Active! */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusBadgeClick(channel);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 hover:bg-emerald-500/15"
                        : "bg-black/[0.04] text-[#6E6E73] border border-black/[0.08] hover:bg-black/[0.08]"
                    }`}
                    title={
                      isActive
                        ? "Channel is active. Click to view configuration."
                        : "Channel is inactive. Click to configure credentials."
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        isActive ? "bg-emerald-500" : "bg-[#1D1D1F]"
                      }`}
                    />
                    <span>{isActive ? "Active" : "Inactive"}</span>
                  </button>
                </div>

                {/* Real-Time Live Stats Row */}
                <div className="flex items-center justify-between text-xs py-2.5 border-y border-black/[0.04] my-3">
                  <div>
                    <span className="text-[#86868B]">Orders: </span>
                    <span className="font-semibold text-[#1D1D1F] tabular-nums">
                      {metrics.count} {metrics.count === 1 ? "order" : "orders"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#86868B]">Sales: </span>
                    <span className="font-semibold text-[#1D1D1F] tabular-nums">
                      {formatINR(metrics.revenue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cohesive, Clean Action Bar */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => openConfigForChannel(channel)}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-xl bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border border-black/[0.08] shadow-apple-xs active:scale-[0.98] transition cursor-pointer text-center"
                >
                  Configure
                </button>

                <button
                  onClick={() => handleVerifyChannel(channel)}
                  disabled={isVerifying}
                  className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.05] shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                  title="Verify API connection with third-party credentials"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                  <span>Verify</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Sheet Modal — Clean & Streamlined */}
      {mounted && setupModalChannel && createPortal(
        <div
          onClick={closeSetup}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-card rounded-3xl max-w-lg w-full border border-black/[0.08] shadow-apple-lg overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] flex items-center justify-between bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center shrink-0">
                  {renderSimpleIcon(setupModalChannel.id)}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                    {setupModalChannel.name}
                  </h3>
                  <p className="text-xs text-[#86868B]">
                    Configure credentials and data streams
                  </p>
                </div>
              </div>

              {/* Status Indicator & Close X in Modal Header */}
              <div className="flex items-center gap-2">
                {channelCredentials[setupModalChannel.id]?.vaulted && (
                  <button
                    type="button"
                    onClick={() => handleDisconnectChannel(setupModalChannel.id)}
                    className="text-[11px] text-red-600 hover:text-red-700 font-medium px-2 py-0.5 rounded-full hover:bg-red-500/10 transition cursor-pointer"
                    title="Disconnect this channel"
                  >
                    Disconnect
                  </button>
                )}

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                    connectedChannels[setupModalChannel.id]
                      ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20"
                      : "bg-black/[0.04] text-[#6E6E73] border border-black/[0.08]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectedChannels[setupModalChannel.id] ? "bg-emerald-500" : "bg-[#1D1D1F]"
                    }`}
                  />
                  <span>
                    {connectedChannels[setupModalChannel.id] ? "Active" : "Inactive"}
                  </span>
                </span>

                <button
                  onClick={closeSetup}
                  aria-label="Close dialog"
                  className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Segmented Tab Bar — Simple Labels */}
            {setupModalChannel.supportedModes.length > 1 && (
              <div className="px-6 pt-4">
                <div className={`grid grid-cols-${setupModalChannel.supportedModes.length} p-1 bg-[#F5F5F7] rounded-xl gap-1 text-xs border border-black/[0.04]`}>
                  {setupModalChannel.supportedModes.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSetupTab(mode)}
                      className={`py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                        setupTab === mode
                          ? "bg-white text-[#1D1D1F] font-semibold shadow-apple-sm"
                          : "text-[#86868B] hover:text-[#1D1D1F]"
                      }`}
                    >
                      {mode === "webhook" && "Webhook"}
                      {mode === "api" && "API Token"}
                      {mode === "csv" && "Upload File"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* TAB 1: WEBHOOK */}
              {setupTab === "webhook" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#6E6E73] mb-1.5">
                      Webhook Endpoint URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getFullWebhookUrl(setupModalChannel.endpoint)}
                        className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white text-[#1D1D1F] select-all outline-none transition-colors"
                      />
                      <button
                        onClick={() => handleCopy(getFullWebhookUrl(setupModalChannel.endpoint))}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-xs font-medium text-[#1D1D1F] shrink-0 border border-black/[0.06] shadow-apple-xs active:scale-[0.98] transition cursor-pointer"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-[#1D1D1F]" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedUrl ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {setupModalChannel.id === "shopify" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">
                        How to connect in Shopify:
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">1.</span>
                        <span>Open Shopify Admin &gt; Settings &gt; Notifications.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">2.</span>
                        <span>Scroll down to Webhooks and click <strong>Create webhook</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">3.</span>
                        <span>Event: <strong>Order creation</strong> (Format: JSON). Paste the URL above and save.</span>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "woocommerce" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">
                        How to connect in WooCommerce:
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">1.</span>
                        <span>In WordPress, open <strong>WooCommerce &gt; Settings &gt; Advanced &gt; Webhooks</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">2.</span>
                        <span>Click <strong>Add webhook</strong>, set Topic: <strong>Order created</strong>, Status: <strong>Active</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">3.</span>
                        <span>Paste the Delivery URL above.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">4.</span>
                        <span>Set Secret to the signing secret saved below. If you have not changed it, use the Consumer Secret from this store's API setup.</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="store-webhook-secret" className="block text-xs font-medium text-[#6E6E73]">Webhook signing secret</label>
                    <input id="store-webhook-secret" type="password" autoComplete="new-password" value={signingSecret}
                      placeholder="Enter only to set or replace the saved secret" onChange={event => setSigningSecret(event.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] outline-none" />
                    <button type="button" disabled={!signingSecret.trim() || isTestingApi || !channelCredentials[setupModalChannel.id]?.connectionId}
                      onClick={saveSigningSecret} className="px-3 py-2 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-xs font-medium cursor-pointer disabled:opacity-50">Save signing secret</button>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTestPing}
                        disabled={isTestingPing}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-semibold shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isTestingPing ? "animate-spin text-[#1D1D1F]" : ""}`} />
                        <span>{isTestingPing ? "Checking..." : "Verify Endpoint"}</span>
                      </button>
                    </div>

                    {pingSuccess && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#288548]">
                        <CheckCircle2 className="w-4 h-4 text-[#288548]" />
                        Endpoint reachable
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: API TOKEN */}
              {setupTab === "api" && (
                <div className="space-y-4">
                  {channelCredentials[setupModalChannel.id]?.vaulted && (
                    <div className="flex items-center justify-between gap-3 text-xs text-[#6E6E73]">
                      <span>{isUpdatingCredentials ? "Blank secret fields keep the saved values. Changes are verified before saving." : "Credentials are encrypted and saved. They are never displayed here."}</span>
                      <button type="button" disabled={isTestingApi || isSyncingOrders} onClick={() => { setIsUpdatingCredentials(previous => !previous); clearCredentialInputs(); setApiTestResult(null); }}
                        className="shrink-0 px-3 py-2 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] text-xs font-medium cursor-pointer">
                        {isUpdatingCredentials ? "Cancel update" : "Update credentials"}
                      </button>
                    </div>
                  )}
                  {["amazon", "flipkart", "shopify"].includes(setupModalChannel.id) && (
                    <button type="button" onClick={handleAuthorizeChannel} disabled={isTestingApi || isSyncingOrders}
                      className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white text-xs font-medium cursor-pointer disabled:opacity-50">
                      Authorize {setupModalChannel.name}
                    </button>
                  )}
                  {setupModalChannel.id === "shopify" && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Shopify Store Domain
                        </label>
                        <input
                          type="text"
                          placeholder="your-brand.myshopify.com"
                          value={customApiUrl}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setCustomApiUrl(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Admin API Access Token
                        </label>
                        <input
                          type="password"
                          placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={customApiKey}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setCustomApiKey(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label htmlFor="shopify-own-client" className="block text-xs font-medium text-[#6E6E73] mb-1">Client ID (own-organization app, optional)</label>
                        <input id="shopify-own-client" type="text" value={shopifyClientId} autoComplete="off"
                          disabled={Boolean(channelCredentials.shopify?.vaulted) && !isUpdatingCredentials} onChange={event => setShopifyClientId(event.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] outline-none" />
                      </div>
                      <div>
                        <label htmlFor="shopify-own-secret" className="block text-xs font-medium text-[#6E6E73] mb-1">Client secret (own-organization app, optional)</label>
                        <input id="shopify-own-secret" type="password" value={shopifyClientSecret} autoComplete="new-password"
                          disabled={Boolean(channelCredentials.shopify?.vaulted) && !isUpdatingCredentials} onChange={event => setShopifyClientSecret(event.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] outline-none" />
                      </div>

                      {/* Real Feedback Banner */}
                      {apiTestResult && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                            apiTestResult.success
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800"
                              : "bg-red-500/10 border-red-500/20 text-red-800"
                          }`}
                        >
                          {apiTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div className="leading-relaxed">
                            <span className="font-semibold">
                              {apiTestResult.success ? "Connection Verified: " : "Error: "}
                            </span>
                            {apiTestResult.message}
                          </div>
                        </div>
                      )}

                      {/* Last Synced Info */}
                      {channelCredentials.shopify?.lastSyncedAt && (
                        <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 pt-0.5">
                          <span>Last synchronized:</span>
                          <span className="font-medium text-[#1D1D1F] tabular-nums">
                            {new Date(channelCredentials.shopify.lastSyncedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestShopifyConnection}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-medium shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                          <span>{isTestingApi ? "Testing Connection..." : "Test Connection"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncShopifyOrders}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOrders ? "animate-spin text-white" : "text-white/80"}`} />
                          <span>{isSyncingOrders ? "Syncing Orders..." : "Save & Sync Orders"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "woocommerce" && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          WordPress Store URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://yourstore.com"
                          value={customApiUrl}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setCustomApiUrl(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Consumer Key (ck_...)
                        </label>
                        <input
                          type="text"
                          placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx"
                          value={customApiKey}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setCustomApiKey(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Consumer Secret (cs_...)
                        </label>
                        <input
                          type="password"
                          placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx"
                          value={webhookSecret}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setWebhookSecret(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      {/* Real Feedback Banner */}
                      {apiTestResult && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                            apiTestResult.success
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800"
                              : "bg-red-500/10 border-red-500/20 text-red-800"
                          }`}
                        >
                          {apiTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div className="leading-relaxed">
                            <span className="font-semibold">
                              {apiTestResult.success ? "Connection Verified: " : "Error: "}
                            </span>
                            {apiTestResult.message}
                          </div>
                        </div>
                      )}

                      {/* Last Synced Info */}
                      {channelCredentials.woocommerce?.lastSyncedAt && (
                        <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 pt-0.5">
                          <span>Last synchronized:</span>
                          <span className="font-medium text-[#1D1D1F] tabular-nums">
                            {new Date(channelCredentials.woocommerce.lastSyncedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestWooCommerceConnection}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-medium shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                          <span>{isTestingApi ? "Testing Connection..." : "Test Connection"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncWooCommerceOrders}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOrders ? "animate-spin text-white" : "text-white/80"}`} />
                          <span>{isSyncingOrders ? "Syncing Orders..." : "Save & Sync Orders"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "flipkart" && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Application ID (App ID)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 981240a1-xxxx-xxxx-xxxx"
                          value={flipkartAppId}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setFlipkartAppId(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Application Secret
                        </label>
                        <input
                          type="password"
                          placeholder="Enter Application Secret"
                          value={flipkartAppSecret}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setFlipkartAppSecret(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <p className="text-[11px] text-[#86868B]">
                        Found in Flipkart Seller Hub under <strong>Manage Profile &gt; Developer Access</strong>.
                      </p>

                      {/* Real Feedback Banner */}
                      {apiTestResult && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                            apiTestResult.success
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800"
                              : "bg-red-500/10 border-red-500/20 text-red-800"
                          }`}
                        >
                          {apiTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div className="leading-relaxed">
                            <span className="font-semibold">
                              {apiTestResult.success ? "Connection Verified: " : "Error: "}
                            </span>
                            {apiTestResult.message}
                          </div>
                        </div>
                      )}

                      {/* Last Synced Info */}
                      {channelCredentials.flipkart?.lastSyncedAt && (
                        <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 pt-0.5">
                          <span>Last synchronized:</span>
                          <span className="font-medium text-[#1D1D1F] tabular-nums">
                            {new Date(channelCredentials.flipkart.lastSyncedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestFlipkartConnection}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-medium shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                          <span>{isTestingApi ? "Testing Connection..." : "Test Connection"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncFlipkartOrders}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOrders ? "animate-spin text-white" : "text-white/80"}`} />
                          <span>{isSyncingOrders ? "Syncing Orders..." : "Save & Sync Orders"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "amazon" && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          LWA Client ID (App ID)
                        </label>
                        <input
                          type="text"
                          placeholder="amzn1.application-oa2-client.xxxx"
                          value={amazonClientId}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setAmazonClientId(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          LWA Client Secret
                        </label>
                        <input
                          type="password"
                          placeholder="amzn1.oa2-cs.v1.xxxx"
                          value={amazonClientSecret}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setAmazonClientSecret(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          LWA Refresh Token
                        </label>
                        <input
                          type="password"
                          placeholder="Atzr|IQEBLz49..."
                          value={amazonRefreshToken}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setAmazonRefreshToken(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Seller / Merchant ID (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. A21TJRUUN4KGV"
                          value={amazonSellerId}
                          disabled={Boolean(channelCredentials[setupModalChannel.id]?.vaulted) && !isUpdatingCredentials}
                          onChange={(e) => {
                            setAmazonSellerId(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <p className="text-[11px] text-[#86868B]">
                        Found under <strong>Amazon Seller Central &gt; Apps &amp; Services &gt; Develop Apps</strong>.
                      </p>

                      {/* Real Feedback Banner */}
                      {apiTestResult && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                            apiTestResult.success
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800"
                              : "bg-red-500/10 border-red-500/20 text-red-800"
                          }`}
                        >
                          {apiTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div className="leading-relaxed">
                            <span className="font-semibold">
                              {apiTestResult.success ? "Connection Verified: " : "Error: "}
                            </span>
                            {apiTestResult.message}
                          </div>
                        </div>
                      )}

                      {/* Last Synced Info */}
                      {channelCredentials.amazon?.lastSyncedAt && (
                        <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 pt-0.5">
                          <span>Last synchronized:</span>
                          <span className="font-medium text-[#1D1D1F] tabular-nums">
                            {new Date(channelCredentials.amazon.lastSyncedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestAmazonConnection}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-medium shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                          <span>{isTestingApi ? "Testing Connection..." : "Test Connection"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncAmazonOrders}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOrders ? "animate-spin text-white" : "text-white/80"}`} />
                          <span>{isSyncingOrders ? "Syncing Orders..." : "Save & Sync Orders"}</span>
                        </button>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setSetupTab("csv")}
                          className="w-full py-2 rounded-xl bg-transparent hover:bg-black/[0.03] text-[#86868B] hover:text-[#1D1D1F] text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <span>Prefer report upload? Switch to CSV file tab</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 3: UPLOAD FILE */}
              {setupTab === "csv" && (
                <div className="space-y-4">
                  {setupModalChannel.id === "amazon" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">
                        How to download from Amazon Seller Central:
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">1.</span>
                        <span>Go to <strong>Reports &gt; Payments &gt; Date Range Reports</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">2.</span>
                        <span>Click <strong>Generate Report</strong> &gt; Select <strong>Transaction (CSV)</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">3.</span>
                        <span>Download the CSV and upload it below.</span>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "flipkart" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">
                        How to download from Flipkart Seller Hub:
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">1.</span>
                        <span>Go to <strong>Reports &gt; Report Centre</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">2.</span>
                        <span>Request <strong>Payment Reports &gt; Settle Transactions</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">3.</span>
                        <span>Download the CSV/Excel and upload it below.</span>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "meesho" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">
                        How to download from Meesho Supplier Panel:
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">1.</span>
                        <span>In Meesho Supplier Panel, click on <strong>Payments</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">2.</span>
                        <span>Select your month and click <strong>Download Statement</strong> (Excel/ZIP).</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">3.</span>
                        <span>Upload the file directly into MarginFlow below.</span>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "myntra" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">
                        How to download from Myntra Partner Portal:
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">1.</span>
                        <span>In Myntra Partner Portal, go to <strong>Financial Reports &gt; Settlement Recon</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">2.</span>
                        <span>Select the reconciliation cycle and click <strong>Download Order CSV</strong>.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-[#1D1D1F]">3.</span>
                        <span>Upload the file directly into MarginFlow below.</span>
                      </div>
                    </div>
                  )}

                  {(setupModalChannel.id === "shopify" || setupModalChannel.id === "woocommerce") && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F] mb-1">Orders CSV Import</div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Export orders from your store admin and import them here to backfill your ledger.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 text-center">
                    <button
                      onClick={() => {
                        closeSetup();
                        setHasOpenedCsv(true);
                        setIsCsvModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold shadow-apple-sm active:scale-[0.98] transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choose File to Import</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Store Catalog Modal */}
      {mounted && isAddStoreOpen && createPortal(
        <div
          onClick={() => setIsAddStoreOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="apple-card rounded-3xl max-w-2xl w-full border border-black/[0.08] shadow-apple-lg overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-black/[0.06] flex items-center justify-between bg-white">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
                  Connect a Channel
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  Select a platform to link with MarginFlow
                </p>
              </div>
              <button
                onClick={() => setIsAddStoreOpen(false)}
                aria-label="Close dialog"
                className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Catalog Grid */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto">
              {CATALOG_PLATFORMS.map((platform) => {
                const existing = CHANNELS.find((c) => c.id === platform.id);
                const isActive = existing ? connectedChannels[existing.id] : false;

                return (
                  <button
                    key={platform.id}
                    onClick={() => {
                      if (platform.comingSoon) {
                        showToast("In Preview", `${platform.name} integration is scheduled for v2.2.`);
                        return;
                      }
                      if (existing) {
                        setIsAddStoreOpen(false);
                        openConfigForChannel(existing);
                      } else {
                        showToast("Channel Ready", `${platform.name} configuration opened.`);
                        setIsAddStoreOpen(false);
                      }
                    }}
                    className="p-3.5 rounded-2xl border border-black/[0.06] bg-white hover:bg-[#F5F5F7] hover:border-black/[0.12] transition-all duration-150 flex items-start gap-3 text-left group shadow-apple-xs cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-lg bg-black/[0.04] text-[#1D1D1F] flex items-center justify-center shrink-0">
                      {renderSimpleIcon(platform.id)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-[#1D1D1F] tracking-tight">
                          {platform.name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#86868B]">
                          {existing ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20"
                                  : "bg-black/[0.04] text-[#6E6E73] border border-black/[0.08]"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? "bg-emerald-500" : "bg-[#1D1D1F]"
                                }`}
                              />
                              <span>{isActive ? "Active" : "Inactive"}</span>
                            </span>
                          ) : platform.comingSoon ? (
                            "Preview"
                          ) : (
                            "Available"
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#86868B] mt-0.5 line-clamp-2 leading-relaxed">
                        {platform.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-black/[0.05] bg-[#FBFBFD] flex items-center justify-between text-xs text-[#86868B]">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#1D1D1F]" />
                <span>All connections encrypted with AES-256</span>
              </span>
              <button
                onClick={() => setIsAddStoreOpen(false)}
                className="text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CSV Import Modal Integration */}
      {hasOpenedCsv && <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        products={products}
        onImportOrders={async (importedOrders) => {
          const syncResult = await syncExternalOrders(importedOrders);
          showToast(
            "Imported",
            `${importedOrders.length} orders processed (${syncResult.added} new, ${syncResult.updated} updated in ledger).`
          );
        }}
      />}
    </div>
  );
}
