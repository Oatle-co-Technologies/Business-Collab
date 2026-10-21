import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: process.env.MEDIA_STORAGE === "vercel-blob" ? "1mb" : "34mb" } },
  serverExternalPackages: ["@ffprobe-installer/ffprobe"],
  outputFileTracingIncludes: { "/*": ["./node_modules/@ffprobe-installer/**/*"] },
  async headers() {
    return [
      { source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/api/auth/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
      { source: "/offline.html", headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
