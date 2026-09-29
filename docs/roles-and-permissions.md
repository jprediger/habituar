# Papéis e permissões

Referência detalhada do que cada papel institucional pode fazer. O modelo e as regras de
autorização estão no D9 do `ARCHITECTURE.md`; o requisito, no RF0007 do `DOCUMENTACAO.md`.

Fontes da verdade no código — se este documento divergir delas, o código vence e este
arquivo está desatualizado:

- Catálogo de permissões e alcances: `packages/core/src/permissions/permission-catalog.ts`
- Concessões dos templates: `apps/api/src/database/seeds/role-templates.ts`
- Bundles de papel personalizado: `packages/core/src/role-bundles.ts`
- Regras de delegação: `packages/core/src/delegation.ts`
- Nomes exibidos: `roles`, `roleDescriptions` e `roleBundles` em `apps/*/src/i18n/pt-br/common.json`

## Conceitos

- **Vínculo** (`memberships`): liga uma pessoa a uma instituição. Cada pessoa tem no máximo
  um vínculo por instituição, e ele tem **um tipo**: aluno, profissional ou monitor. O tipo
  decide o ambiente que a pessoa vê.
- **Papel** (`roles`): conjunto de concessões, sempre de um único tipo de vínculo. Um vínculo
  recebe **um ou mais papéis** do seu tipo, e as concessões se **somam** — nenhuma nega outra.
- **Concessão**: uma permissão com um alcance, por exemplo `student.read@assigned`.
- **Alcance**:
  - `own` — dados do próprio ator;
  - `assigned` — dados dos alunos vinculados ao ator em `assignments`;
  - `institution` — qualquer dado da instituição.

  `institution` cobre os outros dois; `own` e `assigned` não se cobrem, porque tratam de
  pessoas diferentes.

## Permissões

| Permissão | O que libera |
|---|---|
| `student.create` | Cadastrar aluno |
| `student.read` | Consultar o cadastro básico do aluno (não inclui dado clínico) |
| `student.update` | Atualizar o cadastro do aluno |
| `guardian.link` | Vincular responsável a um aluno |
| `guardian.unlink` | Desvincular responsável de um aluno |
| `membership.read` | Ver equipe, convites e papéis da instituição |
| `membership.invite` | Convidar, reenviar e revogar convites (convidar exige também `role.assign`) |
| `membership.remove` | Remover o vínculo de um membro |
| `role.assign` | Trocar os papéis de um membro |
| `role.manage` | Criar, editar e excluir papéis personalizados |

Ficha e observações clínicas ainda não existem no catálogo. Quando entrarem, terão chaves
próprias e só os papéis de atendimento as receberão — Gestão da equipe nunca.

## Papéis de sistema

Criados em toda instituição no provisionamento. Não podem ser renomeados, editados nem
excluídos pela interface ou pela API; mudança neles é migração versionada.

### Gestão da equipe (`team-management`) — profissional

Administra a instituição. É o papel de quem coordena a equipe.

| Concessão | Na prática |
|---|---|
| `membership.read@institution` | Vê a aba Gestão: equipe, convites e papéis |
| `membership.invite@institution` | Convida profissionais e monitores |
| `membership.remove@institution` | Remove membros |
| `role.assign@institution` | Troca papéis de membros |
| `role.manage@institution` | Cria papéis personalizados a partir dos templates |
| `student.create@institution` | Cadastra alunos |
| `student.read@institution` | Consulta o cadastro básico de todos os alunos |

Não atualiza cadastro nem vincula responsáveis: isso é atendimento. Pela regra "não se
concede o que não se possui", um gestor só com este papel **não consegue** convidar
alguém para Atendimento; para isso precisa ter também o papel de atendimento
correspondente.

### Atendimento aos alunos vinculados (`care-assigned`) — profissional

Acompanha apenas os alunos vinculados a esta pessoa.

| Concessão | Na prática |
|---|---|
| `student.read@assigned` | Consulta o cadastro dos alunos vinculados a si |
| `student.update@assigned` | Atualiza o cadastro deles |
| `guardian.link@assigned` | Vincula responsáveis a eles |

### Atendimento da instituição (`care-institution`) — profissional

Mesmas ações do anterior, mas sobre **todos** os alunos da instituição.

| Concessão | Na prática |
|---|---|
| `student.read@institution` | Consulta o cadastro de qualquer aluno |
| `student.update@institution` | Atualiza o cadastro de qualquer aluno |
| `guardian.link@institution` | Vincula responsáveis a qualquer aluno |

### Monitoria (`monitoring`) — monitor

| Concessão | Na prática |
|---|---|
| `student.read@assigned` | Consulta o cadastro dos alunos vinculados a si |

O monitor usa o mesmo ambiente do profissional, mas só vê o que as concessões permitem.
Não recebe gestão por compartilhar esse ambiente.

### Aluno (`student`) — aluno

| Concessão | Na prática |
|---|---|
| `student.read@own` | Consulta o próprio cadastro |

## Combinações comuns

| Função na instituição | Tipo do vínculo | Papéis |
|---|---|---|
| Coordenador que também atende | profissional | Gestão da equipe + Atendimento da instituição |
| Coordenador que atende só os seus | profissional | Gestão da equipe + Atendimento aos vinculados |
| Profissional de atendimento | profissional | Atendimento aos vinculados |
| Monitor | monitor | Monitoria |

Não existe "profissional + monitor" na mesma instituição: o vínculo tem um tipo só, e papel
de monitor não pode ser dado a vínculo de profissional (o banco recusa por FK composta).

Usuários de desenvolvimento (`apps/api/src/database/seeds/development-users.ts`):
`professional@habituar.dev` (Atendimento aos vinculados), `monitor@habituar.dev`
(Monitoria), `coordinator@habituar.dev` (Gestão da equipe + Atendimento da instituição) e
`student@habituar.dev` (Aluno).

## Papéis personalizados

Todo papel novo nasce como clone de um template de sistema do mesmo tipo e é ajustado por
**bundles** — agrupamentos com nome de produto, não permissões soltas.

| Bundle | Permissão | Profissional | Monitor |
|---|---|---|---|
| Consultar equipe e convites | `membership.read` | `institution` | — |
| Convidar equipe | `membership.invite` | `institution` | — |
| Atribuir papéis | `role.assign` | `institution` | — |
| Remover membros | `membership.remove` | `institution` | — |
| Personalizar papéis | `role.manage` | `institution` | — |
| Cadastrar alunos | `student.create` | `institution` | — |
| Consultar cadastro de alunos | `student.read` | `assigned` ou `institution` | `assigned` |
| Atualizar cadastro de alunos | `student.update` | `assigned` ou `institution` | — |
| Vincular responsáveis | `guardian.link` | `assigned` ou `institution` | — |
| Desvincular responsáveis | `guardian.unlink` | `assigned` ou `institution` | — |

Papel de aluno não é personalizável. Um papel personalizado só pode ser excluído quando
nenhum membro ativo nem convite pendente o usa. Alterar suas concessões afeta todos os
titulares e revoga os convites pendentes que o referenciam.

## Regras de delegação

- **Não se concede o que não se possui.** Quem atribui, convida ou edita papel precisa cobrir
  todas as concessões do resultado final — e também as do estado atual do alvo, para não
  administrar alguém com mais poder que si.
- **Sempre existe um gestor completo.** Gestor completo é quem soma as cinco ações de gestão
  (`membership.read`, `membership.invite`, `membership.remove`, `role.assign`,
  `role.manage`), vindas de um ou mais papéis. Nenhuma remoção, troca ou edição de papel
  pode deixar a instituição sem um, quando já havia.
- **Administrador geral** configura qualquer instituição pela área de plataforma na web,
  autorizado por `institution.configure`. Não tem vínculo, não soma concessões de tenant e
  não lê dados de alunos.
- Nome de papel nunca autoriza nada: toda decisão compara concessões.

## Situação

A gestão de equipe e papéis está **em desenvolvimento**: implementada e testada localmente,
ainda não integrada. A trilha completa de auditoria das mudanças de permissão é prevista.
