# Atendimentos

Um **atendimento** é um encontro marcado por um profissional com um aluno: data de
início, horário, duração e anotação, com repetição semanal opcional. O aluno e o
responsável veem os atendimentos na mesma agenda das tarefas do dia.

Fontes da verdade no código:

- Modelo e restrições: `apps/api/db/migrations/0011_appointments_and_routine_entries.sql`
- Dados e contratos: `packages/core/src/appointments.ts` e
  `packages/core/src/appointments/contract.ts`
- Regras: `apps/api/src/appointments/appointments.service.ts`
- Agenda que junta atendimentos e tarefas: `packages/react-client/src/agenda-hooks.ts`

Requisito relacionado: RF0011 em [`DOCUMENTACAO.md`](../DOCUMENTACAO.md). Agendar,
editar, cancelar e consultar estão implementados; registrar o atendimento como realizado,
anotações posteriores e notificações continuam previstos. As consultas já realizadas
registradas na ficha são outro conceito, descrito em RF0009.

## Conceitos e relações

- **Série** (`appointments`): um atendimento com `recurrence` `none` (uma vez) ou
  `weekly`, com data de término opcional. Tem versão e guarda o profissional que agendou.
- **Ocorrência**: cada data em que a série acontece. Não é gravada; é calculada a partir
  da data de início e da repetição.
- **Ocorrência cancelada** (`appointment_cancelled_occurrences`): uma data da série que
  não acontece mais, sem apagar a série.

Papéis padrão: aluno e responsável têm `appointment.read@own`; os papéis de atendimento
têm `appointment.read` e `appointment.write` em `assigned` ou `institution`. Os dois
aparecem como agrupamentos em papéis personalizados — ver
[Papéis e permissões](roles-and-permissions.md).

## Regras

- Duração entre 5 e 480 minutos, terminando no mesmo dia; repetição não termina antes de
  começar; anotação de até 1000 caracteres.
- Só quem tem `appointment.write` sobre o aluno agenda, edita, cancela ou remove; aluno e
  responsável nunca escrevem.
- Editar, cancelar ocorrência ou remover conferem a versão esperada; versão velha responde
  `conflict`.
- Cancelar ocorrência exige uma data da série (`occurrence-not-in-series`). Remover apaga
  a série inteira.
- A agenda da instituição mostra só os alunos que o ator alcança e é negada a quem não tem
  alcance de equipe. Cada consulta cobre no máximo a grade de um mês.
- Estudante arquivado recusa escrita.

## Cenários

| Situação | Resultado |
|---|---|
| A profissional agenda um atendimento semanal sem término para Ana. | Ana e o responsável veem todas as ocorrências na agenda. |
| A profissional cancela só o atendimento do feriado. | Aquela data some da agenda; a série continua. |
| O responsável tenta criar um atendimento. | Recusado por falta de `appointment.write`. |
| Duas pessoas editam a mesma série ao mesmo tempo. | A segunda gravação recebe `conflict` e precisa recarregar. |

## Limites deste documento

As tarefas que dividem a agenda com os atendimentos estão em
[Rotina e tarefas do dia](routines-and-tasks.md). Quem acompanha cada aluno está em
[Estudantes e acompanhamentos](students-and-assignments.md).
