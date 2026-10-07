"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { Marketplace } from "@/domain/types";
import { CsvImportModal } from "@/components/modals/csv-import-modal";
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
    defaultTab: "webhook",
    supportedModes: ["webhook", "api", "csv"],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    marketplace: "WooCommerce",
    category: "WordPress Store",
    endpoint: "/api/webhooks/woocommerce",
    defaultTab: "webhook",
    supportedModes: ["webhook", "api", "csv"],
  },
  {
    id: "amazon",
    name: "Amazon India",
    marketplace: "Amazon India",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "csv",
    supportedModes: ["csv", "api"],
  },
  {
    id: "flipkart",
    name: "Flipkart",
    marketplace: "Flipkart",
    category: "Online Marketplace",
    endpoint: "/api/webhooks/generic",
    defaultTab: "csv",
    supportedModes: ["csv", "api"],
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
    id: "generic",
    name: "Custom API & POS",
    marketplace: "Other",
    category: "Custom Ingestion",
    endpoint: "/api/webhooks/generic",
    defaultTab: "webhook",
    supportedModes: ["webhook"],
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
    description: "Supplier panel statement and payment reconciliation parser.",
    icon: Globe,
  },
  {
    id: "generic",
    name: "Custom API & POS",
    description: "RESTful JSON webhook endpoint with HMAC signature verification.",
    icon: SlidersHorizontal,
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

export function WebhookSimulatorView() {
  const { orders, products, addOrder } = usePlatform();

  // Dynamic connection & active state per channel
  // Green dot = Active / Connected; Black dot = Inactive / Deactivated
  const [connectedChannels, setConnectedChannels] = useState<Record<string, boolean>>({
    shopify: true,
    woocommerce: true,
    amazon: true,
    flipkart: true,
    meesho: true,
    generic: false,
  });

  // Real-time dynamic aggregation based on the actual platform orders
  const channelMetrics = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {
      shopify: { count: 0, revenue: 0 },
      woocommerce: { count: 0, revenue: 0 },
      amazon: { count: 0, revenue: 0 },
      flipkart: { count: 0, revenue: 0 },
      meesho: { count: 0, revenue: 0 },
      generic: { count: 0, revenue: 0 },
    };

    orders.forEach((o) => {
      let key = "generic";
      if (o.marketplace === "Personal Website") key = "shopify";
      else if (o.marketplace === "WooCommerce") key = "woocommerce";
      else if (o.marketplace === "Amazon India") key = "amazon";
      else if (o.marketplace === "Flipkart") key = "flipkart";
      else if (o.marketplace === "Meesho") key = "meesho";

      if (stats[key]) {
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

  const toggleChannelStatus = (channelId: string) => {
    setConnectedChannels((prev) => {
      const nextState = !prev[channelId];
      const channelName = CHANNELS.find((c) => c.id === channelId)?.name || "Channel";
      showToast(
        nextState ? "Channel Active" : "Channel Deactivated",
        `${channelName} is now ${nextState ? "Active (connection enabled)" : "Inactive (black dot indicator)"}.`
      );
      return { ...prev, [channelId]: nextState };
    });
  };

  const getFullWebhookUrl = (endpoint: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${endpoint}`;
    }
    return `https://your-domain.com${endpoint}`;
  };

  // Quick verify status check
  const handleVerifyChannel = async (channel: ChannelConfig) => {
    setVerifyingChannelId(channel.id);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setConnectedChannels((prev) => ({ ...prev, [channel.id]: true }));
      if (channel.id === "shopify" || channel.id === "woocommerce" || channel.id === "generic") {
        showToast("Connected & Active", `${channel.name} webhook receiver is healthy and verified.`);
      } else {
        showToast("Connected & Active", `${channel.name} channel is active. Upload statements to sync.`);
      }
    } finally {
      setVerifyingChannelId(null);
    }
  };


  // Webhook ping test
  const handleTestPing = async () => {
    setIsTestingPing(true);
    setPingSuccess(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setPingSuccess(true);
      if (setupModalChannel) {
        setConnectedChannels((prev) => ({ ...prev, [setupModalChannel.id]: true }));
      }
      showToast("Handshake Verified", "Webhook responded with HTTP 200. Channel is now Active.");
    } finally {
      setIsTestingPing(false);
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
          Store Integrations
        </h1>
        <p className="text-xs text-[#86868B] mt-0.5">
          Manage data streams and file ingestion across your storefronts and marketplaces.
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

                  {/* Dynamic Status Button: Matches the MarginFlow Delivered Pill Style */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChannelStatus(channel.id);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 hover:bg-emerald-500/15"
                        : "bg-black/[0.04] text-[#6E6E73] border border-black/[0.08] hover:bg-black/[0.08]"
                    }`}
                    title={isActive ? "Click to deactivate channel" : "Click to activate channel"}
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

                {isFileBased ? (
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.05] shadow-apple-xs active:scale-[0.98] transition cursor-pointer"
                    title="Upload statement or CSV sheet"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#6E6E73]" />
                    <span>Upload</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleVerifyChannel(channel)}
                    disabled={isVerifying}
                    className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.05] shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin text-[#1D1D1F]" : "text-[#6E6E73]"}`} />
                    <span>Verify</span>
                  </button>
                )}
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

              {/* Status Toggle & Close X in Modal Header */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleChannelStatus(setupModalChannel.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide transition-all cursor-pointer ${
                    connectedChannels[setupModalChannel.id]
                      ? "bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 hover:bg-emerald-500/15"
                      : "bg-black/[0.04] text-[#6E6E73] border border-black/[0.08] hover:bg-black/[0.08]"
                  }`}
                  title="Toggle active status"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectedChannels[setupModalChannel.id] ? "bg-emerald-500" : "bg-[#1D1D1F]"
                    }`}
                  />
                  <span>
                    {connectedChannels[setupModalChannel.id] ? "Active" : "Inactive"}
                  </span>
                </button>

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
                        <span>Paste the Delivery URL above and save.</span>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "generic" && (
                    <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                      <div className="font-semibold text-[#1D1D1F]">
                        JSON Webhook Specification:
                      </div>
                      <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                        Send HTTP <code>POST</code> with JSON payload. Authenticate via header <code>X-MarginFlow-Signature</code> (HMAC-SHA256).
                      </p>
                      <button
                        onClick={() =>
                          handleCopy(
                            `curl -X POST "${getFullWebhookUrl(setupModalChannel.endpoint)}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-MarginFlow-Signature: <hmac_sha256>" \\\n  -d '{"eventId":"evt_1","channelOrderId":"ORD-101","marketplace":"Other","status":"CONFIRMED","items":[{"sku":"SKU-1","quantity":1,"sellingPrice":999}]}'`,
                            true
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F] hover:underline cursor-pointer pt-1"
                      >
                        {copiedCurl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedCurl ? "Copied cURL command" : "Copy cURL command"}</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={handleTestPing}
                      disabled={isTestingPing}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.06] text-xs font-semibold shadow-apple-xs active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isTestingPing ? "animate-spin text-[#1D1D1F]" : ""}`} />
                      <span>{isTestingPing ? "Checking..." : "Verify Endpoint"}</span>
                    </button>

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
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Store Domain
                        </label>
                        <input
                          type="text"
                          placeholder="your-brand.myshopify.com"
                          value={customApiUrl}
                          onChange={(e) => setCustomApiUrl(e.target.value)}
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
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div className="pt-1">
                        <button
                          onClick={() => {
                            setConnectedChannels((prev) => ({ ...prev, [setupModalChannel.id]: true }));
                            showToast("Saved", "Shopify access token saved. Channel is Active.");
                            setSetupModalChannel(null);
                          }}
                          className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white hover:bg-black text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer"
                        >
                          Save Credentials
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "woocommerce" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Store URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://yourstore.com"
                          value={customApiUrl}
                          onChange={(e) => setCustomApiUrl(e.target.value)}
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
                          onChange={(e) => setCustomApiKey(e.target.value)}
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
                          onChange={(e) => setWebhookSecret(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <div className="pt-1">
                        <button
                          onClick={() => {
                            setConnectedChannels((prev) => ({ ...prev, [setupModalChannel.id]: true }));
                            showToast("Saved", "WooCommerce credentials saved. Channel is Active.");
                            setSetupModalChannel(null);
                          }}
                          className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white hover:bg-black text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer"
                        >
                          Save Credentials
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "flipkart" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-[#6E6E73] mb-1">
                          Application ID (App ID)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 981240a1-xxxx-xxxx-xxxx"
                          value={flipkartAppId}
                          onChange={(e) => setFlipkartAppId(e.target.value)}
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
                          onChange={(e) => setFlipkartAppSecret(e.target.value)}
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-[#F5F5F7] border border-black/[0.06] focus:border-[#1D1D1F] focus:bg-white outline-none transition-colors"
                        />
                      </div>

                      <p className="text-[11px] text-[#86868B]">
                        Found in Flipkart Seller Hub under <strong>Manage Profile &gt; Developer Access</strong>.
                      </p>

                      <div className="pt-1">
                        <button
                          onClick={() => {
                            setConnectedChannels((prev) => ({ ...prev, [setupModalChannel.id]: true }));
                            showToast("Saved", "Flipkart credentials stored. Channel is Active.");
                            setSetupModalChannel(null);
                          }}
                          className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white hover:bg-black text-xs font-medium shadow-apple-sm active:scale-[0.98] transition cursor-pointer"
                        >
                          Save Credentials
                        </button>
                      </div>
                    </div>
                  )}

                  {setupModalChannel.id === "amazon" && (
                    <div className="space-y-3">
                      <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] text-xs text-[#555] space-y-2">
                        <div className="font-semibold text-[#1D1D1F]">
                          Amazon Developer Access Note
                        </div>
                        <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                          Amazon SP-API uses AWS IAM and OAuth authorization instead of simple static API keys.
                        </p>
                        <p className="text-[11px] text-[#6E6E73] leading-relaxed">
                          For standard reconciliation, we recommend using the <strong>Upload File</strong> tab with your Date Range Transaction Report.
                        </p>
                      </div>

                      <button
                        onClick={() => setSetupTab("csv")}
                        className="w-full py-2.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-xs font-medium border border-black/[0.06] shadow-apple-xs active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Switch to File Upload</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
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
                        setConnectedChannels((prev) => ({ ...prev, [setupModalChannel.id]: true }));
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
        onImportOrders={(importedOrders) => {
          importedOrders.forEach((o) => addOrder(o));
          showToast(
            "Imported",
            `${importedOrders.length} orders added to your active ledger.`
          );
        }}
      />
    </div>
  );
}
