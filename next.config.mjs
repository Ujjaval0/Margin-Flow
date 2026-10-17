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

export default nextConfig;
