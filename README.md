# Habituar

Plataforma web e mobile para apoiar a rotina de estudantes e o trabalho dos profissionais
que os acompanham. O projeto está no marco M0: a fundação do monorepo está pronta, mas as
aplicações ainda não foram inicializadas.

## Estrutura atual

```text
habituar/
├── apps/
│   ├── api/                 # workspace reservado para NestJS
│   ├── mobile/              # workspace reservado para Expo Router
│   └── web/                 # workspace reservado para Vite + React
├── packages/
│   ├── config/              # presets compartilhados de TypeScript e ESLint
│   ├── core/                # workspace reservado para domínio, contratos e hooks
│   └── design-tokens/       # workspace reservado para tokens visuais
├── .github/workflows/ci.yml # validação automática
├── pnpm-workspace.yaml      # definição dos workspaces
└── turbo.json               # pipeline de lint, tipos e testes
```

Neste estágio, `apps/*`, `packages/core` e `packages/design-tokens` possuem apenas seus
manifests. O código de aplicação será introduzido nas próximas etapas do M0.

## Requisitos

- Node.js 22.23.2
- pnpm 10.33.0

Com `nvm`, use `nvm use`. O pnpm está fixado pelo campo `packageManager` do projeto.

## Primeiros comandos

```bash
pnpm install --frozen-lockfile
pnpm check
```

Comandos disponíveis na raiz:

- `pnpm lint`: executa o lint dos workspaces.
- `pnpm typecheck`: verifica os tipos.
- `pnpm test`: executa os testes.
- `pnpm check`: executa lint, typecheck e testes pelo Turborepo.
- `pnpm check:affected`: verifica somente os workspaces afetados.
- `pnpm test:boundaries`: prova que imports e construções proibidos são recusados.

## Fronteiras já impostas

O pacote compartilhado não aceita dependências de framework, UI ou aplicações. As
fixtures negativas verificam, entre outros casos, que `react-native`, `@nestjs/common`,
imports de `apps/*`, decorators de classe e acesso ao DOM falham pelo motivo esperado.

O CI executa essas provas em toda mudança, usa o filtro de afetados em pull requests e
valida o padrão Conventional Commits.

## Documentação

- [Descrição do produto](project-description.md)
- [Arquitetura](ARCHITECTURE.md)
- [Plano de implementação](implementation-plan.md)
- [Regras de desenvolvimento](CLAUDE.md)
- [Guia de contribuição](CONTRIBUTING.md)
- [Acessibilidade](ACCESSIBILITY.md)
