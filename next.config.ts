/**
 * @type {import('next').NextConfig}
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
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
    ],
    qualities: [100],
  },
  async rewrites() {
    return [
      {
        // Tudo que o navegador mandar para /api/backend/...
        source: '/api/backend/:path*',
        // O Next.js manda internamente para o Laravel
        destination: 'http://192.168.10.10/api/:path*', 
      },
      // (Opcional) Se precisar de imagens do Storage
      {
        source: '/storage/:path*',
        destination: 'http://192.168.10.10/storage/:path*',
      },
    ];
  },
};

export default nextConfig;
