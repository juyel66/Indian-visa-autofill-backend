import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { getUserById, UserResponse } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: UserResponse;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. Missing or malformed authorization token.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access denied. Token not provided.',
    });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;

    const userId = payload.sub;
    if (!userId || typeof userId !== 'string') {
      res.status(401).json({
        success: false,
        message: 'Invalid token subject.',
      });
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User associated with this token no longer exists.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Access token has expired.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
    });
  }
}

export const requireAuth = authenticate;

/**
 * Middleware factory enforcing that the authenticated user possesses one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
}

// Convenient role guards
export const requireDashboardAccess = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.MANAGER
);

export const requireAdminOrSuperAdmin = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN
);

export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);
