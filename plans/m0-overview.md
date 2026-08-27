# M0 — Esqueleto executável

> Produto: `../project-description.md` · Arquitetura: `../ARCHITECTURE.md` ·
> Execução: `../implementation-plan.md` · Regras: `../CLAUDE.md`
>
> Planos detalhados por área: [`m0-shared-packages.md`](m0-shared-packages.md) ·
> [`m0-api.md`](m0-api.md) · [`m0-clients.md`](m0-clients.md)

Escopo do marco: **encanamento provado e imposição automática**. Nenhum CRUD, nenhuma regra
de negócio, nenhuma tabela de domínio. O que este marco entrega é a certeza de que o marco
seguinte não vai tropeçar em toolchain.

---

## Estado da execução

| Passo | Estado |
|---|---|
| 2 — `nodenext` no `tsconfig/nest.json` | **parcial** — falta exportar `FRAMEWORK_BANS` |
| 5 — `^build` em `typecheck`, `test` e `dev` | concluído |
| 6 — scaffold da API com SWC | concluído, com o teste de metadata de DI passando |
| 7 — build, `exports` e lint de `packages/core` | concluído |
| 11 — schema de `health` | concluído |
| 12 — rota `/v1/health` no contrato | concluído |
| 22 — fatia `health` na API, a partir do contrato | concluído |

`pnpm check` verde nos 10 tasks. O esqueleto anda ponta a ponta: o schema zod nasce em
`packages/core`, o contrato o publica sob `/v1`, `apps/api` o implementa, e o teste valida
a resposta HTTP real contra o mesmo schema.

**Os passos 6, 12 e 22 são reimplementados no passo 6b**, que troca a plataforma para ESM,
Nest 12 e oRPC. O que eles provaram continua valendo — metadata de DI sob SWC, contrato
como fonte única, teste HTTP ponta a ponta —, mas a biblioteca por baixo muda. Sequência
detalhada em [`m0-api-sequence.md`](m0-api-sequence.md).

**Falta na fase 0:** passo 1 (`catalog:`/`overrides:` e as opções do `.npmrc`), a segunda
metade do passo 2 (exportar `FRAMEWORK_BANS`), o passo 3 (`no-extraneous-dependencies`) e o
passo 4 (seletores de a11y/i18n). Só o passo 2 bloqueia algo adiante: o ban local do ORM no
passo 27.

---

## Decisões fechadas

As quatro primeiras vieram de evidência convergente; as demais desempataram contradições
entre os planos de área ou pontos que o repositório não respondia.

| Decisão | Escolha | Por quê |
|---|---|---|
| Módulo do monorepo | **ESM em todos os workspaces** + SWC | Revista em 27/08/2026. `@nestjs/core@12` saiu estável e é ESM-only; o que prendia o app em CommonJS era o peer do `@ts-rest/nest` (`^9 \|\| ^10 \|\| ^11`), resolvido pela troca por oRPC. O SWC **continua obrigatório**: o problema do `emitDecoratorMetadata` é sobre decorators, não sobre formato de módulo, e o esbuild ignora a opção em silêncio. `tsc` fica só como portão de tipo (`--noEmit`) |
| Contrato da API | **oRPC `1.15.0`** + **zod 4** | Revista em 27/08/2026. O `@ts-rest` não publica desde 2025-06-02 e trava o Nest em 11. O `@orpc/nest` tem peer `>=11.0.0`, valida por Standard Schema (destravando zod 4), e traz `@orpc/openapi` e `@orpc/tanstack-query`. Contrato incompleto passa a ser erro de `tsc`, não de runtime |
| Forma de `packages/core` | Compilado **só ESM** (tsup), consumido só por `dist/` | Com o monorepo inteiro em ESM, a condição `require` deixa de ter consumidor. O consumo por `dist/` permanece: o SWC compila arquivo a arquivo e nunca atravessa fronteira de workspace, e export apontando para `src/` criaria dois caminhos de resolução — a armadilha de módulo duplicado do D5 |
| `tsconfig/nest.json` | `module` e `moduleResolution` → `nodenext` | O algoritmo antigo (`node`, node10) **ignora o campo `exports`** — e sem barrel o `exports` é o entrypoint público. `nodenext` é o padrão do ecossistema e é verdade sobre o Node 22 que o `.nvmrc` fixa. Com todo o monorepo em ESM, o formato emitido deixa de depender do campo `type` de cada workspace |
| Provas de infra no M0 | RLS e `expo-doctor` dentro; Dockerfile e build EAS fora | O teste de isolamento prova docker, migração e CI de uma vez. O Dockerfile existia para provar dependência declarada sob `hoisted` — o lint prova isso mais barato e no gate certo |
| Corpo de `/v1/health` | `{ status, version }`, sem porta `Clock` | `checkedAt` é campo sem consumidor (quem chamou já sabe a hora), então não sustenta a porta. `Clock` entra no M1, com expiração deslizante de sessão |
| Forma do hook | União discriminada via `toQueryState(query)` | Mais hooks são certeza, não hipótese. O escopo está no nome: cobre leitura. Mutation ganha o seu em M4 — esta união não será alargada para servir aos dois |
| Singletons de React/RN | `catalog:` **e** `overrides:` | `catalog:` fixa só o que os workspaces declaram; a cópia que quebra o Metro é a que uma transitiva arrasta, e só `overrides:` alcança essa |
| `openapi.json` | M0, com gate por snapshot do Vitest | O mecanismo precisa existir antes da primeira rota que mexe em contrato. Custa um teste e nenhum step novo no CI |
| Roteamento dos clientes | File-based nos dois apps | A doc do TanStack diz que code-based "não é recomendado para a maioria das aplicações", e file-based é um **superset** — mesmas opções de rota, geradas. Ganha code-splitting automático e o mesmo modelo mental do Expo Router no mobile, que é o que a paridade do D1 pede |
| Runner de teste | Vitest, exceto `apps/mobile` em `jest@29` | `jest-expo` é o único caminho que a Expo testa (Flow no source do RN, mocks nativos, resolução `.native.ts`). O custo da divergência é um arquivo de config; `turbo run test` continua uniforme |

### Decisões adjacentes, fechadas sem discussão

- Log JSON correlacionado desde o M0. **`pino` + `pino-http` diretos, sem `nestjs-pino`**:
  o wrapper trava em Nest 11 e não publica desde 2026-03-13, e o passo 24 já cria o
  middleware onde o `pino-http` se monta. Dependência que não compra complexidade material.
- `nestjs-zod` **fora** — o oRPC já parseia request e response contra o contrato;
  um segundo pipe seria a segunda definição de validade que o D4 existe para evitar.
- `IdGenerator` como porta fica para o M1. `apps/api` usa `CryptoIdGenerator` concreto para
  o `correlationId` — consumidor real, classe concreta, sem token de injeção.
- Paleta provisória que passa no AA. O que protege a troca de marca é o teste, não o olho.
- Playwright + `@axe-core/playwright` no M1.

---

## Achado que mudou o escopo

`node-linker=hoisted` **já está ativo** no `.npmrc`. A garantia natural de que dependência
não declarada quebra o build já morreu, e nada a substituiu. Com o Dockerfile fora do M0,
o lint passa a ser a única prova de fechamento de dependências — por isso
`no-extraneous-dependencies` é obrigatório na fase 0, não opcional.

---

## Sequência

Fases numeradas porque a ordem carrega dependência real. Todo passo fecha com
`pnpm check` verde e um commit em Conventional Commits.

### Fase 0 — Configuração do repositório

Bloqueia todas as outras.

| # | Commit | Conteúdo |
|---|---|---|
| 1 | `chore(config): move pnpm settings into the workspace manifest` | `nodeLinker`, `engineStrict` e `saveExact` saem do `.npmrc`; entram `catalog:` e `overrides:` |
| 2 | `build(config): resolve packages with nodenext in the nest tsconfig` | `tsconfig/nest.json` → `nodenext`; exportar `FRAMEWORK_BANS` de `eslint/api.js` |
| 3 | `feat(config): forbid undeclared dependencies in every workspace` | `no-extraneous-dependencies` + fixture no teste de fronteiras |
| 4 | `feat(config): forbid hardcoded ui text and untyped interactive elements` | três seletores em `eslint/react.js` |
| 5 | ✅ `build(repo): build shared packages before typecheck, test and dev` | `turbo.json`: `^build` em `typecheck`, `test` e `dev` |

### Fase 1 — O quadrilátero de risco da API

Depende só da fase 0 e roda em paralelo com a fase 2. **É o único passo do marco que não
pode ser adiado nem paralelizado**: se o SWC não entregar `decoratorMetadata` dentro do
Vitest 4, todo o resto muda de forma.

| # | Commit |
|---|---|
| 6 | ✅ `build(api): scaffold nest app with swc toolchain` |
| 6b | ✅ `feat(api): move the stack to esm, nest 12 and orpc` |

O passo **6b** reimplementa 6, 12 e 22 sobre ESM + Nest 12 + oRPC + zod 4, num commit
atômico — Nest 12 é ESM-only e está fora do peer do `@ts-rest`, então separá-los deixaria
o repositório quebrado entre commits. O quadrilátero **Nest 12 × ESM × SWC × Vitest ×
oRPC** foi provado por spike antes de a decisão ser tomada; a evidência está na §3 de
[`m0-api-sequence.md`](m0-api-sequence.md).

### Fase 2 — `packages/core` e `packages/design-tokens`

Bloqueia as fases 3, 4 e 5.

| # | Commit |
|---|---|
| 7 | ✅ `build(core): add package build, exports map and lint setup` |
| 8 | `feat(core): add assertNever for closed unions` |
| 9 | `feat(core): add branded identifier schema helper` |
| 10 | `feat(core): add closed catalog of failure codes` |
| 11 | ✅ `feat(core): add health status schema` |
| 12 | ✅ `feat(core): declare the v1 health route in the contract` — reimplementado em 6b |
| 13 | `feat(core): commit the generated openapi document` |
| 14 | `feat(core): add the typed api client factory` |
| 15 | `feat(core): map query results into a discriminated view state` |
| 16 | `feat(core): add the health query hook` |
| 17 | `build(tokens): add package build and lint setup` |
| 18 | `feat(tokens): add color, spacing and typography scales` |
| 19 | `feat(tokens): verify wcag 2.2 aa contrast of declared pairs` |
| 20 | `feat(tokens): emit css theme variables for tailwind` |

### Fase 3 — `apps/api`

O passo 22 depende do passo 12. Os passos 21, 23, 24 e 25 são independentes entre si.

| # | Commit |
|---|---|
| 21 | ✅ `feat(api): parse process environment with zod at boot` |
| 22 | ✅ `feat(api): serve the health route from the shared contract` — reimplementado em 6b |
| 23 | `feat(api): deny every route that does not declare itself public` |
| 24 | `feat(api): carry a correlation id through async request context` |
| 25 | `feat(api): translate closed failure codes at the http edge` |
| 26 | `build(api): run postgres locally with a non-owner application role` |
| 27 | `feat(api): scope every database call through a tenant transaction` |
| 28 | `test(api): prove one institution cannot read another institution rows` |
| 29 | `ci(api): pull the postgres image before the workspace checks` |

### Fase 4 — `apps/web`

Depende dos passos 16 e 20.

| # | Commit |
|---|---|
| 30 | `feat(web): scaffold vite react application` |
| 31 | `feat(web): wire design tokens into tailwind theme` |
| 32 | `feat(web): add typed pt-BR i18n and file-based routing` |
| 33 | `feat(web): render system health from typed contract` |
| 34 | `test(web): cover health screen behaviour and accessibility` |

### Fase 5 — `apps/mobile`

Depende dos passos 16 e 20.

| # | Commit |
|---|---|
| 35 | `feat(mobile): scaffold expo router application` |
| 36 | `feat(mobile): add providers, tokens and pt-BR i18n` |
| 37 | `feat(mobile): render system health from typed contract` |
| 38 | `test(mobile): cover health screen behaviour` |

### Fase 6 — Fechamento

| # | Commit |
|---|---|
| 39 | `ci(config): verify expo monorepo health and build every workspace` |
| 40 | `docs(docs): record m0 manual accessibility pass` |
| 41 | `docs(docs): correct the metro monorepo guidance in the implementation plan` |

> As mensagens dos passos 1, 29, 39, 40 e 41 foram corrigidas: o `commitlint.config.js` do
> repositório define `scope-empty: never` e um `scope-enum` fechado, então `chore(repo):`,
> `ci:` e `docs:` sem escopo falham no hook `commit-msg`.

---

## Pronto quando

Cada linha é verificável por comando, não por leitura.

- **Os três apps sobem** e cada um mostra o mesmo `HealthStatus`, inferido do schema do contrato.
- **`pnpm check` verde num checkout limpo**, sem nenhum passo manual de build antes.
- **Import proibido quebra o CI** — e agora também dependência não declarada e nome de
  arquivo fora do `kebab-case`, cada um com sua fixture.
- **Contrato divergindo do `openapi.json`** deixa o CI vermelho.
- **Par de contraste abaixo do AA** deixa o CI vermelho, nos dois temas.
- **Rota que esquece de se declarar pública responde 401**, provado por teste.
- **A instituição A não lê linha da B**, executado como o role não-dono, com quatro
  tentativas deliberadas de burla — inclusive tentar desligar a RLS.

---

## Riscos que ficam abertos

| Risco | Estado | Mitigação |
|---|---|---|
| ~~`@ts-rest` sem release estável~~ | **Fechado em 27/08/2026** | Substituído por oRPC no passo 6b. A troca saiu mais barata que o previsto porque existia uma rota só |
| `@nestjs/core@12` tem dias de vida | Aberto | O spike do passo 6b cobre DI, roteamento, HTTP e teste. Preferir a API estável do Nest e evitar recurso novo do major |
| `@orpc/nest` em `1.15.0` com `2.0.0-beta` no horizonte | Aberto | Trocamos "abandonado há 14 meses" por "em movimento rápido" — melhor, e não grátis. Versão exata fixada; reavaliação marcada no M1 |
| `color-contrast` não roda em jsdom | Coberto em parte | O axe do M0 pega estrutura, papel e nome acessível; contraste vem do teste sobre os tokens. Playwright no M1 |
| VoiceOver nunca passado | Pendente | Sem macOS no ambiente. Prender o item ao critério de aceite do M1 — pendente registrado tem a tendência conhecida de virar permanente |
| Fechamento de dependências sob `hoisted` | Mitigado | Com o Dockerfile fora do M0, o lint é a única prova. Se ele der falso positivo com subpath exports e for relaxado, o buraco reabre em silêncio |
| `tenant_probe` será dropada no M1 | Aceito | Remoção fora da política de duas fases, e tudo bem: nunca esteve num release publicado nem guardou dado. Registrar em *Não publicado* no CHANGELOG |
