import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://wannysim.com';

// AI 크롤러 정책 (D-1) — 봇 목록만 두지 않고 분류와 기본 처리 방침을 코드로 명시한다.
//
// 1. 학습(training)용 봇: 차단(disallow). 콘텐츠가 모델 가중치로 흡수되는 것을 막는다.
// 2. 검색·실시간 인용(search/citation)용 봇: 명시적 허용(allow). ChatGPT/Claude/Perplexity
//    답변에 출처로 인용되는 것은 허용한다(GEO). 기본 `*` 규칙으로도 허용되지만,
//    "학습은 차단, 검색 인용은 허용"이 우연이 아니라 의도임을 코드로 고정한다.
// 3. 어느 분류에도 없는 신규 봇: 기본 허용. allowlist가 아니라 denylist 방식이라
//    일반 검색엔진·미분류 봇을 실수로 막지 않는다. 신규 봇이 학습용으로 판명되면
//    AI_TRAINING_BOTS에, 검색·인용용이면 AI_SEARCH_BOTS에 추가한다.

// 학습용 — disallow
const AI_TRAINING_BOTS = [
  'GPTBot',
  'anthropic-ai',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Meta-ExternalAgent',
  'cohere-ai',
];

// 검색·실시간 인용용 — 명시적 allow
const AI_SEARCH_BOTS = [
  'OAI-SearchBot', // ChatGPT 검색 인덱싱
  'ChatGPT-User', // ChatGPT 사용자 요청 시 fetch
  'Claude-SearchBot', // Claude 검색 인덱싱
  'Claude-User', // Claude 사용자 요청 시 fetch
  'PerplexityBot', // Perplexity 인덱싱
  'Perplexity-User', // Perplexity 사용자 요청 시 fetch
];

const CRAWL_DISALLOW = ['/api/', '/_next/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: CRAWL_DISALLOW,
      },
      {
        userAgent: AI_SEARCH_BOTS,
        allow: '/',
        disallow: CRAWL_DISALLOW,
      },
      {
        userAgent: AI_TRAINING_BOTS,
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
