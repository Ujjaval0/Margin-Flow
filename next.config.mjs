/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ["pg", "pg-connection-string"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  webpack: (config, { isServer, nextRuntime }) => {
    if (!isServer || nextRuntime === "edge") {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        pg: false,
        "pg-connection-string": false,
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/audit",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

// Development recompilation must not overwrite a concurrently verified production build.
export default (phase) => {
  if (phase === "phase-production-build" && process.env.VERCEL === "1") {
    const missing = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!publicKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
    if (missing.length) throw new Error(`Vercel build blocked: set ${missing.join(" and ")} in this deployment's environment settings, then redeploy.`);
    let privateKey = publicKey.startsWith("sb_secret_");
    try { privateKey ||= JSON.parse(Buffer.from(publicKey.split(".")[1] || "", "base64url").toString()).role === "service_role"; }
    catch { /* Key contents must never appear in build diagnostics. */ }
    if (privateKey) throw new Error("Vercel build blocked: use a Supabase publishable/anon key, never a server secret, for public configuration.");
  }
  return {
    ...nextConfig,
    distDir: phase === "phase-development-server" ? ".next-dev" : ".next",
  };
};
