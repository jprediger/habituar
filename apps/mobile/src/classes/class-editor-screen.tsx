import type { ClassDetail } from '@habituar/core/classes'
import type { ClassId } from '@habituar/core/identity/ids'
import { getClassCapabilities } from '@habituar/react-client/class-hooks'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import type { InstitutionSession } from '../session/session-screen'

/** A edição utiliza a versão recuperada no detalhe para detectar concorrência. */
export function ClassEditorScreen({ session, classId }: Readonly<{ session: InstitutionSession; classId?: ClassId }>) {
  const { t } = useTranslation('classes')
  const capabilities = getClassCapabilities(session.membership)
  const record = habituar.useClassDetail(session.membership, classId)
  const canWrite = classId === undefined ? capabilities.canCreate : capabilities.canManage

  return <StackPage title={t(classId === undefined ? 'newTitle' : 'editTitle')}>
    {!canWrite && <Text accessibilityRole="alert" tone="danger">{t('errors.forbidden')}</Text>}
    {canWrite && classId !== undefined && record.state.status === 'loading' && <Text>{t('loading')}</Text>}
    {canWrite && classId !== undefined && record.state.status === 'failed' && <>
      <Text accessibilityRole="alert" tone="danger">{t('errors.loadDetail')}</Text>
      <Button variant="outline" label={t('retry')} onPress={() => { void record.refresh() }} />
    </>}
    {canWrite && classId === undefined && <ClassEditorForm session={session} />}
    {canWrite && classId !== undefined && record.state.status === 'ready' && record.state.detail.archivedAt === null && (
      <ClassEditorForm key={`${record.state.detail.id}:${String(record.state.detail.version)}`} session={session} initial={record.state.detail} onRefresh={() => { void record.refresh() }} />
    )}
    {canWrite && classId !== undefined && record.state.status === 'ready' && record.state.detail.archivedAt !== null && <Text tone="muted">{t('errors.archived')}</Text>}
  </StackPage>
}

function ClassEditorForm({ session, initial, onRefresh }: Readonly<{ session: InstitutionSession; initial?: ClassDetail; onRefresh?: () => void }>) {
  const { t } = useTranslation('classes')
  const router = useRouter()
  const actions = habituar.useClassActions(session.membership)
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [submitted, setSubmitted] = useState(false)
  const validName = name.trim().length > 0 && name.trim().length <= 100
  const validDescription = description.trim().length <= 500

  async function save(): Promise<void> {
    setSubmitted(true)
    if (!validName || !validDescription || actions.pending) return
    try {
      if (initial === undefined) {
        const created = await actions.create(name.trim(), description.trim() || null)
        router.replace({ pathname: '/professional/management/classes/[class-id]', params: { 'class-id': created.id } })
      } else {
        await actions.update(initial.id, initial.version, name.trim(), description.trim() || null)
        router.back()
      }
    } catch {
      // O erro é exibido pelo estado do hook; o formulário permanece preenchido.
    }
  }

  return <>
    <FormField id="class-name" label={t('fields.name')} isRequired error={submitted && !validName ? t('errors.name') : undefined}>
      {control => <Input
        accessibilityLabel={control.accessibilityLabel}
        accessibilityHint={control.accessibilityHint}
        hasError={control.hasError}
        value={name}
        maxLength={101}
        onChangeText={setName}
      />}
    </FormField>
    <FormField id="class-description" label={t('fields.description')} isRequired={false} hint={t('fields.descriptionHint')} error={submitted && !validDescription ? t('errors.description') : undefined}>
      {control => <Textarea
        accessibilityLabel={control.accessibilityLabel}
        accessibilityHint={control.accessibilityHint}
        hasError={control.hasError}
        value={description}
        maxLength={501}
        onChangeText={setDescription}
      />}
    </FormField>
    {actions.failure !== undefined && <Text accessibilityRole="alert" tone="danger">{t(actions.failure === 'conflict' ? 'errors.conflict' : 'errors.save')}</Text>}
    {actions.failure === 'conflict' && onRefresh !== undefined && <Button variant="outline" label={t('refresh')} onPress={onRefresh} />}
    <Button label={t(actions.pending ? 'saving' : 'save')} isBusy={actions.pending} isDisabled={actions.pending} onPress={() => { void save() }} />
  </>
}
