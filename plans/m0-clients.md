# M0 — Clientes: índice e decisões compartilhadas

> Índice do marco: [`m0-overview.md`](m0-overview.md) · Arquitetura:
> [`../ARCHITECTURE.md`](../ARCHITECTURE.md) · Acessibilidade:
> [`../ACCESSIBILITY.md`](../ACCESSIBILITY.md)
>
> Planos executáveis: [`m0-react-client.md`](m0-react-client.md) ·
> [`m0-web.md`](m0-web.md) · [`m0-mobile.md`](m0-mobile.md)

Escopo: provar o encanamento de `GET /v1/health` nos dois clientes. Uma tela por app, sem
login, domínio, CRUD ou design system de componentes.

## Dependências

```text
@habituar/core ───────────────► apps/api
       ▲
       │
@habituar/react-client
       ▲              ▲
       │              │
   apps/web       apps/mobile
```

Web e mobile dependem de `react-client` e dos tokens, mas não dependem um do outro. Depois
dos pré-requisitos compartilhados, podem ser implementados, testados e revisados em
sessões ou branches diferentes.

## Decisões comuns

- `@habituar/core` contém apenas contrato, schemas, falhas e tipos puros.
- `@habituar/react-client` esconde oRPC, TanStack Query, query keys, cache, repetição e
  tradução para estados discriminados. Não contém UI nem lê ambiente.
- Cada app cria uma instância com `createHabituarReactClient({ origin })` e monta o
  `Provider` retornado. Não existe singleton global nem reset exclusivo de teste.
- `origin` é HTTP(S), absoluta e sem `/v1`; o contrato já declara o prefixo.
- Configuração inválida falha sincronamente. Rede, HTTP ou resposta inválida produzem
  estado recuperável `failed`, sem detalhe técnico na UI.
- Health não repete automaticamente. `retry()` inicia nova consulta e retorna a
  `loading`; o botão aparece somente em `failed`.
- Os dois apps cobrem `loading`, `ready`, `failed` e retry. As asserções específicas de
  plataforma divergem.
- UI é separada. A coerência vem da mesma hierarquia de informação e de tokens
  semânticos, não de componentes compartilhados.
- Tema claro/escuro segue a preferência do sistema; não existe seletor no M0.
- Texto de usuário é pt-BR via catálogo i18n próprio de cada app.
- `minimumTouchTarget: 44` é token semântico compartilhado.

## Origem por ambiente

| Ambiente    | Web                                                                  | Mobile                                                  |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Local       | `window.location.origin`; Vite encaminha `/v1` para `localhost:8080` | `EXPO_PUBLIC_API_ORIGIN` obrigatória                    |
| Homologação | origem pública da SPA                                                | mesma origem pública, embutida na configuração do build |
| Produção    | origem pública da SPA                                                | mesma origem pública, embutida na configuração do build |

Em produção, uma única origem pública serve a SPA e encaminha `/v1/*` ao container da API.
O mobile chama essa origem diretamente. Banco e segredos são separados entre local,
homologação e produção; a escolha do fornecedor não pertence ao M0.

## Fora do escopo

- Cookies ou Bearer token: entram no M1, quando existir sessão real.
- Playwright, Maestro, EAS Build e publicação em loja.
- Componentes compartilhados, seletor manual de tema e design system.
- `AccessibilityInfo` preventivo sem movimento ou comportamento consumidor.
- Um pacote `api-client` separado: será extraído somente se surgir consumidor sem React.

## Pronto quando

- O tipo `HealthStatus` nasce no contrato e chega aos dois apps sem duplicação.
- Web e mobile executam a mesma máquina de estados pela interface do `react-client`.
- Cada app passa seus próprios comandos e critérios documentados.
- A configuração local funciona no navegador, em emulador Android e em Android físico.
- `pnpm check` e `expo-doctor` ficam verdes num checkout limpo.
