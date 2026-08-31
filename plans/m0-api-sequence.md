# M0 — Sequência de execução do restante de `apps/api`

> Índice e decisões: [`m0-overview.md`](m0-overview.md) · Especificação da área:
> [`m0-api.md`](m0-api.md) · Contratos: [`m0-shared-packages.md`](m0-shared-packages.md) ·
> Clientes: [`m0-clients.md`](m0-clients.md) · Regras: [`../CLAUDE.md`](../CLAUDE.md)

Plano de execução acordado em 27/08/2026. Ele substitui a decisão de módulo registrada na
§0 de `m0-api.md` e as decisões de contrato e versão de zod do `m0-overview.md`. As
seções 2 e 3 abaixo são a evidência que sustenta a troca; a seção 5 é a sequência.

---

## 1. Auditoria do estado real

Levantada por inspeção do repositório em 27/08/2026, depois de o worktree ter sido
organizado em seis commits.

### Concluído

| Passo | Prova no repositório |
|---|---|
| 5 — `^build` em `typecheck`, `test` e `dev` | `turbo.json` |
| 6 — scaffold com SWC + Vitest, teste de metadata de DI | `apps/api/.swcrc`, `src/platform/dependency-injection.test.ts` |
| 7 — build, `exports` e lint de `packages/core` | `packages/core/tsup.config.ts` |
| 11 — schema de `health` | `packages/core/src/health/health.schema.ts` |
| 12 — rota `/v1/health` no contrato | `packages/core/src/contract/api-contract.ts` |
| 22 — fatia `health` na API | `apps/api/src/health/` |

Os passos 6, 12 e 22 permanecem entregues **como comportamento**, mas a sua
implementação muda de biblioteca no step S1. O que eles provaram continua válido: o
`decoratorMetadata` sob SWC, o contrato como fonte única, e o teste HTTP ponta a ponta.

### Parcial

- **Passo 2.** `nodenext` entrou em `packages/config/tsconfig/nest.json`, mas
  `FRAMEWORK_BANS` continua `const` local em `packages/config/eslint/api.js`, sem
  `export`. Sem ele, o override local da §11 de `m0-api.md` apagaria o ban de
  `class-validator`. **Bloqueia o passo 27.**
- **Passo 4.** `eslint/react.js` tem um dos três seletores previstos. Faltam
  `JSXText[value=/\S/]` e os dois de elemento interativo. Pertence à fase 4.

### Pendente

- **Passo 1.** `.npmrc` ainda carrega `node-linker`, `engine-strict` e `save-exact`;
  sem `catalog:` nem `overrides:`.
- **Passo 3.** `no-extraneous-dependencies` não existe. Sob `node-linker=hoisted` e com o
  Dockerfile fora do M0, é a única prova de fechamento de dependências.
- **Passos 8 e 10 de `packages/core`.** `assertNever` e o catálogo fechado de falhas não
  existem. **Bloqueiam o passo 25.**

### Achados que os planos não previram

1. **`commitlint` rejeita as mensagens previstas para os passos 1, 29, 39, 40 e 41.**
   `commitlint.config.js` define `scope-empty: [2, 'never']` e `scope-enum` fechado em
   `api, web, mobile, core, tokens, config, deps, release, docs`. `chore(repo):`, `ci:` e
   `docs:` sem escopo falham no hook `commit-msg`.
2. **A §3 de `m0-api.md` descreve `eslint.config.js` e `vitest.config.ts`.** No disco são
   `.mjs` e `.mts`. Depois do S1 os dois voltam a poder ser `.js`/`.ts`, porque o
   workspace inteiro passa a ser ESM.
3. **`nestjs-pino@4.6.1` não suporta Nest 12** — ver seção 4.

---

## 2. Decisão revista: ESM em todo o monorepo

A §0 de `m0-api.md` fixou CommonJS apoiada em dois fatos que envelheceram:
"ESM nativo no Nest só existe em `12.0.0-alpha.7`" e "o `@ts-rest` é a peça central do
D4". O primeiro caiu em 27/08/2026, quando `@nestjs/core@12.0.0` e `12.0.1` foram
publicados. O segundo é o que estava, na prática, prendendo o Nest em 11:

```
@ts-rest/nest   peer @nestjs/core: ^9 || ^10 || ^11
                última publicação: 3.53.0-rc.1 em 2025-06-02  → 14 meses
```

**Decisão:** trocar `@ts-rest` por **oRPC**, adotar **Nest 12**, e padronizar **ESM** em
todos os workspaces. Fundamentos:

| Fato verificado em 27/08/2026 | Consequência |
|---|---|
| `@orpc/nest@1.15.0` tem peer `@nestjs/core: >=11.0.0`; 651 releases, último em 23/08/2026 | Substituto mantido, e compatível com Nest 11 e 12 |
| oRPC valida por **Standard Schema** | Destrava **zod 4**; o pin em `zod@3.25.76` deixa de existir |
| `@orpc/openapi@1.15.0` existe | Cobre o passo 13 sem `@ts-rest/open-api` |
| `@orpc/tanstack-query@1.15.0` tem peer só de `@orpc/client` e `@tanstack/query-core` | Pode permanecer implementação interna de `@habituar/react-client`; `core` não importa React ou TanStack Query |
| `@nestjs/core@12.0.1` é `"type": "module"`, sem condição `require` | Nest 12 é ESM-only. Adotá-lo **é** a migração para ESM |
| `@nestjs/config@12.0.0`, `platform-express@12.0.1`, `testing@12.0.1`, `cli@12.0.0`, `bullmq@12.0.0` | A família primária já está inteira em 12 |

**O que ESM resgata de verdade:** `packages/core` deixa de precisar de build dual — o
`tsup` emite só ESM e o `exports` perde a condição `require`. Some a exceção
`"type": "commonjs"` e somem as extensões `.mjs`/`.mts`. Um formato só no monorepo
inteiro.

**O que ESM não resgata:** o SWC continua obrigatório. O problema do
`emitDecoratorMetadata` é sobre decorators, não sobre formato de módulo — `esbuild`
continua ignorando a opção em silêncio, e o `dependency-injection.test.ts` continua sendo
o alarme que protege isso. Essa complexidade não é recuperável por esta troca.

**Reversibilidade.** Volta para CJS custa `type`, `.swcrc`, extensões e o build dual —
porta de mão dupla, e agora com uma rota só no ar. Voltar para `@ts-rest` deixa de ser
possível a partir do Nest 12: são decisões acopladas de saída, não de retorno.

---

## 3. Evidência: o spike executado

Antes de reescrever este plano, o quadrilátero **Nest 12 + ESM + SWC + Vitest + oRPC**
foi montado num diretório descartável e executado. Resultado integral:

**Instalação.** `@nestjs/*@12.0.1` + `@orpc/*@1.15.0` + `zod@4.1.13` + `@swc/core` +
`unplugin-swc` + `vitest@4.1.11`, sem nenhum peer quebrado.

**Runtime — 3 testes passando:**

- injeção resolvida **só pelo tipo do parâmetro** do construtor, sob ESM: prova que o
  SWC emite `design:paramtypes` com `module.type: es6` e que o container do Nest 12 o lê;
- `GET /v1/health` respondendo `200` com o corpo vindo do provider injetado, por
  requisição HTTP real contra um servidor de verdade;
- `GET /health`, sem o prefixo de versão, respondendo `404`.

**Compilação — as três propriedades da tabela *O que impõe o quê* sobrevivem:**

| Quebra deliberada | Erro de compilação |
|---|---|
| corpo fora do schema (`version: 42`) | `TS2322: Type 'number' is not assignable to type 'string'` |
| valor fora da união (`status: 'degraded'`) | `TS2322: Type '"degraded"' is not assignable to type '"ok"'` |
| contrato implementado pela metade | `TS2345: Property 'getReadiness' is missing` |

A terceira é mais forte do que o arranjo anterior: no `@ts-rest`, contrato incompleto era
pego por `validateResponses` em **runtime**; no oRPC é erro de `tsc`. A linha
*"Contrato implementado por inteiro, retorno dentro do schema"* do `CLAUDE.md` continua
imposta por compilação, e o D4 não é rebaixado a disciplina.

**Forma da API.** `@Implement(contract)` + `implement(contract).router({...})` é
estruturalmente o mesmo desenho de `@TsRestHandler` + `tsRestHandler`. A migração do
controller de `health` é de poucas linhas.

---

## 4. A única baixa real: `nestjs-pino`

```
nestjs-pino@4.6.1   peer @nestjs/common: ^8 || ^9 || ^10 || ^11    ← sem 12
                    última publicação: 2026-03-13
```

Ele estava no overview como decisão adjacente fechada, e é o passo 24.

**Resolução: usar `pino` e `pino-http` diretamente**, sem o wrapper. Três razões, nesta
ordem:

1. O step já cria `platform/request-context.middleware.ts` para o `AsyncLocalStorage`.
   `pino-http` é middleware de Express. É o mesmo ponto de montagem — o wrapper não
   estaria comprando nada que o step não faça de qualquer forma.
2. `CLAUDE.md`, seção *Dependências*: *"Dependência nova precisa comprar complexidade
   material. Funcionalidade pequena, estável e bem delimitada prefere implementação
   local."* Um middleware de log correlacionado é exatamente esse caso.
3. Elimina a segunda dependência do projeto travada em Nest 11, em vez de trocá-la por um
   `override` de peer não testado.

`pino@10.3.1` e `pino-http@11.0.0` não têm acoplamento com Nest. O que se perde é o
`genReqId`/`customProps` prontos — cerca de vinte linhas, escritas onde o correlation id
já vive.

---

## 5. Protocolo de execução

Vale para todos os steps:

1. Implementar o step inteiro, incluindo teste e documentação.
2. Rodar a verificação do step.
3. Apresentar resumo, arquivos tocados e resultado real da verificação.
4. **Parar e pedir aprovação antes do commit.**
5. Só depois do commit aprovado, seguir para o próximo step.

`pnpm check` precisa rodar **fora do sandbox**: `app.listen(0)` recebe `EPERM` aqui.
É limitação do ambiente, não regressão — registrar o resultado real, nunca presumir verde.

Cada step de S4 em diante atualiza, no mesmo commit, a sua linha no `CHANGELOG.md` e a
marcação correspondente em `plans/m0-overview.md`.

---

## 6. Steps

### S0 — Reescrever os planos para a stack nova

- **Objetivo.** Nenhum código é escrito contra um plano que descreve outra stack.
- **Arquivos.** `plans/m0-overview.md` (tabela de decisões: módulo, versão do contrato,
  forma de `packages/core`; tabela de riscos: fechar o risco do `@ts-rest` e abrir o de
  oRPC v2), `plans/m0-api.md` (§0, §1, §2, §4, §5, §10, §11, §14), `plans/m0-shared-packages.md`
  (contrato, `exports`, pin de zod, `@ts-rest/open-api` → `@orpc/openapi`),
  `plans/m0-react-client.md` (OpenAPILink, TanStack Query e estados compartilhados),
  `plans/m0-api-sequence.md`, `CHANGELOG.md`.
- **Pré-requisitos.** Nenhum.
- **Aceite.** Nenhuma afirmação de estado ou de stack nos planos contradiz o repositório
  ou o registry. Os ✅ dos passos 5, 6, 7, 11, 12 e 22 registrados; passo 2 marcado
  parcial.
- **Verificação.** Leitura.
- **Commit.** `docs(docs): adopt esm, nest 12 and orpc across the M0 plans`

### S1 — Troca de plataforma: ESM, Nest 12, oRPC, zod 4

Este step é **atômico de propósito**. Nest 12 é ESM-only e está fora do peer do
`@ts-rest`; separar ESM, Nest e contrato em commits distintos deixaria o repositório
quebrado entre eles. Granularidade falsa não ajuda ninguém a revisar.

- **Objetivo.** Um formato de módulo, um contrato mantido, zod 4.
- **Passos globais.** Reimplementa 6, 12 e 22 sobre a stack nova.
- **Arquivos.**
  - `packages/core`: `contract/api-contract.ts` e `health/health.contract.ts` para `oc`;
    `health.schema.ts` para zod 4; `tsup.config.ts` (só `esm`); `package.json`
    (`exports` sem `require`, `@orpc/contract`, `zod@4`); testes.
  - `apps/api`: `package.json` (`"type": "module"`, `@nestjs/*@12`, `@orpc/nest`),
    `.swcrc` (`module.type: es6`), `nest-cli.json`, `tsconfig*.json`,
    `vitest.config.mts` → `.ts`, `eslint.config.mjs` → `.js`, `app.module.ts`
    (`ORPCModule.forRoot`), `health/health.controller.ts` (`@Implement`).
  - `packages/config/tsconfig/nest.json`: comentários da decisão de módulo.
  - `pnpm-lock.yaml`.
- **Pré-requisitos.** S0.
- **Aceite.** Os três testes existentes continuam passando com o mesmo significado:
  metadata de DI sob ESM, `GET /v1/health` = 200 pelo contrato, `GET /health` = 404.
  As três quebras deliberadas da seção 3 continuam sendo erro de `tsc` — verificar uma a
  uma, não presumir. Nenhum `require` sobra no monorepo.
- **Verificação.** `pnpm check` fora do sandbox.
- **Documentação.** `CHANGELOG.md`; marcações dos passos 6, 12 e 22 revisadas.
- **Commit.** `feat(api): move the stack to esm, nest 12 and orpc`

### S2 — Exportar os bans de framework

- **Objetivo.** Permitir que `apps/api` estenda `no-restricted-imports` sem apagar o ban
  de `class-validator`.
- **Passos globais.** Resto do passo 2.
- **Arquivos.** `packages/config/eslint/api.js`.
- **Aceite.** Fixture que importa `class-validator` continua sendo erro com o override
  local ativo.
- **Verificação.** `pnpm --filter @habituar/config test`, `pnpm lint`.
- **Commit.** `build(config): export the framework import bans`

### S3 — Proibir dependência não declarada

- **Objetivo.** Restabelecer a prova de fechamento perdida com `node-linker=hoisted`,
  antes que as dependências dos steps seguintes entrem sem gate.
- **Passos globais.** Passo 3.
- **Arquivos.** `packages/config/eslint/base.js`, `boundaries.test.ts`, fixture nova.
- **Aceite.** Import de pacote ausente do `package.json` do próprio workspace falha o
  lint; os workspaces atuais seguem verdes. Vigiar falso positivo com subpath exports —
  relaxar a regra por causa dele reabriria o buraco em silêncio.
- **Verificação.** `pnpm check`.
- **Commit.** `feat(config): forbid undeclared dependencies in every workspace`

### S4 — Ambiente parseado por zod no boot

- **Objetivo.** Configuração validada uma vez, na borda; falta derruba o processo antes
  de aceitar tráfego.
- **Passos globais.** Passo 21.
- **Arquivos.** `apps/api/src/environment/` + teste, `app.module.ts`,
  `health.controller.ts`, `package.json` (`@nestjs/config@12.0.0`), `.env.example`.
- **Aceite.** Recusa subir sem `DATABASE_URL`; recusa `PORT` não numérico; `/v1/health`
  devolve `APP_VERSION`. `DATABASE_MIGRATION_URL` fica **fora** do schema, para que o
  processo da aplicação não tenha como abrir conexão com o role dono. Em zod 4, preferir
  `z.url()` a `z.string().url()` — as duas existem, a segunda está a caminho da
  obsolescência.
- **Verificação.** `pnpm --filter @habituar/api test`.
- **Commit.** `feat(api): parse process environment with zod at boot`

### S5 — Negar por padrão

- **Objetivo.** Rota que esquece de se declarar pública falha fechada.
- **Passos globais.** Passo 23.
- **Arquivos.** `apps/api/src/authorization/`, `app.module.ts` (`APP_GUARD`),
  `health.controller.ts` (`@PublicRoute()`).
- **Aceite.** Rota de teste sem o marcador responde 401; `/v1/health` continua 200.
  O teste tenta burlar de propósito. Lista de públicas no M0: só `/v1/health`.
- **Verificação.** `pnpm --filter @habituar/api test`.
- **Commit.** `feat(api): deny every route that does not declare itself public`

### S6 — Correlation id e log correlacionado

- **Objetivo.** Um ponto único de correlação entre resposta e log.
- **Passos globais.** Passo 24, com a substituição da seção 4.
- **Arquivos.** `apps/api/src/platform/` (`request-context.ts` com `AsyncLocalStorage`,
  `request-context.middleware.ts`, `id-generator.ts`, `platform.module.ts`),
  `package.json` (`pino@10.3.1`, `pino-http@11.0.0` — **sem `nestjs-pino`**).
- **Aceite.** Aplicado como **middleware**, nunca interceptor — o `Observable` de um
  interceptor é subscrito fora do `storage.run()` e o contexto some. `CryptoIdGenerator`
  é classe concreta injetada, sem token nem interface. Toda linha de log carrega o
  `correlationId` da requisição em curso.
- **Verificação.** `pnpm --filter @habituar/api test`.
- **Commit.** `feat(api): carry a correlation id through async request context`

### S7 — `assertNever` em `core`

- **Passos globais.** Passo 8. Pré-requisito explícito do passo 25.
- **Arquivos.** `packages/core/src/type/assert-never.ts` + teste, `package.json`
  (`exports`), `tsup.config.ts` — entrada nova nos dois lugares, porque a lista de
  `exports` é a declaração de entrypoint público e não existe barrel.
- **Verificação.** `pnpm --filter @habituar/core test` e `build`.
- **Commit.** `feat(core): add assertNever for closed unions`

### S8 — Catálogo fechado de falhas em `core`

- **Passos globais.** Passo 10.
- **Arquivos.** `packages/core/src/contract/failure.ts` + teste, `api-contract.ts`,
  `package.json`, `tsup.config.ts`.
- **Pré-requisitos.** S7.
- **Aceite.** Código fora do catálogo é erro de compilação. Avaliar declarar o catálogo
  no `errors` do contrato oRPC, que dá tipagem de erro ponta a ponta — se couber sem
  duplicar a definição, é ganho sobre o arranjo anterior; se duplicar, fica de fora.
- **Verificação.** `pnpm --filter @habituar/core test`, `build`, `pnpm check`.
- **Commit.** `feat(core): add closed catalog of failure codes`

### S9 — Tradução de falha na borda HTTP

- **Passos globais.** Passo 25.
- **Arquivos.** `apps/api/src/errors/` (`failure-to-http.ts` + teste,
  `unhandled-exception.filter.ts`), `app.module.ts` (`APP_FILTER`).
- **Pré-requisitos.** S6, S7, S8.
- **Aceite.** Cada código vira um status distinto; o `switch` termina em `assertNever`,
  então código novo quebra o build aqui. O filtro devolve
  `{ code: 'internal_error', correlationId }` e **nunca** a mensagem da exceção.
- **Verificação.** `pnpm --filter @habituar/api test`.
- **Commit.** `feat(api): translate closed failure codes at the http edge`

### S10 — Postgres local com role não-dono

- **Passos globais.** Passo 26.
- **Arquivos.** `docker-compose.yml`, `db/bootstrap.sql`, `drizzle.config.ts`,
  `.env.example`, `package.json` (`drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`).
- **Pré-requisitos.** S4.
- **Aceite.** `postgres:18-alpine` na porta 5433 com healthcheck; `bootstrap.sql` cria os
  dois roles e os default privileges. Criação de role não é migração e não roda pelo role
  não-dono.
- **Commit.** `build(api): run postgres locally with a non-owner application role`

### S11 — `withTenant()` como único caminho até o banco

- **Objetivo.** A fronteira precisa existir **antes** da primeira query, senão a primeira
  query será escrita sem ela.
- **Passos globais.** Passo 27.
- **Arquivos.** `apps/api/src/database/`, `db/migrations/0000_tenant_probe.sql`,
  `apps/api/eslint.config.js` (ban local do ORM).
- **Pré-requisitos.** S2 e S10.
- **Aceite.** `src/database/` é o único diretório que importa `drizzle-orm`/`pg`, imposto
  por lint com fixture; a migração traz `enable` **e** `force row level security` mais a
  política com `nullif(current_setting(...), '')`; `set_config` com escopo de transação,
  para que a conexão devolvida ao pool não carregue contexto adiante.
- **Dívida a registrar no commit.** `TenantContext` é de strings cruas no M0; os branded
  types nascem em `packages/core` no M1.
- **Commit.** `feat(api): scope every database call through a tenant transaction`

### S12 — Prova de isolamento entre instituições

- **Objetivo.** Padrão de segurança entregue sem o teste que o prova é crença.
- **Passos globais.** Passo 28.
- **Arquivos.** `src/database/testcontainers.setup.ts`, `tenant-isolation.test.ts`,
  `vitest.config.ts`, `package.json` (`testcontainers`, `@testcontainers/postgresql`).
- **Pré-requisitos.** S11.
- **Aceite.** As seis asserções: leitura escopada; burla por `where true or`; query fora
  de `withTenant()` devolvendo zero linhas; `insert` cruzado barrado por `with check`;
  `current_user` diferente do dono; e `alter table ... disable row level security`
  respondendo *permission denied*. A última impede a regressão mais provável — apontar a
  aplicação para a URL do dono e a RLS parar de valer sem nada quebrar.
- **Verificação.** Fora do sandbox, com Docker ativo.
- **Commit.** `test(api): prove one institution cannot read another institution rows`

### S13 — Banco no CI

- **Passos globais.** Passo 29.
- **Arquivos.** `.github/workflows/ci.yml`.
- **Aceite.** `docker pull postgres:18-alpine` depois de *Install dependencies*;
  `TESTCONTAINERS_RYUK_DISABLED: "true"` nos dois steps de checagem, porque o runner é
  efêmero e o Ryuk só acrescenta um container e uma fonte de flakiness.
- **Commit.** `ci(api): pull the postgres image before the workspace checks`

---

## 7. Efeitos fora de `apps/api`

Consequências desta troca que pertencem a outras fases, registradas aqui para não se
perderem:

- **Passo 13** (`openapi.json`) passa a usar `@orpc/openapi` em vez de `@ts-rest/open-api`.
- **Passo 14** (client tipado) passa a usar `@orpc/client`.
- **Passo 16** (hook de `health`) pode usar `@orpc/tanstack-query`, que **não tem peer de
  React** — a razão que reprovou o `@ts-rest/react-query` desapareceu. Reavaliar contra a
  regra *"componente é burro, hook é esperto"*: se o hook gerado não devolver a união
  discriminada do `toQueryState`, escrever à mão continua sendo o certo.
- **Pin de zod.** `zod@3.25.76` deixa de ser necessário no repositório inteiro. A
  migração para zod 4 acontece dentro do S1 para `packages/core`; `apps/web` e
  `apps/mobile` já nascem em zod 4.

## 8. Riscos novos que esta decisão abre

| Risco | Estado | Mitigação |
|---|---|---|
| `@nestjs/core@12` tem um dia de vida e já levou um patch em 26 minutos | Aberto | O spike cobre DI, roteamento, HTTP e teste. O que ele não cobre é o que ainda não existe no M0. Preferir a API estável do Nest e evitar recurso novo do major |
| `@orpc/nest` está em `2.0.0-beta.31` enquanto adotamos a 1.15.0 | Aberto | Migração de major no horizonte. Trocamos "abandonado há 14 meses" por "em movimento rápido" — melhor, e não grátis. Fixar versão exata e marcar reavaliação no M1 |
| `@orpc/nest@1.15.0` foi publicado antes de o Nest 12 existir | Mitigado | O peer `>=11.0.0` é intervalo aberto, não teste. O spike executado na seção 3 é o teste |
| Log correlacionado passa a ser código local | Aceito | Cerca de vinte linhas no middleware que o step cria de qualquer forma. Coberto por teste no S6 |

## 9. Fora deste plano

- **Passos 1 e 4** da fase 0 seguem pendentes; nenhum bloqueia a API.
- **Passos 9, 13 a 20** de `core` e `design-tokens` seguem a sequência do overview.
- Dockerfile, Playwright e o build EAS continuam fora do M0.
