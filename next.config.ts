/**
 * @type {import('next').NextConfig}
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  images: {
    domains: ['plus.unsplash.com','i.imgur.com','www.folhadointerior.com.br','192.168.100.128:8000'],
  },
};

export default nextConfig;
