import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { extractApplicantNames } from '../utils/nameFormatter';
import { logAuditEvent } from '../services/audit.service';
import { getConfiguredSuperAdminEmails, isConfiguredSuperAdmin } from '../config/superAdmin';
import { formatErrorMessage } from '../utils/errorHandler';

/**
 * GET /api/admin/dashboard/stats
 * Real server-side aggregated metrics for the admin dashboard.
 */
export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      countsRows,
      rawRecentApplications,
      recentUsers,
    ] = await Promise.all([
      prisma.$queryRaw<{
        totalUsers: number;
        activeUsers: number;
        totalApplications: number;
        applicationsToday: number;
        applicationsThisMonth: number;
        totalAdmins: number;
        totalManagers: number;
        totalSuperAdmins: number;
      }[]>`
        SELECT 
          (SELECT count(*)::int FROM "User") AS "totalUsers",
          (SELECT count(*)::int FROM "User" WHERE "isActive" = true) AS "activeUsers",
          (SELECT count(*)::int FROM "User" WHERE "role" = 'ADMIN'::"UserRole") AS "totalAdmins",
          (SELECT count(*)::int FROM "User" WHERE "role" = 'MANAGER'::"UserRole") AS "totalManagers",
          (SELECT count(*)::int FROM "User" WHERE "role" = 'SUPER_ADMIN'::"UserRole") AS "totalSuperAdmins",
          (SELECT count(*)::int FROM "Application") AS "totalApplications",
          (SELECT count(*)::int FROM "Application" WHERE "createdAt" >= ${startOfDay}) AS "applicationsToday",
          (SELECT count(*)::int FROM "Application" WHERE "createdAt" >= ${startOfMonth}) AS "applicationsThisMonth"
      `,
      prisma.application.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          applicantName: true,
          passportNumber: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          picture: true,
        },
      }),
    ]);

    const counts = countsRows[0] || {
      totalUsers: 0,
      activeUsers: 0,
      totalApplications: 0,
      applicationsToday: 0,
      applicationsThisMonth: 0,
      totalAdmins: 0,
      totalManagers: 0,
      totalSuperAdmins: 0,
    };

    // Format applicant names: Given Name + Surname
    const recentApplications = rawRecentApplications.map((app) => {
      const names = extractApplicantNames(null, app.applicantName);
      return {
        id: app.id,
        applicantGivenName: names.givenName,
        applicantSurname: names.surname,
        applicantFullName: names.fullName,
        passportNumber: app.passportNumber,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        user: app.user,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers: Number(counts.totalUsers || 0),
        activeUsers: Number(counts.activeUsers || 0),
        totalApplications: Number(counts.totalApplications || 0),
        applicationsToday: Number(counts.applicationsToday || 0),
        applicationsThisMonth: Number(counts.applicationsThisMonth || 0),
        totalAdmins: Number(counts.totalAdmins || 0),
        totalManagers: Number(counts.totalManagers || 0),
        totalSuperAdmins: Number(counts.totalSuperAdmins || 0),
        recentApplications,
        recentUsers,
      },
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve dashboard statistics', error),
    });
  }
}

/**
 * GET /api/admin/applications
 * Paginated application list across all users with uploader details and search filters.
 */
export async function getAdminApplications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string)?.trim();
    const status = (req.query.status as string)?.trim();
    const userId = (req.query.userId as string)?.trim();

    const where: Prisma.ApplicationWhereInput = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { applicantName: { contains: search, mode: 'insensitive' } },
        { passportNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, rawApps] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          applicantName: true,
          passportNumber: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          originalPdfFileName: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              picture: true,
            },
          },
        },
      }),
    ]);

    const applications = rawApps.map((app) => {
      const names = extractApplicantNames(null, app.applicantName);
      return {
        id: app.id,
        applicantGivenName: names.givenName,
        applicantSurname: names.surname,
        applicantFullName: names.fullName,
        passportNumber: app.passportNumber,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        originalPdfFileName: app.originalPdfFileName,
        user: app.user,
      };
    });

    res.status(200).json({
      success: true,
      data: applications,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve applications:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve applications', error),
    });
  }
}

/**
 * GET /api/admin/applications/:id
 * Complete application details with uploader profile and formatted names.
 */
export async function getAdminApplicationById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);

    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!app) {
      res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
      return;
    }

    const names = extractApplicantNames(app.applicationData, app.applicantName);

    res.status(200).json({
      success: true,
      data: {
        id: app.id,
        applicantGivenName: names.givenName,
        applicantSurname: names.surname,
        applicantFullName: names.fullName,
        passportNumber: app.passportNumber,
        status: app.status,
        originalPdfFileName: app.originalPdfFileName,
        originalPdfMimeType: app.originalPdfMimeType,
        applicationData: app.applicationData,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        user: app.user,
      },
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve application details:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve application details', error),
    });
  }
}

/**
 * DELETE /api/admin/applications/:id
 * Privileged application deletion. Allowed for SUPER_ADMIN and ADMIN.
 */
export async function deleteAdminApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);

    const existing = await prisma.application.findUnique({
      where: { id },
      select: { id: true, applicantName: true, passportNumber: true, userId: true },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Application not found.',
      });
      return;
    }

    await prisma.application.delete({
      where: { id },
    });

    await logAuditEvent({
      actorUserId: req.user?.id,
      action: 'APPLICATION_DELETED',
      targetType: 'Application',
      targetId: id,
      metadata: {
        applicantName: existing.applicantName,
        passportNumber: existing.passportNumber,
        uploaderUserId: existing.userId,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Application deleted successfully by administrator.',
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to delete application:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to delete application', error),
    });
  }
}

/**
 * GET /api/admin/applications/:id/pdf
 * Streams original PDF bytes for any application to authorized staff.
 */
export async function downloadAdminApplicationPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);

    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        originalPdf: true,
        originalPdfFileName: true,
        originalPdfMimeType: true,
      },
    });

    if (!application || !application.originalPdf) {
      res.status(404).json({
        success: false,
        message: 'PDF not found for this application.',
      });
      return;
    }

    const fileName = application.originalPdfFileName || 'passport.pdf';
    const mimeType = application.originalPdfMimeType || 'application/pdf';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', application.originalPdf.length);
    res.end(Buffer.from(application.originalPdf));
  } catch (error: any) {
    console.error('[AdminController] Failed to stream PDF:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to stream PDF', error),
    });
  }
}

/**
 * GET /api/admin/users
 * Paginated list of users with search, role, and active status filters.
 */
export async function getAdminUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string)?.trim();
    const role = (req.query.role as string)?.trim();
    const status = (req.query.status as string)?.trim();

    const where: Prisma.UserWhereInput = {};

    if (role && role !== 'all') {
      if (Object.values(UserRole).includes(role as UserRole)) {
        where.role = role as UserRole;
      }
    }

    if (status && status !== 'all') {
      if (status === 'active') where.isActive = true;
      if (status === 'inactive') where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          picture: true,
          role: true,
          isActive: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              applications: true,
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      picture: u.picture,
      role: u.role,
      isActive: u.isActive,
      hasPassword: Boolean(u.passwordHash),
      isMotherSuperAdmin: isConfiguredSuperAdmin(u.email),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      _count: u._count,
    }));

    res.status(200).json({
      success: true,
      data: formattedUsers,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve users:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve users', error),
    });
  }
}

/**
 * GET /api/admin/users/:id
 * Single user details, application count, and recent applications.
 */
export async function getAdminUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        googleId: true,
        name: true,
        email: true,
        picture: true,
        role: true,
        isActive: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
        applications: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            applicantName: true,
            passportNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            applicationData: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    const formattedApplications = user.applications.map((app) => {
      const names = extractApplicantNames(app.applicationData, app.applicantName);
      return {
        id: app.id,
        applicantGivenName: names.givenName,
        applicantSurname: names.surname,
        applicantFullName: names.fullName,
        passportNumber: app.passportNumber,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        picture: user.picture,
        role: user.role,
        isActive: user.isActive,
        hasPassword: Boolean(user.passwordHash),
        isMotherSuperAdmin: isConfiguredSuperAdmin(user.email),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        totalApplications: user._count.applications,
        applications: formattedApplications,
      },
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve user details:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve user details', error),
    });
  }
}

/**
/**
 * POST /api/admin/users
 * Create a new user (USER, MANAGER, or ADMIN).
 * SUPER_ADMIN role can NEVER be created through this API.
 */
export async function createAdminUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role = 'USER', isActive = true } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, message: 'Name is required.' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, message: 'Valid email is required.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // The hardcoded Mother Super Admin email is reserved
    if (isConfiguredSuperAdmin(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: 'This email is reserved for the Mother Super Admin account.',
      });
      return;
    }

    if (!['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed roles are: USER, MANAGER, ADMIN, SUPER_ADMIN.',
      });
      return;
    }

    // Role check: Normal ADMIN can only create USER or MANAGER
    if (req.user?.role === UserRole.ADMIN && (role === 'ADMIN' || role === 'SUPER_ADMIN')) {
      res.status(403).json({
        success: false,
        message: 'Administrators cannot create Administrator or Super Admin accounts.',
      });
      return;
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN accounts
    if (role === 'SUPER_ADMIN' && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Only a Super Admin can create Super Admin accounts.',
      });
      return;
    }

    // Verify email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: role as UserRole,
        isActive: Boolean(isActive),
      },
      select: {
        id: true,
        name: true,
        email: true,
        picture: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      actorUserId: req.user?.id,
      action: 'USER_CREATED',
      targetType: 'User',
      targetId: newUser.id,
      metadata: {
        createdUserEmail: newUser.email,
        assignedRole: newUser.role,
      },
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: newUser,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to create user:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to create user', error),
    });
  }
}

/**
 * PATCH /api/admin/users/:id/role
 * Heavily protected role modification. Only SUPER_ADMIN can execute this.
 * Prevents modifying Super Admin and prevents assigning SUPER_ADMIN role.
 */
export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { role } = req.body || {};

    if (!role || !['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      res.status(400).json({
        success: false,
        message: 'A valid role is required (USER, MANAGER, ADMIN, SUPER_ADMIN).',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: 'Target user not found.',
      });
      return;
    }

    // Protection: Mother Super Admin cannot be downgraded or role-changed by anyone
    if (isConfiguredSuperAdmin(targetUser.email)) {
      res.status(403).json({
        success: false,
        message: 'The Mother Super Admin account role cannot be changed or demoted.',
      });
      return;
    }

    // Prevent changing own role
    if (req.user?.id === targetUser.id) {
      res.status(400).json({
        success: false,
        message: 'You cannot modify your own role.',
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      actorUserId: req.user?.id,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: id,
      metadata: {
        userEmail: targetUser.email,
        previousRole: targetUser.role,
        newRole: role,
      },
    });

    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully.`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to update user role:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to update user role', error),
    });
  }
}

/**
 * PATCH /api/admin/users/:id/status
 * Enable or disable a user account.
 * ADMINs can only modify regular USER accounts.
 * Super Admin cannot be disabled by anyone.
 */
export async function updateUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { isActive } = req.body || {};

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isActive boolean flag is required.',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: 'Target user not found.',
      });
      return;
    }

    // Protection: Mother Super Admin cannot be disabled by anyone
    if (isConfiguredSuperAdmin(targetUser.email)) {
      res.status(403).json({
        success: false,
        message: 'The Mother Super Admin account cannot be disabled.',
      });
      return;
    }

    // Prevent disabling own account
    if (req.user?.id === targetUser.id) {
      res.status(400).json({
        success: false,
        message: 'You cannot disable your own account.',
      });
      return;
    }

    // Normal ADMIN cannot disable SUPER_ADMIN or other ADMINs
    if (req.user?.role === UserRole.ADMIN && targetUser.role !== UserRole.USER) {
      res.status(403).json({
        success: false,
        message: 'Administrators can only modify the active status of regular User accounts.',
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // If deactivating user, revoke active refresh tokens immediately
    if (!isActive) {
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });
    }

    await logAuditEvent({
      actorUserId: req.user?.id,
      action: isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      targetType: 'User',
      targetId: id,
      metadata: {
        userEmail: targetUser.email,
        previousStatus: targetUser.isActive,
        newStatus: isActive,
      },
    });

    res.status(200).json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to update user status:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to update user status', error),
    });
  }
}

/**
 * DELETE /api/admin/users/:id
 * Delete a user account.
 * Super Admin cannot be deleted by anyone.
 * ADMINs can only delete regular USER accounts.
 */
export async function deleteAdminUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    // Protection: Mother Super Admin can NEVER be deleted
    if (isConfiguredSuperAdmin(targetUser.email)) {
      res.status(403).json({
        success: false,
        message: 'The Mother Super Admin account can never be deleted.',
      });
      return;
    }

    // Prevent deleting own account
    if (req.user?.id === targetUser.id) {
      res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
      return;
    }

    // Super Admin accounts can only be managed by Super Admin
    if (targetUser.role === UserRole.SUPER_ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
      res.status(403).json({
        success: false,
        message: 'Administrators cannot delete Super Admin accounts.',
      });
      return;
    }

    // Normal ADMIN can only delete regular USER accounts
    if (req.user?.role === UserRole.ADMIN && targetUser.role !== UserRole.USER) {
      res.status(403).json({
        success: false,
        message: 'Administrators can only delete regular User accounts.',
      });
      return;
    }

    // Delete user (cascade will delete tokens/applications or associated records)
    await prisma.user.delete({
      where: { id },
    });

    await logAuditEvent({
      actorUserId: req.user?.id,
      action: 'USER_DELETED',
      targetType: 'User',
      targetId: id,
      metadata: {
        userEmail: targetUser.email,
        userRole: targetUser.role,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully.',
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to delete user:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to delete user', error),
    });
  }
}

/**
 * POST /api/admin/users/:id/reset-password
 * Set / Add / Reset user password.
 * Accessible by SUPER_ADMIN and ADMIN.
 * Rules:
 * 1. Mother Super Admin credentials can ONLY be changed by the Mother Super Admin themselves.
 * 2. Regular Admins CANNOT change or add passwords for any Super Admin accounts.
 * 3. Super Admins can set/reset passwords for any accounts (except Mother Super Admin unless they are Mother Super Admin).
 */
export async function resetUserPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const { newPassword, password } = req.body || {};
    const pass = newPassword || password;

    if (!pass || typeof pass !== 'string' || pass.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: 'User not found.',
      });
      return;
    }

    const caller = req.user;
    const isCallerSuperAdmin = caller?.role === UserRole.SUPER_ADMIN;
    const isTargetMotherSuperAdmin = isConfiguredSuperAdmin(targetUser.email);
    const isTargetSuperAdmin = targetUser.role === UserRole.SUPER_ADMIN || isTargetMotherSuperAdmin;

    // Protection 1: Mother Super Admin's password can only be changed by Mother Super Admin themselves
    if (isTargetMotherSuperAdmin && caller?.id !== targetUser.id) {
      res.status(403).json({
        success: false,
        message: 'The Mother Super Admin credentials are permanently protected and cannot be changed by other accounts.',
      });
      return;
    }

    // Protection 2: Normal ADMIN cannot change or add password for any SUPER_ADMIN
    if (!isCallerSuperAdmin && isTargetSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'Administrators cannot change or add passwords for Super Admin accounts.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(pass, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Revoke all existing sessions for target user if caller is someone else
    if (caller?.id !== targetUser.id) {
      await prisma.refreshToken.deleteMany({
        where: { userId: id },
      });
    }

    await logAuditEvent({
      actorUserId: caller?.id,
      action: 'USER_PASSWORD_RESET',
      targetType: 'User',
      targetId: id,
      metadata: {
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
        changedBy: caller?.email,
      },
    });

    res.status(200).json({
      success: true,
      message: `Password has been set successfully for ${targetUser.name || targetUser.email}.`,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to set user password:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to set user password', error),
    });
  }
}

/**
 * GET /api/admin/audit-logs
 * Paginated system audit logs. Only accessible by SUPER_ADMIN.
 */
export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const action = (req.query.action as string)?.trim();

    const where: Prisma.AuditLogWhereInput = {};
    if (action && action !== 'all') {
      where.action = action;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              picture: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve audit logs:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve audit logs', error),
    });
  }
}

/**
 * GET /api/admin/settings
 * System information and configured super admin configuration.
 * Only accessible by SUPER_ADMIN.
 */
export async function getAdminSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const configuredEmails = getConfiguredSuperAdminEmails();

    const [superAdminCount, adminCount, managerCount, userCount] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.count({ where: { role: UserRole.MANAGER } }),
      prisma.user.count({ where: { role: UserRole.USER } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        configuredSuperAdminEmails: configuredEmails,
        roleCounts: {
          superAdmins: superAdminCount,
          admins: adminCount,
          managers: managerCount,
          users: userCount,
        },
        environment: process.env.NODE_ENV || 'development',
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[AdminController] Failed to retrieve settings:', error);
    res.status(500).json({
      success: false,
      message: formatErrorMessage('Failed to retrieve settings', error),
    });
  }
}
