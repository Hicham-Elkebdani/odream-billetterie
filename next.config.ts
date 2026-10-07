import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ticket-pdf.ts lit ces fichiers avec readFile : on force leur inclusion dans les fonctions serveur (Vercel).
  outputFileTracingIncludes: {
    "/**": ["./public/aei.png", "./public/fonts/**"],
  },
};

export default nextConfig;
