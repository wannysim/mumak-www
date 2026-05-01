import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.join(__dirname, '..', '..');
const CONTENT = '[locale]/(main)/(content)';

const PAGES_WITH_ALTERNATES = [
  `${CONTENT}/page.tsx`,
  `${CONTENT}/about/page.tsx`,
  `${CONTENT}/now/page.tsx`,
  `${CONTENT}/blog/page.tsx`,
  `${CONTENT}/blog/[category]/page.tsx`,
  `${CONTENT}/blog/[category]/[slug]/page.tsx`,
  `${CONTENT}/blog/tags/page.tsx`,
  `${CONTENT}/blog/tags/[tag]/page.tsx`,
  `${CONTENT}/garden/page.tsx`,
  `${CONTENT}/garden/[slug]/page.tsx`,
  `${CONTENT}/garden/tags/page.tsx`,
  `${CONTENT}/garden/tags/[tag]/page.tsx`,
  `${CONTENT}/garden/status/[status]/page.tsx`,
];

function readPageSource(relativePath: string): string {
  const fullPath = path.join(APP_ROOT, 'app', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

describe('page-level alternates wiring', () => {
  describe.each(PAGES_WITH_ALTERNATES)('%s', relativePath => {
    let source: string;

    beforeAll(() => {
      source = readPageSource(relativePath);
    });

    it('should export generateMetadata', () => {
      expect(source).toMatch(/export\s+(async\s+)?function\s+generateMetadata/);
    });

    it('should import buildAlternates', () => {
      expect(source).toMatch(/import\s+\{[^}]*\bbuildAlternates\b[^}]*\}/);
    });

    it('should call buildAlternates inside generateMetadata', () => {
      // 'alternates: buildAlternates({ ... })' 형태 검증 (spaces tolerant)
      expect(source).toMatch(/alternates\s*:\s*buildAlternates\s*\(/);
    });
  });
});
