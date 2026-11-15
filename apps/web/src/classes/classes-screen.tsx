import type { ClassId } from '@habituar/core/identity/ids'
import { getClassCapabilities } from '@habituar/react-client/class-hooks'
import { Archive, Plus, RefreshCw, UsersRound } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { PageHeader } from '../components/ui/page-header.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { ClassDetailPanel } from './class-detail-panel.js'
import { ClassEditorDialog } from './class-editor-dialog.js'

type Editor = Readonly<{ kind: 'create' }> | Readonly<{ kind: 'edit'; classId: ClassId }>

/** Lista e gestão de turmas da instituição, sempre respeitando as permissões do vínculo atual. */
export function ClassesScreen(): ReactElement {
  const { t } = useTranslation('classes')
  const { membership } = useInstitutionSession()
  const capabilities = getClassCapabilities(membership)
  const [archived, setArchived] = useState(false)
  const [selectedId, setSelectedId] = useState<ClassId | undefined>()
  const [editor, setEditor] = useState<Editor | undefined>()
  const [message, setMessage] = useState<string | undefined>()
  const list = habituar.useClasses(membership, archived)
  const current = habituar.useClassDetail(membership, selectedId)
  const candidates = habituar.useClassCandidates(membership, selectedId !== undefined)
  const actions = habituar.useClassActions(membership)
  const archiveId = useId()

  async function save(name: string, description: string | null): Promise<void> {
    if (editor?.kind === 'edit' && current.state.status === 'ready' && current.state.detail.id === editor.classId) {
      await actions.update(editor.classId, current.state.detail.version, name, description)
      setMessage(t('messages.updated'))
    } else {
      const created = await actions.create(name, description)
      setArchived(false)
      setSelectedId(created.id)
      setMessage(t('messages.created'))
    }
  }

  return (
    <div className="flex flex-col gap-xxl">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <PageHeader eyebrow={membership.institution.name} title={t('title')} description={t('description')} />
        {capabilities.canCreate && (
          <Button type="button" onClick={() => { setEditor({ kind: 'create' }); setMessage(undefined) }}>
            <Plus aria-hidden="true" className="size-4" />{t('actions.create')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-md">
        <label htmlFor={archiveId} className="flex min-h-tap-target items-center gap-sm text-body">
          <input id={archiveId} type="checkbox" checked={archived} onChange={(event) => { setArchived(event.target.checked); setSelectedId(undefined); setMessage(undefined) }} />
          {t('showArchived')}
        </label>
        {capabilities.canRead && <Button type="button" variant="outline" size="sm" onClick={() => { void list.refresh() }}><RefreshCw aria-hidden="true" className="size-4" />{t('actions.refresh')}</Button>}
      </div>

      {message !== undefined && <p role="status" className="text-body text-primary" aria-live="polite">{message}</p>}
      {!capabilities.canRead && <p role="note" className="text-body text-text-muted">{t('errors.readPermission')}</p>}
      {capabilities.canRead && list.state.status === 'loading' && <p role="status" className="text-body text-text-muted">{t('loading')}</p>}
      {capabilities.canRead && list.state.status === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center gap-md">
          <p className="text-body text-danger">{t(list.state.failure === 'forbidden' ? 'errors.forbidden' : 'errors.load')}</p>
          <Button type="button" variant="outline" onClick={() => { void list.refresh() }}>{t('actions.retry')}</Button>
        </div>
      )}
      {list.state.status === 'ready' && (
        <div className="grid min-w-0 gap-xl lg:grid-cols-[minmax(14rem,0.9fr)_minmax(0,1.6fr)]">
          <section className="flex min-w-0 flex-col gap-md" aria-label={t('listLabel')}>
            <p className="text-caption text-text-muted">{t('totalClasses', { count: list.state.items.length })}</p>
            {list.state.items.length === 0 ? (
              <EmptyState icon={UsersRound} title={t(archived ? 'emptyArchived' : 'empty')} description={t(archived ? 'emptyArchivedDescription' : 'emptyDescription')} />
            ) : (
              <ul className="flex flex-col gap-sm">
                {list.state.items.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selectedId === item.id}
                      onClick={() => { setSelectedId(item.id); setMessage(undefined) }}
                      className={
                        'w-full rounded-field border p-md text-left outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
                        (selectedId === item.id ? 'border-primary bg-surface-muted' : 'border-hairline bg-surface hover:border-primary')
                      }
                    >
                      <span className="flex items-start justify-between gap-sm">
                        <span className="break-words text-body font-semibold text-text">{item.name}</span>
                        {item.archivedAt !== null && <Archive aria-label={t('archived')} className="size-4 shrink-0 text-text-muted" />}
                      </span>
                      {item.description !== null && <span className="mt-xs block text-caption text-text-muted">{item.description}</span>}
                      <span className="mt-sm block text-caption text-text-muted">{t('membersSummary', { students: item.studentCount, staff: item.staffCount })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="min-w-0" aria-label={t('detailLabel')}>
            {current.state.status === 'idle' && (
              <EmptyState icon={UsersRound} title={t('selectTitle')} description={t('selectDescription')} />
            )}
            {current.state.status === 'loading' && <p role="status" className="text-body text-text-muted">{t('loadingDetail')}</p>}
            {current.state.status === 'failed' && (
              <div role="alert" className="flex flex-col items-start gap-sm">
                <p className="text-body text-danger">{t(current.state.failure === 'forbidden' ? 'errors.forbidden' : 'errors.loadDetail')}</p>
                <Button type="button" variant="outline" onClick={() => { void current.refresh() }}>{t('actions.retry')}</Button>
              </div>
            )}
            {current.state.status === 'ready' && (
              <ClassDetailPanel
                key={current.state.detail.id}
                detail={current.state.detail}
                capabilities={capabilities}
                candidates={candidates}
                actions={actions}
                onRefresh={() => { void current.refresh() }}
                onEdit={() => {
                  if (current.state.status !== 'ready') return
                  setEditor({ kind: 'edit', classId: current.state.detail.id })
                  setMessage(undefined)
                }}
                onStatusChange={(isArchived) => { setArchived(isArchived); setMessage(t(isArchived ? 'messages.archived' : 'messages.reopened')) }}
              />
            )}
          </section>
        </div>
      )}

      {editor !== undefined && (
        <ClassEditorDialog
          key={editor.kind === 'create' ? 'create' : editor.classId}
          isOpen
          onClose={() => { setEditor(undefined) }}
          {...(editor.kind === 'edit' && current.state.status === 'ready' ? { initial: current.state.detail } : {})}
          pending={actions.pending}
          failure={actions.failure}
          onSave={save}
        />
      )}
    </div>
  )
}
