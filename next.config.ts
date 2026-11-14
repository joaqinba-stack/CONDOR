import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las portadas se suben por server action (el video va directo a Bunny).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
