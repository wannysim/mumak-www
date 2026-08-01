import { cn } from '@mumak/ui/lib/utils';

import type { ContentHeading } from '@/src/shared/lib/content';

/**
 * 목차를 띄울 최소 읽기 시간(분).
 *
 * 현재 콘텐츠 기준 이 선을 넘는 글은 23편 중 다섯이고, 전부 섹션이 여섯 개 이상이다.
 * 짧은 에세이에 목차를 달면 본문보다 목차가 길어진다.
 */
export const TOC_MIN_READING_TIME = 8;

/** 목차가 길잡이 노릇을 하려면 최소한 이만큼은 갈라져 있어야 한다. */
const MIN_HEADINGS = 3;

interface PostTocProps {
  headings: ContentHeading[];
  readingTime: number;
  label: string;
}

export function shouldShowToc(headings: ContentHeading[], readingTime: number): boolean {
  return readingTime >= TOC_MIN_READING_TIME && headings.length >= MIN_HEADINGS;
}

const LABEL_ID = 'post-toc-label';

/**
 * 긴 글의 우측 레일 목차.
 *
 * 읽기 진행률 바는 "얼마나 왔는지"는 알려주지만 "어디쯤인지"는 알려주지 않는다.
 * 9,000자짜리 트러블슈팅 글에서 독자가 필요한 건 후자다.
 *
 * DOM에서는 본문 `</article>` 뒤에 두고 grid로만 우측에 배치한다. 앞에 두면
 * 키보드 사용자가 본문에 닿기 전에 링크 여러 개를 지나야 한다. 앵커 id는
 * mdx-components가 헤딩에 붙이는 것과 같은 규칙(normalizeHeadingToAnchor)이다.
 *
 * ponytail: 스크롤 위치 추적(scrollspy)은 넣지 않았다. 필요해지면
 * IntersectionObserver 하나로 활성 항목에 aria-current="location"을 붙이면 된다.
 */
export function PostToc({ headings, readingTime, label }: PostTocProps) {
  if (!shouldShowToc(headings, readingTime)) {
    return null;
  }

  return (
    <nav
      data-slot="post-toc"
      aria-labelledby={LABEL_ID}
      className="hidden xl:block xl:col-start-2 xl:row-start-1 xl:sticky xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto"
    >
      <p id={LABEL_ID} className="mb-2 text-sm font-semibold">
        {label}
      </p>
      <ol className="space-y-1.5 border-l border-border text-sm">
        {headings.map(heading => (
          <li key={heading.anchor}>
            <a
              href={`#${heading.anchor}`}
              className={cn(
                '-ml-px block border-l border-transparent py-0.5 pl-3 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground',
                heading.level >= 3 && 'pl-6'
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
