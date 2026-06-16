import { markdownToHtml } from '../markdown';

describe('markdownToHtml', () => {
  it('converts headings and paragraphs to HTML', () => {
    const html = markdownToHtml('# Title\n\nHello world');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<p>Hello world</p>');
  });

  it('renders fenced code blocks as pre/code', () => {
    const html = markdownToHtml('```ts\nconst a = 1;\n```');

    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).toContain('const a = 1;');
  });

  it('supports GFM (strikethrough)', () => {
    const html = markdownToHtml('~~gone~~');

    expect(html).toContain('<del>gone</del>');
  });

  it('escapes JSX/HTML inside code fences so feeds do not render source as markup', () => {
    const html = markdownToHtml('```tsx\n<div style={{ width: `50%` }} />\n```');

    // 코드펜스 안의 JSX는 raw 태그가 아니라 이스케이프된 텍스트로 남는다.
    expect(html).toContain('&lt;div');
    expect(html).not.toMatch(/<div\s/);
  });
});
