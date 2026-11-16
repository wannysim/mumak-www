import type * as React from 'react';

import { pageContent } from '@/content/pages';
import { joinClassNames } from '@/lib/class-names';
import type { PageLayout } from '@/model/fold';

import './book-page.css';

/**
 * 한 쪽의 내용. 사진 쪽은 사진 한 장만 넉넉한 여백과 함께 둔다(EXIF·프레임·캡션 없음, plan.md 사진).
 * 크기는 쪽 상자 기준 컨테이너 단위(cq)라 닫힌 책 안쪽 면과 펼친 책에서 같은 비율로 놓인다.
 */
function BookPage({
  page,
  layout,
  className,
  ...props
}: React.ComponentProps<'div'> & { page: number; layout: PageLayout }) {
  const content = pageContent(page);
  return (
    <div
      className={joinClassNames('book-page', className)}
      data-layout={layout}
      data-side={page % 2 === 1 ? 'left' : 'right'}
      data-page={page}
      {...props}
    >
      {content.kind === 'photo' ? (
        <img
          className="book-page__photo"
          src={content.src}
          width={content.width}
          height={content.height}
          alt={content.alt}
          decoding="async"
          draggable={false}
        />
      ) : null}
      {content.kind === 'opening' ? (
        <div className="absolute inset-0 flex flex-col p-5">
          {content.lines.map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {content.kind === 'colophon' ? (
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <p>{content.text}</p>
        </div>
      ) : null}
    </div>
  );
}

export { BookPage };
