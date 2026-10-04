import dotenv from 'dotenv';
dotenv.config();

const googleWebClientId =
  process.env.GOOGLE_WEB_CLIENT_ID ||
  '478244875026-vc9kkmtbl8geq0gl2jv3vc40hndqqb0u.apps.googleusercontent.com';

const googleExtensionClientId =
  process.env.GOOGLE_EXTENSION_CLIENT_ID ||
  '478244875026-tpnqtk9ke8e1tpldgrsu40gft4r65ifu.apps.googleusercontent.com';

const trustedGoogleClientIds: string[] = Array.from(
  new Set(
    [
      googleWebClientId,
      googleExtensionClientId,
      process.env.GOOGLE_CLIENT_ID,
    ].filter(Boolean) as string[]
  )
);

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',

  // Dedicated Chrome Extension OAuth Configuration
  GOOGLE_EXTENSION_CLIENT_ID: googleExtensionClientId,
  GOOGLE_EXTENSION_CLIENT_SECRET:
    process.env.GOOGLE_EXTENSION_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_EXTENSION_REDIRECT_URI:
    process.env.GOOGLE_EXTENSION_REDIRECT_URI ||
    'https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/',

  // Dedicated Web Dashboard OAuth Configuration
  GOOGLE_WEB_CLIENT_ID: googleWebClientId,
  GOOGLE_WEB_CLIENT_SECRET:
    process.env.GOOGLE_WEB_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_WEB_REDIRECT_URI:
    process.env.GOOGLE_WEB_REDIRECT_URI || 'http://localhost:3000/login',

  // Trusted Client IDs (Dual Verification for Extension & Dashboard)
  TRUSTED_GOOGLE_CLIENT_IDS: trustedGoogleClientIds,

  // General / Fallback Compatibility
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || googleWebClientId,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ||
    'https://idjemajdjnoefigfbnnfmcpnnfgme.chromiumapp.org/',

  JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'default-access-secret-for-dev-only',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'default-access-secret-for-dev-only',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-for-dev-only',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '365d',
  SUPER_ADMIN_EMAILS: process.env.SUPER_ADMIN_EMAILS || 'mdjuyelrana.com.bd1@gmail.com',
};

export default env;
