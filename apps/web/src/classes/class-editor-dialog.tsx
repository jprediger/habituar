import type { ClassFailure } from '@habituar/react-client/class-hooks'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.js'
import { Dialog } from '../components/ui/dialog.js'
import { Input } from '../components/ui/input.js'
import { Textarea } from '../components/ui/textarea.js'

export function ClassEditorDialog({
  isOpen, onClose, initial, pending, failure, onSave,
}: Readonly<{
  isOpen: boolean
  onClose(): void
  initial?: Readonly<{ name: string; description: string | null }>
  pending: boolean
  failure: ClassFailure | undefined
  onSave(name: string, description: string | null): Promise<void>
}>): ReactElement {
  const { t } = useTranslation('classes')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [attempted, setAttempted] = useState(false)
  const [rejected, setRejected] = useState(false)
  const nameId = useId()
  const descriptionId = useId()
  const validName = name.trim().length > 0 && name.trim().length <= 100
  const validDescription = description.trim().length <= 500

  async function submit(): Promise<void> {
    setAttempted(true)
    setRejected(false)
    if (!validName || !validDescription) return
    try {
      await onSave(name.trim(), description.trim() || null)
      onClose()
    } catch {
      setRejected(true)
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t(initial === undefined ? 'editor.createTitle' : 'editor.editTitle')}
      description={t('editor.description')}
    >
      <form className="flex flex-col gap-lg" noValidate onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <div className="flex flex-col gap-xs">
          <label htmlFor={nameId} className="text-body font-medium">{t('editor.name')}</label>
          <Input id={nameId} autoFocus required maxLength={100} value={name} aria-invalid={attempted && !validName} onChange={(event) => { setName(event.target.value); setRejected(false) }} />
          {attempted && !validName && <p role="alert" className="text-caption text-danger">{t('editor.invalidName')}</p>}
        </div>
        <div className="flex flex-col gap-xs">
          <label htmlFor={descriptionId} className="text-body font-medium">{t('editor.descriptionLabel')}</label>
          <Textarea id={descriptionId} maxLength={500} value={description} aria-invalid={attempted && !validDescription} onChange={(event) => { setDescription(event.target.value); setRejected(false) }} />
          <p className="text-caption text-text-muted">{t('editor.optional')}</p>
        </div>
        {rejected && <p role="alert" className="text-body text-danger">{t(failure === 'conflict' ? 'errors.conflict' : failure === 'forbidden' ? 'errors.forbidden' : 'errors.save')}</p>}
        <div className="flex flex-wrap justify-end gap-sm">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>{t('actions.cancel')}</Button>
          <Button type="submit" disabled={pending}>{pending ? t('actions.saving') : t('actions.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
