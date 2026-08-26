# Habituar — Descrição do Produto

> Documento de produto. Para decisões de arquitetura, ver `ARCHITECTURE.md`.
> Para o plano de execução, ver `implementation-plan.md`.

## 1. Visão geral

Habituar é uma plataforma de **apoio à organização de estudantes com dificuldades de
aprendizagem**, usada por profissionais de acompanhamento (pedagogos, psicólogos,
orientadores) e pelos próprios estudantes.

O caso de origem é o IFSul: **63 estudantes identificados** com TDAH, autismo e
deficiências, acompanhados por um profissional e uma equipe de monitores. Hoje a rotina
de cada aluno é mantida em **tabelas manuais** de dias da semana, e o acompanhamento
(fichas, observações, consultas, notas) vive em planilhas e papel.

O produto é desenhado como **SaaS multi-instituição**: o IFSul é a primeira instituição,
não a única.

## 2. O problema

A dificuldade central relatada não é cognitiva — é **organizacional**:

- os alunos não conseguem estruturar a própria rotina de estudos;
- não conseguem acompanhar entregas e avaliações;
- o profissional não tem visibilidade contínua da rotina real de cada aluno;
- o registro do acompanhamento é manual, disperso e não gera relatório;
- não há material consolidado para apresentar aos professores das disciplinas.

O produto ataca os dois lados desse problema ao mesmo tempo: dá **estrutura ao aluno**
e **visibilidade ao profissional**, com os dados alimentando um ao outro.

## 3. Personas

| Persona | Papel | Uso principal |
|---|---|---|
| **Profissional** | Responsável pelo acompanhamento | Fichas, agenda, consultas, métricas, relatórios |
| **Monitor** | Apoio, sob supervisão do profissional | Acompanhamento dos alunos designados |
| **Aluno** | Pessoa acompanhada | Rotina, tarefas, pomodoro, agenda |
| **Admin da instituição** | Gestão da conta da escola | Usuários, papéis e permissões |
| **Admin da plataforma** | Operação do SaaS | Provisionamento de instituições — **sem acesso a fichas** |

Ambas as plataformas (mobile e web) atendem **todas as personas** — ver
`ARCHITECTURE.md`, decisão D1.

## 4. Modelo de domínio

```
Institution ─┬─ User ─── Membership (role)
             │            └─ Assignment ──► Student | Group
             ├─ Group ─── GroupMember ──► Student
             ├─ Ficha ─┬─ Observation
             │         ├─ Appointment ─── AppointmentNote
             │         └─ Task
             ├─ RoutineBlock  (grade semanal do aluno)
             ├─ MetricDefinition ─┬─ MetricDefinitionTarget ──► Group | Student | (todos)
             │                    └─ MetricEntry
             └─ Report
```

### Entidades

**Ficha** — registro do aluno: dados, observações, histórico de consultas. É o núcleo
do acompanhamento e concentra os dados mais sensíveis do sistema.

**Rotina (RoutineBlock)** — substitui a tabela manual semanal. Representa a rotina real
do aluno (aulas, trabalho, deslocamento, compromissos) para que os blocos de estudo
sejam encaixados no tempo que de fato existe.

**Tarefa (Task)** — avaliações, trabalhos e entregas. Criadas pelo aluno ou pelo
profissional, integradas à agenda do aluno como TODOs com lembrete.

**Consulta (Appointment)** — atendimento entre profissional e aluno. Agendado pelo
profissional, com anotações registradas na ficha.

**Métrica (MetricDefinition + MetricEntry)** — métricas **definidas pelo usuário**,
não fixas no código: nota em uma disciplina, resultado de uma avaliação, frequência.
Cada definição pode valer para toda a instituição, para grupos (turmas) ou para alunos
específicos.

**Grupo** — turma ou agrupamento. **Opcional**: instituições que não agrupam pessoas
simplesmente não criam grupos, e nenhuma tela de grupo aparece para elas.

**Relatório** — consolidação de frequência, notas, rotina de estudos, observações e
anotações de consulta, exportável para apresentar aos professores.

## 5. Funcionalidades

### Aluno
- Grade de rotina semanal, com blocos de estudo encaixados no tempo livre real
- Tarefas e avaliações como TODOs, com lembretes locais
- Pomodoro e ferramentas de foco para execução das tarefas
- Agenda pessoal, incluindo consultas marcadas pelo profissional
- Visualização das próprias métricas

### Profissional / Monitor
- Fichas dos alunos designados: dados, observações, histórico
- Agenda de consultas e distribuição de atendimentos
- Definição de métricas e registro de valores ao longo do tempo
- Criação de tarefas atribuídas a alunos
- Relatórios consolidados para apresentar aos professores

### Admin da instituição
- Gestão de usuários e vínculos
- Edição de papéis e permissões a partir de um catálogo fechado (ver D8)
- Configuração dos módulos ativos (grupos, monitores) via preset de tipo de organização

## 6. Requisitos não-funcionais

Estes não são "extras" — são o motivo de o produto existir e as condições legais de
operá-lo.

### Acessibilidade
- **WCAG 2.2 AA** como requisito obrigatório, verificado em CI (D12)
- **LBI (Lei 13.146/2015), Art. 63** torna acessibilidade digital obrigatória para
  empresas sediadas no Brasil e órgãos públicos — o IFSul é ambos os casos de uma vez
- WCAG cobre bem acessibilidade sensorial e motora e **mal a cognitiva**. Como o público
  primário é TDAH e autista, existe um conjunto adicional de regras cognitivas escritas
  separadamente (D12): sem auto-avanço, sem timeout sem extensão, navegação previsível,
  desfazer em toda ação, movimento reduzido respeitado, linguagem simples em pt-BR

### Privacidade e conformidade
- Dados de saúde e deficiência são **dados sensíveis (LGPD, Art. 11)**, sobre pessoas
  provavelmente **menores de idade** — exige consentimento de responsável
- Como SaaS, cada instituição é **controladora** e o Habituar é **operador**: exige
  contrato de tratamento de dados por instituição
- Log de auditoria de escritas e de **leituras sensíveis** (D11)
- **Soft-delete + legal hold**: retenção obrigatória entra em conflito direto com o
  direito de exclusão da LGPD. Registros de acompanhamento nunca sofrem hard delete
- **Transferência de custódia** de registros quando um profissional deixa a instituição

## 7. Escopo

### Dentro
- Domínio educacional (instituições de ensino), como caso primário
- Multi-instituição desde a primeira migração
- Esquema **neutro de domínio**, permitindo tenants clínicos no futuro sem reescrita

### Fora, por ora
- **Posicionamento clínico.** O sistema não é vendido nem descrito como prontuário
  eletrônico. Atender psiquiatras/psicólogos como mercado primário acionaria o regime
  CFM/SBIS (Resolução CFM 1.821/2007, certificação S-RES) e CFP (Resoluções 001/2009 e
  006/2019, guarda mínima de 5 anos). É uma decisão consciente de adiar, não de ignorar —
  as portas de mão única (soft-delete, legal hold, custódia, auditoria) já ficam prontas
- Faturamento e planos comerciais
- Integração com sistemas acadêmicos do IFSul
- SSO institucional
