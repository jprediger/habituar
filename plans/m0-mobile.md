# M0 — `apps/mobile`

> Decisões comuns: [`m0-clients.md`](m0-clients.md) · Cliente compartilhado:
> [`m0-react-client.md`](m0-react-client.md)

Escopo: app Expo Router com uma rota inicial que apresenta `GET /v1/health` no Expo Go.
Sem login, CRUD, EAS Build, publicação, animação ou design system.

## Ambientes validados

- Android Emulator com `EXPO_PUBLIC_API_ORIGIN=http://10.0.2.2:3000`.
- Android físico na mesma rede, com `EXPO_PUBLIC_API_ORIGIN=http://<IP-LAN>:3000`.
- iOS permanece suportado pela estrutura Expo, mas não é declarado manualmente validado
  no M0. VoiceOver precisa ser verificado antes da primeira distribuição iOS.

Variável ausente ou origem contendo `/v1` falha antes do primeiro render. Não se tenta
inferir host pelo Metro. Homologação e produção recebem uma origem HTTPS pública no build.

## Estrutura

```text
apps/mobile/
├── package.json                 # mantém "type": "module"
├── app.json
├── .env.example                 # EXPO_PUBLIC_API_ORIGIN, sem `/v1`
├── metro.config.cjs
├── babel.config.cjs
├── jest.config.cjs
├── jest.setup.ts
├── tsconfig.json
├── eslint.config.js
├── .watchmanconfig
└── src/
    ├── habituar-client.ts
    ├── app/_layout.tsx
    ├── app/index.tsx
    ├── app/index.test.tsx
    ├── i18n/i18n.ts
    ├── i18n/resources.ts
    ├── i18n/pt-br/common.json
    └── theme/tokens.ts
```

Expo SDK 57 detecta o monorepo; `metro.config.cjs` apenas estende
`expo/metro-config`. Não usar `watchFolders`, `resolver.nodeModulesPath`,
`extraNodeModules` ou `disableHierarchicalLookup`. As extensões `.cjs` preservam as
configurações CommonJS sem abrir exceção ao ESM do workspace.

## Bootstrap e tela

- `src/habituar-client.ts` lê e valida `EXPO_PUBLIC_API_ORIGIN` e cria uma instância.
- `_layout.tsx` monta SafeArea e o `Provider` do `react-client`; TanStack Query não é
  configurado no app.
- Expo Router usa rotas tipadas sob `src/app`.
- A tela consome somente `habituar.useHealth()`.
- Tema claro/escuro segue `useColorScheme()` e seleciona os objetos semânticos de
  `design-tokens`; não existe seletor manual.
- Não há animação, portanto não existe consulta preventiva a reduce motion.

```text
SafeAreaView
├── header: Estado do sistema
├── live region: loading | ready | failed
└── Pressable Verificar novamente, somente em failed
```

Todo interativo declara papel, rótulo, estado quando aplicável e alvo mínimo pelo token
`minimumTouchTarget: 44`. Texto suporta fonte ampliada sem corte. Strings vêm do catálogo
pt-BR próprio do app.

## Testes automatizados

Jest 29 + `jest-expo` + React Native Testing Library:

1. anuncia loading por `accessibilityLiveRegion="polite"`;
2. apresenta status e versão em `ready`;
3. apresenta mensagem simples e ação acessível em `failed`;
4. retry retorna a loading e dispara nova consulta;
5. título possui papel de header;
6. Pressable possui papel, rótulo e alvo mínimo vindos de i18n/tokens;
7. nenhum detalhe técnico do erro é renderizado.

Os testes usam a interface real do `react-client` com `fetch` em memória. Não duplicam
testes internos de oRPC ou TanStack Query.

## Verificações manuais

Antes de concluir o marco:

1. abrir no Android Emulator via Expo Go;
2. provar `loading → ready` e `failed → retry`;
3. repetir o smoke test num Android físico pela rede local;
4. executar TalkBack na tela de health, percorrendo os três estados e o retry;
5. registrar iOS/VoiceOver como não verificado, bloqueante antes da primeira distribuição.

O registro em arquivo do passe manual saiu do escopo do M0 (ver Fase 6 em
[`m0-overview.md`](m0-overview.md)); a limitação de VoiceOver vive em `ACCESSIBILITY.md`,
que é onde ela bloqueia a distribuição.

## Ordem de execução

| #   | Commit                                                               | Conteúdo                                 |
| --- | -------------------------------------------------------------------- | ---------------------------------------- |
| 35  | `feat(mobile): scaffold expo router application`                     | Expo, configs `.cjs`, scripts e Watchman |
| 36  | `feat(mobile): add tokens and typed pt-BR i18n`                      | temas e catálogo pt-BR                   |
| 37  | `feat(mobile): render system health through the shared react client` | origem, SafeArea, Provider e estados     |
| 38  | `test(mobile): cover health behaviour and accessibility`             | Jest, estados e props acessíveis         |

## Verificação automatizada

```bash
pnpm --filter @habituar/mobile lint
pnpm --filter @habituar/mobile typecheck
pnpm --filter @habituar/mobile test
pnpm --filter @habituar/mobile expo:doctor
```

Não existe script `build` no workspace mobile; o binário será responsabilidade do EAS em
marco posterior.

## Pronto quando

- Testes e `expo-doctor` ficam verdes num checkout limpo.
- Expo Go resolve uma única versão de React e React Native.
- A tela funciona em emulador e Android físico com origem explícita e sem `/v1` duplicado.
- TalkBack foi percorrido e a limitação de VoiceOver está explícita.
- O plano pode ser implementado sem consultar o plano web.
