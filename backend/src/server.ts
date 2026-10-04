import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './lib/prisma';
import { env } from './config/env';
import { ensureSuperAdminExists } from './config/superAdmin';

export { prisma };

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database has been connected');

    await ensureSuperAdminExists(prisma);

    app.listen(env.PORT, () => {
      console.log(`Visa Autofill server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

startServer();
