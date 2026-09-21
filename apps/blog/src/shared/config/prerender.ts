// Next.js renders paths omitted from generateStaticParams on first request.
// https://nextjs.org/docs/app/api-reference/functions/generate-static-params#all-paths-at-runtime
export const prerenderGardenRoutes = process.env.VERCEL_ENV !== 'preview';
