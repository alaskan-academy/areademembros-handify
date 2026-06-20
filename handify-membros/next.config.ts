import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ozsbyscxcpijyvnjlkpw.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://player.pandavideo.com.br https://*.pandavideo.com.br https://*.tv.pandavideo.com.br",
              "frame-src 'self' https://player.pandavideo.com.br https://*.pandavideo.com.br https://*.tv.pandavideo.com.br https://docs.google.com https://www.youtube.com https://notion.so https://www.canva.com",
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.pandavideo.com.br https://*.tv.pandavideo.com.br",
              "media-src 'self' blob: https://*.pandavideo.com.br https://*.tv.pandavideo.com.br",
              "font-src 'self'",
            ].join("; "),
          },
        ],
      },
      // Webhook endpoint: sem cache, sempre fresco
      {
        source: "/api/webhooks/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
