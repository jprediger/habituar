# Habituar — Plano de Implementação

> Produto: `project-description.md` · Arquitetura: `ARCHITECTURE.md`

## Estratégia

Fatias verticais (*tracer bullets*): cada marco atravessa banco → API → `packages/core` →
os dois apps, e termina em algo demonstrável. Nenhum marco é "só backend".

A ordem segue o risco, não a facilidade. Identidade e tenancy vêm primeiro porque são as
portas de mão única mais caras de retroajustar; o laço do aluno vem cedo porque é a
hipótese mais arriscada do produto (se os alunos não usarem, nada mais importa).

---

## M0 — Fundação

Sem valor de usuário. Existe para que nenhum marco seguinte tropece em toolchain.

- Monorepo: pnpm workspaces + Turborepo, `nodeLinker: hoisted`, singletons de
  React/React Native fixados, Metro com autodetecção do monorepo e `.watchmanconfig`
- `packages/config`: tsconfig base, eslint, **`eslint-plugin-boundaries` falhando o CI**
- `packages/design-tokens`: escala de cor/espaço/tipografia, com **contraste verificado
  programaticamente** (D12)
- `packages/react-client`: módulo headless criado por factory, compartilhando transporte,
  cache, estados discriminados e hooks sem compartilhar UI
- Postgres + Drizzle + primeira migração; `apps/api` com NestJS e `/health`
- `apps/web` (Vite) e `apps/mobile` (Expo Router) rodando e consumindo `/health`
- CI: lint, typecheck, testes, com filtro de afetados

**Pronto quando:** os três apps sobem, um tipo de `packages/core` atravessa os três, e um
import proibido (`react-native` dentro de `core`) **quebra o CI**.

---

## M1 — Identidade e tenancy · *a espinha*

O marco mais importante. Tudo se apoia nele e nada disso é barato de mudar depois.

- `institutions`, `users`, `sessions`, `memberships`
- Sessões opacas: argon2id, token com hash SHA-256, expiração deslizante (D6)
- Dois transportes: cookie no web, `expo-secure-store` + Bearer no mobile
- `institution_id` em todas as tabelas; RLS com **`FORCE`**; **role de aplicação não-dono**
- Wrapper `withTenant()` definindo `app.institution_id`, `app.actor_id`, `app.session_id`
- Triggers de auditoria de escrita (D11)
- Login/logout funcionando nos dois apps

**Pronto quando:** existem duas instituições com dados, e um **teste automatizado prova**
que a instituição A não consegue ler linhas da B — executado como o role da aplicação,
com a query tentando burlar o filtro de propósito.

> Se este marco não estiver sólido, não avance. Todo o resto herda dele.

---

## M2 — Autorização

- Catálogo de permissões em `packages/core` como union type
- `roles`, `role_permissions` (com `scope`), templates seedados por instituição
- `assignments` (staff ↔ aluno | grupo)
- Resolução de permissão efetiva por requisição
- Proteções contra escalonamento (D9), incluindo `institution_admin` **sem**
  `observation.read`
- `usePermission()` em `packages/react-client`, consumido pelos dois apps; a resolução e
  os tipos de permissão permanecem puros em `packages/core`

**Pronto quando:** a matriz papel × escopo está testada, e um admin de instituição
comprovadamente **não consegue** conceder acesso a observações que ele mesmo não possui.

---

## M3 — Fichas e observações · *primeira fatia de domínio real*

- CRUD de fichas, observações, com `institution_id` e escopo por atribuição
- **Soft-delete + legal hold** desde o início — nunca hard delete
- Auditoria de **leitura sensível** em abertura de ficha e observações
- Transferência de custódia quando um profissional sai
- Telas nos dois apps

**Pronto quando:** um profissional cria uma ficha, um monitor vê apenas as suas atribuídas,
e o log de auditoria mostra quem leu o quê.

---

## M4 — Rotina, tarefas e foco · *o laço do aluno*

O coração do produto. Substitui a tabela manual semanal.

- `routine_blocks`: grade semanal, blocos de estudo encaixados no tempo livre real
- `tasks`: TODOs criados por aluno ou profissional, integrados à agenda
- Persistência da query cache em MMKV + fila de mutations otimistas (D13)
- Notificações locais agendadas: tarefa vencendo, bloco começando (D14)
- Pomodoro e ferramentas de foco (local)
- Regras cognitivas de D12 aplicadas com rigor — esta é a tela onde mais importam

**Pronto quando:** um aluno marca uma tarefa como concluída **em modo avião**, e um
lembrete dispara **sem rede**.

> Este é o marco a colocar na frente de estudantes reais o quanto antes. É a hipótese
> mais arriscada do produto inteiro.

---

## M5 — Agenda e consultas

- `appointments` e distribuição de atendimentos pelo profissional
- `appointment_notes` ligadas à ficha
- Push do servidor quando o profissional agenda ou altera (D14)
- Agenda do aluno unificando consultas, tarefas e blocos de rotina

**Pronto quando:** profissional agenda uma consulta e o aluno recebe push sem abrir o app.

---

## M6 — Métricas e grupos

- `metric_definitions` + `metric_definition_targets` + `metric_entries` (D10)
- União discriminada por `kind` em `packages/core`
- `groups` e `group_members`; atribuição por grupo
- Presets de tipo de organização controlando a superfície de UI de grupos

**Pronto quando:** uma métrica definida para a turma 3ºA aparece automaticamente para um
aluno recém-adicionado à turma, sem job de backfill.

---

## M7 — Relatórios

- Worker com fila para geração de PDF, fora do request (D16)
- HTML → PDF via Chromium headless, reaproveitando estilos do app web
- Relatórios de frequência, notas, rotina, observações e anotações de consulta
- Armazenamento dos PDFs; geração registrada como leitura sensível

**Pronto quando:** o profissional gera o relatório que leva para a reunião com os
professores.

---

## M8 — Administração da instituição

- UI de gestão de usuários e vínculos
- Editor de papéis com **bundles**, não checkboxes atômicos (D9)
- Presets de tipo de organização
- Trilha de auditoria visível ao admin

---

## M9 — Conformidade e endurecimento

- Fluxo de consentimento, incluindo responsável legal para menores
- Exportação de dados do titular (direito de acesso)
- Jobs de retenção e descarte com legal hold respeitado
- Modelo de contrato de tratamento de dados (operador ↔ controladora)
- **Auditoria de acessibilidade completa**: axe em CI verde, passes manuais de VoiceOver
  e TalkBack registrados
- Revisão de segurança focada em isolamento entre tenants

---

## Ordem alternativa

Se validar engajamento dos alunos for mais urgente que o fluxo do profissional, **M4 pode
vir antes de M3** — rotina, tarefas e pomodoro dependem apenas de `users`, não de fichas.
Custa uma refatoração pequena depois, e compra a resposta para a pergunta mais arriscada
meses antes.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Vazamento entre instituições | RLS `FORCE` + role não-dono + teste de isolamento obrigatório em M1 |
| Alunos não adotarem | Levar M4 a usuários reais o quanto antes; medir uso, não opinião |
| Atrito Expo + monorepo | Resolver inteiramente em M0, antes de existir código de produto |
| Acessibilidade retrofitada | Gate em CI desde M0; tokens de contraste antes da primeira tela |
| Escopo clínico por acidente | Portas de mão única já prontas; posicionamento explicitamente adiado |
| Paridade dobrar o trabalho de UI | Custo aceito em D1 — vigiar se `packages/core` está de fato absorvendo a lógica |

---

## Primeiros passos

1. Consolidar `habituar-frontend` e `habituar-backend` em um repositório único
   (`habituar`). Ambos têm um único commit vazio — o custo é zero **hoje**.
2. Executar M0 por inteiro. Não começar domínio antes de o CI barrar import proibido.
3. Modelar `institutions`/`users`/`sessions` e escrever o teste de isolamento RLS **antes**
   de qualquer tela.
