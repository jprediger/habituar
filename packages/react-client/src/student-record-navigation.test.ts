import { describe, expect, it } from 'vitest'
import { getStudentRecordCapabilities, listStudentRecordSections, resolveStudentRecordNavigation } from './student-record-navigation.js'

describe('student record navigation', () => {
  it('keeps registration accessible without clinical permissions', () => {
    expect(listStudentRecordSections([{ key: 'student.read', scope: 'assigned' }])).toEqual(['registration'])
  })

  it('offers clinical sections only to those allowed to read records', () => {
    expect(listStudentRecordSections([{ key: 'record.read', scope: 'assigned' }])).toEqual(['registration', 'profile', 'agenda', 'consultations', 'history'])
  })

  it('lets an administrative manager act without requesting clinical data', () => {
    expect(listStudentRecordSections([{ key: 'assignment.manage', scope: 'institution' }, { key: 'membership.read', scope: 'institution' }])).toEqual(['registration', 'management'])
  })

  it('requires both institution-wide grants before editing assignments', () => {
    expect(getStudentRecordCapabilities([{ key: 'assignment.manage', scope: 'institution' }, { key: 'membership.read', scope: 'assigned' }]).canManageAssignments).toBe(false)
    expect(getStudentRecordCapabilities([{ key: 'membership.read', scope: 'institution' }]).canManageAssignments).toBe(false)
  })

  it('keeps assigned editors from archiving institution records', () => {
    expect(getStudentRecordCapabilities([{ key: 'student.update', scope: 'assigned' }]).canArchive).toBe(false)
    expect(getStudentRecordCapabilities([{ key: 'student.update', scope: 'institution' }]).canArchive).toBe(true)
  })

  it('includes account invitations for those who may link guardians', () => {
    expect(listStudentRecordSections([{ key: 'guardian.link', scope: 'assigned' }])).toEqual(['registration', 'management'])
  })
})

describe('student record navigation state', () => {
  it('returns to management only when the record was opened there', () => {
    expect(resolveStudentRecordNavigation([], { from: 'management' }).origin).toBe('management')
    expect(resolveStudentRecordNavigation([], { from: 'elsewhere' }).origin).toBe('home')
  })

  it('refuses to open a section the grants do not offer', () => {
    expect(resolveStudentRecordNavigation([{ key: 'student.read', scope: 'assigned' }], { section: 'history' }).section).toBeUndefined()
    expect(resolveStudentRecordNavigation([{ key: 'record.read', scope: 'assigned' }], { section: 'history' }).section).toBe('history')
  })
})
