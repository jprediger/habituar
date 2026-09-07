import * as argon2 from 'argon2'

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id })
}

export async function verifyPassword(passwordHash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(passwordHash, plainPassword)
}
