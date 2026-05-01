import robots from '@/app/robots';

describe('robots', () => {
  it('should return valid robots configuration', () => {
    const result = robots();

    expect(result).toHaveProperty('rules');
    expect(result).toHaveProperty('sitemap');
    expect(Array.isArray(result.rules)).toBe(true);
  });

  it('should have rules for all user agents', () => {
    const result = robots();
    const rule = result.rules;

    if (Array.isArray(rule)) {
      expect(rule[0]).toHaveProperty('userAgent', '*');
    }
  });

  it('should allow root path', () => {
    const result = robots();
    const rule = result.rules;

    if (Array.isArray(rule)) {
      expect(rule[0]?.allow).toBe('/');
    }
  });

  it('should disallow api and _next paths', () => {
    const result = robots();
    const rule = result.rules;

    if (Array.isArray(rule)) {
      const disallowPaths = rule[0]?.disallow;
      expect(disallowPaths).toContain('/api/');
      expect(disallowPaths).toContain('/_next/');
    }
  });

  it('should include sitemap URL with correct format', () => {
    const result = robots();

    expect(result.sitemap).toContain('sitemap.xml');
    expect(result.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });

  it('should use base URL (default or from env)', () => {
    const result = robots();

    // BASE_URL은 모듈 로드 시점에 결정되므로 기본값 또는 환경 변수 값 중 하나
    expect(result.sitemap).toMatch(/^https:\/\/(wannysim\.com|.+)\/sitemap\.xml$/);
  });

  it('should declare host', () => {
    const result = robots();

    expect(result.host).toMatch(/^https?:\/\/.+/);
  });

  describe('AI bot policy', () => {
    function findAiTrainingRule(result: ReturnType<typeof robots>) {
      const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
      return rules.find(rule => {
        const ua = rule.userAgent;
        const list = Array.isArray(ua) ? ua : [ua];
        return list.includes('GPTBot');
      });
    }

    it('should disallow training-only LLM crawlers', () => {
      const trainingRule = findAiTrainingRule(robots());

      expect(trainingRule).toBeDefined();
      expect(trainingRule?.disallow).toBe('/');

      const ua = trainingRule?.userAgent;
      const list = Array.isArray(ua) ? ua : [ua];
      expect(list).toEqual(expect.arrayContaining(['GPTBot', 'anthropic-ai', 'ClaudeBot', 'Google-Extended', 'CCBot']));
    });

    it('should leave answer/search bots covered by the default allow rule', () => {
      const result = robots();
      const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
      const flatten = (ua: string | string[] | undefined) => (Array.isArray(ua) ? ua : ua ? [ua] : []);
      const explicitlyDisallowed = rules
        .filter(rule => rule.disallow === '/' || (Array.isArray(rule.disallow) && rule.disallow.includes('/')))
        .flatMap(rule => flatten(rule.userAgent));

      for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-User']) {
        expect(explicitlyDisallowed).not.toContain(bot);
      }
    });
  });
});
