# M0 — `apps/web`

> Decisões comuns: [`m0-clients.md`](m0-clients.md) · Cliente compartilhado:
> [`m0-react-client.md`](m0-react-client.md)

Escopo: SPA Vite com uma rota `/` que apresenta o estado de `GET /v1/health`. Sem login,
CRUD, SSR, componentes compartilhados ou design system.

## Dependências e configuração

- Depende dos passos 16 (`react-client`) e 20 (CSS dos design tokens).
- Usa Vite, React, Tailwind v4, shadcn/Radix, TanStack Router file-based, i18next, Vitest,
  Testing Library, jsdom e `axe-core` nas versões fixadas pelo workspace.
- `src/habituar-client.ts` cria uma instância com `window.location.origin`.
- Em dev, `server.proxy['/v1']` encaminha para `http://localhost:3000`.
- Homologação e produção usam a mesma topologia de origem única; o bundle web não recebe
  nem conhece o endereço interno do container da API.

## Estrutura

```text
apps/web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── src/
    ├── main.tsx
    ├── habituar-client.ts
    ├── index.css
    ├── route-tree.gen.ts
    ├── providers/i18n-provider.tsx
    ├── i18n/i18n.ts
    ├── i18n/resources.ts
    ├── i18n/pt-br/common.json
    ├── components/ui/button.tsx
    ├── components/ui/card.tsx
    ├── routes/__root.tsx
    ├── routes/index.tsx
    ├── routes/index.test.tsx
    └── test/expect-no-a11y-violations.ts
```

O `Provider` do `react-client` envolve o RouterProvider no bootstrap. A rota conhece
somente `habituar.useHealth()`; não importa oRPC ou TanStack Query.

## Tema e UI

- Os objetos TS de `design-tokens` são a fonte; o build gera `dist/theme.css` com os
  temas claro e escuro para Tailwind v4.
- O tema acompanha `prefers-color-scheme`; não existe seletor manual.
- shadcn gera somente Button e Card. Código gerado passa pelo lint sem relaxar regras.
- Nenhuma cor, espaço ou tamanho de alvo de toque literal vive no app.
- A tela preserva a mesma hierarquia do mobile, sem buscar paridade de layout.

```text
main
├── h1: Estado do sistema
└── card
    ├── região viva: loading | ready | failed
    └── botão Verificar novamente, somente em failed
```

Todos os textos vêm do catálogo pt-BR tipado. A nova tentativa volta ao anúncio de
carregamento; detalhes técnicos nunca são renderizados.

## Roteamento

- TanStack Router file-based, SPA sem SSR.
- `route-tree.gen.ts` é gerado e commitado.
- O alias `@/*` existe em TypeScript, Vite e Vitest.
- O M0 possui somente a rota `/`.

## Testes

Vitest + jsdom + Testing Library, com `globals: false`:

1. anuncia loading numa região `aria-live="polite"`;
2. apresenta status e versão em `ready`;
3. apresenta mensagem simples e botão em `failed`;
4. retry retorna a loading e dispara nova consulta;
5. botão é alcançável por teclado e tem foco visível;
6. existe exatamente um `h1` e o conteúdo ocupa `main`;
7. os três estados não têm violações axe `serious` ou `critical`.

Contraste é verificado nos tokens, pois jsdom não calcula cor e layout. Playwright entra
no M1, quando existir um fluxo real de autenticação.

## Ordem de execução

| #   | Commit                                                            | Conteúdo                           |
| --- | ----------------------------------------------------------------- | ---------------------------------- |
| 30  | `feat(web): scaffold vite react application`                      | Vite, scripts, configs e bootstrap |
| 31  | `feat(web): wire design tokens into tailwind theme`               | Tailwind, temas e Button/Card      |
| 32  | `feat(web): add typed pt-BR i18n and file-based routing`          | catálogo e rota `/`                |
| 33  | `feat(web): render system health through the shared react client` | instância, Provider e estados      |
| 34  | `test(web): cover health behaviour and accessibility`             | estados, retry, teclado e axe      |

## Verificação

```bash
pnpm --filter @habituar/web lint
pnpm --filter @habituar/web typecheck
pnpm --filter @habituar/web test
pnpm --filter @habituar/web build
```

## Pronto quando

- Um checkout limpo compila os pré-requisitos antes do app.
- A SPA funciona com a API local pelo proxy e não duplica `/v1`.
- Os três estados e retry passam nos testes de comportamento e acessibilidade.
- Tema claro e escuro usam exclusivamente tokens e passam no gate de contraste.
- O plano pode ser implementado sem consultar o plano mobile.
