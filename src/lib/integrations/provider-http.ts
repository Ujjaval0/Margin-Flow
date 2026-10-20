/** Public error details never include provider response bodies, URLs, or credentials. */
export class ProviderRequestError extends Error {
  constructor(public readonly status: number, public readonly retryable = status === 429 || status >= 500) {
    super(status === 401 || status === 403
      ? "Store authorization was rejected. Check the app permissions or reconnect the store."
      : status === 429 ? "The platform is busy. Synchronization will retry after its rate-limit cooldown."
      : "The platform request failed. Please retry shortly.");
  }
}

export async function providerFetch(request: () => Promise<Response>, attempts = 3): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try { response = await request(); }
    catch {
      if (attempt + 1 >= attempts) throw new ProviderRequestError(503);
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (response.ok) return response;
    if ((response.status !== 429 && response.status < 500) || attempt + 1 >= attempts) {
      const status = response.status;
      await response.body?.cancel().catch(() => {});
      throw new ProviderRequestError(status);
    }
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) : undefined;
    const delay = seconds !== undefined ? seconds * 1000 : 1000 * 2 ** attempt;
    await response.body?.cancel().catch(() => {});
    // A long cooldown belongs in the durable job queue, not an open HTTP request.
    if (delay > 5000) throw new ProviderRequestError(response.status);
    await new Promise(resolve => setTimeout(resolve, Math.max(250, delay)));
  }
}

export function publicProviderError(error: unknown, fallback: string): string {
  return error instanceof ProviderRequestError ? error.message : fallback;
}
