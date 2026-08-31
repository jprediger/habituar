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
- `[infra]` O CI pré-carrega o PostgreSQL 18 e executa as provas de isolamento sem o
  container auxiliar Ryuk, desnecessário no runner efêmero.
- `[api]` A suíte prova em PostgreSQL real que uma instituição não lê nem escreve linhas
  de outra, mesmo ao tentar burlar a query ou desligar a RLS.
- `[api]` Todo acesso ao banco passa por uma transação que instala instituição, ator e
  sessão; a tabela-sonda do M0 força RLS e falha fechada sem contexto de tenant.
- `[api]` O ambiente local ganha PostgreSQL 18 com roles separados para migração e
  aplicação; o processo da API usa um role não-dono desde a primeira conexão.
- `[core]` O catálogo fechado de falhas é declarado uma vez no contrato compartilhado
  (`.errors()`) e herdado por toda procedure; código de falha fora do catálogo é erro de
  compilação, não resposta errada em produção.
- `[api]` `Database.withTenant` lê a instituição, o ator e a sessão do contexto da
  requisição em vez de recebê-los por parâmetro; passar um tenant arbitrário exige o
  método `withTenantOutsideRequest`, reservado a jobs e workers fora de uma requisição.
- `[api]` Um único logger (`pino`) cobre boot e requisição, com `LOG_LEVEL` realmente
  aplicado e destino sobreponível por teste.
- `[core]` Falhas esperadas passam a usar um catálogo fechado de códigos e uma união de
  resultado que separa sucesso de falha sem lançar exceções.
- `[core]` Uniões fechadas ganham uma proteção exaustiva que também interrompe payloads
  com variantes inesperadas em runtime.
- `[api]` Cada resposta e linha de log HTTP compartilha um `correlationId`, preservado
  durante todo o fluxo assíncrono da requisição.
- `[api]` A API passa a negar por padrão toda rota que não se declare pública; no M0,
  somente `GET /v1/health` permanece acessível sem autenticação.
- `[api]` O serviço valida e tipa a configuração de ambiente no boot; ausência da URL
  do banco ou porta inválida impede a API de aceitar tráfego, e a rota de saúde expõe a
  versão configurada da aplicação.
- `[infra]` O monorepo passa a ser **ESM em todos os workspaces**, sobre **NestJS 12** e
  **oRPC**, com **zod 4**. A decisão anterior fixava CommonJS porque o ESM do Nest era
  alpha; o que de fato prendia o app na versão 11 era o peer do `@ts-rest/nest`, que não
  publica desde junho de 2025. O `@orpc/nest` mantém a verificação do contrato em
  compilação — e contrato implementado pela metade passa a ser erro de `tsc`, não de
  runtime. `packages/core` deixa de precisar de build dual. O SWC permanece obrigatório:
  `emitDecoratorMetadata` é problema de decorator, não de formato de módulo.
- `[api]` Log correlacionado passa a usar `pino` e `pino-http` diretos. O `nestjs-pino`
  fica de fora: trava em NestJS 11 e não compraria complexidade material sobre o
  middleware que o contexto de requisição já exige.
- `[api]` `GET /v1/health` responde `{ status, version }`. É a primeira rota do serviço,
  implementada a partir do contrato compartilhado — retorno fora do schema declarado é
  erro de compilação, e não resposta errada em produção.
- `[core]` Contrato da API em zod, com o prefixo de versão `/v1` definido num lugar só.
  `apps/api` o implementa; os clientes o consomem como tipo.
- `[infra]` Regras de desenvolvimento, política de acessibilidade e guia de contribuição.
- `[infra]` D4 fecha o backend em **NestJS**, registra as alternativas avaliadas (Hono,
  Fastify, Nitro, Hapi, tRPC) e define o contrato da API declarado em `packages/core`.
- `[infra]` `CLAUDE.md` reexpresso no idioma do Nest: DI e decorators deixam de ser
  banidos; herança de provider, `forwardRef`, `class-validator` e CQRS prematuro
  continuam fora.

### Alterado
- `[api]` A borda HTTP responde toda falha — declarada no contrato, rota negada pelo guard
  ou rota inexistente — com o mesmo envelope de erro do oRPC; só a exceção inesperada foge
  do catálogo, e continua oculta atrás de um `correlationId`. Antes, só a exceção não
  tratada respeitava o catálogo fechado; guard e rota inexistente respondiam com o corpo
  default do Nest.
- `[api]` `TenantContext` usa strings cruas apenas no M0; os branded types de instituição,
  ator e sessão entram no M1, quando existirem os identificadores concretos.
- `[api]` A tabela `tenant_probe` é uma prova descartável de RLS e será removida na
  primeira migração do M1, antes de qualquer release ou dado de produção.

### Segurança
- `[api]` `authorization` e `cookie` nunca chegam ao log: são removidos na origem, dentro
  do próprio processo, e não apenas mascarados no coletor.
