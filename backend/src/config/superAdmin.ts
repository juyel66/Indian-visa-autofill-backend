import dotenv from 'dotenv';
dotenv.config();

/**
 * Returns the parsed, normalized list of configured super admin emails.
 * Normalization: trim, lowercase, filter out empty entries.
 */
export function getConfiguredSuperAdminEmails(): string[] {
  const single = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const raw = process.env.SUPER_ADMIN_EMAILS || '';
  const list = raw
    .split(',')
    .map((e) => e.replace(/['"\\;]/g, '').trim().toLowerCase())
    .filter(Boolean);

  if (single && !list.includes(single)) {
    list.unshift(single);
  }
  return list;
}

/**
 * Checks whether a given email address matches the permanent Mother Super Admin email.
 */
export function isMotherSuperAdmin(email?: string | null): boolean {
  return isConfiguredSuperAdmin(email);
}

export function isConfiguredSuperAdmin(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const configured = getConfiguredSuperAdminEmails();
  return configured.includes(normalized);
}

/**
 * Ensures the configured Super Admin account exists in the database.
 * If not present, creates it with SUPER_ADMIN role and SUPER_ADMIN_PASSWORD_HASH.
 * If already present and passwordHash is unset, initializes it.
 * Does NOT overwrite existing password on subsequent restarts.
 */
export async function ensureSuperAdminExists(prisma: any): Promise<void> {
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || getConfiguredSuperAdminEmails()[0] || '').trim().toLowerCase();
  const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

  if (!superAdminEmail) return;

  try {
    const existing = await prisma.user.findUnique({
      where: { email: superAdminEmail },
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          isActive: true,
          passwordHash: passwordHash || null,
        },
      });
      console.log(`[SuperAdmin] Created Super Admin account: ${superAdminEmail}`);
    } else {
      const updates: any = {};
      if (existing.role !== 'SUPER_ADMIN') {
        updates.role = 'SUPER_ADMIN';
      }
      if (!existing.isActive) {
        updates.isActive = true;
      }
      if (!existing.passwordHash && passwordHash) {
        updates.passwordHash = passwordHash;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: existing.id },
          data: updates,
        });
        console.log(`[SuperAdmin] Verified Super Admin account: ${superAdminEmail}`);
      }
    }
  } catch (error) {
    console.error('[SuperAdmin] Failed to initialize Super Admin account:', error);
  }
}
