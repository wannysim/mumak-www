import fs from 'fs';
import os from 'os';
import path from 'path';

import { isPublishable, listMdxFiles, NoteFrontmatterSchema, parseMdxFile, PostFrontmatterSchema } from '..';

describe('content frontmatter schemas', () => {
  it('normalizes optional draft to false for posts', () => {
    const frontmatter = PostFrontmatterSchema.parse({
      title: 'Post title',
      date: '2026-06-12',
      description: 'Description',
      tags: ['test'],
    });

    expect(frontmatter.draft).toBe(false);
  });

  it('rejects post tags that are not an array', () => {
    expect(() =>
      PostFrontmatterSchema.parse({
        title: 'Post title',
        date: '2026-06-12',
        description: 'Description',
        tags: 'test',
      })
    ).toThrow('Expected array');
  });

  it('rejects invalid ISO date values', () => {
    expect(() =>
      PostFrontmatterSchema.parse({
        title: 'Post title',
        date: '2026-99-99',
        description: 'Description',
        tags: ['test'],
      })
    ).toThrow('Expected an ISO date string in YYYY-MM-DD format');
  });

  it('rejects dates that are not zero-padded YYYY-MM-DD strings', () => {
    expect(() =>
      PostFrontmatterSchema.parse({
        title: 'Post title',
        date: '2026-6-12',
        description: 'Description',
        tags: ['test'],
      })
    ).toThrow('Expected an ISO date string in YYYY-MM-DD format');
  });

  it('rejects unknown note status values', () => {
    expect(() =>
      NoteFrontmatterSchema.parse({
        title: 'Note title',
        created: '2026-06-12',
        status: 'sprout',
        tags: ['garden'],
      })
    ).toThrow('Invalid enum value');
  });
});

describe('content loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-content-loader-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it('lists only direct MDX files by default', () => {
    fs.writeFileSync(path.join(tempDir, 'first.mdx'), 'content');
    fs.writeFileSync(path.join(tempDir, 'ignore.txt'), 'content');
    fs.mkdirSync(path.join(tempDir, 'nested'));
    fs.writeFileSync(path.join(tempDir, 'nested', 'second.mdx'), 'content');

    expect(listMdxFiles(tempDir).map(filePath => path.basename(filePath))).toEqual(['first.mdx']);
  });

  it('lists nested MDX files when recursive is true', () => {
    fs.writeFileSync(path.join(tempDir, 'first.mdx'), 'content');
    fs.mkdirSync(path.join(tempDir, 'nested'));
    fs.writeFileSync(path.join(tempDir, 'nested', 'second.mdx'), 'content');

    expect(
      listMdxFiles(tempDir, { recursive: true })
        .map(filePath => path.basename(filePath))
        .toSorted()
    ).toEqual(['first.mdx', 'second.mdx']);
  });

  it('parses frontmatter and content with the provided schema', () => {
    const filePath = path.join(tempDir, 'post.mdx');
    fs.writeFileSync(
      filePath,
      `---
title: Test post
date: '2026-06-12'
description: Test description
tags:
  - test
---

Body content`
    );

    const parsed = parseMdxFile(filePath, PostFrontmatterSchema);

    expect(parsed.frontmatter.title).toBe('Test post');
    expect(parsed.content.trim()).toBe('Body content');
  });
});

describe('isPublishable', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalE2eIncludeDraft = process.env.E2E_INCLUDE_DRAFT;

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      configurable: true,
      value: originalNodeEnv,
      writable: true,
    });

    if (originalE2eIncludeDraft === undefined) {
      delete process.env.E2E_INCLUDE_DRAFT;
    } else {
      process.env.E2E_INCLUDE_DRAFT = originalE2eIncludeDraft;
    }
  });

  it('blocks drafts in production', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      configurable: true,
      value: 'production',
      writable: true,
    });

    expect(isPublishable({ draft: true })).toBe(false);
  });

  it('allows drafts in production when E2E_INCLUDE_DRAFT is enabled', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      configurable: true,
      value: 'production',
      writable: true,
    });
    process.env.E2E_INCLUDE_DRAFT = 'true';

    expect(isPublishable({ draft: true })).toBe(true);
  });
});
