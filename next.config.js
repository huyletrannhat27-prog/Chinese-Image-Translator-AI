// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // tesseract.js spawns a worker_thread that requires its own worker-script
  // file straight from node_modules at runtime; bundling it with webpack
  // breaks that resolution (MODULE_NOT_FOUND for .next/worker-script/...).
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
  compress: true,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;