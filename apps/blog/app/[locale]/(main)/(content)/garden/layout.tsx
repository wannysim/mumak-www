import { setRequestLocale } from 'next-intl/server';

import { buildNoteTree, getNotes } from '@/src/entities/note';
import { locales, type Locale } from '@/src/shared/config/i18n';
import { GardenSidebar } from '@/src/widgets/garden-sidebar';

interface GardenLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

const PARA_CATEGORIES = [
  { key: 'projects', label: 'Projects' },
  { key: 'areas', label: 'Areas' },
  { key: 'resources', label: 'Resources' },
  { key: 'archives', label: 'Archives' },
  { key: 'garden', label: 'Uncategorized' },
];

export default async function GardenLayout({ children, params }: GardenLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const notes = getNotes(locale as Locale);

  const categories = PARA_CATEGORIES.map(cat => {
    const categoryNotes = notes.filter(n => (n.category || 'garden') === cat.key);
    const tree = buildNoteTree(categoryNotes);
    return {
      key: cat.key,
      label: cat.label,
      noteCount: categoryNotes.length,
      tree: tree.map(function toSerializable(node): {
        slug: string;
        title: string;
        children: ReturnType<typeof toSerializable>[];
      } {
        return {
          slug: node.slug,
          title: node.title,
          children: node.children.map(toSerializable),
        };
      }),
    };
  });

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <GardenSidebar categories={categories} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
