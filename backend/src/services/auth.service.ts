import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { GoogleUserProfile } from './google.service';
import { isConfiguredSuperAdmin } from '../config/superAdmin';
import { calculateRefreshTokenExpiresAt } from '../utils/duration';

export interface UserResponse {
  id: string;
  googleId: string | null;
  name: string;
  email: string;
  picture: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function authenticateWithPassword(email: string, password: string): Promise<UserResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account disabled');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Ensure super admin role if configured
  if (isConfiguredSuperAdmin(normalizedEmail) && user.role !== 'SUPER_ADMIN') {
    return prisma.user.update({
      where: { id: user.id },
      data: { role: 'SUPER_ADMIN', isActive: true },
    });
  }

  return user;
}

export async function findOrCreateUser(profile: GoogleUserProfile): Promise<UserResponse> {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const shouldBeSuperAdmin = isConfiguredSuperAdmin(normalizedEmail);

  // 1. Check if user exists by googleId
  let user = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
  });

  if (user) {
    const updateData: {
      name?: string;
      picture?: string | null;
      email?: string;
      role?: UserRole;
    } = {};

    if (user.name !== profile.name) updateData.name = profile.name;
    if (user.picture !== profile.picture) updateData.picture = profile.picture;
    if (user.email !== normalizedEmail) updateData.email = normalizedEmail;

    // Auto-promote configured super admins
    if (shouldBeSuperAdmin && user.role !== 'SUPER_ADMIN') {
      updateData.role = 'SUPER_ADMIN';
    }

    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    return user;
  }

  // 2. Check if a user with this email already exists
  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingByEmail) {
    const updateData: {
      googleId: string;
      name?: string;
      picture?: string | null;
      role?: UserRole;
    } = {
      googleId: profile.googleId,
    };

    if (existingByEmail.name !== profile.name) updateData.name = profile.name;
    if (existingByEmail.picture !== profile.picture) updateData.picture = profile.picture;

    // Auto-promote configured super admins
    if (shouldBeSuperAdmin && existingByEmail.role !== 'SUPER_ADMIN') {
      updateData.role = 'SUPER_ADMIN';
    }

    user = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: updateData,
    });

    return user;
  }

  // 3. Create new user
  const initialRole: UserRole = shouldBeSuperAdmin ? 'SUPER_ADMIN' : 'USER';

  user = await prisma.user.create({
    data: {
      googleId: profile.googleId,
      email: normalizedEmail,
      name: profile.name,
      picture: profile.picture,
      role: initialRole,
      isActive: true,
    },
  });

  return user;
}

export async function generateAuthTokens(userId: string): Promise<AuthTokens> {
  const accessSignOptions: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    subject: userId,
  };

  const refreshSignOptions: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    subject: userId,
  };

  const accessToken = jwt.sign({}, env.JWT_ACCESS_SECRET, accessSignOptions);
  const refreshToken = jwt.sign({}, env.JWT_REFRESH_SECRET, refreshSignOptions);

  // Store refresh token in database (approx 365 days validity matching JWT exp)
  const expiresAt = calculateRefreshTokenExpiresAt(refreshToken);
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

export async function refreshAccessToken(token: string): Promise<{ accessToken: string }> {
  if (!token) {
    throw new Error('Refresh token is required');
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }

  const userId = payload.sub;
  if (!userId) {
    throw new Error('Invalid token subject');
  }

  // Verify token exists in database and is not expired
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    if (tokenRecord) {
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } }).catch(() => {});
    }
    throw new Error('Refresh token has expired or has been revoked');
  }

  // Verify user still exists and is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('Account has been deactivated');
  }

  // Generate new short-lived access token
  const accessSignOptions: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as any,
    subject: userId,
  };

  const newAccessToken = jwt.sign({}, env.JWT_ACCESS_SECRET, accessSignOptions);

  return { accessToken: newAccessToken };
}

export async function revokeRefreshToken(token?: string): Promise<void> {
  if (token) {
    await prisma.refreshToken.deleteMany({
      where: { token },
    });
  }
}

export async function getUserById(userId: string): Promise<UserResponse | null> {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}
