# Habituar

Plataforma web e mobile para apoiar a rotina de estudantes e o trabalho dos profissionais
que os acompanham. O projeto está no marco M0: um esqueleto executável ponta a ponta, sem
regra de negócio. Os três apps sobem e mostram o mesmo `HealthStatus`, inferido do mesmo
contrato zod.

## Estrutura atual

```text
habituar/
├── apps/
│   ├── api/                 # NestJS + Drizzle, com a borda já endurecida
│   ├── mobile/              # Expo Router + React Native
│   └── web/                 # Vite + React + Tailwind
├── packages/
│   ├── config/              # presets compartilhados de TypeScript e ESLint
│   ├── core/                # domínio, contratos, schemas e tipos puros
│   ├── react-client/        # cliente e hooks React compartilhados, sem UI
│   └── design-tokens/       # tokens visuais, com contraste verificado por teste
├── .github/workflows/ci.yml # validação automática
├── pnpm-workspace.yaml      # definição dos workspaces
└── turbo.json               # pipeline de build, lint, tipos e testes
```

Web e mobile não compartilham componente: compartilham `react-client` (dados, estados e
ações) e `design-tokens` (cor, espaço, tipografia). Cada plataforma decide só o visual.

## Requisitos

- Node.js 22.23.2
- pnpm 10.33.0
- Docker, para o PostgreSQL local e para os testes de isolamento

Com `nvm`, use `nvm use`. O pnpm está fixado pelo campo `packageManager` do projeto.

## Primeiros comandos

```bash
pnpm install --frozen-lockfile
pnpm check
```

Comandos disponíveis na raiz:

- `pnpm lint`: executa o lint dos workspaces.
- `pnpm build`: constrói os pacotes compartilhados e o bundle do web.
- `pnpm typecheck`: verifica os tipos.
- `pnpm test`: executa os testes.
- `pnpm check`: executa lint, typecheck e testes pelo Turborepo.
- `pnpm check:affected`: verifica somente os workspaces afetados.
- `pnpm test:boundaries`: prova que imports e construções proibidos são recusados.

## Rodando a API localmente

O único serviço em container é o PostgreSQL. A API roda como processo Node — Dockerfile e
deploy estão fora do M0, com o motivo registrado na seção *Fora do M0* de
[`plans/m0-api.md`](plans/m0-api.md).

```bash
cp apps/api/.env.example apps/api/.env     # o .env não é versionado
pnpm --filter @habituar/api db:up          # sobe o postgres e espera ficar saudável
pnpm --filter @habituar/api db:migrate     # aplica as migrações pendentes
pnpm turbo run dev --filter @habituar/api  # nest em watch, recompilando com swc
```

O `.env.example` traz valores que só servem a desenvolvimento. Duas variáveis merecem
atenção porque não são a mesma credencial por desenho:

| Variável | Papel |
|---|---|
| `DATABASE_URL` | Role `habituar_app`, **não** dono das tabelas. É por onde a API fala com o banco, e é o que faz a RLS valer |
| `DATABASE_MIGRATION_URL` | Role `habituar_owner`, dono das tabelas. Usado só pelo `db:migrate` |

O `dev` passa pelo Turborepo pelo mesmo motivo dos clientes: `apps/api` importa o contrato
de `@habituar/core` pelo `dist`, que precisa existir antes.

Se a porta 3000 já estiver ocupada na sua máquina, suba com `PORT=3100 pnpm turbo run dev
--filter @habituar/api` — a porta vem de `PORT`, e a variável de ambiente vence o `.env`.

### Verificando

```bash
curl -i http://localhost:3000/v1/health
```

Responde `200` com `{"status":"ok","version":"0.0.0"}`, mais `x-correlation-id` e os
cabeçalhos de segurança (`x-content-type-options`, `x-frame-options`, `referrer-policy`).
Qualquer outro caminho responde `404` no mesmo envelope de falha do contrato:

```json
{"defined":true,"code":"not_found","status":404,"message":"The requested resource was not found."}
```

`GET /v1/health` é a única rota pública, e é liveness — não toca o banco. Toda rota nova
nasce negada pelo guard global; o 401 ainda não é alcançável porque não existe rota
autenticada, e a sessão que preenche ator e instituição é do M1.

### Banco

O `docker-compose.yml` da raiz sobe `postgres:18-alpine` na porta **5433** e executa
`apps/api/db/bootstrap.sql` na primeira criação do volume, que é o que cria os dois roles.
Alterar esse arquivo depois só tem efeito recriando o volume:

```bash
docker compose down -v && pnpm --filter @habituar/api db:up
```

Os testes não usam esse container: `pnpm test` sobe um PostgreSQL próprio e descartável
por testcontainers, então a suíte não depende do banco de desenvolvimento nem o suja.

## Rodando os clientes

Os dois apps consomem `@habituar/react-client` e `@habituar/design-tokens` pelo `dist`,
não pelo fonte. Por isso o comando passa pelo Turborepo, que constrói os pacotes
compartilhados antes de subir o app — `pnpm --filter <app> dev` pularia esse passo e
falharia num checkout limpo:

```bash
pnpm turbo run dev --filter @habituar/web      # vite em http://localhost:5173
pnpm turbo run dev --filter @habituar/mobile   # metro, para abrir no Expo Go
```

### Web

O bundle nunca conhece o endereço da API: ele chama `/v1` na própria origem. Em
desenvolvimento, o proxy do Vite encaminha `/v1` para `http://localhost:3000`, então a API
precisa estar no ar para a tela sair de *carregando*. Em homologação e produção a mesma
origem pública serve os dois, e o proxy deixa de existir.

### Mobile

O app exige uma origem explícita antes de subir, porque app nativo não tem origem própria
para herdar:

```bash
cp apps/mobile/.env.example apps/mobile/.env   # o .env não é versionado
```

| Ambiente | `EXPO_PUBLIC_API_ORIGIN` |
|---|---|
| Emulador Android | `http://10.0.2.2:3000` — `localhost` resolveria para o próprio emulador |
| Aparelho na mesma rede | `http://<IP-LAN>:3000` |

A variável não tem valor padrão: ausente, ou contendo `/v1`, o app falha antes do primeiro
render em vez de errar a URL silenciosamente em runtime.

```bash
pnpm --filter @habituar/mobile expo:doctor   # alinhamento com o SDK, rodado também no CI
```

iOS continua suportado pela estrutura Expo, mas o passe de VoiceOver ainda não aconteceu —
é bloqueante antes da primeira distribuição iOS.

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
