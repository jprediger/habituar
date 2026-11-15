import { oc } from '@orpc/contract'
import {
  assignClassStaffInputSchema, changeClassStatusInputSchema, classDetailSchema, classListSchema,
  classPathSchema, classStaffPathSchema, classStudentPathSchema, createClassInputSchema,
  enrollClassStudentInputSchema, listClassesInputSchema, updateClassInputSchema,
} from '../classes.js'

const BASE = '/institutions/{institutionId}/classes'
const ITEM = `${BASE}/{classId}`

/** O mesmo contrato autoriza a gestão de turmas na web e no mobile. */
export const classesContract = {
  list: oc.route({ method: 'GET', path: BASE }).input(listClassesInputSchema).output(classListSchema),
  get: oc.route({ method: 'GET', path: ITEM }).input(classPathSchema).output(classDetailSchema),
  create: oc.route({ method: 'POST', path: BASE }).input(createClassInputSchema).output(classDetailSchema),
  update: oc.route({ method: 'PUT', path: ITEM }).input(updateClassInputSchema).output(classDetailSchema),
  archive: oc.route({ method: 'POST', path: `${ITEM}/archive` }).input(changeClassStatusInputSchema).output(classDetailSchema),
  unarchive: oc.route({ method: 'POST', path: `${ITEM}/unarchive` }).input(changeClassStatusInputSchema).output(classDetailSchema),
  enrollStudent: oc.route({ method: 'POST', path: `${ITEM}/students/{studentId}` }).input(enrollClassStudentInputSchema).output(classDetailSchema),
  removeStudent: oc.route({ method: 'DELETE', path: `${ITEM}/students/{studentId}` }).input(classStudentPathSchema).output(classDetailSchema),
  assignStaff: oc.route({ method: 'POST', path: `${ITEM}/staff/{membershipId}` }).input(assignClassStaffInputSchema).output(classDetailSchema),
  removeStaff: oc.route({ method: 'DELETE', path: `${ITEM}/staff/{membershipId}` }).input(classStaffPathSchema).output(classDetailSchema),
}
