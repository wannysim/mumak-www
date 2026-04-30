import type { EvaluateOptions } from 'next-mdx-remote-client/rsc';
import rehypePrism from 'rehype-prism-plus';
import remarkGfm from 'remark-gfm';

export const mdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
  },
} satisfies EvaluateOptions;
