import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'

/** Links antigos de edição da gestão chegam à edição da ficha comum e preservam a lista de origem. */
export default function EditStudentRoute() {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const parsed = studentIdSchema.safeParse(params['student-id'])
  if (!parsed.success) return <Redirect href="/professional/management/students" />
  return <Redirect href={{ pathname: '/professional/students/[student-id]/edit', params: { 'student-id': parsed.data, from: 'management' } }} />
}
