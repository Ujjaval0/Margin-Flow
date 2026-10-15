export function flipkartOAuthConfig(requestUrl: string) {
  const clientId = process.env.FLIPKART_APP_ID;
  const clientSecret = process.env.FLIPKART_APP_SECRET;
  const redirectUri = process.env.FLIPKART_REDIRECT_URI || (process.env.NODE_ENV !== "production"
    ? new URL("/api/integrations/flipkart/callback", requestUrl).toString() : "");
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Flipkart OAuth server configuration is required.");
  const redirect = new URL(redirectUri);
  if ((redirect.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && redirect.hostname === "localhost")) || redirect.username || redirect.password || redirect.search || redirect.hash) {
    throw new Error("Invalid configured Flipkart callback URI.");
  }
  return { clientId, clientSecret, redirectUri };
}
