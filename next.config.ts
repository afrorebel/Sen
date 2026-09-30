import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio", "@react-pdf/renderer"],
  experimental: {
    // AI Traffic log uploads go up to 20 MB (the default server-action limit is 1 MB).
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
