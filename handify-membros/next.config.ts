import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  // Marca cada requisição com a versão que serviu a página. Com a Proteção de
  // Versão ligada no painel da Vercel, a aluna que está com a aula aberta
  // durante um deploy continua conversando com a versão dela, em vez de bater
  // numa Server Action que deixou de existir e parar de salvar o progresso.
  // Sem a opção ligada no painel, isto é inofensivo: a Vercel ignora a marca.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,

  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
  turbopack: {},
  images: {
    remotePatterns: [
      // Projeto Supabase atual — onde estão as capas dos cursos.
      // Faltava aqui, então next/image recusava essas imagens e o projeto
      // inteiro acabou usando `unoptimized`, servindo o arquivo original.
      { protocol: "https", hostname: "fjcdcvywdiagzovqqcpc.supabase.co" },
      // Projeto antigo — ainda hospeda imagens de posts de inspiração.
      { protocol: "https", hostname: "ozsbyscxcpijyvnjlkpw.supabase.co" },
      // Miniaturas de vídeo do YouTube nos posts de inspiração.
      { protocol: "https", hostname: "img.youtube.com" },
      // Miniaturas do Panda Video na tela de métricas de vídeo. Faltava aqui,
      // e o next/image derrubava a página inteira — ela abria em branco.
      { protocol: "https", hostname: "cdn.pandavideo.com" },
    ],
  },
  async redirects() {
    return [
      // Redireciona toda a área de membros antiga para o fluxo de ativação da nova plataforma
      {
        source: "/:path*",
        has: [{ type: "host", value: "acesso.handify.com.br" }],
        destination: "https://membros.handify.com.br/ativar",
        permanent: false, // 302 — facilita mudar depois se necessário
      },
    ];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS: força HTTPS por 2 anos (apenas em produção)
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://player.pandavideo.com.br https://*.pandavideo.com.br https://*.tv.pandavideo.com.br",
              "frame-src 'self' https://player.pandavideo.com.br https://*.pandavideo.com.br https://*.tv.pandavideo.com.br https://docs.google.com https://www.youtube.com https://www.youtube-nocookie.com https://notion.so https://www.canva.com https://*.typeform.com https://*.handify.com.br",
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.pandavideo.com.br https://*.tv.pandavideo.com.br",
              "media-src 'self' blob: https://*.pandavideo.com.br https://*.tv.pandavideo.com.br",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
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
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  customWorkerSrc: "worker",
  fallbacks: {
    document: "/~offline",
  },
})(nextConfig);
