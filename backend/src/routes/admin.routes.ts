import { Router } from 'express';
import {
  requireAuth,
  requireDashboardAccess,
  requireAdminOrSuperAdmin,
  requireSuperAdmin,
} from '../middleware/auth.middleware';
import {
  getDashboardStats,
  getAdminApplications,
  getAdminApplicationById,
  deleteAdminApplication,
  downloadAdminApplicationPdf,
  getAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateUserRole,
  updateUserStatus,
  deleteAdminUser,
  resetUserPassword,
  getAuditLogs,
  getAdminSettings,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes strictly require an authenticated active user
router.use(requireAuth);

// 1. Dashboard Statistics (SUPER_ADMIN, ADMIN, MANAGER)
router.get('/dashboard/stats', requireDashboardAccess, getDashboardStats);

// 2. Applications Monitoring & Details (SUPER_ADMIN, ADMIN, MANAGER)
router.get('/applications', requireDashboardAccess, getAdminApplications);
router.get('/applications/:id', requireDashboardAccess, getAdminApplicationById);
router.get('/applications/:id/pdf', requireDashboardAccess, downloadAdminApplicationPdf);
router.delete('/applications/:id', requireAdminOrSuperAdmin, deleteAdminApplication);

// 3. User Management (SUPER_ADMIN, ADMIN, MANAGER)
router.get('/users', requireDashboardAccess, getAdminUsers);
router.post('/users', requireAdminOrSuperAdmin, createAdminUser);
router.get('/users/:id', requireDashboardAccess, getAdminUserById);
router.delete('/users/:id', requireAdminOrSuperAdmin, deleteAdminUser);
// Password management (SUPER_ADMIN & ADMIN)
router.post('/users/:id/reset-password', requireAdminOrSuperAdmin, resetUserPassword);
router.post('/users/:id/password', requireAdminOrSuperAdmin, resetUserPassword);

// Role modification (SUPER_ADMIN ONLY)
router.patch('/users/:id/role', requireSuperAdmin, updateUserRole);

// Status modification (SUPER_ADMIN & ADMIN)
router.patch('/users/:id/status', requireAdminOrSuperAdmin, updateUserStatus);

// 4. Audit Logs (SUPER_ADMIN ONLY)
router.get('/audit-logs', requireSuperAdmin, getAuditLogs);

// 5. System Settings (SUPER_ADMIN ONLY)
router.get('/settings', requireSuperAdmin, getAdminSettings);

export default router;
