import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function setSuperAdminPassword() {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'mdjuyelrana.com.bd1@gmail.com').trim().toLowerCase();
  const rawPassword = process.env.SUPER_ADMIN_RAW_PASSWORD || 'Juyel294922*#@';
  
  console.log(`Setting password for Super Admin: ${email}`);
  const hash = await bcrypt.hash(rawPassword, 10);
  console.log('Generated bcrypt hash:', hash);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash: hash,
    },
  });

  const verified = await bcrypt.compare(rawPassword, user.passwordHash || '');
  console.log('Updated user:', {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  });
  console.log('Password verification:', verified ? 'SUCCESS' : 'FAILED');

  await prisma.$disconnect();
}

setSuperAdminPassword().catch((err) => {
  console.error('Error setting super admin password:', err);
  process.exit(1);
});
