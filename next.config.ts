import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio", "@react-pdf/renderer"],
};

export default nextConfig;
