import type { EvaluateOptions } from 'next-mdx-remote-client/rsc';
import rehypePrism from 'rehype-prism-plus';
import remarkGfm from 'remark-gfm';

import { remarkContentImages } from '@/src/shared/lib/content/remark-content-images';

export const mdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm, remarkContentImages],
    rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
  },
} satisfies EvaluateOptions;
