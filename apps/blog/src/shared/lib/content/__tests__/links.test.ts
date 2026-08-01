import { extractInAppLinks } from '../links';

describe('extractInAppLinks', () => {
  it('사이트 내부 마크다운 링크를 뽑는다', () => {
    expect(extractInAppLinks('본문 [노트](/ko/garden/keep-alive-timeout-ordering) 참고')).toEqual([
      '/garden/keep-alive-timeout-ordering',
    ]);
  });

  // 저자가 URL이 아니라 파일 경로를 그대로 적는 습관이 있어서, 렌더러가 쓰는
  // 정규화(.mdx 제거 · 중첩 가든 경로 평탄화 · locale prefix 제거)를 그대로 태운다.
  it.each([
    ['/ko/garden/resources/frontend/browser/browser-rendering-pipeline.mdx', '/garden/browser-rendering-pipeline'],
    ['/ko/articles/react-compiler-rust-port.mdx', '/blog/articles/react-compiler-rust-port'],
    ['/ko/blog/articles/expo-social-login', '/blog/articles/expo-social-login'],
  ])('%s를 렌더된 href와 같은 형태로 정규화한다', (raw, expected) => {
    expect(extractInAppLinks(`[링크](${raw})`)).toEqual([expected]);
  });

  it('외부 링크는 무시한다', () => {
    expect(extractInAppLinks('[깃허브](https://github.com/x) [상대](./sibling.md)')).toEqual([]);
  });

  it('이미지는 링크가 아니다', () => {
    expect(extractInAppLinks('![스크린샷](/images/shot.png)')).toEqual([]);
  });

  it('같은 대상을 여러 번 가리켜도 한 번만 센다', () => {
    const content = '앞에서 [노트](/ko/garden/x)를 말했고 뒤에서 [다시](/ko/garden/x) 말한다';

    expect(extractInAppLinks(content)).toEqual(['/garden/x']);
  });

  it('코드블록 안의 링크는 실제 링크가 아니다', () => {
    const content = ['진짜 [노트](/ko/garden/real)', '```md', '예시: [노트](/ko/garden/fake)', '```'].join('\n');

    expect(extractInAppLinks(content)).toEqual(['/garden/real']);
  });

  it('물결 펜스도 코드블록으로 본다', () => {
    const content = ['~~~md', '[노트](/ko/garden/fake)', '~~~'].join('\n');

    expect(extractInAppLinks(content)).toEqual([]);
  });

  it('앵커만 있는 링크는 사이트 내부 경로가 아니다', () => {
    expect(extractInAppLinks('[여기](#section)')).toEqual([]);
  });

  // 이 값은 렌더용이 아니라 두 문서를 잇는 키다. 앵커가 남으면 같은 문서를 가리키는
  // 링크가 서로 다른 키가 되어 연결이 조용히 끊긴다.
  it('앵커와 쿼리를 떼어 문서 단위 키로 만든다', () => {
    expect(extractInAppLinks('[섹션](/ko/garden/x#어떤-섹션) [쿼리](/ko/blog/articles/y?ref=z)')).toEqual([
      '/garden/x',
      '/blog/articles/y',
    ]);
  });

  it('같은 문서의 다른 앵커는 한 번만 센다', () => {
    expect(extractInAppLinks('[a](/ko/garden/x#one) [b](/ko/garden/x#two)')).toEqual(['/garden/x']);
  });

  it('링크가 없으면 빈 배열이다', () => {
    expect(extractInAppLinks('링크 없는 문단')).toEqual([]);
  });
});
