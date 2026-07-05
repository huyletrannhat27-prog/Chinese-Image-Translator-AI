// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;