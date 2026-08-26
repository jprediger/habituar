# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); o
versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## Como escrever uma entrada

- **Uma entrada por mudança percebida por alguém.** Refatoração interna que não muda
  comportamento não entra.
- Escrita para quem **usa**, não para quem escreveu o código. Sem hash de commit, sem
  nome de arquivo.
- Prefixe com o workspace afetado: `[api]`, `[web]`, `[mobile]`, `[core]`, `[infra]`.
  Uma mudança que atravessa vários lista todos.
- Categorias: `Adicionado`, `Alterado`, `Corrigido`, `Removido`, `Depreciado`,
  `Segurança`.
- **Mudança que afeta compatibilidade da API é obrigatória aqui.** Builds antigos do app
  conversam com a API por semanas após cada release (D15) — este arquivo é o registro de
  o que eles ainda podem esperar.
- Entrada de segurança descreve o impacto e a versão corrigida, nunca como explorar.

## [Não publicado]

### Adicionado
- `[infra]` Regras de desenvolvimento, política de acessibilidade e guia de contribuição.
- `[infra]` D4 fecha o backend em **NestJS**, registra as alternativas avaliadas (Hono,
  Fastify, Nitro, Hapi, tRPC) e define o contrato da API declarado em `packages/core`
  com `@ts-rest/nest`.
- `[infra]` `CLAUDE.md` reexpresso no idioma do Nest: DI e decorators deixam de ser
  banidos; herança de provider, `forwardRef`, `class-validator` e CQRS prematuro
  continuam fora.
