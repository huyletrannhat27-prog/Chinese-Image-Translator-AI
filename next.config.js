// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/ocr': ['./scripts/paddle_ocr.py'],
    '/api/verify': ['./scripts/paddle_ocr.py'],
  },
  outputFileTracingExcludes: {
    '/api/ocr': ['./next.config.js'],
    '/api/verify': ['./next.config.js'],
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
