/**
 * @type {import('next').NextConfig}
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
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
