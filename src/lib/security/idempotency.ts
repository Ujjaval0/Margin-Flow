/**
 * Webhook Idempotency Store & Replay Defense
 * Tracks unique event identifiers across Shopify, WooCommerce, Amazon,
 * and custom channels to ensure zero duplicate financial entries.
 */

interface IdempotencyRecord {
  eventId: string;
  channel: string;
  processedAt: string;
  expiresAt: number;
}

// In-memory sliding window cache with 24-hour retention
const processedEvents = new Map<string, IdempotencyRecord>();

const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Check if an event has already been recorded and mark it if fresh.
 * Returns true if the event is a duplicate (replay), false if fresh.
 */
export function checkAndMarkEventIdempotency(
  channel: string,
  eventId: string
): { isDuplicate: boolean; recordedAt?: string } {
  const compositeKey = `${channel}:${eventId}`;
  const now = Date.now();

  // Housekeeping: remove expired records
  if (processedEvents.size > 10000) {
    for (const [key, record] of processedEvents.entries()) {
      if (record.expiresAt < now) {
        processedEvents.delete(key);
      }
    }
  }

  const existing = processedEvents.get(compositeKey);
  if (existing) {
    return {
      isDuplicate: true,
      recordedAt: existing.processedAt,
    };
  }

  processedEvents.set(compositeKey, {
    eventId,
    channel,
    processedAt: new Date().toISOString(),
    expiresAt: now + RETENTION_MS,
  });

  return { isDuplicate: false };
}
