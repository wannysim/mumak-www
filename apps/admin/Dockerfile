# syntax=docker/dockerfile:1.7
# Build context is the repository root. Production must use --platform linux/amd64
# so Next traces the same sharp native binary that the home server will execute.
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
WORKDIR /app

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.10.7 prune admin --docker

FROM base AS builder
COPY --from=prune /app/out/json/ ./
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=prune /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ ./
ARG DEPLOYMENT_ID=local
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DEPLOYMENT_ID=$DEPLOYMENT_ID
RUN pnpm --filter admin build

WORKDIR /app/apps/admin
RUN node -e "const s=require('sharp');if(s.versions.sharp!=='0.35.3')throw Error('unexpected sharp version');console.log('sharp',s.versions.sharp,s.versions.vips)" \
 && node --experimental-strip-types --input-type=module -e "import{readFile,mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{processImageUpload}from'./src/entities/image/image-upload.ts';const input=await readFile('./src/entities/image/__tests__/fixtures/landscape-orientation-6.jpg');const root=await mkdtemp(join(tmpdir(),'source-v1-'));try{const result=await processImageUpload({body:new ReadableStream({start(c){c.enqueue(input);c.close()}}),storageRoot:root,minFreeBytes:0,verifyPublic:async()=>{}});if(result.checksums.source!=='e4c54beb780223fa8bf1ced9d83712225ef07108efdf884fddca38c58975e287'||result.bytes.source!==176242)throw Error('source-v1 policy drift');console.log('source-v1',result.checksums.source)}finally{await rm(root,{recursive:true,force:true})}"
WORKDIR /app

FROM node:24-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /app/apps/admin/.next/cache /data/images \
 && chown -R nextjs:nodejs /app /data/images

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone /app/
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static /app/apps/admin/.next/static
# Next traces sharp under pnpm's virtual store but does not create the app-level
# direct-dependency link. Restore that stable link so route chunks and smoke tests
# resolve the exact target-platform binary copied above.
RUN ln -s ../../../node_modules/.pnpm/node_modules/sharp /app/apps/admin/node_modules/sharp

USER nextjs
WORKDIR /app/apps/admin
RUN node -e "const s=require('sharp');if(s.versions.sharp!=='0.35.3')throw Error('unexpected sharp version');console.log('sharp',s.versions.sharp,s.versions.vips)"
EXPOSE 3000
CMD ["node", "server.js"]
