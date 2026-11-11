# Rotina e tarefas do dia

A **rotina** é a grade semanal do aluno: blocos com dia da semana, horário, título, tipo
e observação, montados pela equipe que o acompanha. Cada bloco se repete toda semana; a
**tarefa do dia** é uma ocorrência desse bloco numa data. O **registro da tarefa** guarda
como foi aquela ocorrência: a observação e as fotos do aluno, a entrega e a avaliação da
equipe.

Fontes da verdade no código:

- Modelo e restrições: `apps/api/db/migrations/0009_routine_blocks.sql`,
  `0011_appointments_and_routine_entries.sql` e `0012_routine_entry_deliveries.sql`
- Dados e contratos: `packages/core/src/routines.ts`, `packages/core/src/routine-entries.ts`
  e os `contract.ts` de `packages/core/src/routines` e `packages/core/src/routine-entries`
- Regras: `apps/api/src/routines/routines.service.ts` e `routine-entries.service.ts`
- Fotos: `apps/api/src/routines/routine-entry-photo.ts`
- Uso sem conexão: `packages/react-client/src/offline-sync.ts`
- Lembretes: `apps/mobile/src/notifications`

Requisitos relacionados: RF0010 e RNF0010 em [`DOCUMENTACAO.md`](../DOCUMENTACAO.md).
Grade, registro, entrega, avaliação, acompanhamento, lembretes e uso sem conexão no app
estão implementados; o modo foco continua previsto.

## Conceitos e relações

- **Bloco da rotina** (`routine_blocks`): pertence a um estudante e tem versão. Só a
  equipe com `routine.write` o cria, edita ou remove; aluno e responsável leem com
  `routine.read@own`.
- **Registro da tarefa** (`routine_entries`): um por bloco e data. Guarda a observação
  (até 1000 caracteres), a data de entrega e a versão. É a voz do aluno: só ele escreve,
  com `routine.entry.write@own`.
- **Foto** (`routine_entry_photos`): até seis por registro, JPEG, PNG ou WebP de até 2 MB.
  O arquivo fica fora do banco, no armazenamento definido por `FILE_STORAGE_DIRECTORY`; o
  banco guarda só os metadados. A API confere o conteúdo, não só o tipo declarado.
- **Avaliação** (`routine_entry_evaluations`): conceito fechado (`achieved`, `partial`,
  `not-achieved`) e comentário opcional, com versão própria para que uma nova observação
  do aluno não a invalide. Exige `routine.entry.evaluate` sobre o estudante.

Papéis padrão: aluno tem `routine.read`, `routine.entry.write` e `appointment.read` em
`own`; responsável só lê; os papéis de atendimento leem, escrevem a rotina e avaliam em
`assigned` ou `institution`. As mesmas permissões aparecem como agrupamentos em papéis
personalizados — ver [Papéis e permissões](roles-and-permissions.md).

## Regras

- Registro só existe para uma data em que o bloco acontece; outro dia é recusado com
  `occurrence-not-in-routine`. Estudante arquivado recusa escrita.
- Toda escrita confere a versão esperada; gravar sobre versão velha responde `conflict`.
- A entrega leva junto a observação e as fotos. Desfazer só é aceito enquanto não houver
  avaliação (`entry-already-evaluated`). As telas só oferecem a entrega a partir do dia
  da tarefa.
- Avaliar exige entrega (`entry-not-delivered`). Depois de avaliada, a entrega fica fixa.
- Responsável e equipe nunca escrevem no registro do aluno, e um aluno não escreve no de
  outro.
- No acompanhamento, cada tarefa de um período aparece como avaliada, entregue, não
  entregue (data passada sem entrega) ou por vir.

## Lembretes no app

O app agenda notificações locais para os blocos da grade, com uma ou mais antecedências
que o aluno escolhe nas configurações (minutos, horas ou dias). Os lembretes são
refeitos sempre que o app recebe a grade atualizada e cancelados ao sair da conta. Nada passa pelo servidor.

## Uso sem conexão

Só no app mobile e só no ambiente de aluno. A agenda, os registros, os atendimentos e o
último contexto da sessão ficam salvos no aparelho, e cada item lido do disco passa pelo
schema antes de entrar no cache. Observação, entrega e desfazer entrega feitos sem conexão
entram numa fila reenviada a cada 30 segundos até a rede voltar. Conflito de versão relê o
registro e grava por cima (vale a última alteração); recusa de regra descarta a mudança e
avisa o aluno. Foto exige conexão. A cópia no aparelho é apagada ao sair da conta; a web
continua exigindo conexão. A decisão está em D13 de [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Cenários

| Situação | Resultado |
|---|---|
| O aluno entrega a tarefa de segunda e a equipe avalia como parcial. | Aluno e responsável leem o conceito e o comentário; a entrega não pode mais ser desfeita. |
| O responsável tenta escrever a observação da tarefa. | Recusado: o registro é do aluno. |
| O aluno registra observação para uma terça num bloco que só acontece às segundas. | Recusado com `occurrence-not-in-routine`. |
| Sem conexão, o aluno desfaz uma entrega que a equipe avaliou nesse meio-tempo. | Ao reconectar, o envio é recusado pela regra, a mudança é descartada e o aluno é avisado. |
| A equipe muda o horário de um bloco. | Quando o app recebe a grade nova, os lembretes passam para o novo horário. |

## Limites deste documento

Atendimentos aparecem na mesma agenda do aluno, mas têm regras próprias em
[Atendimentos](appointments.md). Quem acompanha cada estudante é definido em
[Estudantes e acompanhamentos](students-and-assignments.md).
