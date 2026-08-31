# Habituar — Arquitetura

> Especificação de arquitetura. Rever antes de escrever qualquer código.
> Produto: `project-description.md` · Execução: `implementation-plan.md`

## Princípio orientador

Nem toda decisão merece o mesmo esforço. A disciplina aqui é separar:

- **Portas de mão única** — caras ou impossíveis de reverter com dados em produção.
  Modelo de multi-tenancy, modelo de dados, modelo de autenticação, versionamento de API,
  auditoria. Estas são decididas para escalar, agora.
- **Portas de mão dupla** — baratas de reverter. Framework HTTP, ORM, hospedagem, cache,
  UI. Estas são otimizadas para **entregar**, não para escalar.

Projetar tudo para escala infinita é como projetos morrem antes de existir. Projetar as
portas de mão única errado é como projetos morrem depois.

---

## Registro de decisões

| # | Decisão | Escolha |
|---|---|---|
| D1 | Paridade entre plataformas | Todas as personas em mobile e web |
| D2 | Camada de UI | Separada por plataforma; lógica compartilhada |
| D3 | Mobile | Nativo (Expo), não PWA |
| D4 | Backend | TypeScript — NestJS + Drizzle + zod |
| D5 | Repositório | Monorepo único (pnpm + Turborepo) |
| D6 | Autenticação | Sessões opacas no servidor (padrão Lucia) |
| D7 | Tenancy | SaaS multi-instituição |
| D8 | Isolamento | Schema compartilhado + RLS `FORCE` |
| D9 | Autorização | Papel × atribuição, catálogo fechado de permissões |
| D10 | Métricas | Definições + colunas de valor tipadas + alvos |
| D11 | Auditoria | Triggers + GUC; escritas e leituras sensíveis |
| D12 | Acessibilidade | WCAG 2.2 AA em CI + regras cognitivas |
| D13 | Offline | Cache persistido + fila de mutations |
| D14 | Notificações | Locais agendadas + push do servidor |
| D15 | Versionamento de API | `/v1` na URL, evolução aditiva |
| D16 | Relatórios | Geração em worker, fora do request |

---

## D1 — Paridade total entre plataformas

Todas as personas usam mobile **e** web, com o mesmo conjunto de telas.

**Custo assumido:** cada tela é construída duas vezes, e a acessibilidade é feita duas
vezes em duas APIs distintas (ver D12). Este é o custo mais alto de toda a arquitetura e
é aceito conscientemente.

## D2 — Lógica compartilhada, UI separada por plataforma

Em vez de uma camada de UI única via React Native Web, o projeto separa:

- **Domínio e lógica dos clientes (compartilhados):** validação e tipos permanecem puros;
  hooks, chamadas de API e estado ficam num módulo React headless. Nenhum deles contém
  referência visual — nada de `View`, nada de `div`.
- **UI (por plataforma):** cada plataforma monta sua própria árvore de componentes,
  idiomática ao seu ambiente — gestos e navegação nativa no mobile; HTML semântico,
  grids, hover e foco de teclado no web.

Consistência visual vem de **design tokens**, não de componentes compartilhados.

A lógica compartilhada dos clientes ocupa um módulo próprio, `@habituar/react-client`.
Ele é **headless**: esconde o cliente oRPC, TanStack Query, cache, política de repetição e
conversão para estados discriminados, mas não conhece DOM, React Native, navegação,
componentes ou variáveis de ambiente. Cada app cria uma instância com uma factory e monta
o `Provider` retornado; não existe singleton global configurável.

`@habituar/core` permanece puro e utilizável pela API: contratos, schemas, falhas e tipos.
Separar hooks apenas por subpath não bastaria, porque o manifesto, o build e os testes do
pacote ainda dependeriam de React. Um pacote `api-client` adicional também fica fora por
ora: sem consumidor não React, seria uma seam hipotética sobre um único transporte.

O `react-client` passa no *deletion test*: removê-lo espalharia cliente HTTP, query keys,
cache, transições de estado e políticas de falha por web e mobile. Sua interface pequena
compra comportamento compartilhado real; não é apenas organização de arquivos.

**Por quê:** React Native Web sempre cobra compromissos de CSS/layout (flex-only, grids
complexos, hover, nuances de desktop) — e esses compromissos doem exatamente nas telas
mais pesadas do produto: tabelas de fichas e relatórios. O que é caro de duplicar é
lógica de negócio, não layout.

## D3 — Mobile nativo (Expo), não PWA

Um PWA daria paridade total com um único código e eliminaria o monorepo inteiro. Foi
rejeitado por um fato técnico decisivo:

> **Notificações locais agendadas não existem na Notifications API da web.**

Um PWA não consegue disparar "lembrar às 14h" sozinho — precisa de round-trip por push do
servidor, e no iOS só depois de o usuário ter adicionado manualmente à tela de início
(não existe prompt de instalação). Para um produto cujo valor central é lembrar
estudantes com TDAH, isso é regressão na única feature que mais importa.

## D4 — Backend em TypeScript: NestJS + Drizzle + zod

**Por que TypeScript e não Go** (ainda que Go seja o stack de backend já dominado):

A justificativa **não** é performance. Nesta carga, Go e Node são igualmente
irrelevantes — o gargalo é o Postgres. A justificativa é o número de sistemas de tipos:

> Um sistema de tipos para três consumidores, em vez de dois sistemas para três
> consumidores.

`FichaSchema` é definido uma vez em `packages/core` e é o **mesmo objeto** que valida o
formulário no Expo, o formulário no Vite e o corpo da requisição no handler. Com Go, a
definição de "o que é uma ficha válida" existe duas vezes, em duas linguagens, sem nada
garantindo que concordem. Esse argumento **fortalece** com escala, não enfraquece.

**Por que NestJS:** a razão é a equipe. O time trabalha melhor orientado a objetos, e
fluência de quem escreve vence elegância de arquitetura num projeto que precisa chegar a
estudantes reais no M4. Framework opinativo com convenções prontas deixa de ser peso e
vira ativo quando há mais de uma pessoa commitando.

Somam-se três encaixes concretos com decisões já tomadas:

- **Negar por padrão vira configuração, não disciplina.** Um `APP_GUARD` global exige
  sessão e permissão em toda rota; pública é quem se declara pública. O D9 pede
  exatamente isso, e nenhum framework minimalista entrega sem código próprio.
- **`@nestjs/bullmq`** é integração de primeira classe para o worker de PDF do D16.
- **Interceptors** dão um ponto único para correlação de log e contexto de auditoria.

**A objeção antiga caiu.** Este registro dizia que o NestJS "estruturalmente atrapalha"
o D4, porque sua validação idiomática são DTOs com `class-validator` em vez de zod. Isso
continua verdade **do caminho idiomático** — e por isso ele não é usado aqui. O contrato
zod vive em `packages/core` e chega ao Nest pelo contrato oRPC. DTO com
`class-validator` ou um segundo pipe de validação é proibido: seria outra definição de
validade, exatamente o que o D4 existe para evitar.

**Por que Drizzle e não Prisma:** o Prisma 7 removeu o motor em Rust (cliente puro TS,
bundle de ~14MB para ~1.6MB, ~3x mais rápido) — os argumentos antigos contra ele estão
obsoletos. O que resta é filosofia: Prisma é schema-first com DSL própria e codegen;
Drizzle é code-first e o query builder mapeia perto do SQL. Coerente com a preferência
já estabelecida por SQL explícito, e importante para as consultas de agregação de
métricas.

**Escape hatch:** não se supera Node por causa da linguagem — supera-se em caminhos
quentes específicos. Aqui, o candidato é geração de PDF (CPU-bound). A saída é extrair
esse job para um worker em fila, que pode ser escrito em Go. O monorepo não impede isso.

### Alternativas avaliadas

| Candidato | Por que perdeu |
|---|---|
| **Hono** | Foi a escolha registrada até esta revisão. Minimalista, sem mágica, e o cliente RPC (`hc`) dava typecheck ponta a ponta sem codegen. Perde por dois motivos: o `hc` obrigava `packages/core` a importar tipo de `apps/api`, invertendo a direção da dependência; e o argumento "sem DI, sem decorators" deixou de valer quando a equipe assumiu OOP. |
| **Fastify** | Empate técnico apertado com o Hono. Ergonomia superior de processo longo e log estruturado com pino embutido. Perde pelo mesmo motivo: nada disso decide, e ele não resolve a preferência de paradigma. |
| **Nitro** | Cobra complexidade por portabilidade de deploy que este projeto **recusa** — o alvo é um container fixo com Postgres gerenciado. Roteamento por sistema de arquivos briga com fatia vertical, e auto-imports contradizem a regra de import explícito. |
| **Hapi** | Modelo de autenticação bom (`auth.default` torna *negar por padrão* configuração), mas os tipos vêm do DefinitelyTyped e **não fluem da validação para o handler**: usar o corpo validado exige `as` ou um tipo escrito à mão espelhando o schema. O Nest entrega a mesma garantia de autorização sem esse custo. |
| **tRPC** | Camada de contrato, não framework. Abandona semântica REST, que o D15 e integrações futuras exigem. |

### Contrato da API: oRPC em `packages/core`

O contrato — rotas, métodos, schemas de request e response — é **declarado em
`packages/core`**, em zod. `apps/api` o implementa via `@orpc/nest`; o
`@habituar/react-client` o consome pelo `OpenAPILink`.

```
packages/core/contract/
        ├──► apps/api                 implementa (verificado em compilação)
        └──► packages/react-client    consome pelo OpenAPILink
                    ├──► apps/web
                    └──► apps/mobile
```

Três propriedades, e todas foram exigência de alguma decisão anterior:

- **Todas as setas apontam para dentro.** Nenhuma exceção no `eslint-plugin-boundaries`.
  O contrato não conhece o framework, então trocar de framework não toca nele.
- **O servidor é verificado contra o contrato**: rota não implementada e retorno fora do
  schema declarado são erro de compilação, não bug de produção.
- **OpenAPI sai do mesmo contrato**, para documentação externa e para congelar o que cada
  versão prometeu (D15).

O `openapi.json` é commitado, e o CI falha se ele mudar sem estar no PR — mudança de
contrato precisa ser diff revisável, não saída de build.

Alternativa descartada: o RPC do Hono (`hc`), que derivava o contrato da implementação em
vez de declará-lo. Fidelidade de tipo maior — branded types atravessam, o que não
acontece via OpenAPI — mas ao preço da inversão de dependência e do acoplamento ao
framework.

**Consequência aceita — a porta do Go fecha.** O contrato em zod é TypeScript. O escape
hatch do worker de PDF continua valendo; o backend, não.

## D5 — Monorepo único

```
habituar/
├── apps/
│   ├── mobile/          # Expo + Expo Router
│   ├── web/             # Vite + React + Tailwind + shadcn/Radix
│   └── api/             # NestJS + Drizzle
├── packages/
│   ├── core/            # contratos, schemas zod, falhas e tipos — sem framework
│   ├── react-client/    # transporte, cache, estados e hooks React — sem UI
│   ├── design-tokens/   # cores, espaçamento, tipografia (não componentes)
│   └── config/          # eslint, tsconfig, boundaries
├── turbo.json
└── package.json
```

**Ferramenta:** pnpm workspaces + Turborepo. **Não Nx** — a documentação oficial do Expo
recomenda workspaces de pnpm/yarn/npm/bun e não menciona Nx; há issues documentados de
builds EAS quebrando em monorepos com Nx. Migrar de Turborepo para Nx depois é mais
simples que o inverso.

**Por que a API entra no mesmo repo:** o custo do monorepo vem do Expo + Metro, e já
seria pago por `apps/mobile` + `packages/core`. O custo marginal de somar `apps/api` é
próximo de zero; o benefício é o zod compartilhado com o servidor — a razão inteira de D4.

Vale notar que "small team" não é a variável real: Google e Meta também usam monorepo.
A variável é **se as mesmas pessoas fazem mudanças que atravessam fronteiras, e se as
fronteiras ainda estão se movendo**. Aqui, ambas verdadeiras.

### Armadilhas conhecidas do Expo em monorepo

- Versões duplicadas de React ou React Native **não são suportadas**; módulos Expo
  duplicados quebram build ou runtime. Fixar singletons.
- pnpm com linker isolado só é suportado a partir do SDK 54; em caso de problema, usar
  `nodeLinker: hoisted` no `pnpm-workspace.yaml`.
- Desde o SDK 52, Metro detecta o monorepo; não configurar `watchFolders` ou caminhos de
  resolução manualmente. Manter `.watchmanconfig` na raiz observada.
- Symlinks do pnpm quebram no Windows sem Developer Mode — **não afeta este projeto**,
  que roda em WSL2 no filesystem Linux (`/home/...`, não `/mnt/c`).

### Regras de organização — impostas por lint, não por documentação

- `packages/core` **não pode** importar React, `react-native` nem tocar no DOM.
- `packages/core` **não importa de `apps/*`**. Sem exceção: o contrato mora em `core`, e é
  a API que depende dele (D4).
- `packages/react-client` depende de `core`, pode importar React e TanStack Query, mas não
  importa DOM, React Native, Expo ou `apps/*`.
- `apps/web` e `apps/mobile` consomem `react-client`; cada app monta sua própria árvore
  visual e resolve sua própria configuração de ambiente.
- Código específico de plataforma dentro de pacote compartilhado usa sufixos
  `.native.ts` / `.web.ts`, isolado o quanto antes.

> Estas regras só são reais se algo as impuser. `eslint-plugin-boundaries` (ou
> `dependency-cruiser`) falhando o CI é a proteção de maior alavancagem de toda a
> arquitetura. Documentação não impede o import das 2h da manhã.

**Monorepo ≠ monolito.** `apps/api` continua deployável em seu próprio ritmo. Isso
importa: mobile passa por revisão de loja (dias), a API sobe em minutos — versões
antigas do app continuarão chamando a API por semanas (ver D15).

## D6 — Sessões opacas no servidor, não JWT

A biblioteca Lucia foi descontinuada em março de 2025 e virou material de referência —
"Lucia-style" é o **padrão**, não uma dependência. São ~150 linhas próprias.

```
sessions
  id           text pk        -- SHA-256 do token, NUNCA o token
  user_id      uuid references users(id) on delete cascade
  expires_at   timestamptz
```

Login verifica senha com **argon2id**; gera ~32 bytes de CSPRNG; guarda o **hash** do
token (vazamento do banco não rende sessões utilizáveis); valida por hash a cada
requisição; expiração deslizante; logout apaga a linha.

**Por que não JWT:** JWT não é revogável sem uma blocklist no servidor — que reintroduz a
consulta ao banco que era o argumento a favor dele. Aqui:

- acesso de um profissional a registros sensíveis precisa morrer **agora**, não no expiry;
- a consulta extra é um lookup por PK, e já se consulta o Postgres na mesma requisição;
- papéis mudam (monitor → profissional), e JWT carrega o papel velho até expirar;
- a auditoria LGPD precisa de identidade estável, revogável e correlacionável.

**Escape hatch em escala:** cache de sessão em Redis, ou access token curto respaldado por
refresh token em linha de sessão. Ambos aditivos — não reescrevem a autenticação.

**Dois transportes, uma tabela:** web usa cookie `httpOnly; Secure; SameSite=Lax`; mobile
usa `expo-secure-store` com `Authorization: Bearer`. O middleware checa cookie e cai para
header.

## D7/D8 — Multi-instituição com isolamento no banco

`institution_id` em todas as tabelas desde a primeira migração. Retrofit de tenancy sobre
dados vivos é uma das piores migrações que existem; o custo agora é ~5%.

**Isolamento: schema compartilhado + RLS.** Schema-per-tenant é armadilha (N migrações por
deploy, drift entre schemas, overhead de pool). Database-per-tenant só se compensa com
poucos tenants de alto valor.

```sql
BEGIN;
SELECT set_config('app.institution_id', $1, true);  -- true = escopo de transação
-- consultas aqui são filtradas automaticamente pela RLS
COMMIT;
```

Três detalhes decidem se isso realmente segura:

1. **`FORCE ROW LEVEL SECURITY`**, não apenas `ENABLE` — senão o dono da tabela ignora
   toda política silenciosamente.
2. **A aplicação conecta como role não-dono.** Assim não existe *nenhum* caminho —
   nem job em background, nem query de relatório, nem migração escrita à mão — capaz de
   vazar entre instituições.
3. **Todo acesso passa por `withTenant()`**, um wrapper de transação. `SET LOCAL` reseta
   ao fim da transação, então conexão em pool não carrega contexto para a próxima
   requisição.

> A pior falha possível deste sistema é o registro clínico de um menor de uma escola
> aparecer na tela de outra. Vazamentos não vêm da camada de repositório bem revisada —
> vêm do gerador de relatório escrito às pressas. Por isso a garantia é estrutural.

## D9 — Autorização: papel × atribuição, com permissões editáveis

**Permissões são código. Papéis são dados.**

Um admin de instituição **compõe** papéis a partir de um catálogo fechado; não pode
**inventar** capacidades — uma permissão só significa algo se existe um call site a
verificando.

```
permissions        key ('ficha.read', 'observation.write', …), sensitive boolean
roles              id, institution_id, name, is_system, cloned_from
role_permissions   role_id, permission_key, scope ('own'|'assigned'|'institution')
memberships        user ↔ institution ↔ role
assignments        staff ↔ (student | group)
```

A coluna `scope` funde as duas dimensões: `ficha.read@assigned` para um monitor,
`ficha.read@institution` para um coordenador. Uma permissão, escopos diferentes.

### Proteções contra escalonamento de privilégio

1. Catálogo fechado — sem inventar permissões.
2. **Não se concede o que não se possui.**
3. Papel novo precisa **clonar um template** e então ser modificado.
4. Hierarquia — só se atribui papel de nível igual ou inferior ao próprio.
5. Admin da plataforma é invisível aos tenants e **não possui** leitura de ficha.
6. Toda mudança de permissão é auditada (ator, alvo, antes/depois).

A regra 2 sustenta o resto por causa de um padrão: o template `institution_admin` **não
inclui `observation.read`**. Logo o admin pode montar qualquer papel e ainda assim é
incapaz de distribuir acesso a anotações clínicas — porque ele próprio não o tem. Dar
ambos a uma pessoa é possível, mas vira ato deliberado e registrado.

**UX:** expor **bundles** ("Pode gerenciar registros de alunos") mapeando para permissões
atômicas. Quarenta checkboxes são um gerador de configuração errada.

**Ganho de D4:** o catálogo vive em `packages/core` como union type, então
`usePermission('ficha.write')` é verificado em compilação nos dois apps e no handler.
Permissão com typo vira erro de build, não `false` silencioso.

## D10 — Métricas definidas pelo usuário

```
metric_definitions          id, institution_id, name,
                            kind ('numeric'|'scale'|'boolean'|'text'),
                            unit, min, max
metric_definition_targets   definition_id, group_id?, student_id?   -- N linhas
metric_entries              student_id, definition_id, recorded_at, recorded_by,
                            value_numeric, value_text, value_bool
                            -- CHECK: exatamente a coluna correspondente a `kind` não-nula
```

Valores numéricos ficam em colunas numéricas reais, então `AVG`, tendências e índices
funcionam — exigência direta dos relatórios, que agregam ao longo do tempo.

**Alvos:** definição **sem alvo** vale para a instituição inteira; com alvos, vale para os
grupos e/ou alunos listados. Um mecanismo cobre os três casos.

- **Alvos são resolvidos dinamicamente**, nunca materializados. Aluno entrando na turma
  3ºA herda as métricas da turma na hora, sem job de backfill.
- **Alvos governam aplicabilidade, não histórico.** Aluno que sai da turma mantém suas
  `metric_entries` — são fatos registrados. Nunca cascatear delete a partir de alvo.

Em `packages/core`, isso vira uma união discriminada por `kind` — o mesmo schema validando
o formulário mobile, o web e o handler.

**Grupos são opcionais.** Instituição que não agrupa pessoas simplesmente não cria grupos:
o schema já está correto com as tabelas vazias. O que se controla por configuração é a
**superfície de UI**, via presets de tipo de organização (profissional autônomo / clínica
/ escola), não o modelo de dados.

## D11 — Auditoria

`withTenant()` já define `app.institution_id`; estende-se para definir também
`app.actor_id` e `app.session_id`. Assim **triggers do Postgres** escrevem linhas de
auditoria totalmente atribuídas, com diff antes/depois, e **não existe caminho que
esqueça de logar** — nem relatório, nem job, nem migração manual.

- **Escritas:** todas, via trigger.
- **Leituras:** apenas quando dado do Art. 11 é servido — abrir ficha, ver observações,
  gerar relatório. Responde à pergunta que a LGPD de fato faz ("quem viu o registro de
  deficiência deste aluno, e quando") sem logar toda listagem.
- Eventos de leitura em tabela **particionada por mês**, com política de retenção — a LGPD
  também proíbe guardar indefinidamente sem justificativa.

## D12 — Acessibilidade

**Obrigatória por lei**, não por boa vontade: LBI Art. 63 exige acessibilidade digital de
empresas sediadas no Brasil e de órgãos públicos. O padrão aplicado por peritos e tribunais
é **WCAG 2.2**; para sites de governo, **eMAG**. Ações civis públicas do MPF e multas
acima de R$ 1 milhão são precedente real.

**Gate:** WCAG 2.2 AA falhando o build.
- Web: `axe-core` em CI; contrastes codificados em `design-tokens` e verificados
  programaticamente; caminhos de teclado testados. Radix/shadcn já entrega primitivos
  acessíveis.
- Mobile: `accessibilityRole` / `accessibilityLabel` / `AccessibilityInfo`, com passes
  manuais agendados de VoiceOver e TalkBack — **não existe equivalente automatizado**.

**Regras cognitivas (além da WCAG).** WCAG cobre bem o sensorial e o motor, e mal o
cognitivo — exatamente onde estão TDAH e autismo:

- sem auto-avanço e sem carrossel automático;
- sem timeout sem opção de estender;
- navegação previsível — mesma coisa no mesmo lugar, sempre;
- desfazer em toda ação destrutiva; nenhuma ação irreversível sem confirmação;
- `prefers-reduced-motion` respeitado em ambas as plataformas;
- tarefas fatiadas, com progresso visível e estimativa de tempo;
- linguagem simples em pt-BR; modo de baixo estímulo.

## D13 — Offline

TanStack Query persistido em MMKV, com mutations otimistas enfileiradas e reexecutadas na
reconexão. Conflitos aqui são triviais — last-write-wins em um checkbox está certo.
Pomodoro é local de qualquer forma.

**Por que não um sync engine local-first:** PowerSync/ElectricSQL exigem sync rules que
espelham as políticas RLS — ou seja, manter o modelo de isolamento de tenant **duas vezes,
em duas linguagens**. Para um sistema cuja pior falha é vazamento entre instituições, é
uma troca ruim.

## D14 — Notificações

- **Locais e agendadas** (`expo-notifications`) para tudo que o dispositivo já sabe:
  tarefa vencendo, bloco de rotina começando, pomodoro terminando. Dispara offline, sem
  round-trip, sem risco de entrega.
- **Push do servidor** (Expo Push) só para eventos originados em outro lugar: consulta
  agendada pelo profissional, recado de monitor.

Cuidado de implementação: reagendar notificações locais quando os dados mudam. Push exige
dev build (não Expo Go) e credenciais FCM/APNs via EAS.

## D15 — Versionamento de API

`/v1` na URL. Dentro de uma versão, **apenas mudanças aditivas** — nunca remover ou
renomear campo. Builds antigos do app conversam com a API por semanas após cada release.
Endpoint de versão mínima suportada, permitindo forçar atualização quando necessário.

## D16 — Relatórios

Geração de PDF é CPU-bound e Node é single-threaded por processo: **fora do request**, em
worker com fila. HTML → PDF via Chromium headless permite reaproveitar componentes e
estilos do app web. PDFs gerados são armazenados, e a geração é **leitura sensível** para
efeito de auditoria (D11).

---

## Estado no cliente

React Query é dono do **estado de servidor**. Zustand fica restrito ao estado
genuinamente local: timer do pomodoro, preferências de UI, rascunhos de formulário. Não é
camada de cache paralela.

## Testes

- **API:** Vitest + testcontainers (Postgres).
- **Obrigatório:** testes de política RLS — asserção de que a instituição A não consegue
  ler linhas da instituição B, executados como o role não-dono da aplicação.
- **Obrigatório:** matriz de permissões papel × escopo.
- **`packages/core`:** unit tests puros — é exatamente o que a regra "sem UI" compra.
- **Web:** Vitest + Testing Library + axe.
- **Mobile:** Jest + RN Testing Library; Maestro para fluxos E2E.

## Deploy

- **API:** container Docker (`turbo prune` para imagem enxuta).
- **Postgres:** gerenciado, **em região brasileira** quando possível — escolha de região é
  controle de localização de dado, não prova de conformidade, mas simplifica a conversa.
- **Web:** SPA estática em CDN. Cada ambiente expõe uma única origem pública; a CDN serve
  a SPA e encaminha `/v1/*` para a API. O endereço interno do container não chega ao
  bundle web.
- **Mobile:** EAS Build + **EAS Update** — updates OTA de JS contornam a latência de
  revisão de loja para correções que não tocam código nativo.
- **Ambientes:** local, homologação e produção usam origens, bancos e segredos separados.
  O fornecedor de infraestrutura é deliberadamente uma porta de mão dupla e permanece
  indefinido até o primeiro deploy.

---

## Fora de escopo (decidido explicitamente)

- **Sem SSR/SSG no web** — a versão web é SPA; não há necessidade de SEO.
- **Sem compartilhamento de componentes de UI** entre mobile e web (nem React Native Web,
  nem Solito, nem Tamagui como camada de UI comum).
- **Sem Nx** — Turborepo como task runner.
- **Sem tRPC como opção "ou React Query"** — a escolha é explícita e depende de D4/D5.
- **Sem posicionamento como prontuário eletrônico** — ver `project-description.md`, §7.
