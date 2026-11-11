import { studentHistoryEntrySchema } from '@habituar/core/student-records'
import type { StudentHistoryEntry } from '@habituar/core/student-records'
import { describe, expect, it } from 'vitest'
import { groupStudentHistory } from './student-history-timeline.js'

// Instantes montados no fuso local: o agrupamento é por dia de quem lê, e um ISO fixo em
// UTC cairia em outro dia conforme o fuso da máquina que roda o teste.
const NOW = new Date(2026, 10, 11, 15, 0)
const ANA = { id: '20000000-0000-4000-8000-000000000001', name: 'Ana Souza' }
const CARLOS = { id: '20000000-0000-4000-8000-000000000002', name: 'Carlos Lima' }

let sequence = 0

function at(month: number, day: number, hour = 10): string {
  return new Date(2026, month - 1, day, hour, 0).toISOString()
}

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`
}

function observation(recordedAt: string, body = 'Participou da atividade.', recordedBy = ANA): StudentHistoryEntry {
  return studentHistoryEntrySchema.parse({ kind: 'observation', id: nextId('50'), body, recordedAt, recordedBy })
}

function revision(recordedAt: string, changedFields: readonly string[], recordedBy = ANA): StudentHistoryEntry {
  return studentHistoryEntrySchema.parse({ kind: 'profile-revision', id: nextId('40'), changedFields, recordedAt, recordedBy })
}

describe('linha do tempo do histórico da ficha', () => {
  it('chama de hoje e ontem o que foi registrado nesses dias, mantendo a ordem do mais recente', () => {
    const first = observation(at(11, 11, 14), 'Mais recente.')
    const second = observation(at(11, 11, 9), 'Mais cedo.')
    const third = observation(at(11, 10, 18))

    const timeline = groupStudentHistory([first, second, third], NOW)

    expect(timeline.map((group) => group.period)).toEqual([{ kind: 'today' }, { kind: 'yesterday' }])
    expect(timeline[0]?.moments).toEqual([{ kind: 'observation', observation: first }, { kind: 'observation', observation: second }])
  })

  it('separa por dia o restante do mês corrente e por mês o que é mais antigo', () => {
    const timeline = groupStudentHistory([
      observation(at(11, 4)),
      observation(at(11, 2)),
      observation(at(10, 30)),
      observation(at(10, 3)),
      observation(at(9, 15)),
    ], NOW)

    expect(timeline.map((group) => group.period)).toEqual([
      { kind: 'day', year: 2026, month: 11, day: 4 },
      { kind: 'day', year: 2026, month: 11, day: 2 },
      { kind: 'month', year: 2026, month: 10 },
      { kind: 'month', year: 2026, month: 9 },
    ])
    expect(timeline[2]?.moments).toHaveLength(2)
  })

  it('reconhece ontem mesmo quando ontem é o último dia do mês anterior', () => {
    const timeline = groupStudentHistory([observation(at(10, 31, 20))], new Date(2026, 10, 1, 8, 0))

    expect(timeline.map((group) => group.period)).toEqual([{ kind: 'yesterday' }])
  })

  it('junta atualizações seguidas da mesma pessoa no mesmo dia, somando os campos sem repetir', () => {
    const latest = revision(at(11, 11, 14), ['supportNeeds', 'conditions'])
    const timeline = groupStudentHistory([
      latest,
      revision(at(11, 11, 11), ['conditions']),
      revision(at(11, 11, 9), ['schoolGrade']),
    ], NOW)

    expect(timeline).toEqual([{
      period: { kind: 'today' },
      moments: [{ kind: 'profile-revisions', latest, count: 3, changedFields: ['supportNeeds', 'conditions', 'schoolGrade'] }],
    }])
  })

  it('mantém separadas atualizações de pessoas diferentes, de dias diferentes ou com observação entre elas', () => {
    const timeline = groupStudentHistory([
      revision(at(11, 11, 14), ['conditions'], CARLOS),
      revision(at(11, 11, 13), ['conditions']),
      observation(at(11, 11, 12)),
      revision(at(11, 11, 11), ['schoolGrade']),
      // Mesmo grupo de mês, dias diferentes: o grupo de outubro não pode fundir os dois.
      revision(at(10, 5), ['schoolGrade']),
      revision(at(10, 4), ['schoolGrade']),
    ], NOW)

    expect(timeline.flatMap((group) => group.moments.map((moment) => moment.kind === 'profile-revisions' ? moment.count : 'observation')))
      .toEqual([1, 1, 'observation', 1, 1, 1])
  })

  it('não cria grupo nenhum quando não há registro', () => {
    expect(groupStudentHistory([], NOW)).toEqual([])
  })
})
