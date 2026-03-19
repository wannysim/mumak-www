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
      <Accordion type="single" collapsible data-testid="linked-notes-accordion">
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
                  <Link href={`/garden/${linkedNote.slug}`} className="text-primary hover:underline underline-offset-4">
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
