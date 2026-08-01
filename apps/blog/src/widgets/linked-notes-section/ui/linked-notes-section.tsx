'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@mumak/ui/components/accordion';

import type { LinkDirection, LinkedNote } from '@/src/entities/note';
import { Link } from '@/src/shared/config/i18n';

const directionIcons: Record<LinkDirection, string> = {
  bidirectional: '↔',
  outgoing: '→',
  incoming: '←',
};

interface LinkedNotesSectionProps {
  linkedNotes: LinkedNote[];
  linkedNotesLabel: string;
  linkDirectionLabels: Record<LinkDirection, string>;
}

export function LinkedNotesSection({ linkedNotes, linkedNotesLabel, linkDirectionLabels }: LinkedNotesSectionProps) {
  if (linkedNotes.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-border" data-linked-notes-section>
      {/* 백링크는 가든의 주 재방문 경로다. 기본으로 펼쳐두고 접기만 선택으로 남긴다. */}
      <Accordion type="single" collapsible defaultValue="linked-notes" data-testid="linked-notes-accordion">
        <AccordionItem value="linked-notes" className="border-b-0">
          <AccordionTrigger className="py-0 text-lg font-semibold hover:no-underline">
            {linkedNotesLabel} ({linkedNotes.length})
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-0">
            <ul className="space-y-2">
              {linkedNotes.map(linkedNote => (
                <li key={linkedNote.slug} className="flex items-center gap-2">
                  <span
                    className="text-muted-foreground text-sm w-5 text-center"
                    title={linkDirectionLabels[linkedNote.direction]}
                  >
                    {directionIcons[linkedNote.direction]}
                  </span>
                  {/* 본문 MDX 링크·위키링크와 같은 토큰. text-primary는 라이트에서 3.48:1이라
                      AA 미달이라 사이트 전체가 accent-foreground(7.92:1 / 11.58:1)를 쓴다. */}
                  <Link
                    href={`/garden/${linkedNote.slug}`}
                    className="text-accent-foreground hover:underline underline-offset-4"
                  >
                    {linkedNote.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">{linkDirectionLabels[linkedNote.direction]}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
