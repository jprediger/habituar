# Habituar

Plataforma web e mobile para apoiar a rotina de estudantes e o trabalho dos profissionais
que os acompanham. O sistema reúne uma API multi-instituição, clientes web e mobile,
autenticação, autorização tipada e contratos compartilhados entre as plataformas.

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

O único serviço em container é o PostgreSQL. A API roda como processo Node; Dockerfile e
deploy ainda não fazem parte da configuração atual.

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

Se a porta 8080 já estiver ocupada na sua máquina, suba com `PORT=8090 pnpm turbo run dev
--filter @habituar/api` — a porta vem de `PORT`, e a variável de ambiente vence o `.env`.

### Verificando

```bash
curl -i http://localhost:8080/v1/health
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
pnpm turbo run dev --filter @habituar/mobile   # metro, para o build de desenvolvimento
```

### Web

O bundle nunca conhece o endereço da API: ele chama `/v1` na própria origem. Em
desenvolvimento, o proxy do Vite encaminha `/v1` para `http://localhost:8080`, então a API
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
| Emulador Android | `http://10.0.2.2:8080` — `localhost` resolveria para o próprio emulador |
| Aparelho na mesma rede | `http://<IP-LAN>:8080` |
| Aparelho pelo adb (USB ou Wi-Fi) | `http://localhost:8080`, depois de `adb reverse tcp:8080 tcp:8080` |

A variável não tem valor padrão: ausente, ou contendo `/v1`, o app falha antes do primeiro
render em vez de errar a URL silenciosamente em runtime. Ela entra no bundle quando o
Metro sobe, então trocar o `.env` pede reiniciar o Metro com `--clear`.

O app roda num build de desenvolvimento (`expo-dev-client`), não no Expo Go. O Expo Go
traz um nativo fixo: ignora os plugins do `app.json` — identidade do pacote, `scheme` de
deep link, splash, barra de navegação, configuração de notificações — e só acompanha o
SDK mais recente. Testar lembrete de rotina nele não diz nada sobre o app real.

O build nativo é compilado e instalado no aparelho ou emulador visível ao `adb`:

```bash
pnpm turbo run build --filter @habituar/mobile^...   # pacotes compartilhados no dist
pnpm --filter @habituar/mobile android:build          # compila, instala e sobe o Metro
```

Ele só precisa ser refeito quando muda algo nativo: dependência com código nativo, plugin
ou configuração nativa no `app.json`, versão do SDK. Fora disso, basta subir o Metro com
`pnpm turbo run dev --filter @habituar/mobile` e abrir o app já instalado.

```bash
pnpm --filter @habituar/mobile expo:doctor   # alinhamento com o SDK, rodado também no CI
```

iOS continua suportado pela estrutura Expo, mas o passe de VoiceOver ainda não aconteceu —
é bloqueante antes da primeira distribuição iOS.

## Ambiente live

Ambiente de desenvolvimento alcançável de qualquer rede: a API roda em contêiner com banco
próprio, e um túnel ngrok a publica em HTTPS. O `compose.live.yml` é um projeto separado
(`habituar-live`) e convive com o `docker-compose.yml` de desenvolvimento sem disputar
porta, volume ou dados.

O túnel usa o domínio estático gratuito da conta ngrok, não um endereço aleatório. A origem
da API fica gravada no APK, e uma URL que muda a cada restart obrigaria a refazer o app.

```bash
cp .env.live.example .env.live   # preencher domínio, authtoken e as duas senhas
docker compose -f compose.live.yml --env-file .env.live up -d --build
```

O `up` aplica as migrações, roda os seeds de admin e de dados de exemplo (idempotentes, a
cada subida) e só então libera a API e o túnel. A API sobe com `NODE_ENV=development`,
porque o seed de exemplo recusa produção. Por isso `DEV_SEED_PASSWORD` é obrigatória: o
ambiente é público, e a senha do `.env.example` está no repositório. Ela vale para o
`admin@habituar.dev` e para todos os usuários de exemplo.

| Endereço | O quê |
|---|---|
| `https://<NGROK_DOMAIN>/v1/health` | API pelo túnel, de qualquer rede |
| `http://127.0.0.1:8090/v1/health` | A mesma API direto no host (`API_HOST_PORT`) |
| `http://127.0.0.1:4040` | Inspetor do ngrok; só no loopback porque mostra corpo de requisição |

O Postgres não publica porta no host. Para inspecionar, use
`docker compose -f compose.live.yml exec postgres psql -U postgres habituar`. Para zerar o
ambiente, `down -v` no mesmo arquivo apaga banco e arquivos enviados.

### APK apontando para o ambiente live

```bash
EXPO_PUBLIC_API_ORIGIN=https://<NGROK_DOMAIN> pnpm --filter @habituar/mobile android:apk:live
```

Gera um APK release com o JavaScript embutido: não precisa de Metro nem do computador na
mesma rede. A origem é exigida no shell, não lida do `apps/mobile/.env`, que aponta para o
emulador ou para a rede local. Ao final, o script confere que a origem entrou no bundle e
imprime o caminho do APK (`android/app/build/outputs/apk/release/app-release.apk`). Ele pode
ser instalado com `adb install -r` ou enviado ao aparelho como arquivo.

A build compila o nativo só para `arm64-v8a` (todo aparelho físico atual) com 2 workers e
prioridade baixa, porque a build completa em paralelo congela a máquina. Se sobrar fôlego,
`GRADLE_WORKERS=4` acelera. O APK não roda em emulador x86.

O APK live usa `com.jprediger.habituar`. A build de desenvolvimento usa
`com.jprediger.habituar.dev` e aparece como **Habituar Dev**. As duas podem ficar
instaladas no mesmo aparelho. A instalação de desenvolvimento antiga, que ainda usa
`com.jprediger.habituar`, continua separada; após conferir a nova build, você pode
removê-la pelo Android.

## Fronteiras já impostas

O pacote compartilhado não aceita dependências de framework, UI ou aplicações. As
fixtures negativas verificam, entre outros casos, que `react-native`, `@nestjs/common`,
imports de `apps/*`, decorators de classe e acesso ao DOM falham pelo motivo esperado.

O CI executa essas provas em toda mudança, usa o filtro de afetados em pull requests e
valida o padrão Conventional Commits.

## Documentação

- [Conceitos do sistema](docs/README.md)
- [Documentação consolidada](DOCUMENTACAO.md)
- [Documento oficial](documentacao_habituar.docx)
- [Arquitetura](ARCHITECTURE.md)
- [Regras de desenvolvimento](CLAUDE.md)
- [Guia de contribuição](CONTRIBUTING.md)
- [Acessibilidade](ACCESSIBILITY.md)
- [Histórico de mudanças](CHANGELOG.md)
