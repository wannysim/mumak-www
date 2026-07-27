/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['next.mumak.localhost'],
  transpilePackages: ['@mumak/ui'],
  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
