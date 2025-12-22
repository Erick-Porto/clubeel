/**
 * @type {import('next').NextConfig}
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    domains: [
      'plus.unsplash.com',
      'i.imgur.com',
      'www.folhadointerior.com.br',
      '192.168.100.48:8000',
      '192.168.100.48',
      'clubedosfuncionarios.com.br'
    ],
  },
};

export default nextConfig;
