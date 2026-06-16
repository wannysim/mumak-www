import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import type { z } from 'zod';

export interface ParsedMdxFile<TFrontmatter> {
  filePath: string;
  frontmatter: TFrontmatter;
  content: string;
}

export function listMdxFiles(dirPath: string, options: { recursive?: boolean } = {}): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries.flatMap(entry => {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return options.recursive ? listMdxFiles(fullPath, options) : [];
    }

    return entry.isFile() && entry.name.endsWith('.mdx') ? [fullPath] : [];
  });
}

export function parseMdxFile<TSchema extends z.ZodTypeAny>(
  filePath: string,
  schema: TSchema
): ParsedMdxFile<z.output<TSchema>> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  return {
    filePath,
    frontmatter: schema.parse(data),
    content,
  };
}
