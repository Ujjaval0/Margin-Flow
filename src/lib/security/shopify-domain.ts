/** Accept only a Shopify-owned shop hostname, never paths, ports or suffix lookalikes. */
export function normalizeShopifyDomain(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) throw new Error("Invalid Shopify store domain.");
  let value = input.trim().toLowerCase();
  if (!value.includes("://")) {
    if (!value.includes(".")) value += ".myshopify.com";
    value = `https://${value}`;
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
      parsed.pathname !== "/" || parsed.search || parsed.hash ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(parsed.hostname)) {
    throw new Error("Invalid Shopify store domain.");
  }
  return parsed.hostname;
}
