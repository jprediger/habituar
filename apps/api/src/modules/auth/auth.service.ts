import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.module';
import { sessions, users } from '../../db/schemas';
import { hashPassword, verifyPassword } from './password';
import { generateSessionToken, hashSessionToken } from './session-token';
import type { LoginInput, RegisterInput } from './auth.schema';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias, expiração deslizante

@Injectable()
export class AuthService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async register(input: RegisterInput) {
    const existing = await this.db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (existing) throw new ConflictException('EMAIL_ALREADY_IN_USE');

    const passwordHash = await hashPassword(input.password);
    const [user] = await this.db.insert(users).values({
      email: input.email,
      passwordHash,
      name: input.name,
    }).returning();

    return user;
  }

  async login(input: LoginInput) {
    const user = await this.db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (!user) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');

    const token = generateSessionToken();
    await this.db.insert(sessions).values({
      id: hashSessionToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return { token, user };
  }

  async validateSession(token: string) {
    const id = hashSessionToken(token);
    const session = await this.db.query.sessions.findFirst({ where: eq(sessions.id, id) });
    if (!session || session.expiresAt < new Date()) return null;

    await this.db.update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, id));

    return this.db.query.users.findFirst({ where: eq(users.id, session.userId) }) ?? null;
  }

  async logout(token: string) {
    await this.db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
  }
}