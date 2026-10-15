// A bounded run must fail explicitly when the provider cannot be exhausted.
// Callers persist only after every page has been fetched and validated.
export async function collectPages<T>(
  initialUrl: string,
  request: (url: string, firstPage: boolean) => Promise<Response>,
  decode: (data: any, response: Response) => { records: T[]; next?: string | null },
): Promise<T[]> {
  const records: T[] = [];
  const visited = new Set<string>();
  let url: string | null = initialUrl;
  while (url) {
    if (visited.has(url) || visited.size >= 250) throw new Error("Provider pagination is incomplete; retry with a smaller date window.");
    visited.add(url);
    const response = await request(url, visited.size === 1);
    if (!response.ok) throw new Error(`Provider request failed (HTTP ${response.status}).`);
    const page = decode(await response.json(), response);
    if (!Array.isArray(page.records)) throw new Error("Provider returned an invalid record collection.");
    records.push(...page.records);
    url = page.next ? providerNextUrl(page.next, initialUrl) : null;
  }
  return records;
}

export function providerNextUrl(next: string, initial: string): string {
  const base = new URL(initial);
  const url = new URL(next, base);
  if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || url.hash) {
    throw new Error("Provider returned an unsafe pagination URL.");
  }
  return url.toString();
}

export function nextLink(response: Response): string | undefined {
  return response.headers.get("link")?.split(",").map(part => part.match(/<([^>]+)>;\s*rel="next"/i)?.[1]).find(Boolean);
}

export async function amazonPages(initial: string, accessToken: string, collection: string): Promise<any[]> {
  return collectPages(initial, url => fetch(url, {
    headers: { "x-amz-access-token": accessToken, Accept: "application/json" },
    signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
  }), data => {
    const payload = data?.payload ?? data;
    const records = payload?.[collection];
    if (!Array.isArray(records)) throw new Error(`Amazon omitted ${collection}.`);
    const next = payload.NextToken ? new URL(initial) : null;
    if (next) next.searchParams.set("NextToken", payload.NextToken);
    return { records, next: next?.toString() };
  });
}
