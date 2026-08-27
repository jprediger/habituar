# M0 — `apps/web` e `apps/mobile`

> Índice e decisões compartilhadas: [`m0-overview.md`](m0-overview.md)

Escopo: só encanamento. Uma tela por app, consumindo `GET /v1/health` pelo cliente tipado.
Sem login, sem domínio, sem CRUD.

---

## 0. Premissas sobre os pacotes compartilhados

| # | Premissa |
|---|---|
| P1 | `@habituar/core` exporta o contrato por subpath explícito, sem barrel |
| P2 | O hook esperto `useHealth()` vive em `core`, sobre `@tanstack/react-query` + `initClient`, com `react` e `@tanstack/react-query` como **peer opcional** — nunca `dependencies`, porque duplicar React quebra o Metro |
| P3 | O cliente HTTP é **singleton de módulo** configurado no bootstrap de cada app (`configureApiClient`), não um Provider React — Provider obrigaria `core` a exportar `.tsx`, o que o D2 proíbe |
| P4 | `useHealth()` devolve `{ state, retry }`, onde `state` é a união `loading \| ready \| failed` produzida por `toQueryState` — não `isLoading`/`isError` |
| P5 | `@habituar/core` é compilado com tsup e consumido **só por `dist/`**; o dev loop vem de `tsup --watch` no `turbo dev` |
| P6 | `@habituar/design-tokens` exporta os objetos TS com valores **sem unidade** e um `dist/theme.css` gerado, com bloco `@theme` do Tailwind v4 |
| P7 | A API expõe `GET /v1/health` retornando `{ status: 'ok', version }` |

---

## 1. Versões verificadas (npm, 26/08/2026)

**Singletons do monorepo** — ditados pelo template oficial do Expo SDK 57, **não** pelo
`latest` do npm:

| Pacote | Versão | Observação |
|---|---|---|
| `expo` | `57.0.17` | SDK 57 |
| `react-native` | `0.86.3` | **`latest` é 0.87.1 — não usar** |
| `react` / `react-dom` | `19.2.3` | `latest` é 19.2.8; alinhar com o Expo |
| `@types/react` | `19.2.2` | idem |
| `typescript` | `5.9.3` | igual ao resto do repo; o template do Expo sugere 6.x — não seguir |

**Web:** `vite@8.2.2`, `@vitejs/plugin-react@6.1.0`, `tailwindcss@4.3.3` +
`@tailwindcss/vite@4.3.3`, `tw-animate-css@1.4.0`, `class-variance-authority@0.7.1`,
`clsx@2.1.1`, `tailwind-merge@3.6.0`, `lucide-react@1.34.0`, `@radix-ui/react-slot@1.3.3`,
`@tanstack/react-router@1.170.32` + o plugin de rotas do Vite, `@tanstack/react-query@5.102.6`,
`i18next@26.4.0`, `react-i18next@17.0.12`.
Testes: `vitest@4.1.11`, `jsdom@30.0.1`, `@testing-library/react@16.3.2`,
`@testing-library/dom@10.4.1` (peer **não** transitiva — declarar),
`@testing-library/user-event@14.6.6`, `@testing-library/jest-dom@7.0.1`, `axe-core@4.13.0`.

**Mobile:** `expo-router@57.0.17`, `expo-constants@57.0.15`, `expo-linking@57.0.8`,
`expo-status-bar@57.0.1`, `expo-localization@57.0.1`, `react-native-screens@4.26.0`,
`react-native-safe-area-context@5.7.0`, `react-native-gesture-handler@2.32.0`,
`react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`.
Testes: `jest@29.7.0` (**não 30** — `jest-expo@57.0.5` depende de `babel-jest@^29`),
`jest-expo@57.0.5`, `@testing-library/react-native@14.0.1`, `test-renderer@1.2.0`
(peer novo da RNTL 14, substitui `react-test-renderer`).

**Utilitário de query do contrato — reavaliar no passo 16.** O `@ts-rest/react-query`
estava fora porque seu peer de React travava em `^16.8 || ^17 || ^18`. Com a troca por
oRPC (27/08/2026), o `@orpc/tanstack-query@1.15.0` **não tem peer de React** — só
`@orpc/client` e `@tanstack/query-core >=5.80.2` —, então a razão factual desapareceu.

O critério passa a ser o do D2, não o do peer: o hook precisa devolver a união
discriminada do `toQueryState`, e a decisão de forma do hook do `m0-overview.md` continua
valendo. Se o utilitário gerado não devolver essa união, hook escrito à mão em
`packages/core` continua sendo o certo — que é o que a regra "hook esperto em `core`" já
pedia.

---

## 2. `apps/web`

### 2.1 Estrutura

```
apps/web/
├── package.json
├── vite.config.ts
├── vitest.config.ts            # separado: o setup de teste não polui o build
├── tsconfig.json               # extends @habituar/config/tsconfig/web.json
├── eslint.config.js
├── components.json             # shadcn
├── index.html                  # <html lang="pt-BR">
└── src/
    ├── main.tsx                # createRoot + configureApiClient + providers
    ├── index.css               # @import tailwindcss + tokens + mapeamento shadcn
    ├── route-tree.gen.ts       # GERADO e commitado
    ├── providers/
    │   ├── query-provider.tsx
    │   └── i18n-provider.tsx
    ├── i18n/
    │   ├── i18n.ts
    │   ├── resources.ts        # tipagem via declaration merging
    │   └── pt-br/common.json
    ├── lib/
    │   └── cn.ts
    ├── components/ui/          # gerado pelo shadcn CLI
    └── routes/
        ├── __root.tsx
        ├── index.tsx           # a tela de health
        └── index.test.tsx
```

### 2.2 Scripts

```json
"dev": "vite",
"build": "tsc --noEmit && vite build",
"lint": "eslint .",
"typecheck": "tsc --noEmit",
"test": "vitest run"
```

`tsconfig/web.json` já tem `noEmit: true`, então `tsc -b` não serve — usar `tsc --noEmit`.

### 2.3 Tokens → tema do Tailwind

Tailwind v4 é **CSS-first**: não existe mais `tailwind.config.js` como fonte de verdade;
o tema é o bloco `@theme`. A cadeia:

1. os objetos TS em `packages/design-tokens` são a fonte única — é sobre eles que roda o
   teste de contraste do D12;
2. o `build` do pacote gera `dist/theme.css` com `@theme { … }`, **acrescentando a
   unidade** que o objeto TS não carrega (o token é `4`, o CSS é `4px`);
3. `apps/web/src/index.css`:

```css
@import "tailwindcss";
@import "@habituar/design-tokens/theme.css";   /* gerado — traz o @theme */
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));

/* Ponte para os nomes semânticos que o shadcn exige. Só aliases — nenhum valor literal. */
:root {
  --background: var(--color-surface);
  --foreground: var(--color-text);
  --primary:    var(--color-primary);
  /* … --card, --border, --ring, --muted, --destructive … */
}
```

O `@import` de `node_modules` é resolvido pelo próprio Tailwind v4, sem plugin extra.
**Nenhum valor de cor ou espaço literal existe em `apps/web`** — se aparecer, é sinal de
token faltando no pacote.

### 2.4 shadcn / Radix

- `shadcn init` e depois `add button card` — só isso no M0.
- `components.json` aponta `"css": "src/index.css"`, `"cssVariables": true`,
  `"aliases": { "@": "./src" }`.
- O alias `@/*` precisa existir nos **dois** lugares: `resolve.alias` do `vite.config.ts` e
  `paths` do `tsconfig.json` — e também no `vitest.config.ts`, ou reusar via `mergeConfig`.
- Os componentes gerados entram no repo como código nosso e passam pelo mesmo lint. Ponto
  de atenção de review: o gerador emite `React.forwardRef` e às vezes `as`, e
  `assertionStyle: 'never'` vai reclamar. **Corrigir na mão no PR, não relaxar a regra.**

### 2.5 Roteamento — file-based

SPA, sem SSR. **TanStack Router com rotas file-based**, via o plugin do Vite, com
`route-tree.gen.ts` **commitado** — mesmo tratamento dado ao `openapi.json`: artefato
gerado, versionado, e portanto diff revisável.

Por quê, e não code-based: a própria documentação do TanStack diz que code-based *"não é
recomendado para a maioria das aplicações"*, e que file-based é um **superset** — a mesma
árvore de rotas, gerada em vez de escrita à mão com `getParentRoute()` e `.addChildren()`.
As opções de rota são idênticas, então `params: { parse, stringify }` para branded ids
funciona igual nos dois modos; não há nada a ganhar escrevendo a árvore na mão. O que se
ganha com file-based é code-splitting automático por rota — relevante para uma SPA servida
em CDN a estudantes em rede móvel — e o **mesmo modelo mental do Expo Router no mobile**,
que é o que a paridade do D1 pede.

Se `src/routes/` começar a doer como camada horizontal contra a fatia vertical, a saída
oficial é **Virtual File Routes**: mantém os arquivos colocados por fatia e mapeia a árvore
explicitamente, sem perder o file-based.

M0 tem **uma** rota (`/`). O `<RouterProvider>` fica dentro do `QueryClientProvider`.

### 2.6 i18n

`i18next` + `react-i18next`, com `lng: 'pt-BR'`, `fallbackLng: 'pt-BR'`, **sem** language
detector (existe um idioma só), `returnNull: false`, `interpolation: { escapeValue: false }`.

Catálogo mínimo (`src/i18n/pt-br/common.json`), namespace único `common`:

```json
{
  "health": {
    "title": "Estado do sistema",
    "status": { "loading": "Verificando…", "ready": "Tudo funcionando", "failed": "Não foi possível verificar" },
    "retry": "Verificar novamente"
  }
}
```

Tipagem por declaration merging em `react-i18next`
(`interface CustomTypeOptions { resources: typeof resources }`), então `t('health.titl')`
vira erro de compilação — mesma lógica do catálogo fechado de permissões do D9.

**Mesma stack no mobile** — i18next funciona em RN sem adaptação. Um catálogo por app: as
strings de UI não se repetem entre plataformas, e não há catálogo compartilhado no M0.

### 2.7 Cliente tipado

O app não instancia `initClient`; ele só informa o ambiente:

```ts
// src/main.tsx, antes de createRoot
configureApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '/v1',
  credentials: 'include',   // cookie de sessão (D6), já preparado
})
```

Duas consequências que **têm de estar no plano de teste**, porque singleton de módulo é
estado global: (1) `configureApiClient` roda antes do primeiro render — se um hook rodar
antes, `getApiClient()` lança, e é isso que se quer, não um default silencioso;
(2) o `setupFiles` do Vitest e o `setupFilesAfterEach` do Jest configuram o cliente
apontando para um `fetch` de teste, e resetam entre arquivos.

Em dev, `vite.config.ts` faz `server.proxy['/v1'] → http://localhost:3000` — evita CORS e
mantém o cookie *same-origin*, que é como vai funcionar em produção atrás do CDN.

### 2.8 A tela

`src/routes/index.tsx`, componente burro:

```
<main>                                      landmark
  <h1>{t('health.title')}</h1>
  <Card>
    <p aria-live="polite">{…switch sobre state.status, terminando em assertNever…}</p>
    <Button onClick={retry}>{t('health.retry')}</Button>   // mínimo 44×44 via token
  </Card>
</main>
```

Zero lógica: o `switch` é sobre a união que veio do hook. Nenhuma string literal.

---

## 3. `apps/mobile`

### 3.1 As armadilhas do D5, uma a uma

**(a) `nodeLinker: hoisted` — já ativo.** Está no `.npmrc` hoje (`node-linker=hoisted`).
A ação do M0 é **mover a declaração para `pnpm-workspace.yaml`**, que é o local canônico no
pnpm 10 ("only auth and registry settings are read from `.npmrc`"), junto de `engineStrict`
e `saveExact`. É higiene para o pnpm 11, não muda comportamento.

Nota factual: o Expo suporta *isolated* desde o SDK 54, então hoisted não é mais
obrigatório — é escolha de reduzir superfície de falha de bibliotecas RN de terceiros.

**Impacto que precisa ser compensado:** o comentário no topo de `eslint/shared-package.js`
já antecipa — com hoisted, "a dependência não declarada no `package.json`" deixa de ser
garantia. Os `LEAK_BANS` cobrem pacotes **por nome**; qualquer dependência não declarada
fora dessa lista passa. Compensação obrigatória na fase 0: `no-extraneous-dependencies`
cobrindo `packages/*` **e** os dois apps.

**(b) Singletons de React / React Native.** Duas camadas, ambas necessárias:

```yaml
catalog:                   # dependências DIRETAS — os workspaces escrevem "catalog:"
  react: 19.2.3
  react-dom: 19.2.3
  react-native: 0.86.3
  '@types/react': 19.2.2
  '@tanstack/react-query': 5.102.6
  typescript: 5.9.3

overrides:                 # TRANSITIVAS — a cópia que de fato quebra o Metro
  react: 19.2.3
  react-dom: 19.2.3
  react-native: 0.86.3
  '@types/react': 19.2.2
```

`catalog:` sozinho fixa apenas o que os workspaces declaram; a cópia que quebra o Metro é
a que uma dependência transitiva arrasta, e só `overrides:` alcança essa. `resolutions` é
campo do Yarn e **não** é lido pelo pnpm.

Verificação, não crença: `pnpm why react --depth=10` e `pnpm why react-native --depth=10`
devem mostrar **uma** versão. O gate automático é `expo-doctor` no CI.

**(c) `watchFolders` — a documentação mudou.** A partir do **SDK 52**, `expo/metro-config`
detecta o monorepo sozinho, e a doc oficial manda **apagar** `watchFolders`,
`resolver.nodeModulesPath`, `resolver.extraNodeModules` e
`resolver.disableHierarchicalLookup` de configs manuais antigas. O M0 escreve o mínimo:

```js
// apps/mobile/metro.config.js  (CommonJS — ver (e))
const { getDefaultConfig } = require('expo/metro-config')
module.exports = getDefaultConfig(__dirname)
```

Isto contraria a letra do `implementation-plan.md` ("`watchFolders` limitado"). O documento
é corrigido no mesmo PR. Se algum dia precisar voltar a ser manual, rodar
`npx expo start --clear` junto — cache velho do Metro é a causa mais comum de "não é o meu
código".

**(d) `.watchmanconfig`.** Já existe na raiz. Falta **um também em `apps/mobile/`** — o
Watchman procura o arquivo na raiz do projeto observado. Conteúdo `{}`. Sem ele, projetos
grandes em WSL2 caem no crawler de fallback e o hot reload fica lento. Symlinks do pnpm no
Windows não são problema: o repo vive em `/home/…` no WSL2.

**(e) Armadilha extra, não listada no D5: `"type": "module"`.** O stub
`apps/mobile/package.json` tem `"type": "module"`. **Remover.** `metro.config.js`,
`babel.config.js` e `app.config.js` são carregados como CommonJS pelo toolchain do Expo;
com `"type": "module"` o `module.exports` do `metro.config.js` explode. `apps/web` mantém
`"type": "module"` normalmente.

**(f) Expo Go vs dev build.** O M0 inteiro roda em **Expo Go** — `expo-router`,
`react-native-screens`, `safe-area-context`, `reanimated`, `gesture-handler` e
`expo-localization` estão todos no runtime do Expo Go do SDK 57. Dev build vira
obrigatório no **M4**: `react-native-mmkv` (D13) é módulo nativo de terceiro, e push exige
credenciais FCM/APNs.

**Build EAS fica fora do M0.** O argumento a favor era fechar o risco "Atrito Expo +
monorepo" — o Metro local subir não prova que o EAS instala o workspace. O argumento
contra venceu: coloca conta Expo, credenciais e uma dependência externa dentro de um
critério de aceite hoje 100% local. **Risco a vigiar:** o primeiro build EAS acontece no
M4, e um problema de instalação de monorepo aparece lá, não aqui.

### 3.2 Estrutura

```
apps/mobile/
├── package.json          # SEM "type": "module"; "main": "expo-router/entry"
├── app.json
├── metro.config.js       # CommonJS, mínimo
├── babel.config.js       # module.exports = { presets: ['babel-preset-expo'] }
├── jest.config.js        # preset: 'jest-expo'
├── jest.setup.ts
├── tsconfig.json
├── eslint.config.js
├── .watchmanconfig       # {}
└── src/
    ├── app/
    │   ├── _layout.tsx        # Stack + providers (Query, i18n, SafeArea)
    │   ├── index.tsx          # a tela
    │   └── index.test.tsx
    ├── i18n/…                 # espelho do web, catálogo próprio
    └── theme/tokens.ts        # re-export tipado de @habituar/design-tokens
```

`app.json`: `"experiments": { "typedRoutes": true }` e `"plugins": ["expo-router"]`. Com
`src/app/`, declarar `"main": "expo-router/entry"`.

### 3.3 Scripts

```json
"dev": "expo start",
"lint": "eslint .",
"typecheck": "tsc --noEmit",
"test": "jest --ci"
```

**Sem `build`** — o binário sai do EAS, não do turbo. `turbo run build` pula este workspace.

### 3.4 tsconfig

Estende `@habituar/config/tsconfig/mobile.json`, que já é `lib: ["ES2022"]` sem DOM — é o
que faz `document` no app nativo virar erro de compilação. Acrescentar:

```json
{ "compilerOptions": { "types": ["expo/types"], "paths": { "@/*": ["./src/*"] } },
  "include": ["src", "expo-env.d.ts", ".expo/types/**/*.d.ts"] }
```

`skipLibCheck: true` já vem da base — é o que evita que um `.d.ts` do Expo referenciando
DOM quebre o build sem que nenhum código nosso toque no DOM.

### 3.5 A tela

`src/app/index.tsx`, componente burro, mesmo `useHealth()` do web:

```
<SafeAreaView>
  <Text accessibilityRole="header">{t('health.title')}</Text>
  <Text accessibilityLiveRegion="polite">{…switch + assertNever…}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={t('health.retry')}
             hitSlop={…} style={{ minWidth: 44, minHeight: 44 }} />
</SafeAreaView>
```

Regras de acessibilidade já valendo no M0: `accessibilityRole` em todo interativo, alvo
44×44, nenhuma string literal, `AccessibilityInfo.isReduceMotionEnabled()` consultado no
`_layout` — mesmo sem animação alguma, o gancho existe desde o primeiro dia.

---

## 4. A prova do M0: um tipo atravessando os três

O tipo é `HealthStatus`, inferido do schema zod do contrato — nunca escrito à mão.

```
packages/core/src/health/          (zod 4 → contrato oRPC)
        ├──► apps/api      @orpc/nest implementa; retorno fora do schema = erro de compilação
        ├──► apps/web      useHealth() → src/routes/index.tsx
        └──► apps/mobile   useHealth() → src/app/index.tsx
```

O hook mora em `packages/core` (esperto); os dois componentes só fazem `switch` sobre a
união (burros). Se o hook migrar para um app, o D2 foi violado — isso é *review*.

---

## 5. Acessibilidade em CI (D12)

### 5.1 Web — `axe-core` direto, dentro do Vitest

Runner: **Vitest + jsdom + `axe-core` puro**, com helper local — **não** `jest-axe` (traz
`chalk`/`jest-matcher-utils` para dentro de um repo Vitest) e **não** `vitest-axe` (0.1.0,
sem manutenção).

```ts
// src/test/expect-no-a11y-violations.ts
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  const { violations } = await axe.run(container, { resultTypes: ['violations'] })
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}
```

O filtro por `impact` é a regra do `ACCESSIBILITY.md` **codificada**, não confiada ao
default da ferramenta. A mensagem de falha lista a regra e o `help`, então o CI diz o que
corrigir.

**O que o M0 testa:** os três estados da união renderizam sem violação bloqueante;
`userEvent.tab()` alcança o botão e o foco fica visível; existe `<h1>` e a região de status
é `aria-live`.

**Falha o build** porque `test` já está em `pnpm check` → `turbo run test` → step do CI.
Nenhum step novo.

**Limite honesto:** jsdom não calcula layout nem cor computada, então a regra
`color-contrast` do axe **não roda** ali. Essa cobertura vem do teste de contraste sobre
`packages/design-tokens`. Playwright + `@axe-core/playwright` fica para o **M1**, quando
existir fluxo de login com teclado de verdade para percorrer.

### 5.2 O que dá para impor por lint sem plugin novo

`eslint-plugin-jsx-a11y` e `eslint-plugin-react` declaram peer `eslint ^9` e o repo está no
**10**. Em vez de forçar peers, estender o `no-restricted-syntax` que `eslint/react.js` já
usa — três seletores em `esquery` puro:

```js
// texto de usuário hardcoded em JSX
{ selector: 'JSXText[value=/\\S/]',
  message: 'Texto de usuário vai por i18n, em pt-BR. Literal no componente é erro.' },

// "div com onClick é erro; se é botão, é <button>" (ACCESSIBILITY.md, web)
{ selector: "JSXOpeningElement[name.name=/^[a-z]/]:has(JSXAttribute[name.name='onClick']):not([name.name=/^(button|a|input|select|textarea|summary)$/])",
  message: 'Elemento não interativo com onClick. Se é botão, é <button>.' },

// mobile: interativo sem papel de acessibilidade
{ selector: "JSXOpeningElement[name.name=/^(Pressable|TouchableOpacity|TouchableHighlight)$/]:not(:has(JSXAttribute[name.name='accessibilityRole']))",
  message: 'Todo elemento interativo declara accessibilityRole (ACCESSIBILITY.md, mobile).' },
```

Alteração em `packages/config/eslint/react.js`, na fase 0.

### 5.3 Mobile — a pendência manual, registrada

Não existe axe para RN; o `ACCESSIBILITY.md` já assume isso. O M0 entrega:

- o lint da §5.2 (papel de acessibilidade obrigatório);
- `docs/accessibility/manual-passes.md` criado com o template exigido (data, versão do app,
  telas percorridas, achados, quem passou) e a primeira entrada: TalkBack na tela de health,
  viável em emulador Android;
- **VoiceOver registrado como pendente**, com o marco alvo (M1, junto do login, que é a
  primeira tela com formulário). O ambiente é WSL2, sem macOS. "Passe não registrado não
  aconteceu" vale nos dois sentidos: um pendente registrado é melhor que um verde falso.

---

## 6. Testes do M0 — e o conflito Jest × Vitest

**Vitest em todo o repo, exceto `apps/mobile`, que usa Jest.**

- `jest-expo` é o **único** caminho suportado para transformar RN/Expo: o source do React
  Native é distribuído com tipos Flow e sem transpilação, e o preset resolve
  `babel-preset-expo`, `@react-native/jest-preset`, mocks de módulos nativos e a resolução
  de plataforma (`.ios.ts` / `.android.ts` / `.native.ts`). `@testing-library/react-native@14`
  declara peer `jest >= 29`, e o `expo-router` publica helpers que assumem Jest.
- Rodar RN sob Vitest exige montar e **manter** um pipeline de transform que a Expo não
  testa. O M0 existe para eliminar risco de toolchain — trocá-lo por risco de toolchain
  caseiro é o oposto do objetivo.
- O custo da divergência é **um arquivo de config dentro de um workspace**. A interface
  externa não muda: todo workspace expõe `test`, e quem é invocado é o Turborepo.
- Consequência a aceitar: `jest@29`, não 30.

Se um dia a Expo publicar preset oficial de Vitest, a migração é um workspace.

**Web:** `vitest.config.ts` com `environment: 'jsdom'`, `setupFiles` carregando
`@testing-library/jest-dom/vitest`, e `globals: false` — import explícito de `describe`/`it`,
coerente com `verbatimModuleSyntax`. Nomes de teste são frases sobre comportamento:
*"mostra o estado de indisponível quando a verificação falha"*, não *"renders correctly"*.

**Mobile:** `jest.config.js` com `preset: 'jest-expo'`, `setupFilesAfterEnv` com
`@testing-library/react-native/extend-expect`, e o `transformIgnorePatterns` do preset —
não reescrever à mão. Um teste: a tela anuncia o título com `accessibilityRole="header"` e
o botão de retry tem `accessibilityLabel` vindo do i18n.

**Maestro** é só citado. Fluxo E2E entra quando existir fluxo (M1).

---

## 7. Alterações em arquivos existentes

### `.github/workflows/ci.yml`

Depois de `Install dependencies`:

```yaml
      - name: Check Expo monorepo health
        run: pnpm --filter @habituar/mobile exec expo-doctor
```

`expo-doctor` é o gate automático das armadilhas do D5: detecta React/React Native
duplicados, versões fora do range do SDK 57 e config de Metro incompatível. É o único
lugar do CI onde a duplicação de singleton é pega antes de virar crash em runtime.

E, no fim, um step de build — `check` não compila o SPA:

```yaml
      - name: Build
        run: pnpm turbo run build
```

Sem step de Playwright no M0. Sem step de EAS.

### `pnpm-workspace.yaml`

`nodeLinker`, `engineStrict` e `saveExact` movidos do `.npmrc`; `catalog:` e `overrides:`
como na §3.1(b). Se o `pnpm install` reclamar de build scripts bloqueados após somar o
Expo, acrescentar os nomes a `onlyBuiltDependencies` — **um a um, com o nome no diff**,
nunca via flag global.

### `turbo.json`

```jsonc
"build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
"typecheck": { "dependsOn": ["^typecheck", "^build"], "outputs": [] },
"test":      { "dependsOn": ["^typecheck", "^build"], "outputs": [] },
"dev":       { "dependsOn": ["^build"], "cache": false, "persistent": true }
```

Sem `^build`, o `tsc --noEmit` de `apps/web` não acha os `.d.ts` de `core` num checkout
limpo, e `expo start` / `nest start --watch` não acham o `dist/` no primeiro boot.
`.next/**` sai de `outputs`: não há Next no projeto.

**Dev loop.** `core` e `design-tokens` ganham `dev` = `tsup --watch` (persistente). Como
`turbo dev` roda o grafo inteiro, `pnpm dev` sobe os dois watchers, o Vite e o Metro
juntos. A latência de rebuild do tsup é de dezenas de ms; na prática o Vite faz HMR e o
Metro faz fast refresh logo depois.

**Por que não a condição `"react-native"` apontando para `src/`:** ela criaria dois
caminhos de resolução para o mesmo módulo — Metro em `src/`, Vite e Nest em `dist/` — que
é exatamente a classe de bug que "módulo duplicado" produz no Expo. O que se perde é HMR
verdadeiro do código de `core`; o que se ganha é que o que o teste executa é o que o build
publica.

**Cuidado com ESM+CJS no Metro.** `core` dual precisa de `exports` com `import`/`require` e
um `types` por subpath. O Metro do SDK 52+ lê `exports` por padrão; se alguma dependência
acabar resolvida pelos dois caminhos ao mesmo tempo, o sintoma é módulo com estado
duplicado. Verificação no M0: `expo-doctor` e um `console.log` descartável provando que
`useHealth` vem de uma instância só.

---

## 8. Ordem de execução

Numeração global — ver [`m0-overview.md`](m0-overview.md).

| # | Commit | Conteúdo |
|---|---|---|
| 30 | `feat(web): scaffold vite react application` | Vite + React + TS, eslint e tsconfig do `@habituar/config`. Tela vazia |
| 31 | `feat(web): wire design tokens into tailwind theme` | Tailwind v4 + `theme.css` + shadcn `init` e `add button card` |
| 32 | `feat(web): add typed pt-BR i18n and file-based routing` | i18n tipado + TanStack Router file-based com `route-tree.gen.ts` commitado |
| 33 | `feat(web): render system health from typed contract` | `configureApiClient`, `QueryClientProvider`, a tela |
| 34 | `test(web): cover health screen behaviour and accessibility` | Vitest + Testing Library + `expectNoA11yViolations` |
| 35 | `feat(mobile): scaffold expo router application` | Expo SDK 57, **sem `"type": "module"`**, `metro.config.js` mínimo, `.watchmanconfig` local. Rodar em Expo Go e conferir `pnpm why react` |
| 36 | `feat(mobile): add providers, tokens and pt-BR i18n` | `_layout.tsx` com Query, SafeArea e i18n |
| 37 | `feat(mobile): render system health from typed contract` | a tela, com props de acessibilidade |
| 38 | `test(mobile): cover health screen behaviour` | Jest + `jest-expo` + RNTL |
| 39 | `ci: verify expo monorepo health and build every workspace` | `expo-doctor` + `turbo run build` |
| 40 | `docs: record m0 manual accessibility pass` | template + entrada do M0 |
| 41 | `docs: correct the metro monorepo guidance in the implementation plan` | `watchFolders` (SDK 52+) |

Os passos 30–34 e 35–38 são independentes entre si; ambos dependem dos passos 16 e 20.
