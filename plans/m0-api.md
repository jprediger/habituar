# M0 — `apps/api`

> Índice e decisões compartilhadas: [`m0-overview.md`](m0-overview.md)

Escopo: só encanamento. Nenhum CRUD, nenhuma regra de negócio, nenhuma tabela de domínio.
Guard, contexto de requisição, filtro de erro e `withTenant()` entram como **padrão vazio**
que o M1 preenche.

---

## 0. Decisão de módulo: CommonJS

**Fato do repositório:** `packages/config/tsconfig/nest.json` já fixou `module: commonjs`,
`useDefineForClassFields: false`, `verbatimModuleSyntax: false` e decorators legados. A
decisão já estava tomada ali; o `"type": "module"` no stub de `apps/api/package.json` a
**contradiz** — com ele, o `dist/*.js` emitido como CJS é lido pelo Node como ESM e o
processo morre em `exports is not defined`.

**Fatos externos, verificados em 26/08/2026:**

| Fato | Consequência |
|---|---|
| `@nestjs/core` estável = **11.2.3**; ESM nativo só em `12.0.0-alpha.7` | ESM em Nest hoje é alpha. Fora |
| esbuild — e portanto `tsx` e o transform padrão do Vitest — **não implementa** `emitDecoratorMetadata` | Runner baseado em esbuild quebra o DI do Nest. Fora |
| SWC implementa `legacyDecorator` + `decoratorMetadata` | SWC é o transformador para build, dev e teste |
| Node fixado em 22.23.2; `require(esm)` é default desde 22.12 | CJS consegue consumir `@habituar/core` |

**Resolução concreta:**

1. `apps/api/package.json` → `"type": "commonjs"` explícito, não ausente — o campo é
   resolvido pelo `package.json` mais próximo, então a raiz ESM não contamina.
2. Transformador único: **SWC** (`.swcrc` com `module.type: "commonjs"`), usado por
   `nest build -b swc`, `nest start -b swc --watch` e `unplugin-swc` no Vitest.
   Um transformador só significa uma semântica só de decorator.
3. `tsc` **não compila**, só verifica: `typecheck` = `tsc --noEmit`. O build por SWC é
   seguro justamente porque esse portão existe separado.
4. `packages/config/tsconfig/nest.json` → `module` e `moduleResolution` para **`nodenext`**.
   `node` (node10) ignora o campo `exports`, e como barrel é proibido em `packages/*`,
   `@habituar/core` só é consumível por subpath.

**`nodenext` e não `node16`.** Os dois resolvem o campo `exports`, que é o problema real.
A diferença: desde o TS 5.8, `nodenext` permite `import` de pacote ESM-only a partir de
arquivo CJS, apoiado no `require(esm)` do Node ≥22.12; `node16` recusa com TS1479.

Essa recusa seria uma trava útil — se `core` perdesse a condição `require`, quebraria em
compilação em vez de falhar em runtime. Mas `core` ser dual já é requisito estrutural, no
`tsup.config.ts`, e o cenário contra o qual `node16` protege só falha de verdade se
alguém introduzir top-level await. Divergir do padrão do ecossistema para blindar um caso
já tornado improvável cobra depois. `nodenext` é o que o próprio template do Nest gera e
é verdade sobre o Node 22.23.2 que o `.nvmrc` fixa.

Sob `nodenext` o formato emitido continua decidido pelo `"type"` do `package.json` mais
próximo — a decisão CJS fica intacta. E quem emite é o SWC; o `tsc` aqui só verifica.

**Reversibilidade:** trocar CJS→ESM depois custa `.swcrc`, `type` e eventuais `__dirname`.
É porta de mão dupla; ficar preso em NestJS 12-alpha não é.

---

## 1. Premissas sobre `packages/core`

| # | Premissa |
|---|---|
| P1 | O contrato é exportado por subpath: `@habituar/core/contract` |
| P2 | O prefixo de versão vive no contrato (`pathPrefix: '/v1'`), **não** em `setGlobalPrefix` |
| P3 | `core` é buildado e publica **dual ESM+CJS**, com condição `require`. Sob `nodenext` um `core` ESM-only ainda resolveria via `require(esm)` do Node 22, então quem garante a saída CJS é o `tsup.config.ts` de `core`, não o compilador da API |
| P4 | `.ts` cru em `core` não serve: o SWC compila arquivo a arquivo e nunca atravessa a fronteira do workspace. A API consome `dist/` + `.d.ts`, e o `^build` no `turbo.json` garante que existam |
| P5 | `zod` fixado em `3.25.76` no repositório inteiro |
| P6 | `assertNever` e o union `FailureCode` moram em `@habituar/core` |
| P7 | A resposta de `/v1/health` é `{ status: 'ok', version }` — sem timestamp, e portanto sem a porta `Clock` no M0 |

---

## 2. Bloqueio verificado: zod 3, não zod 4

`@ts-rest/core@3.52.1` declara `peerDependencies: { zod: '^3.22.3' }`. O suporte a zod 4
chega via Standard Schema em `3.53.0`, que hoje só existe como `3.53.0-rc.1` — e o issue
ts-rest#852 documenta que os tipos do RC ainda referenciam `z.AnyZodObject` e
`z.objectUtil`, removidos no zod 4: **quebra em compilação**, não é só peer warning.

**Consequência:** `nestjs-zod` seria compatível, mas **não entra no M0**. A validação de
borda já é feita pelo próprio `@ts-rest/nest`, que parseia request e response contra o
schema do contrato. Um segundo pipe de zod agora é abstração para caso hipotético; entra
quando existir entrada fora do contrato.

---

## 3. Estrutura de diretórios

```
apps/api/
├── package.json              # "type": "commonjs"
├── tsconfig.json             # extends @habituar/config/tsconfig/nest.json
├── tsconfig.build.json       # exclude: **/*.test.ts
├── .swcrc
├── nest-cli.json             # { "compilerOptions": { "builder": "swc", "typeCheck": false } }
├── eslint.config.js
├── vitest.config.ts
├── drizzle.config.ts
├── docker-compose.yml
├── .env.example
├── db/
│   ├── bootstrap.sql         # CREATE ROLE não-dono — roda como superuser
│   └── migrations/           # saída do drizzle-kit
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── environment/
    │   ├── environment.schema.ts
    │   └── environment.schema.test.ts
    ├── platform/                       # portas de infra, não camada de domínio
    │   ├── platform.module.ts
    │   ├── id-generator.ts             # classe concreta CryptoIdGenerator
    │   ├── request-context.ts          # AsyncLocalStorage
    │   └── request-context.middleware.ts
    ├── database/                       # ÚNICO diretório que importa drizzle-orm / pg
    │   ├── database.module.ts
    │   ├── database.ts                 # Pool + withTenant()
    │   ├── schema.ts
    │   ├── testcontainers.setup.ts
    │   └── tenant-isolation.test.ts
    ├── authorization/
    │   ├── authorization.module.ts
    │   ├── public-route.decorator.ts
    │   ├── authentication.guard.ts
    │   └── authentication.guard.test.ts
    ├── errors/
    │   ├── failure-to-http.ts          # mapeamento exaustivo, borda
    │   ├── failure-to-http.test.ts
    │   └── unhandled-exception.filter.ts
    └── health/
        ├── health.module.ts
        ├── health.controller.ts
        └── health.test.ts
```

Nenhum `services/`, `controllers/` ou `repositories/`. `platform/`, `database/`,
`authorization/` e `errors/` são **fatias de borda** — cada uma com responsabilidade única
e um dono —, não camadas horizontais agrupando por tipo técnico.

---

## 4. Dependências

Versões exatas; `save-exact=true` já está ativo.

```jsonc
"dependencies": {
  "@habituar/core": "workspace:*",
  "@nestjs/common": "11.2.3",
  "@nestjs/core": "11.2.3",
  "@nestjs/config": "4.0.4",
  "@nestjs/platform-express": "11.2.3",
  "@ts-rest/core": "3.52.1",
  "@ts-rest/nest": "3.52.1",
  "drizzle-orm": "0.45.2",
  "nestjs-pino": "4.6.1",
  "pg": "8.23.0",
  "pino": "10.3.1",
  "pino-http": "11.0.0",
  "reflect-metadata": "0.2.2",
  "rxjs": "7.8.2",
  "zod": "3.25.76"
},
"devDependencies": {
  "@habituar/config": "workspace:*",
  "@nestjs/cli": "11.0.24",
  "@nestjs/testing": "11.2.3",
  "@swc/cli": "0.8.1",
  "@swc/core": "1.16.1",
  "@testcontainers/postgresql": "12.1.0",
  "@types/node": "22.20.1",
  "@types/pg": "8.23.1",
  "@types/supertest": "7.2.1",
  "drizzle-kit": "0.31.10",
  "eslint": "10.9.1",
  "supertest": "7.2.2",
  "testcontainers": "12.1.0",
  "typescript": "catalog:",
  "unplugin-swc": "1.5.11",
  "vitest": "4.1.11"
}
```

`typescript` sai do `catalog:` de propósito: o `latest` do npm hoje é 7.x, mas o repo está
em 5.9.3, e versão de TS divergente entre workspaces quebra o `projectService` do
typescript-eslint. Migração de TS é PR próprio, de escopo `deps`.

**Scripts:**

```jsonc
"dev":       "nest start --watch -b swc",
"build":     "nest build -b swc",
"lint":      "eslint .",
"typecheck": "tsc --noEmit",
"test":      "vitest run",
"db:generate": "drizzle-kit generate",
"db:migrate":  "drizzle-kit migrate",
"db:up":       "docker compose up -d --wait"
```

---

## 5. `GET /v1/health` via `@ts-rest/nest`

**Estado:** walking skeleton entregue no passo 22. Enquanto o passo 21 não introduz a
configuração de ambiente, a rota devolve a versão constante `0.0.0`; o passo 23 ainda
adicionará `@PublicRoute()`. O contrato, o roteamento versionado, a validação da resposta
e o teste HTTP ponta a ponta já estão ativos.

```ts
// src/health/health.controller.ts
@Controller()
export class HealthController {
  constructor(private readonly configService: ConfigService<Environment, true>) {}

  @PublicRoute()
  @TsRestHandler(apiContract.health)
  async handleHealthCheck() {
    return tsRestHandler(apiContract.health, async () => ({
      status: 200,
      body: { status: 'ok', version: this.configService.get('APP_VERSION', { infer: true }) },
    }))
  }
}
```

- **Verificação em compilação:** o tipo de retorno de `tsRestHandler` é derivado do
  `responses` do contrato — status fora da união ou body fora do schema é erro de `tsc`.
- **Verificação em runtime:** `TsRestModule.register({ validateResponses: true })` no
  `AppModule`. Resposta fora do schema vira 500, não resposta errada em produção.
- `/health` **não toca o banco** no M0. É liveness, não readiness — readiness com
  `SELECT 1` entra quando houver o que ficar não-pronto.
- Sem `class-validator`, sem `@nestjs/swagger`. O `openapi.json` é gerado em
  `packages/core`, a partir do contrato.

---

## 6. Configuração de ambiente tipada por zod

```ts
// src/environment/environment.schema.ts
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_VERSION: z.string().min(1),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})
export type Environment = z.infer<typeof environmentSchema>
```

Ligado por `ConfigModule.forRoot({ isGlobal: true, validate: (raw) => environmentSchema.parse(raw) })`
e injetado como `ConfigService<Environment, true>` — `get('DATABASE_URL', { infer: true })`
sai tipado, sem token de injeção próprio e sem tipo escrito à mão. *Parse, don't validate*:
acontece uma vez, no boot; falha derruba o processo antes de aceitar tráfego.

**`DATABASE_MIGRATION_URL` fica FORA deste schema, de propósito.** Ele é lido apenas por
`drizzle.config.ts`. Assim o processo da aplicação **não tem como** abrir conexão com o
role dono — nem por engano, nem por job.

Testes: *"recusa subir sem DATABASE_URL"*, *"recusa PORT não numérico"*.

---

## 7. Banco: porta única e `withTenant()`

`src/database/` é o único diretório autorizado a importar `drizzle-orm` e `pg`, imposto
por `no-restricted-imports` no `eslint.config.js` local (§11).

```ts
@Injectable()
export class Database {
  /**
   * Única porta de entrada do banco. O terceiro argumento `true` de set_config é o
   * escopo de transação: conexão devolvida ao pool não carrega o contexto adiante.
   */
  async withTenant<T>(
    context: TenantContext,
    run: (tx: NodePgTransaction<typeof schema, never>) => Promise<T>,
  ): Promise<T> {
    return this.connection.transaction(async (tx) => {
      await tx.execute(sql`
        select set_config('app.institution_id', ${context.institutionId}, true),
               set_config('app.actor_id',       ${context.actorId},       true),
               set_config('app.session_id',     ${context.sessionId},     true)
      `)
      return run(tx)
    })
  }
}
```

`TenantContext` no M0 é de strings cruas — os branded types `InstitutionId`, `ActorId` e
`SessionId` nascem em `packages/core` no M1. **Anotar como dívida explícita no PR.**

**Por que `withTenant()` entra no M0 mesmo sem domínio:** ele não é código de suporte de
uma feature, ele *é* a fronteira. Se a primeira query do M1 for escrita antes de ele
existir, ela será escrita sem ele — e a partir daí `withTenant()` vira refatoração de call
sites em vez de o único caminho que sempre existiu. Custa ~30 linhas agora e é insalvável
depois. Além disso é ele que o teste de isolamento exercita.

---

## 8. Primeira migração — o mínimo que prova o D8

Duas camadas, porque só uma delas é migração.

**(a) `db/bootstrap.sql` — roda como superuser, fora do drizzle.**
Criação de role não é migração de schema e não pode ser executada pelo role não-dono.

```sql
create role habituar_owner login password :'owner_password';
create role habituar_app   login password :'app_password';

revoke all on schema public from public;
grant usage on schema public to habituar_app, habituar_owner;
grant create on schema public to habituar_owner;

-- Toda tabela futura criada pelo dono já nasce acessível ao role da aplicação,
-- sem GRANT esquecido em migração.
alter default privileges for role habituar_owner in schema public
  grant select, insert, update, delete on tables to habituar_app;
```

Montado em `/docker-entrypoint-initdb.d/`; nos testes, executado pelo `globalSetup` logo
após subir o container.

**(b) `0000_tenant_probe.sql` — gerado pelo drizzle-kit a partir de `schema.ts`, com o
bloco de RLS acrescentado à mão** (drizzle-kit não gera política).

```sql
create table tenant_probe (
  id             uuid        primary key default gen_random_uuid(),
  institution_id uuid        not null,
  note           text        not null,
  created_at     timestamptz not null default now()
);

alter table tenant_probe enable row level security;
alter table tenant_probe force  row level security;  -- sem FORCE, o dono ignora tudo

create policy tenant_probe_isolation on tenant_probe
  using      (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
  with check (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid);
```

`nullif(..., '')` importa: com a GUC ausente, `current_setting(..., true)` devolve `NULL`,
o predicado vira `NULL` e o resultado é zero linhas. Com a GUC vazia, `''::uuid`
**lançaria erro**. Falha fechada nos dois casos.

**Entra no M0:** a tabela-sonda, `ENABLE` + `FORCE`, a política, o role não-dono, os
default privileges.
**Fica para o M1:** `institutions`, `users`, `sessions`, `memberships`, os triggers de
auditoria (D11), a tabela particionada de leitura sensível.

**`tenant_probe` é infra, não domínio.** A primeira migração do M1 a dropa. Isso não viola
a política de remoção em duas fases: ela nunca existiu num release publicado nem guardou
dado. Registrar a intenção no `CHANGELOG.md`, em *Não publicado*.

---

## 9. Postgres local e nos testes

**`docker-compose.yml`** — `postgres:18-alpine`, volume nomeado, `db/bootstrap.sql` montado
em `/docker-entrypoint-initdb.d/`, `healthcheck` com `pg_isready`, porta `5433:5432` para
não colidir com um Postgres de sistema. `.env.example` traz as duas URLs
(`DATABASE_URL` = `habituar_app`, `DATABASE_MIGRATION_URL` = `habituar_owner`).

**`vitest.config.ts`:**

```ts
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],  // decoratorMetadata herdado do tsconfig
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/database/testcontainers.setup.ts'],
    pool: 'forks',            // Nest + pg não gostam de threads compartilhando handles
    hookTimeout: 120_000,     // primeiro pull da imagem
  },
})
```

O `globalSetup` sobe **um** `PostgreSqlContainer` para a suíte inteira, aplica
`bootstrap.sql` como superuser, roda `drizzle-kit migrate` com a URL do dono e exporta as
duas URLs. Testes que não precisam de banco não pagam nada além do setup único.

**CI:** um step `docker pull postgres:18-alpine` depois de `Install dependencies`, e
`TESTCONTAINERS_RYUK_DISABLED: "true"` nos dois steps de checagem. Ryuk existe para limpar
containers órfãos; o runner é efêmero, então ele só adiciona um container e uma fonte de
flakiness. `ubuntu-latest` já traz o daemon Docker — nenhum `services:` é necessário. Com
`check:affected`, a suíte de banco só roda em PR que toca `apps/api`.

---

## 10. Negar por padrão, contexto e erros — os três padrões vazios

**Guard global.**

```ts
export const IS_PUBLIC_ROUTE = 'habituar:is-public-route'
export const PublicRoute = () => SetMetadata(IS_PUBLIC_ROUTE, true)

@Injectable()
export class AuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(), context.getClass(),
    ])
    if (isPublic === true) return true
    // M0: não existe sessão ainda. Negar é o comportamento correto, não um placeholder.
    throw new UnauthorizedException()
  }
}
```

Registrado como `{ provide: APP_GUARD, useClass: AuthenticationGuard }`. `PublicRoute` é
marcador de roteamento, não regra de negócio escondida em metadata — que é exatamente o
que o D9 pede. **Lista de públicas no M0: `/v1/health`, e só.**

**Contexto de requisição.** `AsyncLocalStorage`, nunca provider com escopo de requisição
(cascata de escopo é anti-padrão banido). Aplicado como **middleware, não interceptor** —
o `Observable` de um interceptor é subscrito fora do `storage.run()` e o contexto some.

`RequestContext` no M0 é `{ readonly correlationId: string }`; o M1 acrescenta ator e
sessão. O id vem de `CryptoIdGenerator` (`crypto.randomUUID()`), **classe concreta
injetada** — não porta com token e interface, porque a implementação é única.

Log: `nestjs-pino` com `genReqId` lendo o `correlationId` do ALS e `customProps` o
injetando em toda linha. Um ponto único de correlação.

**Erros na borda.** Repare que **não existe filtro para falha de domínio** — falha
esperada é retorno tipado, não exceção. O que existe é:

```ts
// errors/failure-to-http.ts — a borda, e só ela, traduz
export function mapFailureToHttpResponse(failure: Failure) {
  switch (failure.code) {
    case 'not_found':       return { status: 404, body: { code: failure.code } }
    case 'forbidden':       return { status: 403, body: { code: failure.code } }
    case 'unauthenticated': return { status: 401, body: { code: failure.code } }
    case 'conflict':        return { status: 409, body: { code: failure.code } }
    case 'invalid_input':   return { status: 422, body: { code: failure.code } }
    default:                return assertNever(failure.code)
  }
}
```

Código novo na união quebra o build aqui — que é o ponto inteiro.

`errors/unhandled-exception.filter.ts` (`@Catch()`, `APP_FILTER`) registra a exceção com o
`correlationId` e devolve `{ code: 'internal_error', correlationId }`. **Nunca** a
mensagem — erro não carrega dado sensível. O `correlationId` liga a resposta ao log sem
vazar nada.

---

## 11. Lint local

`packages/config/eslint/api.js` já cobre `class-validator`, `forwardRef`, herança de
provider e `consistent-type-imports: no-type-imports`. Falta o ban de import do ORM fora
de `src/database/`:

```js
import apiConfig, { FRAMEWORK_BANS } from '@habituar/config/eslint/api'

const ORM_BAN = [{
  group: ['drizzle-orm', 'drizzle-orm/*', 'pg', 'pg-pool'],
  message: 'Um único caminho até o banco: só src/database/ importa o client do ORM.',
}]

export default tseslint.config(
  ...apiConfig,
  { files: ['src/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: [...FRAMEWORK_BANS, ...ORM_BAN] }] } },
  { files: ['src/database/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: FRAMEWORK_BANS }] } },
)
```

Exige exportar `FRAMEWORK_BANS` de `packages/config/eslint/api.js` — senão o override
local apagaria o ban de `class-validator`. Vai no commit da fase 0.

---

## 12. Testes do M0

| Teste | O que afirma | Precisa de banco |
|---|---|---|
| `health.test.ts` | *"responde ok em GET /v1/health"* — app Nest real numa porta efêmera + `fetch`, ponta a ponta pelo contrato; `/health` sem versão responde 404 | não |
| `authentication.guard.test.ts` | *"recusa rota que não se declarou pública"* — rota de teste sem `@PublicRoute()` → 401 | não |
| `failure-to-http.test.ts` | *"traduz cada código de falha em um status distinto"* | não |
| `environment.schema.test.ts` | *"recusa subir sem DATABASE_URL"* | não |
| `tenant-isolation.test.ts` | ver abaixo | **sim** |

**O teste de RLS entra no M0**, não no M1 como diz o `implementation-plan.md`. O M0 já
entrega o role não-dono, o `FORCE` e o `withTenant()` — e padrão de segurança entregue sem
o teste que o prova é crença, não garantia. É a mesma lógica que já justificou o
`forbidden-imports.test.ts`. Ele também é a única coisa que prova que docker,
testcontainers e migração funcionam no CI; adiar isso empurra risco de infra para dentro
do marco mais crítico do projeto.

Escrito no espírito de tentar burlar de propósito, sobre `tenant_probe`:

1. como **dono**, insere 2 linhas para a instituição A e 2 para a B;
2. como **role da aplicação**, dentro de `withTenant(A)`, `select * from tenant_probe`
   devolve **só** as 2 de A;
3. burla 1 — `select … where true or institution_id = B` dentro de `withTenant(A)` →
   ainda 2 linhas;
4. burla 2 — query **fora** de `withTenant()`, com a GUC ausente → **0 linhas**;
5. burla 3 — `insert` com `institution_id = B` dentro de `withTenant(A)` → erro de
   `with check`;
6. burla 4 — `select current_user` ≠ dono da tabela, e
   `alter table tenant_probe disable row level security` → *permission denied*.

O item 6 impede a regressão silenciosa mais provável: alguém apontar a aplicação para a
URL do dono e a RLS parar de valer sem nada quebrar.

---

## 13. Fora do M0

**Dockerfile com `turbo prune`.** Fica para quando houver deploy. O argumento que o
puxaria para cá era provar que `apps/api` declara suas dependências sob
`nodeLinker: hoisted` — e o `no-extraneous-dependencies` da fase 0 prova isso mais barato
e no gate que já existe. **Risco a vigiar:** se aquele lint for relaxado por falso
positivo com subpath exports, esta prova some junto.

**`openapi.json`** é gerado e commitado em `packages/core`, não aqui.

---

## 14. Ordem de execução

Numeração global — ver [`m0-overview.md`](m0-overview.md).

| # | Commit | Entrega | Risco que aposenta |
|---|---|---|---|
| 6 | `build(api): scaffold nest app on commonjs with swc toolchain` | manifests, `.swcrc`, `nest-cli.json`, `vitest.config.ts`, `main.ts`, `app.module.ts`, **um provider injetado trivial + teste provando que a metadata de DI sobrevive ao SWC dentro do Vitest** | **o triângulo CJS × SWC × Vitest** — o maior risco do marco |
| 21 | `feat(api): parse process environment with zod at boot` | `environment/` + `ConfigModule` + testes | — |
| 22 | `feat(api): serve the health route from the shared ts-rest contract` | `health/`, `validateResponses: true`, teste ponta a ponta | depende do passo 12 |
| 23 | `feat(api): deny every route that does not declare itself public` | `authorization/`, `APP_GUARD`, teste do 401 | — |
| 24 | `feat(api): carry a correlation id through async request context` | `platform/` + `nestjs-pino` | — |
| 25 | `feat(api): translate closed failure codes at the http edge` | `errors/` + `APP_FILTER` + teste exaustivo | — |
| 26 | `build(api): run postgres locally with a non-owner application role` | `docker-compose.yml`, `db/bootstrap.sql`, `drizzle.config.ts`, `.env.example` | — |
| 27 | `feat(api): scope every database call through a tenant transaction` | `database/`, migração `0000`, ban de import do ORM | — |
| 28 | `test(api): prove one institution cannot read another institution rows` | `testcontainers.setup.ts` + as 6 asserções | infra de teste com banco |
| 29 | `ci: pull the postgres image before the workspace checks` | `.github/workflows/ci.yml` | banco no CI |

Os passos 21, 23, 24 e 25 são independentes entre si e podem ser reordenados. **O passo 6
não pode ser adiado nem paralelizado**: se o SWC não entregar `decoratorMetadata` dentro
do Vitest, todo o resto muda de forma.
