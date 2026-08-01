'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@mumak/ui/components/accordion';

import type { LinkDirection } from '@/src/entities/note';
import { Link } from '@/src/shared/config/i18n';

const directionIcons: Record<LinkDirection, string> = {
  bidirectional: '↔',
  outgoing: '→',
  incoming: '←',
};

/**
 * 목록 한 줄.
 *
 * 항목이 자기 href를 들고 오기 때문에 가든 노트와 블로그 글을 한 목록에 섞을 수 있다.
 * 위키링크는 가든 안에서만 통하는 주소라, 노트와 글을 잇는 링크는 경로로만 표현된다.
 */
export interface LinkedItem {
  href: string;
  title: string;
  direction: LinkDirection;
}

interface LinkedNotesSectionProps {
  linkedItems: LinkedItem[];
  linkedNotesLabel: string;
  linkDirectionLabels: Record<LinkDirection, string>;
}

export function LinkedNotesSection({ linkedItems, linkedNotesLabel, linkDirectionLabels }: LinkedNotesSectionProps) {
  if (linkedItems.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-border" data-linked-notes-section>
      {/* 백링크는 가든의 주 재방문 경로다. 기본으로 펼쳐두고 접기만 선택으로 남긴다. */}
      <Accordion type="single" collapsible defaultValue="linked-notes" data-testid="linked-notes-accordion">
        <AccordionItem value="linked-notes" className="border-b-0">
          <AccordionTrigger className="py-0 text-lg font-semibold hover:no-underline">
            {linkedNotesLabel} ({linkedItems.length})
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-0">
            <ul className="space-y-2">
              {linkedItems.map(item => (
                <li key={item.href} className="flex items-center gap-2">
                  <span
                    className="text-muted-foreground text-sm w-5 text-center"
                    title={linkDirectionLabels[item.direction]}
                  >
                    {directionIcons[item.direction]}
                  </span>
                  {/* 본문 MDX 링크·위키링크와 같은 토큰. text-primary는 라이트에서 3.48:1이라
                      AA 미달이라 사이트 전체가 accent-foreground(7.92:1 / 11.58:1)를 쓴다. */}
                  <Link href={item.href} className="text-accent-foreground hover:underline underline-offset-4">
                    {item.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">{linkDirectionLabels[item.direction]}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
