import { assertNever } from '@habituar/core/assert-never'
import { StudentCondition } from '@habituar/core/student-records'
import { eq, sql } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { studentObservations, studentProfileRevisions } from '../schema.js'

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

  // A RLS só aceita observação e revisão cujo autor é o ator da transação. O ator de quem
  // chamou volta no fim, para o resto da transação não escrever em nome de outra pessoa.
  const previousActor = await transaction.execute<{ actor: string | null }>(sql`select current_setting('app.actor_id', true) as actor`)
  let revisionNumber = 0

  for (const entry of SEEDED_HISTORY) {
    const authorId = authors[entry.author]
    const recordedAt = resolveMoment(entry.at, now)
    await transaction.execute(sql`select set_config('app.actor_id', ${authorId}, true)`)

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

  await transaction.execute(sql`select set_config('app.actor_id', ${previousActor.rows[0]?.actor ?? ''}, true)`)
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
