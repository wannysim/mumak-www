import bundleAnalyzer from '@next/bundle-analyzer';
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';

const withNextIntl = createNextIntlPlugin('./src/shared/config/i18n/request.ts');

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['blog.mumak.localhost'],
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  outputFileTracingIncludes: {
    // OG 이미지 라우트가 런타임(on-demand)에 Satori용 woff 폰트를 fs로 읽으므로
    // standalone 산출물에 포함되도록 트레이싱한다. (standalone은 public/을 자동
    // 포함하지 않는다.)
    '/*': ['./content/**/*', './messages/**/*', './public/assets/fonts/**/*'],
  },
  transpilePackages: ['@mumak/ui'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    // 'use cache' 디렉티브만 활성화한다. cacheComponents(전부 동적-기본 + PPR)와 달리
    // generateStaticParams 기반 콘텐츠 페이지의 static-by-default 동작을 유지하므로,
    // 페이지 이동 시 RSC payload가 정적/캐시 가능(no-store 아님)하게 서빙된다.
    useCache: true,
    optimizePackageImports: ['next-mdx-remote-client', '@mumak/ui', 'lucide-react', 'next-themes', 'next-intl'],
  },
  async redirects() {
    const categories = ['essay', 'articles', 'notes'];
    return [
      // 루트 /favicon.ico를 직접 요청하는 크롤러·구형 클라이언트를 코드 생성 PNG
      // 아이콘(/icon)으로 보낸다. app/icon.tsx가 <link rel="icon">을 별도로 제공한다.
      {
        source: '/favicon.ico',
        destination: '/icon',
        permanent: false,
      },
      ...categories.flatMap(category => [
        {
          source: `/:locale/${category}`,
          destination: `/:locale/blog/${category}`,
          permanent: true,
        },
        {
          source: `/:locale/${category}/:slug`,
          destination: `/:locale/blog/${category}/:slug`,
          permanent: true,
        },
      ]),
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
