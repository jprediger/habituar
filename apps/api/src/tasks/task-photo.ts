import { TASK_PHOTO_MAX_BYTES, type TaskPhotoInput } from '@habituar/core/tasks'

/**
 * Bytes da foto quando o conteúdo real bate com o tipo declarado e cabe no limite.
 * O tipo vem do cliente; a assinatura do arquivo é o que decide se é mesmo uma imagem.
 */
export function readValidPhotoBytes(photo: TaskPhotoInput): Uint8Array | undefined {
  const bytes = Buffer.from(photo.base64, 'base64')
  if (bytes.length === 0 || bytes.length > TASK_PHOTO_MAX_BYTES) return undefined
  switch (photo.mediaType) {
    case 'image/jpeg': return bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) ? bytes : undefined
    case 'image/png': return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ? bytes : undefined
    case 'image/webp': return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' ? bytes : undefined
  }
}
