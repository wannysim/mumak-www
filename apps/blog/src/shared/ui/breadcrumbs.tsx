import * as React from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@mumak/ui/components/breadcrumb';
import { cn } from '@mumak/ui/lib/utils';

import { Link } from '@/src/shared/config/i18n';

export interface BreadcrumbEntry {
  label: string;
  // 현재 페이지(마지막 항목)는 href를 생략한다 → aria-current="page"로 렌더된다.
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbEntry[];
  className?: string;
}

// blog/garden 상세 페이지 상단의 "위로 가는" 경로. 지금까지 이 trail은
// BreadcrumbList JSON-LD에만 있고 화면에는 없어서, 검색·소셜·그래프에서
// 깊이 진입한 독자에게 상위로 돌아갈 가시적 길이 없었다. blog/garden 양쪽이
// 같은 recipe를 공유한다(@mumak/ui Breadcrumb 조합).
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <Breadcrumb className={cn('mb-6', className)}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isLink = !isLast && item.href;

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem className="min-w-0">
                {isLink ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href!} className="max-w-[40vw] truncate sm:max-w-none">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="max-w-[60vw] truncate sm:max-w-md">{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
