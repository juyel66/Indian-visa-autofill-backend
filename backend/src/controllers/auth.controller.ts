import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { verifyGoogleToken, exchangeGoogleCode } from '../services/google.service';
import {
  findOrCreateUser,
  authenticateWithPassword,
  generateAuthTokens,
  refreshAccessToken,
  revokeRefreshToken,
} from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * POST /api/auth/login
 * Admin & Staff dashboard email/password authentication
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const user = await authenticateWithPassword(email, password);
    const tokens = await generateAuthTokens(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: tokens.accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          role: user.role,
          isActive: user.isActive,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error: any) {
    const message = error.message === 'Account disabled'
      ? 'Account disabled'
      : 'Invalid email or password';
    res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function googleExchange(req: Request, res: Response): Promise<void> {
  try {
    const { code, redirectUri, codeVerifier, clientId } = req.body || {};

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Authorization code is required.',
      });
      return;
    }

    // 1. Exchange authorization code with Google
    const googleProfile = await exchangeGoogleCode(code, redirectUri, codeVerifier, clientId);

    // 2. Find or create local user
    const user = await findOrCreateUser(googleProfile);

    // Check active status
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
      return;
    }

    // 3. Issue application JWT tokens
    const tokens = await generateAuthTokens(user.id);

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        token: tokens.accessToken,
        user: {
          id: user.id,
          googleId: user.googleId,
          name: user.name,
          email: user.email,
          picture: user.picture,
          role: user.role,
          isActive: user.isActive,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || 'Google authorization code exchange failed.',
    });
  }
}

export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    const token =
      req.body?.token ||
      req.body?.credential ||
      req.body?.idToken ||
      req.body?.accessToken;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Google authentication credential/token is required.',
      });
      return;
    }

    // 1. Verify Google identity
    const googleProfile = await verifyGoogleToken(token);

    // 2. Find or create user
    const user = await findOrCreateUser(googleProfile);

    // Check active status
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
      return;
    }

    // 3. Issue application JWT tokens
    const tokens = await generateAuthTokens(user.id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          role: user.role,
          isActive: user.isActive,
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || 'Google authentication failed.',
    });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const token = req.body?.refreshToken;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
      return;
    }

    const { accessToken } = await refreshAccessToken(token);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || 'Failed to refresh access token.',
    });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authenticated.',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        googleId: req.user.googleId,
        name: req.user.name,
        email: req.user.email,
        picture: req.user.picture,
        role: req.user.role,
        isActive: req.user.isActive,
        createdAt: req.user.createdAt,
      },
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = req.body?.refreshToken;
    if (token) {
      await revokeRefreshToken(token);
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Logout failed.',
    });
  }
}

/**
 * POST /api/auth/change-password
 * Allows any authenticated user (Mother Super Admin, Admin, Manager, User) to change their own password.
 */
export async function changeOwnPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // If the user already has a passwordHash set, verify their currentPassword
    if (user.passwordHash) {
      if (!currentPassword || typeof currentPassword !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Current password is required to set a new password.',
        });
        return;
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        res.status(400).json({
          success: false,
          message: 'Current password does not match.',
        });
        return;
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update password.',
    });
  }
}
