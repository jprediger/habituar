import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import { ROUTINE_KINDS, WEEKDAYS, weekdayOf } from '@habituar/core/routines'
import type { RoutineBlock, Weekday } from '@habituar/core/routines'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { RoutineWriteResult, StudentRoutine } from '@habituar/react-client/react-client'
import { WEEKDAY_LABEL_KEYS, useRoutineBlockForm } from '@habituar/react-client/routine-forms'
import type { RoutineBlockField } from '@habituar/react-client/routine-forms'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { RoutineWeek } from '../components/routine-week'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

// O que está aberto na grade: nada, o formulário de um bloco novo ou de um existente, ou a
// confirmação de remoção. Uma coisa por vez, para a pessoa não perder o fio.
type EditorTarget =
  | Readonly<{ mode: 'idle' }>
  | Readonly<{ mode: 'create'; weekday: Weekday }>
  | Readonly<{ mode: 'edit'; block: RoutineBlock }>
  | Readonly<{ mode: 'remove'; block: RoutineBlock }>

/**
 * Grade semanal dentro da ficha, no app. Com `routine.write`, tocar num bloco abre a
 * edição, cada dia oferece adicionar e a remoção pede confirmação; sem, é só leitura.
 */
export function StudentRoutineEditor({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const toast = useToast()
  const routine = habituar.useStudentRoutine(session.membership, studentId)
  const [target, setTarget] = useState<EditorTarget>({ mode: 'idle' })
  const [failure, setFailure] = useState<'conflict' | 'not-saved' | undefined>(undefined)
  const [isRemoving, setIsRemoving] = useState(false)

  function finish(result: RoutineWriteResult, kind: 'saved' | 'removed'): void {
    if (result === 'saved') {
      setFailure(undefined)
      setTarget({ mode: 'idle' })
      const key = kind === 'saved' ? 'routineSaved' : 'routineRemoved'
      toast({ type: 'success', title: t(`toast.routine.${key}.title`), subtitle: t(`toast.routine.${key}.description`) })
      return
    }
    setFailure(result)
    // Conflito fecha o formulário: a grade já mostra a versão atual para a pessoa conferir.
    if (result === 'conflict') setTarget({ mode: 'idle' })
  }

  switch (routine.state.status) {
    case 'loading':
      return <Text tone="muted" accessibilityLiveRegion="polite">{t('routine.loading')}</Text>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t(routine.state.failure === 'forbidden' ? 'routine.forbidden' : 'routine.failed')}</Text>
    case 'ready':
      return (
        <View style={styles.stack}>
          <RoutineWeek
            days={routine.state.days}
            today={weekdayOf(readCurrentTime())}
            onBlockPress={routine.canEdit && target.mode === 'idle' ? (block) => { setFailure(undefined); setTarget({ mode: 'edit', block }) } : undefined}
            renderDayAction={routine.canEdit && target.mode === 'idle'
              ? (day) => (
                  <Button
                    label={t('routine.addTo', { day: t(WEEKDAY_LABEL_KEYS[day.weekday]) })}
                    variant="link"
                    size="inline"
                    onPress={() => { setFailure(undefined); setTarget({ mode: 'create', weekday: day.weekday }) }}
                  />
                )
              : undefined}
          />
          {target.mode === 'create' && (
            <RoutineBlockEditor key={`create-${String(target.weekday)}`} weekday={target.weekday} save={routine.add} onDone={(result) => { finish(result, 'saved') }} onCancel={() => { setTarget({ mode: 'idle' }) }} />
          )}
          {target.mode === 'edit' && (
            <RoutineBlockEditor
              key={`edit-${target.block.id}`}
              block={target.block}
              weekday={target.block.weekday}
              save={(input) => routine.update(target.block, input)}
              onDone={(result) => { finish(result, 'saved') }}
              onCancel={() => { setTarget({ mode: 'idle' }) }}
              onRemove={() => { setTarget({ mode: 'remove', block: target.block }) }}
            />
          )}
          {failure !== undefined && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(failure === 'conflict' ? 'routine.conflict' : 'routine.writeFailed')}</Text>
          )}
          {target.mode === 'remove' && (
            <ConfirmationSheet
              title={t('routine.removeTitle')}
              message={t('routine.removeQuestion', { title: target.block.title, day: t(WEEKDAY_LABEL_KEYS[target.block.weekday]) })}
              confirmLabel={t('routine.removeYes')}
              cancelLabel={t('routine.cancel')}
              confirmVariant="danger"
              isBusy={isRemoving}
              onConfirm={() => {
                setIsRemoving(true)
                void routine.remove(target.block).then((result) => { setIsRemoving(false); finish(result, 'removed') })
              }}
              onCancel={() => { setTarget({ mode: 'idle' }) }}
            />
          )}
        </View>
      )
    default:
      return assertNever(routine.state)
  }
}

function RoutineBlockEditor({
  block,
  weekday,
  save,
  onDone,
  onCancel,
  onRemove,
}: Readonly<{ block?: RoutineBlock; weekday: Weekday; save: StudentRoutine['add']; onDone: (result: RoutineWriteResult) => void; onCancel: () => void; onRemove?: () => void }>) {
  const { t } = useTranslation()
  const form = useRoutineBlockForm({ block, weekday, save })
  const errorFor = (field: RoutineBlockField) => form.invalidFields.has(field)
    ? t(`routine.invalid.${field}`, { maximum: field === 'notes' ? form.notesMaxLength : form.titleMaxLength })
    : undefined

  return (
    <View style={styles.stack}>
      <Text weight="medium">{block === undefined ? t('routine.newBlock') : t('routine.editBlock', { title: block.title })}</Text>
      <ChoiceList
        label={t('routine.fields.weekday')}
        choices={WEEKDAYS.map((day) => ({ value: String(day), label: t(WEEKDAY_LABEL_KEYS[day]) }))}
        value={String(form.values.weekday)}
        isDisabled={form.isSaving}
        onChange={(value) => { form.change('weekday', WEEKDAYS.find((day) => String(day) === value) ?? form.values.weekday) }}
      />
      <FormField id="routine-startsAt" label={t('routine.fields.startsAt')} isRequired hint={t('routine.timeHint')} error={errorFor('startsAt')}>
        {(control) => <Input {...control} keyboardType="numbers-and-punctuation" editable={!form.isSaving} value={form.values.startsAt} onChangeText={(value) => { form.change('startsAt', value) }} />}
      </FormField>
      <FormField id="routine-endsAt" label={t('routine.fields.endsAt')} isRequired hint={t('routine.timeHint')} error={errorFor('endsAt')}>
        {(control) => <Input {...control} keyboardType="numbers-and-punctuation" editable={!form.isSaving} value={form.values.endsAt} onChangeText={(value) => { form.change('endsAt', value) }} />}
      </FormField>
      <FormField id="routine-title" label={t('routine.fields.title')} isRequired error={errorFor('title')}>
        {(control) => <Input {...control} maxLength={form.titleMaxLength} editable={!form.isSaving} value={form.values.title} onChangeText={(value) => { form.change('title', value) }} />}
      </FormField>
      <ChoiceList
        label={t('routine.fields.kind')}
        choices={ROUTINE_KINDS.map((kind) => ({ value: kind, label: t(`routine.kinds.${kind}`) }))}
        value={form.values.kind}
        isDisabled={form.isSaving}
        onChange={(value) => { form.change('kind', value) }}
      />
      <FormField id="routine-notes" label={t('routine.fields.notes')} isRequired={false} error={errorFor('notes')}>
        {(control) => <Textarea {...control} maxLength={form.notesMaxLength} editable={!form.isSaving} value={form.values.notes} onChangeText={(value) => { form.change('notes', value) }} />}
      </FormField>
      <Button
        label={form.isSaving ? t('routine.saving') : t('routine.save')}
        isBusy={form.isSaving}
        isDisabled={form.isSaving}
        onPress={() => { void form.submit().then((result) => { if (result !== 'invalid') onDone(result) }) }}
      />
      <Button label={t('routine.cancel')} variant="outline" isDisabled={form.isSaving} onPress={onCancel} />
      {onRemove !== undefined && block !== undefined && (
        <Button label={t('routine.removeBlock', { title: block.title })} variant="dangerOutline" isDisabled={form.isSaving} onPress={onRemove} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
})
