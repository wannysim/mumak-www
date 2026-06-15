import { z } from 'zod';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isIsoDate = (value: string) => {
  if (!ISO_DATE_REGEX.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const isoDateSchema = z.string().refine(isIsoDate, {
  message: 'Expected an ISO date string in YYYY-MM-DD format',
});

const tagsSchema = z.array(z.string().min(1));

export const PostFrontmatterSchema = z.object({
  title: z.string().min(1),
  date: isoDateSchema,
  updated: isoDateSchema.optional(),
  description: z.string(),
  tags: tagsSchema,
  draft: z.boolean().default(false),
});

export const NoteFrontmatterSchema = z.object({
  title: z.string().min(1),
  created: isoDateSchema,
  updated: isoDateSchema.optional(),
  status: z.enum(['seedling', 'budding', 'evergreen']),
  tags: tagsSchema,
  draft: z.boolean().default(false),
  parent: z.string().min(1).optional(),
});

export const PageFrontmatterSchema = z.object({
  title: z.string().min(1).default('Untitled'),
  description: z.string().default(''),
  lastUpdated: isoDateSchema.optional(),
});

export type PostFrontmatter = z.output<typeof PostFrontmatterSchema>;
export type NoteFrontmatter = z.output<typeof NoteFrontmatterSchema>;
export type PageFrontmatter = z.output<typeof PageFrontmatterSchema>;
