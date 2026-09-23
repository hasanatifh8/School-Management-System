import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Documents are capped at 4 MB (src/lib/document-types.ts). Vercel itself
      // rejects request bodies over 4.5 MB, so this is the effective ceiling there.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
