import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fee receipt and ledger PDFs embed these fonts (they have the ₹ sign).
  outputFileTracingIncludes: {
    "/api/fees/**": ["./src/assets/fonts/**/*"],
  },
  experimental: {
    serverActions: {
      // Documents are capped at 4 MB (src/lib/document-types.ts). Vercel itself
      // rejects request bodies over 4.5 MB, so this is the effective ceiling there.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
