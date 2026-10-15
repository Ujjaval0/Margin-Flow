"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { Marketplace } from "@/domain/types";
import { CsvImportModal } from "@/components/modals/csv-import-modal";
import { MyntraLogo } from "@/lib/marketplace-config";
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
    supportedModes: ["csv", "api"],
  },
  {
    id: "myntra",
    name: "Myntra",
    marketplace: "Myntra",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "csv",
    supportedModes: ["csv", "api"],
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
    id: "magento",
    name: "Adobe Commerce / Magento",
    description: "Enterprise connector with GraphQL event streaming.",
    icon: Layers,
    comingSoon: true,
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Headless and storefront order webhook receiver.",
    icon: ExternalLink,
    comingSoon: true,
  },
];

interface StoredChannelCredentials {
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
  const { orders, products, addOrder, syncExternalOrders } = usePlatform();

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
                serverConnected[ch.id] = true;
                serverMeta[ch.id] = {
                  webhookPath: conn.webhookPath,
                  vaulted: true,
                  connected: true,
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

  const vaultCredentialsOnServer = async (
    marketplace: string,
    credentials: Record<string, any>,
    sellerId?: string
  ) => {
    try {
      const response = await fetch("/api/integrations/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketplace,
          sellerId,
          credentials,
        }),
      });
      if (!response.ok) throw new Error("Could not save marketplace connection.");
      const result = await response.json();
      if (!result.success || !result.connection) throw new Error(result.error || "Could not save marketplace connection.");
      const channel = CHANNELS.find((candidate) => candidate.name === marketplace ||
        (candidate.id === "amazon" && marketplace === "Amazon India"));
      if (channel) {
        setChannelCredentials((previous) => ({ ...previous, [channel.id]: {
          ...previous[channel.id], vaulted: true, webhookPath: result.connection.webhookPath,
        } }));
      }
    } catch (err) {
      console.warn("Failed to vault credentials on server:", err);
      throw err;
    }
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
  const [flipkartAppId, setFlipkartAppId] = useState("");
  const [flipkartAppSecret, setFlipkartAppSecret] = useState("");
  const [amazonClientId, setAmazonClientId] = useState("");
  const [amazonClientSecret, setAmazonClientSecret] = useState("");
  const [amazonRefreshToken, setAmazonRefreshToken] = useState("");
  const [amazonSellerId, setAmazonSellerId] = useState("");
  const [meeshoSupplierId, setMeeshoSupplierId] = useState("");
  const [meeshoApiKey, setMeeshoApiKey] = useState("");
  const [myntraPartnerId, setMyntraPartnerId] = useState("");
  const [myntraApiKey, setMyntraApiKey] = useState("");

  // Add Store Catalog Modal
  const [isAddStoreOpen, setIsAddStoreOpen] = useState(false);

  // CSV Ingestion Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Keyboard dismissal (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (setupModalChannel) setSetupModalChannel(null);
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
        body: JSON.stringify({ marketplace }),
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
    if (typeof window !== "undefined") {
      return `${window.location.origin}${ownedPath || endpoint}`;
    }
    return `https://your-domain.com${endpoint}`;
  };

  // Quick verify status check — strictly tests valid third-party credentials
  const handleVerifyChannel = async (channel: ChannelConfig) => {
    setVerifyingChannelId(channel.id);
    try {
      if (channel.id === "woocommerce") {
        const creds = channelCredentials.woocommerce;
        if (!creds?.vaulted && (!creds?.storeUrl || !creds?.consumerKey || !creds?.consumerSecret)) {
          showToast("Setup Required", "Please configure your Store URL, Consumer Key, and Consumer Secret first.");
          openConfigForChannel(channel);
          return;
        }

        const res = await fetch("/api/integrations/woocommerce/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_connection",
            storeUrl: creds.storeUrl,
            consumerKey: creds.consumerKey,
            consumerSecret: creds.consumerSecret,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setConnectedChannels((prev) => ({ ...prev, woocommerce: true }));
          saveChannelCredentials("woocommerce", {
            ...creds,
            connected: true,
            totalOrdersInStore: data.totalOrdersInStore,
          });
          showToast("Connected & Active", `WooCommerce store verified. ${data.totalOrdersInStore || 0} orders found in store.`);
        } else {
          setConnectedChannels((prev) => ({ ...prev, woocommerce: false }));
          saveChannelCredentials("woocommerce", { ...creds, connected: false });
          showToast("Verification Failed", data.error || "Could not connect to WooCommerce store.");
        }
        return;
      }

      if (channel.id === "shopify") {
        const creds = channelCredentials.shopify;
        if (!creds?.vaulted && (!creds?.storeUrl || !creds?.consumerKey)) {
          showToast("Setup Required", "Please configure your Shopify Store Domain and Admin API Access Token first.");
          openConfigForChannel(channel);
          return;
        }

        const res = await fetch("/api/integrations/shopify/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_connection",
            shopDomain: creds.storeUrl,
            accessToken: creds.consumerKey,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setConnectedChannels((prev) => ({ ...prev, shopify: true }));
          saveChannelCredentials("shopify", { ...creds, connected: true });
          showToast("Connected & Active", `Shopify store verified: ${data.storeName || data.domain}`);
        } else {
          setConnectedChannels((prev) => ({ ...prev, shopify: false }));
          saveChannelCredentials("shopify", { ...creds, connected: false });
          showToast("Verification Failed", data.error || "Could not connect to Shopify.");
        }
        return;
      }

      if (channel.id === "flipkart") {
        const creds = channelCredentials.flipkart;
        if (!creds?.vaulted && (!creds?.appId || !creds?.appSecret)) {
          showToast("Setup Required", "Please configure your Flipkart App ID and Application Secret first.");
          openConfigForChannel(channel);
          return;
        }

        const res = await fetch("/api/integrations/flipkart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_connection",
            appId: creds.appId,
            appSecret: creds.appSecret,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setConnectedChannels((prev) => ({ ...prev, flipkart: true }));
          saveChannelCredentials("flipkart", { ...creds, connected: true });
          showToast("Connected & Active", data.message || "Flipkart Seller credentials verified.");
        } else {
          setConnectedChannels((prev) => ({ ...prev, flipkart: false }));
          saveChannelCredentials("flipkart", { ...creds, connected: false });
          showToast("Verification Failed", data.error || "Could not verify Flipkart credentials.");
        }
        return;
      }

      if (channel.id === "amazon") {
        const creds = channelCredentials.amazon;
        if (!creds?.vaulted && (!creds?.clientId || !creds?.clientSecret || !creds?.refreshToken)) {
          showToast("Setup Required", "Please configure Amazon SP-API Client ID, Secret, and Refresh Token first.");
          openConfigForChannel(channel);
          return;
        }

        const res = await fetch("/api/integrations/amazon/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_connection",
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            refreshToken: creds.refreshToken,
            sellerId: creds.sellerId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setConnectedChannels((prev) => ({ ...prev, amazon: true }));
          saveChannelCredentials("amazon", { ...creds, connected: true });
          showToast("Connected & Active", data.message || "Amazon SP-API authenticated.");
        } else {
          setConnectedChannels((prev) => ({ ...prev, amazon: false }));
          saveChannelCredentials("amazon", { ...creds, connected: false });
          showToast("Verification Failed", data.error || "Could not verify Amazon SP-API credentials.");
        }
        return;
      }

      if (channel.id === "meesho") {
        const creds = channelCredentials.meesho;
        if (!creds?.supplierId || !creds?.apiKey) {
          showToast("Setup Required", "Please configure Meesho Supplier ID and API Key first.");
          openConfigForChannel(channel);
          return;
        }

        const res = await fetch("/api/integrations/meesho/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_connection",
            supplierId: creds.supplierId,
            apiKey: creds.apiKey,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setConnectedChannels((prev) => ({ ...prev, meesho: true }));
          saveChannelCredentials("meesho", { ...creds, connected: true });
          showToast("Connected & Active", data.message || "Meesho Supplier credentials verified.");
        } else {
          setConnectedChannels((prev) => ({ ...prev, meesho: false }));
          saveChannelCredentials("meesho", { ...creds, connected: false });
          showToast("Verification Failed", data.error || "Could not verify Meesho credentials.");
        }
        return;
      }

      if (channel.id === "myntra") {
        const creds = channelCredentials.myntra;
        const partnerId = creds?.supplierId || creds?.clientId;
        const apiKey = creds?.apiKey || creds?.clientSecret;
        if (!partnerId || !apiKey) {
          showToast("Setup Required", "Please configure Myntra Partner ID and API Secret first.");
          openConfigForChannel(channel);
          return;
        }

        const res = await fetch("/api/integrations/myntra/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_connection",
            partnerId,
            apiKey,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setConnectedChannels((prev) => ({ ...prev, myntra: true }));
          saveChannelCredentials("myntra", { ...creds, supplierId: partnerId, apiKey, connected: true });
          showToast("Connected & Active", data.message || "Myntra Partner Portal credentials verified.");
        } else {
          setConnectedChannels((prev) => ({ ...prev, myntra: false }));
          saveChannelCredentials("myntra", { ...creds, connected: false });
          showToast("Verification Failed", data.error || "Could not verify Myntra credentials.");
        }
        return;
      }


      // Fallback
      showToast("Setup Required", `Please configure credentials for ${channel.name} to activate.`);
      openConfigForChannel(channel);
    } catch (err: any) {
      showToast("Verification Error", err.message || "Failed to reach verification endpoint.");
    } finally {
      setVerifyingChannelId(null);
    }
  };

  // Webhook ping test (endpoint reachability test only — does not connect third-party accounts)
  const handleTestPing = async () => {
    if (!setupModalChannel) return;
    setIsTestingPing(true);
    setPingSuccess(false);
    try {
      const res = await fetch(setupModalChannel.endpoint, {
        method: "POST",
        headers: {
          "x-wc-webhook-topic": "action.woocommerce_webhook_ping",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhook_id: 1, ping: true }),
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

  // Test connection in modal
  const handleTestWooCommerceConnection = async () => {
    if (!channelCredentials.woocommerce?.vaulted && (!customApiUrl || !customApiKey || !webhookSecret)) {
      setApiTestResult({
        success: false,
        message: "Please enter Store URL, Consumer Key, and Consumer Secret.",
      });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/woocommerce/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          storeUrl: customApiUrl,
          consumerKey: customApiKey,
          consumerSecret: webhookSecret,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (customApiKey && webhookSecret) {
          await vaultCredentialsOnServer("WooCommerce", {
            storeUrl: customApiUrl,
            consumerKey: customApiKey,
            consumerSecret: webhookSecret,
          });
        }
        setApiTestResult({
          success: true,
          message: `Connected successfully! ${data.totalOrdersInStore || 0} orders found in store.`,
        });
        setConnectedChannels((prev) => ({ ...prev, woocommerce: true }));
        saveChannelCredentials("woocommerce", {
          storeUrl: customApiUrl,
          connected: true,
          totalOrdersInStore: data.totalOrdersInStore,
        });

        showToast("Connected & Active", "WooCommerce connection verified and credentials vaulted.");
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to verify WooCommerce credentials.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Network error: ${err.message || "Failed to contact proxy route."}`,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Save & Sync orders from WooCommerce
  const handleSyncWooCommerceOrders = async () => {
    if (!channelCredentials.woocommerce?.vaulted && (!customApiUrl || !customApiKey || !webhookSecret)) {
      setApiTestResult({
        success: false,
        message: "Please enter Store URL, Consumer Key, and Consumer Secret before syncing.",
      });
      return;
    }

    setIsSyncingOrders(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/woocommerce/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_orders",
          storeUrl: customApiUrl,
          consumerKey: customApiKey,
          consumerSecret: webhookSecret,
          perPage: 50,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const syncResult = await syncExternalOrders(data.orders);
        const nowIso = new Date().toISOString();

        saveChannelCredentials("woocommerce", {
          storeUrl: customApiUrl,
          consumerKey: customApiKey,
          consumerSecret: webhookSecret,
          connected: true,
          lastSyncedAt: nowIso,
          totalOrdersInStore: data.totalInStore || data.orders.length,
        });

        setConnectedChannels((prev) => ({ ...prev, woocommerce: true }));

        setApiTestResult({
          success: true,
          message: `Sync complete! ${data.orders.length} orders fetched from WooCommerce (${syncResult.added} new, ${syncResult.updated} updated in ledger).`,
        });

        showToast(
          "WooCommerce Synced",
          `${data.orders.length} orders fetched (${syncResult.added} new, ${syncResult.updated} updated).`
        );
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to fetch orders from WooCommerce.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Sync error: ${err.message || "Failed to fetch orders."}`,
      });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // Shopify Connection Test & Order Sync
  const handleTestShopifyConnection = async () => {
    if (!channelCredentials.shopify?.vaulted && (!customApiUrl || !customApiKey)) {
      setApiTestResult({
        success: false,
        message: "Please enter your Shopify Store Domain and Admin API Access Token.",
      });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          shopDomain: customApiUrl,
          accessToken: customApiKey,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (customApiKey) {
          await vaultCredentialsOnServer("Shopify", {
            shopDomain: customApiUrl,
            accessToken: customApiKey,
          });
        }
        setApiTestResult({
          success: true,
          message: `Connected successfully! Store: ${data.storeName || data.domain}`,
        });
        setConnectedChannels((prev) => ({ ...prev, shopify: true }));
        saveChannelCredentials("shopify", {
          storeUrl: customApiUrl,
          connected: true,
        });

        showToast("Connected & Active", "Shopify store verified and access token vaulted.");
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to verify Shopify store.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Network error: ${err.message || "Could not reach sync endpoint."}`,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSyncShopifyOrders = async () => {
    if (!channelCredentials.shopify?.vaulted && (!customApiUrl || !customApiKey)) {
      setApiTestResult({
        success: false,
        message: "Please enter your Store Domain and Admin API Token before syncing.",
      });
      return;
    }

    setIsSyncingOrders(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_orders",
          shopDomain: customApiUrl,
          accessToken: customApiKey,
          limit: 50,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const syncResult = await syncExternalOrders(data.orders);
        const nowIso = new Date().toISOString();

        saveChannelCredentials("shopify", {
          storeUrl: customApiUrl,
          consumerKey: customApiKey,
          connected: true,
          lastSyncedAt: nowIso,
          totalOrdersInStore: data.orders.length,
        });

        setConnectedChannels((prev) => ({ ...prev, shopify: true }));

        setApiTestResult({
          success: true,
          message: `Sync complete! ${data.orders.length} orders fetched from Shopify (${syncResult.added} new, ${syncResult.updated} updated in ledger).`,
        });

        showToast(
          "Shopify Synced",
          `${data.orders.length} orders fetched (${syncResult.added} new, ${syncResult.updated} updated).`
        );
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to fetch orders from Shopify.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Sync error: ${err.message || "Failed to fetch orders."}`,
      });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // Flipkart Connection Test & Order Sync
  const handleTestFlipkartConnection = async () => {
    if (!channelCredentials.flipkart?.vaulted && (!flipkartAppId || !flipkartAppSecret)) {
      setApiTestResult({
        success: false,
        message: "Please enter your Flipkart Application ID and Application Secret.",
      });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/flipkart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          appId: flipkartAppId,
          appSecret: flipkartAppSecret,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (flipkartAppId && flipkartAppSecret) {
          await vaultCredentialsOnServer("Flipkart", {
            appId: flipkartAppId,
            appSecret: flipkartAppSecret,
          });
        }
        setApiTestResult({
          success: true,
          message: data.message || "Flipkart Seller API authenticated successfully via OAuth 2.0.",
        });
        setConnectedChannels((prev) => ({ ...prev, flipkart: true }));
        saveChannelCredentials("flipkart", {
          connected: true,
        });

        showToast("Connected & Active", "Flipkart Seller credentials verified and vaulted.");
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to verify Flipkart Seller credentials.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Network error: ${err.message || "Could not reach Flipkart gateway."}`,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSyncFlipkartOrders = async () => {
    if (!channelCredentials.flipkart?.vaulted && (!flipkartAppId || !flipkartAppSecret)) {
      setApiTestResult({
        success: false,
        message: "Please enter your Flipkart credentials before syncing.",
      });
      return;
    }

    setIsSyncingOrders(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/flipkart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_orders",
          appId: flipkartAppId,
          appSecret: flipkartAppSecret,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const syncResult = await syncExternalOrders(data.orders);
        const nowIso = new Date().toISOString();

        saveChannelCredentials("flipkart", {
          appId: flipkartAppId,
          appSecret: flipkartAppSecret,
          connected: true,
          lastSyncedAt: nowIso,
          totalOrdersInStore: data.orders.length,
        });

        setConnectedChannels((prev) => ({ ...prev, flipkart: true }));

        setApiTestResult({
          success: true,
          message: `Sync complete! ${data.orders.length} orders fetched from Flipkart (${syncResult.added} new, ${syncResult.updated} updated in ledger).`,
        });

        showToast(
          "Flipkart Synced",
          `${data.orders.length} orders fetched (${syncResult.added} new, ${syncResult.updated} updated).`
        );
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to fetch orders from Flipkart.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Sync error: ${err.message || "Failed to fetch orders."}`,
      });
    } finally {
      setIsSyncingOrders(false);
    }
  };


  // Amazon SP-API Handlers
  const handleTestAmazonConnection = async () => {
    if (!channelCredentials.amazon?.vaulted && (!amazonClientId || !amazonClientSecret || !amazonRefreshToken)) {
      setApiTestResult({
        success: false,
        message: "Please enter Amazon LWA Client ID, Client Secret, and Refresh Token.",
      });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/amazon/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          clientId: amazonClientId,
          clientSecret: amazonClientSecret,
          refreshToken: amazonRefreshToken,
          sellerId: amazonSellerId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (amazonClientId && amazonClientSecret && amazonRefreshToken) {
          await vaultCredentialsOnServer(
            "Amazon India",
            {
              clientId: amazonClientId,
              clientSecret: amazonClientSecret,
              refreshToken: amazonRefreshToken,
              sellerId: amazonSellerId,
            },
            amazonSellerId
          );
        }
        setApiTestResult({
          success: true,
          message: data.message || "Amazon SP-API authenticated successfully.",
        });
        setConnectedChannels((prev) => ({ ...prev, amazon: true }));
        saveChannelCredentials("amazon", {
          sellerId: amazonSellerId,
          connected: true,
        });

        showToast("Connected & Active", "Amazon SP-API credentials verified and vaulted.");
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to verify Amazon SP-API credentials.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Network error: ${err.message || "Could not reach Amazon gateway."}`,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSyncAmazonOrders = async () => {
    if (!channelCredentials.amazon?.vaulted && (!amazonClientId || !amazonClientSecret || !amazonRefreshToken)) {
      setApiTestResult({
        success: false,
        message: "Please enter your Amazon SP-API credentials before syncing.",
      });
      return;
    }

    setIsSyncingOrders(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/amazon/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_orders",
          clientId: amazonClientId,
          clientSecret: amazonClientSecret,
          refreshToken: amazonRefreshToken,
          sellerId: amazonSellerId,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const syncResult = await syncExternalOrders(data.orders);
        const nowIso = new Date().toISOString();

        saveChannelCredentials("amazon", {
          clientId: amazonClientId,
          clientSecret: amazonClientSecret,
          refreshToken: amazonRefreshToken,
          sellerId: amazonSellerId,
          connected: true,
          lastSyncedAt: nowIso,
          totalOrdersInStore: data.orders.length,
        });

        setConnectedChannels((prev) => ({ ...prev, amazon: true }));

        setApiTestResult({
          success: true,
          message: `Sync complete! ${data.orders.length} orders fetched from Amazon India (${syncResult.added} new, ${syncResult.updated} updated in ledger).`,
        });

        showToast(
          "Amazon Synced",
          `${data.orders.length} orders fetched (${syncResult.added} new, ${syncResult.updated} updated).`
        );
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to fetch orders from Amazon.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Sync error: ${err.message || "Failed to fetch orders."}`,
      });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // Meesho Handlers
  const handleTestMeeshoConnection = async () => {
    if (!meeshoSupplierId || !meeshoApiKey) {
      setApiTestResult({
        success: false,
        message: "Please enter Meesho Supplier ID and API Key / Panel Token.",
      });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/meesho/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          supplierId: meeshoSupplierId,
          apiKey: meeshoApiKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setApiTestResult({
          success: true,
          message: data.message || "Meesho Supplier Panel authenticated successfully.",
        });
        setConnectedChannels((prev) => ({ ...prev, meesho: true }));
        saveChannelCredentials("meesho", {
          supplierId: meeshoSupplierId,
          apiKey: meeshoApiKey,
          connected: true,
        });
        showToast("Connected & Active", "Meesho Supplier credentials verified.");
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to verify Meesho credentials.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Network error: ${err.message || "Could not reach Meesho gateway."}`,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSyncMeeshoOrders = async () => {
    if (!meeshoSupplierId || !meeshoApiKey) {
      setApiTestResult({
        success: false,
        message: "Please enter your Meesho Supplier credentials before syncing.",
      });
      return;
    }

    setIsSyncingOrders(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/meesho/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_orders",
          supplierId: meeshoSupplierId,
          apiKey: meeshoApiKey,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const syncResult = await syncExternalOrders(data.orders);
        const nowIso = new Date().toISOString();

        saveChannelCredentials("meesho", {
          supplierId: meeshoSupplierId,
          apiKey: meeshoApiKey,
          connected: true,
          lastSyncedAt: nowIso,
          totalOrdersInStore: data.orders.length,
        });

        setConnectedChannels((prev) => ({ ...prev, meesho: true }));

        setApiTestResult({
          success: true,
          message: `Sync complete! ${data.orders.length} orders fetched from Meesho (${syncResult.added} new, ${syncResult.updated} updated in ledger).`,
        });

        showToast(
          "Meesho Synced",
          `${data.orders.length} orders fetched (${syncResult.added} new, ${syncResult.updated} updated).`
        );
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to fetch orders from Meesho.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Sync error: ${err.message || "Failed to fetch orders."}`,
      });
    } finally {
      setIsSyncingOrders(false);
    }
  };

  // Myntra Handlers
  const handleTestMyntraConnection = async () => {
    if (!myntraPartnerId || !myntraApiKey) {
      setApiTestResult({
        success: false,
        message: "Please enter Myntra Partner / Vendor ID and API Key / Partner Secret.",
      });
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/myntra/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          partnerId: myntraPartnerId,
          apiKey: myntraApiKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setApiTestResult({
          success: true,
          message: data.message || "Myntra Partner Portal authenticated successfully.",
        });
        setConnectedChannels((prev) => ({ ...prev, myntra: true }));
        saveChannelCredentials("myntra", {
          supplierId: myntraPartnerId,
          apiKey: myntraApiKey,
          connected: true,
        });
        showToast("Connected & Active", "Myntra Partner credentials verified.");
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to verify Myntra credentials.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Network error: ${err.message || "Could not reach Myntra gateway."}`,
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleSyncMyntraOrders = async () => {
    if (!myntraPartnerId || !myntraApiKey) {
      setApiTestResult({
        success: false,
        message: "Please enter your Myntra Partner credentials before syncing.",
      });
      return;
    }

    setIsSyncingOrders(true);
    setApiTestResult(null);

    try {
      const res = await fetch("/api/integrations/myntra/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_orders",
          partnerId: myntraPartnerId,
          apiKey: myntraApiKey,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        const syncResult = await syncExternalOrders(data.orders);
        const nowIso = new Date().toISOString();

        saveChannelCredentials("myntra", {
          supplierId: myntraPartnerId,
          apiKey: myntraApiKey,
          connected: true,
          lastSyncedAt: nowIso,
          totalOrdersInStore: data.orders.length,
        });

        setConnectedChannels((prev) => ({ ...prev, myntra: true }));

        setApiTestResult({
          success: true,
          message: `Sync complete! ${data.orders.length} orders fetched from Myntra (${syncResult.added} new, ${syncResult.updated} updated in ledger).`,
        });

        showToast(
          "Myntra Synced",
          `${data.orders.length} orders fetched (${syncResult.added} new, ${syncResult.updated} updated).`
        );
      } else {
        setApiTestResult({
          success: false,
          message: data.error || "Failed to fetch orders from Myntra.",
        });
      }
    } catch (err: any) {
      setApiTestResult({
        success: false,
        message: `Sync error: ${err.message || "Failed to fetch orders."}`,
      });
    } finally {
      setIsSyncingOrders(false);
    }
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
      setMeeshoSupplierId(creds.supplierId || "");
      setMeeshoApiKey(creds.apiKey || "");
      setMyntraPartnerId(creds.supplierId || creds.clientId || "");
      setMyntraApiKey(creds.apiKey || creds.clientSecret || "");
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
      setMeeshoSupplierId("");
      setMeeshoApiKey("");
      setMyntraPartnerId("");
      setMyntraApiKey("");
    }
  };

  // Simplistic, lightweight icon renderer
  const renderSimpleIcon = (id: string) => {
    const iconClass = "w-4 h-4 text-[#1D1D1F] stroke-[1.75]";
    switch (id) {
      case "shopify":
        return <ShoppingBag className={iconClass} />;
      case "woocommerce":
        return <Store className={iconClass} />;
      case "amazon":
        return <Layers className={iconClass} />;
      case "flipkart":
        return <Zap className={iconClass} />;
      case "meesho":
        return <Globe className={iconClass} />;
      case "myntra":
        return <MyntraLogo className="w-4 h-4" />;
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
          onClick={() => setSetupModalChannel(null)}
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
                {connectedChannels[setupModalChannel.id] && (
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
                  onClick={() => setSetupModalChannel(null)}
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
                        <span>Secret: enter <code>wc_secret_dev_key_88b19e20a37fc6</code> (or your <code>WOOCOMMERCE_WEBHOOK_SECRET</code>) and click Save.</span>
                      </div>
                    </div>
                  )}

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
                        Endpoint Verified &amp; Active
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: API TOKEN */}
              {setupTab === "api" && (
                <div className="space-y-4">
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
                          onChange={(e) => {
                            setCustomApiKey(e.target.value);
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

                  {setupModalChannel.id === "meesho" && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Meesho Supplier ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SUP-89211 or registered seller ID"
                          value={meeshoSupplierId}
                          onChange={(e) => {
                            setMeeshoSupplierId(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          API Key / Panel Session Token
                        </label>
                        <input
                          type="password"
                          placeholder="Enter Meesho API Key or Panel Token"
                          value={meeshoApiKey}
                          onChange={(e) => {
                            setMeeshoApiKey(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <p className="text-[11px] text-[#86868B]">
                        Found in Meesho Supplier Panel under <strong>Settings &gt; Developer API</strong>.
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
                      {channelCredentials.meesho?.lastSyncedAt && (
                        <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 pt-0.5">
                          <span>Last synchronized:</span>
                          <span className="font-medium text-[#1D1D1F] tabular-nums">
                            {new Date(channelCredentials.meesho.lastSyncedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestMeeshoConnection}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-medium shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                          <span>{isTestingApi ? "Testing Connection..." : "Test Connection"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncMeeshoOrders}
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
                          <span>Prefer statement upload? Switch to CSV file tab</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "myntra" && (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Myntra Partner ID (Vendor ID)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MYN-PARTNER-8891 or Vendor ID"
                          value={myntraPartnerId}
                          onChange={(e) => {
                            setMyntraPartnerId(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          API Key / Partner Secret
                        </label>
                        <input
                          type="password"
                          placeholder="Enter Myntra API Key or Partner Secret"
                          value={myntraApiKey}
                          onChange={(e) => {
                            setMyntraApiKey(e.target.value);
                            setApiTestResult(null);
                          }}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <p className="text-[11px] text-[#86868B]">
                        Found in Myntra Partner Portal under <strong>Settings &gt; Developer &amp; Omnichannel Access</strong>.
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
                      {channelCredentials.myntra?.lastSyncedAt && (
                        <div className="flex items-center justify-between text-[11px] text-[#86868B] px-1 pt-0.5">
                          <span>Last synchronized:</span>
                          <span className="font-medium text-[#1D1D1F] tabular-nums">
                            {new Date(channelCredentials.myntra.lastSyncedAt).toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestMyntraConnection}
                          disabled={isTestingApi || isSyncingOrders}
                          className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-medium shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Zap className={`w-3.5 h-3.5 ${isTestingApi ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                          <span>{isTestingApi ? "Testing Connection..." : "Test Connection"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSyncMyntraOrders}
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
                          <span>Prefer settlement sheet upload? Switch to CSV file tab</span>
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
                        setSetupModalChannel(null);
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
      <CsvImportModal
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
      />
    </div>
  );
}
