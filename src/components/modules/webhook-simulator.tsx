"use client";

import React, { useState, useEffect } from "react";
import { usePlatform } from "@/domain/store";
import { formatINR } from "@/lib/utils";
import { Marketplace, Order } from "@/domain/types";
import { CsvImportModal } from "@/components/modals/csv-import-modal";
import {
  RefreshCw,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  Plus,
  ShoppingBag,
  Store,
  Layers,
  ArrowRight,
  Upload,
  Globe,
  Lock,
  Sparkles,
  X,
  SlidersHorizontal,
} from "lucide-react";

interface ChannelState {
  id: string;
  name: string;
  marketplace: Marketplace;
  accountHandle: string;
  endpoint: string;
  syncedOrdersToday: number;
  syncedRevenueToday: number;
  lastSynced: string;
  brandTint: string;
  brandBg: string;
}

const INITIAL_CHANNELS: ChannelState[] = [
  {
    id: "shopify",
    name: "Shopify",
    marketplace: "Personal Website",
    accountHandle: "threads-studio.myshopify.com",
    endpoint: "/api/webhooks/shopify",
    syncedOrdersToday: 42,
    syncedRevenueToday: 86400,
    lastSynced: "2m ago",
    brandTint: "text-emerald-600",
    brandBg: "bg-emerald-500/10",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    marketplace: "WooCommerce",
    accountHandle: "store.fashionhub.in",
    endpoint: "/api/webhooks/woocommerce",
    syncedOrdersToday: 18,
    syncedRevenueToday: 24800,
    lastSynced: "12m ago",
    brandTint: "text-purple-600",
    brandBg: "bg-purple-500/10",
  },
  {
    id: "amazon",
    name: "Amazon India",
    marketplace: "Amazon India",
    accountHandle: "Merchant: A2Q8769K87G",
    endpoint: "/api/webhooks/generic",
    syncedOrdersToday: 64,
    syncedRevenueToday: 142100,
    lastSynced: "Just now",
    brandTint: "text-amber-600",
    brandBg: "bg-amber-500/10",
  },
  {
    id: "flipkart",
    name: "Flipkart",
    marketplace: "Flipkart",
    accountHandle: "Seller: FK-FASHION-IND",
    endpoint: "/api/webhooks/generic",
    syncedOrdersToday: 31,
    syncedRevenueToday: 48200,
    lastSynced: "45m ago",
    brandTint: "text-blue-600",
    brandBg: "bg-blue-500/10",
  },
  {
    id: "meesho",
    name: "Meesho",
    marketplace: "Meesho",
    accountHandle: "Supplier: MEE-902148",
    endpoint: "/api/webhooks/generic",
    syncedOrdersToday: 22,
    syncedRevenueToday: 18450,
    lastSynced: "1h ago",
    brandTint: "text-rose-600",
    brandBg: "bg-rose-500/10",
  },
  {
    id: "generic",
    name: "Custom API & POS",
    marketplace: "Other",
    accountHandle: "Endpoint: /api/webhooks/generic",
    endpoint: "/api/webhooks/generic",
    syncedOrdersToday: 7,
    syncedRevenueToday: 14200,
    lastSynced: "3h ago",
    brandTint: "text-cyan-600",
    brandBg: "bg-cyan-500/10",
  },
];

export function WebhookSimulatorView() {
  const { products, addOrder } = usePlatform();
  const [channels, setChannels] = useState<ChannelState[]>(INITIAL_CHANNELS);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [notification, setNotification] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Setup Modal
  const [setupModalChannel, setSetupModalChannel] = useState<ChannelState | null>(null);
  const [setupTab, setSetupTab] = useState<"webhook" | "api" | "csv">("webhook");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");

  // CSV Ingestion Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showToast = (title: string, message: string) => {
    setNotification({ title, message });
  };

  const getFullWebhookUrl = (endpoint: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${endpoint}`;
    }
    return `https://your-domain.com${endpoint}`;
  };

  // 1-Click "Sync Now" for a single store
  const handleFetchChannelOrders = async (channel: ChannelState) => {
    setSyncingChannelId(channel.id);

    try {
      await new Promise((resolve) => setTimeout(resolve, 750));

      const orderRandomId = Math.floor(1000 + Math.random() * 9000);
      const isShoppee = channel.id === "shopify";
      const isWoo = channel.id === "woocommerce";

      const matchedProduct = products[0] || {
        sku: "APP-POLO-M",
        name: "Dry-Fit Polo T-Shirt (Navy / M)",
        currentCostPrice: 380,
      };

      const newOrder: Order = {
        id: `ORD-${channel.id.toUpperCase()}-${orderRandomId}`,
        channelOrderId: `${channel.id.toUpperCase()}-${Date.now().toString().slice(-6)}`,
        marketplace: channel.marketplace,
        orderDate: new Date().toISOString(),
        status: "DELIVERED",
        customerName: isShoppee ? "Aman Khurana" : isWoo ? "Kavita Rao" : "Vikramaditya S.",
        customerCity: isShoppee ? "Gurugram" : isWoo ? "Pune" : "Hyderabad",
        customerState: isShoppee ? "Haryana" : isWoo ? "Maharashtra" : "Telangana",
        shippingFeeCharged: 60,
        marketplaceChargesEstimate: Math.round(matchedProduct.currentCostPrice * 0.15),
        items: [
          {
            id: `item-${Date.now()}`,
            sku: matchedProduct.sku,
            productName: matchedProduct.name,
            quantity: 1,
            sellingPrice: Math.round(matchedProduct.currentCostPrice * 2.2),
            discount: 0,
            taxAmount: Math.round(matchedProduct.currentCostPrice * 0.25),
            snapshotUnitCost: matchedProduct.currentCostPrice,
            returnedQuantity: 0,
          },
        ],
        notes: `Real-time sync from ${channel.name}`,
      };

      addOrder(newOrder);
      const addedValue = newOrder.items[0].sellingPrice;

      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id
            ? {
                ...c,
                syncedOrdersToday: c.syncedOrdersToday + 1,
                syncedRevenueToday: c.syncedRevenueToday + addedValue,
                lastSynced: "Just now",
              }
            : c
        )
      );

      showToast(`Synced ${channel.name}`, `Fetched 1 order · ${formatINR(addedValue)}`);
    } finally {
      setSyncingChannelId(null);
    }
  };

  // 1-Click "Sync All"
  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 950));

      const randomId = Math.floor(1000 + Math.random() * 9000);
      const prod = products[0] || { sku: "APP-POLO-M", name: "Polo T-Shirt", currentCostPrice: 380 };

      addOrder({
        id: `ORD-MULTI-${randomId}`,
        channelOrderId: `SYNC-${randomId}`,
        marketplace: "Personal Website",
        orderDate: new Date().toISOString(),
        status: "DELIVERED",
        customerName: "Sneha Kapoor",
        customerCity: "New Delhi",
        customerState: "Delhi",
        shippingFeeCharged: 50,
        marketplaceChargesEstimate: 95,
        items: [
          {
            id: `item-${Date.now()}`,
            sku: prod.sku,
            productName: prod.name,
            quantity: 1,
            sellingPrice: 1299,
            discount: 50,
            taxAmount: 198,
            snapshotUnitCost: prod.currentCostPrice,
            returnedQuantity: 0,
          },
        ],
      });

      setChannels((prev) =>
        prev.map((c) => ({
          ...c,
          syncedOrdersToday: c.syncedOrdersToday + 1,
          syncedRevenueToday: c.syncedRevenueToday + 1299,
          lastSynced: "Just now",
        }))
      );

      showToast("All Stores Synced", "All 6 channels are up to date.");
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Test Ping from Modal
  const handleTestPing = async () => {
    setIsTestingPing(true);
    setPingSuccess(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPingSuccess(true);
      showToast("Verified", "Webhook connection active and verified.");
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const totalOrdersSynced = channels.reduce((acc, c) => acc + c.syncedOrdersToday, 0);
  const totalRevenueSynced = channels.reduce((acc, c) => acc + c.syncedRevenueToday, 0);

  return (
    <div className="space-y-6 w-full max-w-[1440px] min-w-0 mx-auto animate-in fade-in duration-200 pb-16">
      {/* Toast Notification (Apple floating pill) */}
      {notification && (
        <div className="fixed top-20 right-8 z-50 flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-black/[0.06] animate-in slide-in-from-top-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <div className="text-xs font-medium text-[#1D1D1F]">
            <span className="font-semibold">{notification.title}</span> — {notification.message}
          </div>
          <button onClick={() => setNotification(null)} className="text-[#86868B] hover:text-[#1D1D1F] ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.04]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
            Integrations
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            {channels.length} connected channels syncing orders and inventory in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-[#1D1D1F] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin text-[#0071E3]" : ""}`} />
            {isSyncingAll ? "Syncing..." : "Sync All"}
          </button>

          <button
            onClick={() => {
              setSetupModalChannel(channels[0]);
              setSetupTab("webhook");
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white transition-all active:scale-[0.98] shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Store
          </button>
        </div>
      </div>

      {/* Apple-Style Minimalist Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <span className="text-xs text-[#86868B]">Active Stores</span>
            <div className="text-xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
              {channels.length} Connected
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <span className="text-xs text-[#86868B]">Synced Today</span>
            <div className="text-xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
              {totalOrdersSynced} Orders
            </div>
          </div>
          <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
            Real-time
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.05] p-4 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div>
            <span className="text-xs text-[#86868B]">Synced GMV</span>
            <div className="text-xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
              {formatINR(totalRevenueSynced)}
            </div>
          </div>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Reconciled
          </span>
        </div>
      </div>

      {/* Store Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
        {channels.map((channel) => {
          const isSyncing = syncingChannelId === channel.id;

          return (
            <div
              key={channel.id}
              className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-black/[0.12] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Card Header: Squircle Icon + Name + Live Indicator */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl ${channel.brandBg} flex items-center justify-center shrink-0`}
                    >
                      {channel.id === "shopify" && <ShoppingBag className={`w-5 h-5 ${channel.brandTint}`} />}
                      {channel.id === "woocommerce" && <Store className={`w-5 h-5 ${channel.brandTint}`} />}
                      {channel.id === "amazon" && <Layers className={`w-5 h-5 ${channel.brandTint}`} />}
                      {channel.id === "flipkart" && <Zap className={`w-5 h-5 ${channel.brandTint}`} />}
                      {channel.id === "meesho" && <Globe className={`w-5 h-5 ${channel.brandTint}`} />}
                      {channel.id === "generic" && <SlidersHorizontal className={`w-5 h-5 ${channel.brandTint}`} />}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#1D1D1F] truncate">
                        {channel.name}
                      </h3>
                      <p className="text-xs text-[#86868B] truncate font-mono">
                        {channel.accountHandle}
                      </p>
                    </div>
                  </div>

                  {/* Clean Minimalist Status */}
                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {channel.lastSynced}
                  </span>
                </div>

                {/* Minimalist Stats Divider */}
                <div className="flex items-center justify-between text-xs py-3 border-y border-neutral-100 mt-4 mb-3 text-[#1D1D1F]">
                  <div>
                    <span className="text-[#86868B]">Today: </span>
                    <span className="font-semibold">{channel.syncedOrdersToday} orders</span>
                  </div>
                  <div>
                    <span className="text-[#86868B]">Volume: </span>
                    <span className="font-semibold">{formatINR(channel.syncedRevenueToday)}</span>
                  </div>
                </div>
              </div>

              {/* Apple-Style Soft Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleFetchChannelOrders(channel)}
                  disabled={isSyncing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-xl bg-neutral-100 hover:bg-neutral-200/70 text-[#1D1D1F] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#0071E3]" : "text-neutral-500"}`} />
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </button>

                <button
                  onClick={() => {
                    setSetupModalChannel(channel);
                    setSetupTab("webhook");
                  }}
                  className="inline-flex items-center justify-center py-2 px-3 text-xs font-medium rounded-xl text-[#0071E3] hover:bg-blue-50/70 transition-colors"
                >
                  Configure
                </button>

                {(channel.id === "amazon" || channel.id === "flipkart" || channel.id === "meesho") && (
                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="p-2 rounded-xl text-neutral-500 hover:text-[#1D1D1F] hover:bg-neutral-100 transition-colors"
                    title="Upload CSV Sheet"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Apple-Style Connection Sheet Modal */}
      {setupModalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] max-w-lg w-full border border-black/[0.06] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 border-b border-black/[0.04] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1D1D1F]">
                  {setupModalChannel.name} Connection
                </h3>
                <p className="text-xs text-[#86868B]">
                  Manage credentials and real-time webhook streaming
                </p>
              </div>
              <button
                onClick={() => setSetupModalChannel(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* iOS-Style Segmented Tab Bar */}
            <div className="px-6 pt-3">
              <div className="grid grid-cols-3 p-1 bg-neutral-100 rounded-xl gap-1 text-xs">
                <button
                  onClick={() => setSetupTab("webhook")}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    setupTab === "webhook"
                      ? "bg-white text-[#1D1D1F] shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  Webhook
                </button>
                <button
                  onClick={() => setSetupTab("api")}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    setupTab === "api"
                      ? "bg-white text-[#1D1D1F] shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  API Keys
                </button>
                <button
                  onClick={() => setSetupTab("csv")}
                  className={`py-1.5 rounded-lg font-medium transition-all ${
                    setupTab === "csv"
                      ? "bg-white text-[#1D1D1F] shadow-xs"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  CSV Upload
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {setupTab === "webhook" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#86868B] mb-1.5">
                      Webhook Endpoint URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getFullWebhookUrl(setupModalChannel.endpoint)}
                        className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl bg-neutral-100 border border-transparent focus:border-black/[0.1] text-[#1D1D1F] select-all outline-none"
                      />
                      <button
                        onClick={() => handleCopy(getFullWebhookUrl(setupModalChannel.endpoint))}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-[#1D1D1F] shrink-0 transition-colors"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedUrl ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-neutral-50 rounded-xl p-3.5 border border-black/[0.04] space-y-2 text-xs text-[#555]">
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-[#1D1D1F]">1.</span>
                      <span>Copy your personal Webhook URL above.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-[#1D1D1F]">2.</span>
                      <span>Paste it into your <strong>{setupModalChannel.name}</strong> admin webhooks under "Order Creation".</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-semibold text-[#1D1D1F]">3.</span>
                      <span>Click Verify below to complete setup.</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={handleTestPing}
                      disabled={isTestingPing}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isTestingPing ? "animate-spin" : ""}`} />
                      {isTestingPing ? "Testing..." : "Verify Handshake"}
                    </button>

                    {pingSuccess && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Connected
                      </span>
                    )}
                  </div>
                </div>
              )}

              {setupTab === "api" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#86868B] mb-1">
                      Store URL / Domain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. threads-studio.myshopify.com"
                      value={customApiUrl}
                      onChange={(e) => setCustomApiUrl(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-black/[0.08] focus:border-[#0071E3] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#86868B] mb-1">
                      API Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="shpat_xxxxxxxxxxxxxxxx"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-black/[0.08] focus:border-[#0071E3] outline-none"
                    />
                    <p className="text-[10px] text-[#86868B] mt-1 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      Encrypted in server-only vault. Never accessible in browser.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        showToast("Saved", `Credentials updated for ${setupModalChannel.name}`);
                        setSetupModalChannel(null);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#1D1D1F] text-white hover:bg-black text-xs font-medium transition-colors"
                    >
                      Save Credentials
                    </button>
                  </div>
                </div>
              )}

              {setupTab === "csv" && (
                <div className="text-center py-4 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-700">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#1D1D1F]">
                      Manual File Ingestion
                    </h4>
                    <p className="text-xs text-[#86868B] max-w-xs mx-auto mt-0.5">
                      Upload settlement or order sheets directly without configuring APIs.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSetupModalChannel(null);
                      setIsCsvModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition-colors"
                  >
                    Open CSV Importer
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
