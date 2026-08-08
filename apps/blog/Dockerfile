# syntax=docker/dockerfile:1.7
# Build context = repo ROOT. Home server (Portainer endpoint 11) is x86_64, so
# ALWAYS build for linux/amd64 — that makes Next trace the matching sharp binary
# (@img/sharp-linux-x64) into the standalone output.
#
#   docker build -f apps/blog/Dockerfile --platform linux/amd64 \
#     --build-arg NEXT_PUBLIC_BASE_URL=https://<host> \
#     -t ghcr.io/wannysim/mumak-blog:latest .

# ---- base: pin node + pnpm exactly (engines >=24.11.1, packageManager pnpm@11.5.1) ----
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /app

# ---- prune: native turbo prune produces a minimal monorepo subset for blog ----
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.10.2 prune blog --docker
# -> /app/out/json  (package.json skeletons + pruned pnpm-lock.yaml + workspace file)
# -> /app/out/full  (pruned source for blog + @mumak/ui and its deps)

# ---- builder: install from pruned lockfile, then next build ----
FROM base AS builder
# deps layer first (cached until any package.json / lockfile changes)
COPY --from=prune /app/out/json/ ./
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=prune /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# source + build
COPY --from=prune /app/out/full/ ./

# NEXT_PUBLIC_* are INLINED into the client bundle at `next build` — they MUST be
# present before the build. Passing an empty value is fine (feature just no-ops),
# but NEXT_PUBLIC_BASE_URL drives every canonical/OG/sitemap URL, so always set it
# or it falls back to the hardcoded https://wannysim.com.
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GSC_TOKEN
ARG NEXT_PUBLIC_NAVER_TOKEN
# Default here (not only in promote.yml) because workflow_run executes promote.yml
# from MAIN — the build-arg added on develop is inert until the next release lands
# there. A DSN is public-by-design (shipped in every visitor's bundle), not a secret.
# Once main's promote.yml passes vars.NEXT_PUBLIC_SENTRY_DSN it overrides this.
ARG NEXT_PUBLIC_SENTRY_DSN=https://dbb76f675b2145cabcfd7815000c5f44@glitchtip.wannysim.com/1
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GSC_TOKEN=$NEXT_PUBLIC_GSC_TOKEN \
    NEXT_PUBLIC_NAVER_TOKEN=$NEXT_PUBLIC_NAVER_TOKEN \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NODE_ENV=production
# E2E_INCLUDE_DRAFT MUST stay unset here or draft posts leak into the static output.

RUN pnpm --filter blog build

# ---- runner: standalone tree + hand-copied static + public ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# (a) full standalone tree — server.js lands at apps/blog/server.js and the hoisted
#     node_modules (incl. the traced, correct-arch sharp) lands at /app/node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/apps/blog/.next/standalone ./
# (b) static — standalone omits it on purpose; copy INTO the nested app dir
#     (this is exactly what apps/blog/scripts/start-e2e.mjs does for E2E).
COPY --from=builder --chown=nextjs:nodejs /app/apps/blog/.next/static ./apps/blog/.next/static
# (c) public — standalone omits it too (only fonts are traced).
COPY --from=builder --chown=nextjs:nodejs /app/apps/blog/public ./apps/blog/public

# Pre-create the writable cache dir owned by the runtime user. A fresh named volume
# mounted here inherits this ownership (Docker copies dir perms into an empty named
# volume on first mount) — prevents EACCES from 'use cache' + the image optimizer.
RUN mkdir -p /app/apps/blog/.next/cache && chown -R nextjs:nodejs /app/apps/blog/.next

USER nextjs
WORKDIR /app/apps/blog
# Fail the build loudly if the traced sharp binary is the wrong arch (build FOR the
# target platform so this validates the binary the home server will actually run).
# pnpm keeps sharp under .pnpm (no top-level node_modules/sharp symlink), so resolve
# it from next's own require context — the same path the running server uses.
# Loading the module IS the arch check (it dlopens the native binary). Don't touch
# sharp/package.json — sharp 0.35+ (via Next 16.3) no longer exports that subpath.
RUN node -e "const{createRequire}=require('module');const r=createRequire(require.resolve('next/package.json'));const s=r('sharp');console.log('sharp',s.versions&&s.versions.sharp,'loaded:',!!s)"
EXPOSE 3000
# cwd MUST be the standalone app dir — content loaders and OG fonts read from cwd.
CMD ["node", "server.js"]
