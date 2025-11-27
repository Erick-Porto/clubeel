/**
 * @type {import('next').NextConfig}
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  images: {
    domains: [
      'plus.unsplash.com',
      'i.imgur.com',
      'www.folhadointerior.com.br',
      '192.168.100.48:8000',
      '192.168.100.48',
      process.env.NEXT_PUBLIC_LARA_API,
      'encrypted-tbn0.gstatic.com',
      'clubedosfuncionarios.com.br'
    ],
  },
};

export default nextConfig;
