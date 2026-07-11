# The API imports @flappy/core to replay runs, so the build context is the repo
# root, not backend/ — the workspace has to come along.
#
#   docker build -f backend/Dockerfile -t flappy-api .
#
FROM node:20-alpine AS base
WORKDIR /app

# ---- dependencies -----------------------------------------------------------
FROM base AS deps

# Only the manifests first, so a code change doesn't reinstall the world.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# The frontend is a workspace sibling and would drag in Next.js, Three.js and
# the Android toolchain for nothing. It stays out of the image.
RUN npm ci --omit=dev --workspace @flappy/backend --workspace @flappy/core --include-workspace-root

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime

ENV NODE_ENV=production

# npm workspaces hoist everything to the root, so this is the only node_modules
# there is — backend/node_modules never exists.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY backend ./backend

# tsx runs the TypeScript directly. The service is small and the shared core is
# consumed as source by both sides, so there's no build step worth its weight.
RUN npm install --no-save tsx@4

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npx", "tsx", "backend/src/index.ts"]
