import { cleanupInlineMarkdown, extractHeadings } from '../headings';

describe('extractHeadings', () => {
  it('레벨과 텍스트, 앵커를 함께 돌려준다', () => {
    expect(extractHeadings('# 제목\n\n## 섹션')).toEqual([
      { index: 0, level: 1, text: '제목', anchor: '제목' },
      { index: 2, level: 2, text: '섹션', anchor: '섹션' },
    ]);
  });

  // 실제 콘텐츠에 셸 예제의 `# 주석`이 24건 있었고, 전부 유효 앵커로 등록돼
  // 위키링크 앵커 검증을 통과시키고 있었다.
  it('코드펜스 안의 # 주석은 헤딩이 아니다', () => {
    const content = ['# 진짜 헤딩', '```sh', '# 이건 셸 주석이다', 'npm run build', '```', '## 다음 섹션'].join('\n');

    expect(extractHeadings(content).map(h => h.text)).toEqual(['진짜 헤딩', '다음 섹션']);
  });

  it('물결 펜스도 코드블록으로 본다', () => {
    expect(extractHeadings(['~~~yaml', '# comment', '~~~'].join('\n'))).toEqual([]);
  });

  // 섹션 구간을 잘라 쓰는 쪽(노트 임베드 미리보기)이 이 값을 그대로 슬라이스한다.
  it('줄 번호는 펜스를 걷어내기 전 원문 기준이다', () => {
    const content = ['```sh', '# 주석', '```', '', '## 네 번째 줄의 섹션'].join('\n');

    expect(extractHeadings(content)[0]).toMatchObject({ index: 4, level: 2 });
  });

  it('인라인 마크다운을 걷어낸 텍스트로 앵커를 만든다', () => {
    expect(extractHeadings('## `code`와 **굵게** 그리고 [링크](/x)')).toEqual([
      { index: 0, level: 2, text: 'code와 굵게 그리고 링크', anchor: 'code와-굵게-그리고-링크' },
    ]);
  });

  it('# 뒤에 공백이 없으면 헤딩이 아니다', () => {
    expect(extractHeadings('#해시태그처럼 쓴 줄')).toEqual([]);
  });

  it('헤딩이 없으면 빈 배열이다', () => {
    expect(extractHeadings('문단만 있는 본문')).toEqual([]);
  });
});

describe('cleanupInlineMarkdown', () => {
  it('위키링크는 표시 텍스트만 남긴다', () => {
    expect(cleanupInlineMarkdown('[[slug|라벨]] 그리고 [[bare-slug]]')).toBe('라벨 그리고 bare-slug');
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(cleanupInlineMarkdown('  **굵게**  ')).toBe('굵게');
  });
});
