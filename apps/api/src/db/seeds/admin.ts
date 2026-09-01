import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { PERMISSION_CATALOG } from '@habituar/core/permissions';
import { db } from '../client';
import { users, institutions, roles, permissions, rolePermissions, memberships } from '../schemas';
import { hashPassword } from '../../modules/auth/password';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error('Defina ADMIN_EMAIL no .env');

  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingUser) {
    console.log('Admin já existe, nada a fazer.');
    return;
  }

  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(users).values({
    email,
    passwordHash,
    name: 'Administrador',
    mustChangePassword: 'true',
  }).returning();
  if (!user) throw new Error('Falha ao criar usuário admin: insert não retornou linha');

  const [institution] = await db.insert(institutions).values({
    name: process.env.ADMIN_INSTITUTION_NAME ?? 'Instituição Padrão',
  }).returning();
  if (!institution) throw new Error('Falha ao criar instituição: insert não retornou linha');

  // Garante o catálogo na tabela — idempotente, roda em qualquer ordem.
  for (const key of PERMISSION_CATALOG) {
    await db.insert(permissions).values({ key }).onConflictDoNothing();
  }

  const [adminRole] = await db.insert(roles).values({
    institutionId: institution.id,
    name: 'institution_admin',
    isSystem: true,
  }).returning();
  if (!adminRole) throw new Error('Falha ao criar papel de admin: insert não retornou linha');

  await db.insert(rolePermissions).values(
    PERMISSION_CATALOG.map((key) => ({
      roleId: adminRole.id,
      permissionKey: key,
      scope: 'institution' as const,
    })),
  );

  await db.insert(memberships).values({
    userId: user.id,
    institutionId: institution.id,
    roleId: adminRole.id,
  });

  console.log('Admin criado com sucesso.');
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`Senha temporária (guarde agora, não será mostrada de novo): ${password}`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});