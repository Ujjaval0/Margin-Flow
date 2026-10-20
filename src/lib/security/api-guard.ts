import crypto from "crypto";
import { NextResponse } from "next/server";
import { TokenBucketRateLimiter } from "./rate-limiter";

// Process-level protection is supplemental; the release gate also requires shared ingress limits.
const authBudget = new TokenBucketRateLimiter({ capacity: 10, refillRatePerSec: 0.1 });
const aiBudget = new TokenBucketRateLimiter({ capacity: 10, refillRatePerSec: 0.2 });
const processAuthBudget = new TokenBucketRateLimiter({ capacity: 100, refillRatePerSec: 2 });

export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next's development server can normalize LAN requests to localhost internally.
  // Compare against the browser's actual destination; never trust a forwarded host.
  const developmentHost = process.env.NODE_ENV === "development" ? request.headers.get("host") : null;
  const expected = process.env.APP_ORIGIN || (developmentHost
    ? `${requestUrl.protocol}//${developmentHost}`
    : requestUrl.origin);
  if ((origin && origin !== expected) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ success: false, error: "Cross-origin request prohibited." }, { status: 403 });
  }
  return null;
}

export function checkAuthBudget(request: Request, email: unknown): NextResponse | null {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const key = crypto.createHash("sha256").update(typeof email === "string" ? email.trim().toLowerCase() : "invalid").digest("hex");
  const global = processAuthBudget.consume("auth");
  if (!global.allowed) return NextResponse.json({ success: false, error: "Too many authentication attempts. Try again later." }, {
    status: 429, headers: { "Retry-After": String(global.retryAfterSeconds) },
  });
  const account = authBudget.consume(key);
  if (!global.allowed || !account.allowed) {
    return NextResponse.json({ success: false, error: "Too many authentication attempts. Try again later." }, {
      status: 429, headers: { "Retry-After": String(Math.max(global.retryAfterSeconds, account.retryAfterSeconds)) },
    });
  }
  return null;
}

export function checkProcessingBudget(request: Request, userId: string): NextResponse | null {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const result = aiBudget.consume(userId);
  return result.allowed ? null : NextResponse.json({ success: false, error: "Processing limit reached. Try again later." }, {
    status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) },
  });
}
