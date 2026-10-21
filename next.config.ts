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

const nextConfig: NextConfig = {
  reactStrictMode: false,
  ...(basePath ? { basePath } : {}),
  async headers() {
    return [
      { source: "/assinar", headers: HEADERS_ASSINATURA },
      { source: "/assinar/:path*", headers: HEADERS_ASSINATURA },
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
