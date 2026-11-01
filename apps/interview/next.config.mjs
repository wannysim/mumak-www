/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['interview.mumak.localhost'],
  transpilePackages: ['@mumak/ui'],
  experimental: { useTypeScriptCli: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};
export default nextConfig;
