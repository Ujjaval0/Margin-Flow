/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
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
