/**
 * @type {import('next').NextConfig}
 */

import type { NextConfig } from "next";

// Homologação: a mesma base compilada com NEXT_PUBLIC_BASE_PATH=/homolog roda
// numa segunda instância servida em /homolog/*. Em produção fica vazio (raiz).
// Mesma normalização de utils/base-path.ts (o config não importa de lá).
const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
const basePath = rawBasePath && !rawBasePath.startsWith("/") ? `/${rawBasePath}` : rawBasePath;

// Área de assinatura remota (/assinar): fora de buscadores, fora de cache, sem
// Referer para terceiros e sem poder ser emoldurada por outro site. As rotas da
// área repetem os mesmos headers (app/(assinatura)/assinar/servidor.ts); aqui
// eles cobrem as páginas. `source` já recebe o basePath sozinho.
const HEADERS_ASSINATURA = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
];

// Pedido de ingresso do não sócio (/ingressos/pedido/<id>?token=…): o link do
// e-mail chega com o token do pedido na URL. A página troca o token por um
// cookie e o tira da URL, mas até lá ele não pode vazar no Referer (a imagem
// do evento pode vir de outro servidor), ir para o cache nem para buscadores.
const HEADERS_PEDIDO_INGRESSO = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  ...(basePath ? { basePath } : {}),
  async headers() {
    return [
      { source: "/assinar", headers: HEADERS_ASSINATURA },
      { source: "/assinar/:path*", headers: HEADERS_ASSINATURA },
      { source: "/ingressos/pedido/:path*", headers: HEADERS_PEDIDO_INGRESSO },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.folhadointerior.com.br',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lara.clubedosfuncionarios.com.br',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'clubedosfuncionarios.com.br',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '192.168.100.48',
        port: '8000',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    qualities: [100],
  },
  // async rewrites() {
  //   return [
  //     {
  //       // Tudo que o navegador mandar para /api/backend/...
  //       source: '/api/backend/:path*',
  //       // O Next.js manda internamente para o Laravel
  //       destination: 'http://192.168.100.48:8000/api/:path*', 
  //     }
  //   ];
  // },
};

export default nextConfig;
