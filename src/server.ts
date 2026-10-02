import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import app from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;

export const prisma = new PrismaClient();

async function startServer(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database has been connected');

    app.listen(PORT, () => {
      console.log(`Visa Autofill server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

startServer();
