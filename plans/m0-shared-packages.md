# M0 — `packages/core` e `packages/design-tokens`

> Índice e decisões compartilhadas: [`m0-overview.md`](m0-overview.md)

Escopo: só o encanamento que o M0 exige — `GET /v1/health` declarado, um tipo atravessando
os três apps, contraste verificado, import proibido quebrando o CI. Tudo que puxar para
domínio fica registrado como M1+.

---

## 0. Restrições descobertas no repositório

Não são opinião; foram lidas do código.

| Fato | Consequência |
|---|---|
| `assertionStyle: 'never'` proíbe `as` — mas o plugin **ignora `as const`** (verificado na fonte da regra, `consistent-type-assertions.js`) | União fechada e branded type se fazem com `as const` + `.brand()` do zod. `satisfies` também é livre |
| `ban-ts-comment` aceita `ts-expect-error` **com descrição** | Teste de tipo (id A ≠ id B) é possível sem `as` |
| `tsconfig/base.json` não carrega `lib: DOM` | `core` não compila DOM por construção. Nada a fazer |
| `tsconfig/nest.json` usa `moduleResolution: node` | node10 **ignora o campo `exports`**. `apps/api` não resolveria `@habituar/core/health/contract`. **Corrigido:** `nodenext` desde o passo 2 |
| **oRPC valida por Standard Schema** (substituiu o `@ts-rest` em 27/08/2026) | **zod 4**. O pin em `zod@3.25.76`, que existia por causa do `@ts-rest`, foi removido |
| React dentro de `core` contradiz a fronteira que torna o pacote utilizável pela API | Cliente, estado de query e hooks vivem em `@habituar/react-client`; ver `m0-react-client.md` |
| `commitlint` ainda não conhece o workspace `react-client` | Acrescentar o escopo no passo 1, junto da criação do catálogo de versões |

---

## 1. `packages/core` — layout

**Estado da fatia inicial:** passos 7, 11 e 12 concluídos; o passo 6b reimplementa o
contrato sobre oRPC e reduz o build a ESM único. O pacote declara seus subpaths; o schema
de health nasce no zod e compõe o contrato versionado
consumido por `apps/api`. Os demais arquivos desta árvore continuam sendo o alvo do M0.

Fatia vertical. Sem `index.ts` em lugar nenhum — barrel é proibido em `packages/*`.

```
packages/core/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
├── openapi.json                       # gerado e COMMITADO
└── src/
    ├── contract/
    │   ├── api-contract.ts            # composição raiz + pathPrefix /v1 + commonResponses
    │   ├── api-contract.test.ts
    │   ├── failure.ts                 # catálogo fechado de códigos + envelope + Outcome
    │   ├── failure.test.ts
    │   └── openapi.test.ts            # gate de drift do openapi.json
    ├── health/                        # a única fatia do M0
    │   ├── health.schema.ts
    │   ├── health.contract.ts
    │   └── health.test.ts
    ├── identity/
    │   ├── branded-id.ts              # padrão canônico de id (sem ids concretos no M0)
    │   └── branded-id.test.ts
    └── type/
    │   ├── assert-never.ts
    │   └── assert-never.test.ts
```

Convenções: arquivo `kebab-case` com sufixo de papel (`.schema.ts`, `.contract.ts`,
`.hook.ts`, `.test.ts`); schema é valor `camelCase` com sufixo `Schema`.

### package.json

`save-exact=true` já está ativo.

```jsonc
{
  "name": "@habituar/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./contract":      { "types": "./dist/contract/api-contract.d.ts", "import": "./dist/contract/api-contract.js" },
    "./failure":       { "…": "dist/contract/failure" },
    "./assert-never":  { "…": "dist/type/assert-never" },
    "./branded-id":    { "…": "dist/identity/branded-id" },
    "./health/schema":   { "…": "dist/health/health.schema" },
    "./health/contract": { "…": "dist/health/health.contract" }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "openapi": "vitest run src/contract/openapi.test.ts -u"
  },
  "dependencies": { "@orpc/contract": "1.15.0", "zod": "4.1.13" },
  "devDependencies": {
    "@habituar/config": "workspace:*",
    "@orpc/openapi": "1.15.0",
    "@types/node": "22.20.1",
    "eslint": "10.9.1",
    "typescript": "catalog:",
    "vitest": "4.1.11"
  }
}
```

`"…": "dist/x"` é abreviação deste documento: escrever as três chaves `types`/`import`/
`require` por extenso. **Sem wildcard `"./*"`** — a lista explícita *é* a declaração de
entrypoint público que o `CLAUDE.md` exige, e é o que o `boundaries/dependencies` cobra.

`core` não declara React, TanStack Query ou cliente oRPC. Essa separação é imposta por
lint e mantém o pacote inteiro — não apenas alguns subpaths — seguro para `apps/api`.

### tsconfig.json

```jsonc
{
  "extends": "@habituar/config/tsconfig/base.json",
  "compilerOptions": {
    "module": "NodeNext", "moduleResolution": "NodeNext",
    "noEmit": true, "types": ["node"],
    "rootDir": "src", "outDir": "dist"
  },
  "include": ["src"]
}
```

Sem `vitest/globals`: os testes importam `describe`/`it`/`expect` de `vitest`
explicitamente, coerente com a regra de import explícito e com `verbatimModuleSyntax`.

### tsup.config.ts

```ts
entry: {                                   // espelha 1:1 o mapa de exports
  'contract/api-contract': 'src/contract/api-contract.ts',
  'contract/failure': 'src/contract/failure.ts',
  // …
},
format: ['esm'], dts: true, splitting: true, sourcemap: true,
clean: true, target: 'es2022'
```

**Só ESM desde o passo 6b.** O build dual existia para servir `apps/api` em CommonJS; com
o monorepo inteiro em ESM, a condição `require` não tem consumidor e a saída `.cjs`/`.d.cts`
seria peso morto. Se a geração de `.d.ts` duplicar demais entre entries, o fallback é
`bundle: false` + `tsc --emitDeclarationOnly`.

---

## 2. Contrato oRPC e o `/v1`

`/v1` aparece **uma vez**, na composição raiz. Nenhuma fatia conhece a versão — é o que
torna `/v2` uma segunda composição sobre as mesmas fatias, e não um find-and-replace.

```ts
// src/contract/api-contract.ts
import { oc } from '@orpc/contract'

/** D15: a versão vive só aqui. Rota de fatia declara caminho sem prefixo. */
export const API_VERSION = 'v1'

export const apiContract = oc.prefix(`/${API_VERSION}`).router({ health: healthContract })
```

Falha esperada tem uma forma só em toda rota (`CLAUDE.md` §Erros). No passo 10, avaliar
declará-la no mapa `errors` do contrato, que dá tipagem de erro ponta a ponta — se couber
sem duplicar a definição do catálogo, é ganho; se duplicar, fica de fora.

```ts
// src/health/health.schema.ts
export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
})
/** readonly sem espelhar o schema à mão, e sem tocar no schema que o oRPC inspeciona. */
export type HealthStatus = Readonly<z.infer<typeof healthStatusSchema>>
```

**Sem `checkedAt`**, e portanto sem a porta `Clock` no M0: o campo não tem consumidor —
quem chamou já sabe a que horas chamou — e porta sem consumidor é o anti-padrão
"abstração para caso hipotético futuro". `Clock` entra no M1, onde a expiração deslizante
de sessão o torna inevitável. `version` sai da configuração de ambiente já parseada por
zod em `apps/api`; nenhum efeito colateral novo.

`HealthStatus` é **o tipo do M0 que atravessa os três apps**: `apps/api` o devolve
(verificado em compilação pelo `@orpc/nest` — corpo fora do schema, valor fora da união e
contrato implementado pela metade são erro de `tsc`), os dois clientes o consomem pelo hook.

### `openapi.json` — geração e gate de drift

Quem roda o gerador é **o próprio teste**, via file snapshot do Vitest. Isso dispensa
script, `tsx` e passo novo no CI.

```ts
// src/contract/openapi.test.ts
it('mantém o openapi.json commitado igual ao contrato', async () => {
  const document = generateOpenApi(apiContract, {
    info: { title: 'Habituar API', version: API_VERSION },
  })
  await expect(`${JSON.stringify(document, null, 2)}\n`).toMatchFileSnapshot('../../openapi.json')
})
```

- Regenerar: `pnpm --filter @habituar/core openapi` (é `vitest -u`).
- Divergência deixa `pnpm check` vermelho, logo o CI também — tanto no `check:affected`
  do PR quanto no `check` do push. Mudança de contrato vira diff revisável, como o D4 exige.
- O Vitest falha em snapshot ausente, então o arquivo não pode ser "esquecido".

---

## 3. Branded id sem `as`

O truque é não construir o brand na mão: o zod devolve o tipo marcado a partir do `parse`.

```ts
// src/identity/branded-id.ts
/**
 * Id de entidade é uuid marcado. Trocar `StudentId` por `UserId` precisa ser erro de
 * compilação, e o único caminho até um valor marcado é o parse — nunca uma asserção.
 */
export function defineIdSchema<TBrand extends string>(brand: TBrand) {
  return z.string().uuid().brand<TBrand>()
}
```

Teste — comportamento, e uma prova de tipo:

```ts
it('não deixa um id de uma entidade passar por outro', () => {
  const userId = userIdSchema.parse(SOME_UUID)
  // @ts-expect-error UserId não é StudentId — a troca é erro de compilação, não bug de produção.
  const studentId: StudentId = userId
  expect(typeof studentId).toBe('string')
})
```

`@ts-expect-error` **com descrição** é o que o `ban-ts-comment` permite, e é a única forma
de testar tipo sem `as`.

**Nenhum id concreto entra no M0** — não há entidade ainda. Entra só o helper e o teste,
porque a técnica é não-óbvia e precisa estar fixada antes do M1 escrever quinze ids.

---

## 4. União discriminada e `assertNever`

```ts
// src/type/assert-never.ts
/** Variante nova de união quebra o build em cada `switch` que precisa saber dela. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected variant: ${JSON.stringify(value)}`)
}
```

Mora em `src/type/` — é utilitário de linguagem, não fatia de domínio. A exaustividade
estática já é imposta por `switch-exhaustiveness-check` + `noFallthroughCasesInSwitch`;
o `assertNever` cobre o caso de runtime (payload de rede fora da união).

---

## 5. Erros — forma canônica

```ts
// src/contract/failure.ts
/** Catálogo fechado. Código novo entra aqui e em lugar nenhum mais. */
export const FAILURE_CODES = [
  'invalid_input', 'unauthenticated', 'forbidden', 'not_found', 'conflict',
] as const

export const failureSchema = z.object({
  code: z.enum(FAILURE_CODES),
  /** Inglês, para desenvolvedor. Texto de usuário é pt-BR e sai do i18n a partir de `code`. */
  message: z.string().min(1),
})

export type FailureCode = (typeof FAILURE_CODES)[number]
export type Failure = Readonly<z.infer<typeof failureSchema>>

/** Falha esperada é retorno, não exceção (CLAUDE.md §Erros). */
export type Outcome<TValue> =
  | { readonly status: 'success'; readonly value: TValue }
  | { readonly status: 'failure'; readonly failure: Failure }
```

Divisão de responsabilidade:

- **Falha esperada** → o domínio devolve `Outcome`; a borda, e só ela, mapeia
  `FailureCode → status HTTP`. O mapa mora em `apps/api`, porque status HTTP é assunto de borda.
- **Exceção** → bug ou infra; sobe até o filtro global e vira `500` sem corpo detalhado.
- No contrato, `commonResponses` (400/401/403) dá forma a todas as rotas; 404 e 409 são
  declarados por rota, só onde a rota de fato os produz — senão a união mente.

---

## 6. Contrato para clientes

`core` publica o contrato e `HealthStatus`; não publica transporte, estado de query ou
hooks. A seam React está especificada separadamente em
[`m0-react-client.md`](m0-react-client.md). Assim, o mesmo pacote puro serve o adapter Nest
e o cliente compartilhado sem instalar React no container da API.

---

## 7. Portas

Nenhuma porta entra no M0. `Clock` vai para o M1 (expiração de sessão) e `IdGenerator`
também — nada no M0 gera id, e o `correlationId` de `apps/api` usa `CryptoIdGenerator`
como **classe concreta injetada**, que é o que o `CLAUDE.md` manda fazer fora da lista
sancionada de portas.

A regra de lint contra `new Date()` e `Math.random()` já existe e cobra a porta no dia em
que houver o primeiro consumidor.

---

## 8. `packages/design-tokens`

```
packages/design-tokens/
├── package.json  tsconfig.json  tsup.config.ts  eslint.config.js
├── scripts/write-theme-css.ts
└── src/
    ├── color.ts            # primitivos (hex)
    ├── semantic-color.ts   # papéis, tema claro e escuro
    ├── spacing.ts          # escala 4pt, números sem unidade
    ├── interaction.ts      # alvos mínimos e medidas semânticas de interação
    ├── typography.ts       # tamanhos (número), pesos, line-height (razão)
    ├── contrast.ts         # luminância relativa + razão WCAG 2.x
    ├── contrast-pair.ts    # tabela declarada de pares e uso
    └── contrast.test.ts    # gate D12
```

`exports`: `./color`, `./semantic-color`, `./spacing`, `./interaction`, `./typography`,
`./contrast`, `./theme.css` → `./dist/theme.css`.

### Forma dos tokens

Valores **sem unidade** onde as plataformas divergem — o token é o número de design, e
cada plataforma adapta:

```ts
export const SPACING = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const INTERACTION = { minimumTouchTarget: 44 } as const
export const FONT_SIZE = { caption: 12, body: 16, title: 20, display: 28 } as const
export const LINE_HEIGHT = { tight: 1.25, normal: 1.5 } as const   // razão, não px
export const SEMANTIC_COLOR_LIGHT = {
  surface: '#FFFFFF', surfaceMuted: '#F3F4F6',
  text: '#111827', textMuted: '#4B5563',
  primary: '#1F5C3D', onPrimary: '#FFFFFF',
  border: '#9CA3AF', danger: '#B3261E', onDanger: '#FFFFFF', focusRing: '#1F5C3D',
} as const
```

Cor em hex: string válida nos dois mundos. Os valores são **provisórios** — o que garante
que trocar a paleta não quebre o AA é o teste, não o olho.

### Um conjunto, duas plataformas, zero componente compartilhado

- **Mobile**: importa os objetos e usa os números direto em `StyleSheet.create` — RN já
  trabalha em dp sem unidade.
- **Web**: o `build` emite `dist/theme.css` a partir dos **mesmos objetos TS**, como custom
  properties num bloco `@theme` do Tailwind v4 (`--color-surface`, `--spacing-md`, …).
  O gerador é quem acrescenta a unidade. `apps/web` faz `@import` e usa `bg-surface`, `p-md`.
- Nenhum componente atravessa a fronteira. A consistência vem de o arquivo de tokens ser
  um só — que é literalmente o texto do D2.

### Teste programático de contraste (D12)

**Algoritmo — WCAG 2.x**, o mesmo da 2.2 (1.4.3 e 1.4.11 não mudaram):

1. canal sRGB `c` normalizado em 0..1;
2. linearização: `c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4`;
3. `L = 0.2126·R + 0.7152·G + 0.0722·B`;
4. razão `= (Lmax + 0.05) / (Lmin + 0.05)`.

Sem dependência de biblioteca de cor — são ~25 linhas puras, testáveis contra valores de
referência conhecidos (preto sobre branco = 21, branco sobre branco = 1). APCA é rascunho
de WCAG 3 e **não** é usado.

**Pares testados — declarados, não descobertos:**

```ts
export type ContrastUsage = 'body-text' | 'large-text' | 'ui-component'
export const MINIMUM_RATIO = { 'body-text': 4.5, 'large-text': 3, 'ui-component': 3 } as const

export const CONTRAST_PAIRS = [
  { name: 'texto sobre superfície',            foreground: 'text',      background: 'surface',      usage: 'body-text' },
  { name: 'texto secundário sobre superfície', foreground: 'textMuted', background: 'surface',      usage: 'body-text' },
  { name: 'texto sobre superfície suave',      foreground: 'text',      background: 'surfaceMuted', usage: 'body-text' },
  { name: 'rótulo de botão primário',          foreground: 'onPrimary', background: 'primary',      usage: 'body-text' },
  { name: 'rótulo de botão destrutivo',        foreground: 'onDanger',  background: 'danger',       usage: 'body-text' },
  { name: 'borda de campo sobre superfície',   foreground: 'border',    background: 'surface',      usage: 'ui-component' },
  { name: 'anel de foco sobre superfície',     foreground: 'focusRing', background: 'surface',      usage: 'ui-component' },
] as const
```

Cada par roda nos **dois temas**, com `it.each` sobre `[tema × par]` e nome de teste como
frase: *"mantém 'texto sobre superfície' acima de 4,5:1 no tema escuro"*.

**Mais um teste, no espírito de tentar burlar a regra:** *"não deixa existir papel de cor
sem par de contraste declarado"* — toda chave de `SEMANTIC_COLOR_LIGHT` precisa aparecer
em ao menos um `CONTRAST_PAIRS`. Sem ele, token novo escapa do gate em silêncio.

**Como falha o CI:** `test` do workspace é `vitest run`, que entra no `turbo run test` que
o `pnpm check` já executa. Nenhum passo novo no CI.

---

## 9. O que exatamente é testado no M0

Tudo puro, sem mock de infraestrutura, `*.test.ts` ao lado do código.

**`packages/core`**

| Arquivo | Comportamento afirmado |
|---|---|
| `type/assert-never.test.ts` | lança quando chega uma variante que o tipo dizia impossível |
| `identity/branded-id.test.ts` | recusa valor que não é uuid; um id não passa por outro |
| `contract/failure.test.ts` | recusa código fora do catálogo fechado |
| `health/health.test.ts` | recusa `status` diferente de `ok` e versão vazia |
| `contract/api-contract.test.ts` | **toda** rota do contrato começa com `/v1` (D15 mecanizado) |
| `contract/openapi.test.ts` | o `openapi.json` commitado é exatamente o que o contrato gera |

**`packages/design-tokens`**

| Arquivo | Comportamento afirmado |
|---|---|
| `contrast.test.ts` | razões de referência (21 e 1); todo par declarado acima do mínimo, nos dois temas; nenhum papel de cor sem par declarado |

Fora deste plano: comportamento de hooks testado pela interface do `react-client`, schemas
de ficha/permissão/métrica (M2/M3/M6), `Outcome` exercitado por regra de domínio real (M1).

---

## 10. Ordem de execução

Numeração global — ver [`m0-overview.md`](m0-overview.md).

| # | Commit | Conteúdo |
|---|---|---|
| 7 | `build(core): add package build, exports map and lint setup` | `package.json`, `tsconfig.json`, `tsup.config.ts`, `eslint.config.js` |
| 8 | `feat(core): add assertNever for closed unions` | `type/assert-never.ts` + teste |
| 9 | `feat(core): add branded identifier schema helper` | `identity/branded-id.ts` + teste |
| 10 | `feat(core): add closed catalog of failure codes` | `contract/failure.ts` (+ `Outcome`) + teste |
| 11 | `feat(core): add health status schema` | `health/health.schema.ts` + teste |
| 12 | `feat(core): declare the v1 health route in the contract` | `health/health.contract.ts`, `contract/api-contract.ts` + teste de prefixo |
| 13 | `feat(core): commit the generated openapi document` | `contract/openapi.test.ts` + `openapi.json` |
| 17 | `build(tokens): add package build and lint setup` | manifests do `design-tokens` |
| 18 | `feat(tokens): add color, spacing and typography scales` | escalas |
| 19 | `feat(tokens): verify wcag 2.2 aa contrast of declared pairs` | `contrast.ts`, `contrast-pair.ts`, `contrast.test.ts` |
| 20 | `feat(tokens): emit css theme variables for tailwind` | `scripts/write-theme-css.ts` |

Ordem obrigatória dentro da fase: 10 antes de 12 (`commonResponses`); 12 antes de 13;
7 antes de tudo. Os passos 14–16 pertencem ao plano do `react-client`.

---

## 11. Contrato que os outros planos consomem

Declarado aqui porque tudo aponta para dentro.

**`apps/api`**

- `import { apiContract } from '@habituar/core/contract'` → implementa com `@orpc/nest`.
- `import { failureSchema, type FailureCode, type Outcome } from '@habituar/core/failure'`;
  o mapa `FailureCode → status HTTP` mora lá, não aqui.
- Precisa de `nodenext` no `tsconfig/nest.json` — já entregue no passo 2. O `"type"` do
  próprio `package.json` volta a ser `module`, igual ao resto do monorepo, a partir do
  passo 6b.
- Instala `@habituar/core` sem React ou peers de UI.

**`apps/web` e `apps/mobile`**

- Consomem `@habituar/react-client`, que depende do contrato e do schema de health.
- Cada app cria sua instância com uma origem de plataforma e monta o Provider retornado.
- Web: `@import '@habituar/design-tokens/theme.css'`. Mobile: importa os objetos e usa os
  números direto.
- Versão de `react` sai do `catalog:`, fixada pelo SDK do Expo.
