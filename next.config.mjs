/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
