import { assertNever } from '@habituar/core/assert-never'
import { StudentCondition } from '@habituar/core/student-records'
import { eq, sql } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { studentConsultations, studentObservations, studentProfileRevisions } from '../schema.js'

// Quando, relativo à hora em que o seed roda: com data fixa, "Hoje" e "Ontem" sumiriam do
// histórico um dia depois. O que é de hoje conta em minutos para nunca cair no futuro.
type SeededMoment =
  | Readonly<{ kind: 'today'; minutesAgo: number }>
  | Readonly<{ kind: 'past'; daysAgo: number; hour: number; minute: number }>

type SeededAuthor = 'professional' | 'coordinator'

type SeededHistoryEntry =
  | Readonly<{ kind: 'observation'; author: SeededAuthor; at: SeededMoment; body: string }>
  | Readonly<{ kind: 'revision'; author: SeededAuthor; at: SeededMoment; schoolGrade: string; conditions: readonly StudentCondition[]; supportNeeds: string | null }>

// Do mais antigo para o mais novo, que é a ordem do número de revisão. Cobre o que a linha
// do tempo do app distingue: meses anteriores, dias do mês, ontem, hoje, texto longo e
// atualizações seguidas da mesma pessoa no mesmo dia, que a tela junta numa linha só.
const SEEDED_HISTORY: readonly SeededHistoryEntry[] = [
  { kind: 'revision', author: 'coordinator', at: { kind: 'past', daysAgo: 72, hour: 9, minute: 0 }, schoolGrade: 'Turma 2A', conditions: ['adhd'], supportNeeds: null },
  { kind: 'observation', author: 'coordinator', at: { kind: 'past', daysAgo: 70, hour: 10, minute: 15 }, body: 'Primeira semana com o novo cronograma. Lia chegou no horário todos os dias e pediu para ver a agenda da tarde.' },
  { kind: 'observation', author: 'professional', at: { kind: 'past', daysAgo: 56, hour: 15, minute: 40 }, body: 'Teve dificuldade de retomar a atividade depois do recreio. Funcionou avisar cinco minutos antes da troca.' },
  { kind: 'observation', author: 'professional', at: { kind: 'past', daysAgo: 40, hour: 9, minute: 0 }, body: 'Concentrou-se melhor com pausas curtas a cada 20 minutos.' },
  { kind: 'revision', author: 'professional', at: { kind: 'past', daysAgo: 40, hour: 14, minute: 0 }, schoolGrade: 'Turma 2A', conditions: ['adhd'], supportNeeds: 'Tempo extra em provas.' },
  { kind: 'revision', author: 'professional', at: { kind: 'past', daysAgo: 40, hour: 14, minute: 10 }, schoolGrade: 'Turma 2A', conditions: ['adhd', 'learning-disorder'], supportNeeds: 'Tempo extra em provas.' },
  { kind: 'observation', author: 'coordinator', at: { kind: 'past', daysAgo: 27, hour: 14, minute: 10 }, body: 'Reunião com a responsável (Rosa Martins). Combinamos acompanhar a rotina de sono durante as próximas duas semanas.' },
  { kind: 'observation', author: 'professional', at: { kind: 'past', daysAgo: 27, hour: 16, minute: 30 }, body: 'Participou da atividade em grupo e apresentou a parte dela sem precisar de apoio.' },
  { kind: 'observation', author: 'professional', at: { kind: 'past', daysAgo: 13, hour: 11, minute: 20 }, body: 'Semana de avaliações. Na segunda, Lia ficou ansiosa antes da prova de matemática e pediu para sair da sala duas vezes; conversamos no corredor e ela voltou depois de alguns minutos. Na quarta, com o tempo extra combinado e a prova dividida em duas partes, terminou tudo e disse que se sentiu mais segura. Na sexta, na prova de ciências, usou o quadro de rotina para se organizar e não precisou de intervenção. Sugestão para as próximas avaliações: manter a divisão em partes, avisar o horário do intervalo no início e deixar água na mesa. Vale conversar com a família sobre o sono na véspera, que ela relatou ter sido curto.' },
  { kind: 'observation', author: 'coordinator', at: { kind: 'past', daysAgo: 8, hour: 10, minute: 5 }, body: 'Faltou na segunda e na terça; a família avisou que foi consulta médica.' },
  { kind: 'observation', author: 'coordinator', at: { kind: 'past', daysAgo: 5, hour: 9, minute: 30 }, body: 'Pediu para sentar mais perto da lousa.' },
  { kind: 'observation', author: 'professional', at: { kind: 'past', daysAgo: 5, hour: 13, minute: 45 }, body: 'Usou o quadro de rotina sozinha pela primeira vez para se organizar antes da aula de matemática.' },
  { kind: 'observation', author: 'professional', at: { kind: 'past', daysAgo: 1, hour: 17, minute: 20 }, body: 'Dia agitado: a troca de sala no meio da manhã atrapalhou. Ela se acalmou com a pausa na biblioteca e terminou a leitura proposta.' },
  { kind: 'revision', author: 'coordinator', at: { kind: 'past', daysAgo: 1, hour: 18, minute: 5 }, schoolGrade: 'Turma 2A', conditions: ['adhd', 'learning-disorder'], supportNeeds: 'Tempo extra em provas e lugar perto da lousa.' },
  { kind: 'revision', author: 'professional', at: { kind: 'today', minutesAgo: 70 }, schoolGrade: 'Turma 2B', conditions: ['adhd', 'learning-disorder'], supportNeeds: 'Tempo extra em provas e lugar perto da lousa.' },
  { kind: 'revision', author: 'professional', at: { kind: 'today', minutesAgo: 55 }, schoolGrade: 'Turma 2B', conditions: ['adhd'], supportNeeds: 'Tempo extra em provas e lugar perto da lousa.' },
  { kind: 'observation', author: 'coordinator', at: { kind: 'today', minutesAgo: 40 }, body: 'Chegou mais tranquila hoje e quis contar sobre o fim de semana com a avó.' },
]

type SeededConsultation = Readonly<{ author: SeededAuthor; at: SeededMoment; durationMinutes: number; recordedAfterMinutes: number; notes: string }>

// Do mais antigo para o mais novo, na mesma história das observações acima. Varia duração,
// autor e tamanho da anotação, e termina hoje, para a lista do app mostrar todos os casos.
// `recordedAfterMinutes` conta do fim da consulta: o registro vem sempre depois do atendimento.
const SEEDED_CONSULTATIONS: readonly SeededConsultation[] = [
  { author: 'coordinator', at: { kind: 'past', daysAgo: 71, hour: 14, minute: 0 }, durationMinutes: 60, recordedAfterMinutes: 20, notes: 'Acolhimento com Lia e a responsável. Levantamos a rotina de casa e da escola, os horários de sono e o que mais a deixa ansiosa: troca de atividade sem aviso e prova longa. Combinamos montar um quadro de rotina visual e testar pausas curtas nas tarefas longas.' },
  { author: 'professional', at: { kind: 'past', daysAgo: 63, hour: 10, minute: 0 }, durationMinutes: 50, recordedAfterMinutes: 15, notes: 'Montamos juntos o primeiro quadro de rotina da semana, com uma cor por tipo de atividade. Lia escolheu os ícones e pediu para incluir o horário do lanche.' },
  { author: 'professional', at: { kind: 'past', daysAgo: 49, hour: 15, minute: 30 }, durationMinutes: 45, recordedAfterMinutes: 10, notes: 'Treinamos dividir a tarefa em blocos de 20 minutos com pausa curta. Ela completou dois blocos de leitura sem levantar.' },
  { author: 'coordinator', at: { kind: 'past', daysAgo: 34, hour: 9, minute: 0 }, durationMinutes: 90, recordedAfterMinutes: 30, notes: 'Revisão do primeiro mês com Lia e a responsável. Menos saídas da sala e mais tarefas concluídas. Depois da avaliação psicopedagógica, incluímos o transtorno de aprendizagem nas condições acompanhadas e mantivemos o tempo extra em provas.' },
  { author: 'professional', at: { kind: 'past', daysAgo: 20, hour: 16, minute: 0 }, durationMinutes: 50, recordedAfterMinutes: 5, notes: 'Preparação para a semana de avaliações: ensaiamos dividir a prova em duas partes e combinamos um sinal discreto para pedir pausa.' },
  { author: 'professional', at: { kind: 'past', daysAgo: 12, hour: 14, minute: 0 }, durationMinutes: 30, recordedAfterMinutes: 10, notes: 'Revisão rápida da semana de provas. Ela contou que a divisão em partes ajudou.' },
  { author: 'professional', at: { kind: 'past', daysAgo: 6, hour: 10, minute: 30 }, durationMinutes: 45, recordedAfterMinutes: 25, notes: 'Conversamos sobre o sono, que ela vinha relatando curto na véspera das provas. Montamos com ela uma rotina de noite com três passos fixos: guardar o material, separar a roupa do dia seguinte e ler por quinze minutos. Ela pediu para colocar esses passos no quadro de rotina, ao lado dos da manhã. Também revisamos o uso do quadro na escola: nesta semana ela o consultou sozinha antes da aula de matemática, sem precisar de lembrete. Próximo passo: combinar com a família um horário fixo para dormir nos dias de semana e acompanhar por duas semanas, registrando como ela chega à escola.' },
  { author: 'professional', at: { kind: 'today', minutesAgo: 150 }, durationMinutes: 40, recordedAfterMinutes: 10, notes: 'Falamos sobre a troca de sala de ontem. Combinamos que, quando a troca for avisada no dia, ela marca a mudança no quadro de rotina logo na chegada.' },
]

/**
 * Histórico de exemplo da ficha do estudante do seed, para a linha do tempo do app não abrir
 * vazia no desenvolvimento local. Recusa ficha que já tem histórico: observação e revisão são
 * append-only, e repetir o seed duplicaria tudo.
 */
export async function seedDevelopmentRecordHistory(
  transaction: DatabaseTransaction,
  institutionId: string,
  studentId: string,
  authors: Readonly<Record<SeededAuthor, string>>,
  now: Date,
): Promise<void> {
  const [observation] = await transaction.select({ id: studentObservations.id }).from(studentObservations).where(eq(studentObservations.studentId, studentId)).limit(1)
  const [revision] = await transaction.select({ id: studentProfileRevisions.id }).from(studentProfileRevisions).where(eq(studentProfileRevisions.studentId, studentId)).limit(1)
  if (observation !== undefined || revision !== undefined) return

  const previousActor = await readActor(transaction)
  let revisionNumber = 0

  for (const entry of SEEDED_HISTORY) {
    const authorId = authors[entry.author]
    const recordedAt = resolveMoment(entry.at, now)
    await setActor(transaction, authorId)

    if (entry.kind === 'observation') {
      await transaction.insert(studentObservations).values({ institutionId, studentId, authorUserId: authorId, body: entry.body, recordedAt })
    } else {
      revisionNumber += 1
      await transaction.insert(studentProfileRevisions).values({
        institutionId,
        studentId,
        revisionNumber,
        schoolGrade: entry.schoolGrade,
        conditions: [...entry.conditions],
        supportNeeds: entry.supportNeeds,
        recordedByUserId: authorId,
        recordedAt,
      })
    }
  }

  await setActor(transaction, previousActor)
}

/**
 * Consultas de exemplo da ficha do estudante do seed. Trava própria, e não a do histórico:
 * base local semeada antes das consultas existirem ganha as consultas na próxima execução
 * sem duplicar o histórico, e consulta também é append-only.
 */
export async function seedDevelopmentConsultations(
  transaction: DatabaseTransaction,
  institutionId: string,
  studentId: string,
  authors: Readonly<Record<SeededAuthor, string>>,
  now: Date,
): Promise<void> {
  const [existing] = await transaction.select({ id: studentConsultations.id }).from(studentConsultations).where(eq(studentConsultations.studentId, studentId)).limit(1)
  if (existing !== undefined) return

  const previousActor = await readActor(transaction)
  for (const consultation of SEEDED_CONSULTATIONS) {
    const professionalUserId = authors[consultation.author]
    const occurredAt = resolveMoment(consultation.at, now)
    await setActor(transaction, professionalUserId)
    await transaction.insert(studentConsultations).values({
      institutionId,
      studentId,
      professionalUserId,
      occurredAt,
      durationMinutes: consultation.durationMinutes,
      notes: consultation.notes,
      recordedAt: new Date(occurredAt.getTime() + (consultation.durationMinutes + consultation.recordedAfterMinutes) * 60_000),
    })
  }
  await setActor(transaction, previousActor)
}

// A RLS da ficha só aceita registro cujo autor é o ator da transação. Quem semeia em nome dos
// autores devolve o ator de quem chamou no fim, para o resto da transação não escrever em
// nome de outra pessoa.
async function readActor(transaction: DatabaseTransaction): Promise<string> {
  const result = await transaction.execute<{ actor: string | null }>(sql`select current_setting('app.actor_id', true) as actor`)
  return result.rows[0]?.actor ?? ''
}

async function setActor(transaction: DatabaseTransaction, userId: string): Promise<void> {
  await transaction.execute(sql`select set_config('app.actor_id', ${userId}, true)`)
}

function resolveMoment(moment: SeededMoment, now: Date): Date {
  switch (moment.kind) {
    case 'today':
      return new Date(now.getTime() - moment.minutesAgo * 60_000)
    case 'past':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - moment.daysAgo, moment.hour, moment.minute)
    default:
      return assertNever(moment)
  }
}
