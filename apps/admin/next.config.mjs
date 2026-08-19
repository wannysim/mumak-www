import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['admin.mumak.localhost'],
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  transpilePackages: ['@mumak/ui'],
  poweredByHeader: false,
  deploymentId: process.env.DEPLOYMENT_ID,
  experimental: {
    useTypeScriptCli: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; base-uri 'self'; connect-src 'self'${process.env.NODE_ENV === 'development' ? ' ws:' : ''}; form-action 'self'; frame-ancestors 'none'; img-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'`,
          },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
