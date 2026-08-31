# M0 — `packages/react-client`

> Decisões comuns: [`m0-clients.md`](m0-clients.md) · Contrato puro:
> [`m0-shared-packages.md`](m0-shared-packages.md)

Escopo: oferecer aos dois apps uma interface React pequena que esconda transporte, cache e
estado de servidor. Nenhuma UI e nenhuma configuração específica de Vite ou Expo.

## Interface

```ts
export type HealthState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: HealthStatus }
  | { readonly status: "failed" };

export type HabituarReactClient = Readonly<{
  Provider(props: React.PropsWithChildren): React.ReactElement;
  useHealth(): Readonly<{
    state: HealthState;
    retry(): void;
  }>;
}>;

export function createHabituarReactClient(
  options: Readonly<{
    origin: string;
    fetch?: typeof globalThis.fetch;
  }>,
): HabituarReactClient;
```

### Invariantes e erros

- `origin` precisa ser uma origem HTTP(S) absoluta, sem caminho, query, fragmento ou
  `/v1`. Valor inválido lança erro de configuração antes do primeiro render.
- A factory não faz I/O. Cada chamada cria cache e configuração independentes.
- Hooks precisam estar abaixo do `Provider` da mesma instância; uso incorreto lança erro
  explícito de programação.
- `fetch` usa `globalThis.fetch` por padrão e pode receber adapter em memória nos testes.
- Falha de rede, protocolo ou schema vira `failed`; detalhes não atravessam a interface.
- Não existe repetição automática. `retry()` volta a `loading` enquanto refaz a consulta.
- A instância é criada uma vez num módulo local de bootstrap de cada app, não durante
  renderização.

## Estrutura

```text
packages/react-client/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── eslint.config.js
└── src/
    ├── create-habituar-react-client.ts
    ├── create-habituar-react-client.test.tsx
    ├── health-state.ts
    └── react-client.ts
```

`src/react-client.ts` é o único entrypoint público, declarado explicitamente em `exports`.
Ele define a interface do módulo sem introduzir `index.ts` ou barrel, ambos proibidos em
`packages/*`.

## Dependências

- `@habituar/core`: workspace dependency; fornece contrato e `HealthStatus`.
- `react`: peer dependency alinhada pelo catálogo e pelos overrides do monorepo.
- `@tanstack/react-query`, `@orpc/client` e integração OpenAPI do oRPC: dependências
  internas. Os apps não as configuram nem importam diretamente no M0.
- Nenhuma dependência de DOM, React Native, Expo, Vite ou variáveis de ambiente.

O link usado é `OpenAPILink`. O contrato já materializa `/v1/health`; concatenar uma
origem contendo `/v1` produziria `/v1/v1/health` e deve falhar na criação.

## Política da consulta

- Query key de health privada ao pacote.
- `retry: false` para repetição automática.
- Nova montagem não trata um resultado antigo como permanentemente atual; health é
  consultado novamente.
- `UseQueryResult`, `QueryClient` e erros do oRPC não fazem parte da interface pública.
- O botão de retry é decisão da UI; a interface oferece a ação somente como capacidade.

## Testes pela interface

Com um `fetch` em memória, provar:

1. origem inválida falha antes de fazer request;
2. a chamada chega a `/v1/health` exatamente uma vez;
3. resposta válida percorre `loading → ready` e preserva `HealthStatus`;
4. rede ou resposta inválida percorre `loading → failed` sem retry automático;
5. `retry()` percorre novamente `loading → ready` quando o adapter se recupera;
6. duas instâncias não compartilham cache;
7. hook fora do Provider correspondente falha de forma explícita.

Os testes atravessam a mesma interface dos apps. Não existe `resetForTests` nem asserção
sobre detalhes internos do TanStack Query.

## Ordem de execução

Substitui os antigos passos 14–16 de `core`:

| #   | Commit                                                                 | Conteúdo                                             |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| 14  | `build(react-client): add the headless react client package`           | manifesto, build, lint e fronteiras                  |
| 15  | `feat(react-client): create an isolated typed client runtime`          | factory, Provider, OpenAPILink e validação da origem |
| 16  | `test(react-client): cover health states through the public interface` | estados, retry, isolamento e erros de uso            |

O escopo `react-client` precisa ser acrescentado ao catálogo do commitlint antes do passo
14, ou os commits devem usar um escopo existente deliberadamente escolhido. A primeira
opção é preferível porque o workspace é uma unidade estável do monorepo.

## Pronto quando

- O pacote compila somente para ESM e é consumido por `dist/`.
- Sua interface pública contém apenas a factory e os tipos necessários aos callers.
- `core` instala e testa sem React.
- Os testes descritos acima passam sem servidor externo e sem estado global.
- Fixtures de fronteira recusam React em `core` e DOM/React Native/Expo em `react-client`.
