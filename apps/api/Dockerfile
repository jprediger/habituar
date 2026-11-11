# syntax=docker/dockerfile:1
# O contexto de build é a raiz do monorepo, não `apps/api`: a API consome `@habituar/core`
# pelo workspace, e o lockfile só existe na raiz.
ARG NODE_VERSION=22.23.2

FROM node:${NODE_VERSION}-bookworm-slim AS base
# `PNPM_HOME` também fixa o store em `/pnpm/store`, que é o alvo do cache de build abaixo.
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY . .
# O `prepare` da raiz instala o husky, que o install filtrado não traz; hook de git não
# tem função dentro da imagem.
RUN pnpm pkg delete scripts.prepare

FROM base AS build
RUN --mount=type=cache,id=habituar-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@habituar/api..."
# Ordem topológica: `core` precisa do `dist` antes de a API compilar contra ele.
RUN pnpm --filter "@habituar/api..." run build

FROM base AS production-dependencies
# Linker isolado só aqui: o `hoisted` do workspace existe pelo React Native e, com ele, o
# filtro não restringe o que é içado — a imagem levaria Expo e React Native junto.
RUN --mount=type=cache,id=habituar-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@habituar/api..." --config.node-linker=isolated

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /repo
# A árvore inteira, porque o linker isolado espalha `node_modules` com symlinks por cada
# pacote do workspace; copiar só a raiz quebraria a resolução.
COPY --from=production-dependencies /repo /repo
COPY --from=build /repo/packages/core/dist /repo/packages/core/dist
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
RUN mkdir -p /data/storage && chown node:node /data/storage
USER node
# cwd importa: o migrador lê `./db/migrations` relativo a ele.
WORKDIR /repo/apps/api
EXPOSE 8080
CMD ["node", "dist/main.js"]
