'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { AdminUserDetail, UserRole } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Shield,
  Clock,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  Edit2,
  X,
  ExternalLink,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
} from 'lucide-react';

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { user: currentUser } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Role edit modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  // Status toggle
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Delete user
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';

  const canSetPassword = () => {
    if (!userDetail) return false;
    if (userDetail.isMotherSuperAdmin) {
      return currentUser?.email?.trim().toLowerCase() === userDetail.email?.trim().toLowerCase();
    }
    if (isSuperAdmin) return true;
    if (isAdmin && userDetail.role !== 'SUPER_ADMIN') return true;
    return false;
  };

  const canChangeRole = () => {
    if (!userDetail || !isSuperAdmin) return false;
    if (userDetail.isMotherSuperAdmin) return false;
    if (currentUser?.id === userDetail.id) return false;
    return true;
  };

  const canToggleStatus = () => {
    if (!userDetail) return false;
    if (userDetail.isMotherSuperAdmin) return false;
    if (currentUser?.id === userDetail.id) return false;
    if (isSuperAdmin) return true;
    if (isAdmin && userDetail.role === 'USER') return true;
    return false;
  };

  const canDeleteUser = () => {
    if (!userDetail) return false;
    if (userDetail.isMotherSuperAdmin) return false;
    if (currentUser?.id === userDetail.id) return false;
    if (isSuperAdmin) return true;
    if (isAdmin && userDetail.role === 'USER') return true;
    return false;
  };

  const handleDeleteUser = async () => {
    if (!userDetail) return;
    setDeletingUser(true);
    try {
      await api.deleteAdminUser(userDetail.id);
      toastSuccess(`User ${userDetail.name} deleted successfully.`);
      router.push('/dashboard/users');
    } catch (err: any) {
      toastError(err.message || 'Failed to delete user.');
      setDeletingUser(false);
    }
  };

  const fetchUser = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getAdminUser(id);
      setUserDetail(data);
      setNewRole(data.role);
    } catch (err: any) {
      toastError(err.message || 'Failed to load user details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [id]);

  const handleRoleSubmit = async () => {
    if (!userDetail) return;
    setUpdatingRole(true);
    try {
      await api.updateUserRole(userDetail.id, newRole);
      toastSuccess(`Role updated to ${newRole}`);
      setRoleModalOpen(false);
      fetchUser();
    } catch (err: any) {
      toastError(err.message || 'Failed to update role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetail) return;
    if (!passwordInput || passwordInput.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }

    setSettingPassword(true);
    try {
      await api.setUserPassword(userDetail.id, passwordInput);
      toastSuccess(`Password set successfully for ${userDetail.name}.`);
      setPasswordModalOpen(false);
      setPasswordInput('');
      fetchUser();
    } catch (err: any) {
      toastError(err.message || 'Failed to set password.');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!userDetail) return;
    if (userDetail.isMotherSuperAdmin) {
      toastError('The Mother Super Admin account cannot be disabled.');
      return;
    }
    if (isAdmin && userDetail.role !== 'USER') {
      toastError('Administrators can only modify status for regular User accounts.');
      return;
    }

    setTogglingStatus(true);
    try {
      const nextStatus = !userDetail.isActive;
      await api.updateUserStatus(userDetail.id, nextStatus);
      toastSuccess(`Account ${nextStatus ? 'activated' : 'deactivated'} successfully.`);
      fetchUser();
    } catch (err: any) {
      toastError(err.message || 'Failed to toggle account status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">User not found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This account does not exist or may have been deleted.
        </p>
        <Link
          href="/dashboard/users"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Users</span>
        </Link>
      </div>
    );
  }

  const roleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const latestApp = userDetail.applications[0];

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Back button & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/users"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              User Profile
            </h1>
            <p className="text-xs text-slate-500">
              Account ID: <span className="font-mono text-slate-700">{userDetail.id}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Set / Add Password Button */}
          {canSetPassword() && (
            <button
              onClick={() => {
                setPasswordInput('');
                setShowPasswordInput(false);
                setPasswordModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>{userDetail.hasPassword ? 'Change Password' : 'Add Password'}</span>
            </button>
          )}

          {/* Change Role Button (SUPER_ADMIN ONLY) */}
          {canChangeRole() && (
            <button
              onClick={() => setRoleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Change Role</span>
            </button>
          )}

          {/* Status Toggle */}
          {canToggleStatus() && (
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors shadow-xs ${
                userDetail.isActive
                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100'
              }`}
            >
              {togglingStatus ? 'Updating...' : userDetail.isActive ? 'Deactivate Account' : 'Activate Account'}
            </button>
          )}

          {/* Delete User */}
          {canDeleteUser() && (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete User</span>
            </button>
          )}

          {/* Mother Super Admin Indicator */}
          {userDetail.isMotherSuperAdmin && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Root Admin (Protected)</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {userDetail.picture ? (
            <img
              src={userDetail.picture}
              alt={userDetail.name}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-700 font-extrabold text-2xl flex items-center justify-center">
              {userDetail.name ? userDetail.name[0].toUpperCase() : 'U'}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                {userDetail.name}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${roleBadge(
                  userDetail.role
                )}`}
              >
                {userDetail.role.replace('_', ' ')}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-1">{userDetail.email}</p>

            <div className="flex items-center gap-3 mt-2 text-xs">
              {userDetail.isActive ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Active Account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
                  <XCircle className="w-3.5 h-3.5 text-rose-500" /> Deactivated
                </span>
              )}
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                Registered {new Date(userDetail.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Total Applications
          </span>
          <p className="text-2xl font-extrabold text-slate-900">
            {userDetail.totalApplications}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Uploaded through extension</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Latest Application
          </span>
          <p className="text-sm font-bold text-slate-900 truncate">
            {latestApp ? latestApp.applicantFullName : 'None'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {latestApp ? new Date(latestApp.createdAt).toLocaleDateString() : 'No activity'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Last Activity
          </span>
          <p className="text-sm font-bold text-slate-900">
            {new Date(userDetail.updatedAt).toLocaleDateString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Account update timestamp</p>
        </div>
      </div>

      {/* Applications Uploaded by this User */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              User Applications ({userDetail.applications.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Applications saved by this user
            </p>
          </div>
        </div>

        {userDetail.applications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            This user has not uploaded or saved any visa applications yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {userDetail.applications.map((app) => (
              <div
                key={app.id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {app.applicantFullName}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Passport: <span className="font-mono text-slate-700">{app.passportNumber || 'N/A'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Uploaded on {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                    {app.status || 'draft'}
                  </span>
                  <a
                    href={`/dashboard/applications/${app.id}`}
                    className="font-bold text-blue-600 hover:text-blue-700 text-xs inline-flex items-center gap-1"
                  >
                    <span>View &rarr;</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Management Modal (SUPER_ADMIN ONLY) */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setRoleModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Change Role</h3>
                <p className="text-xs text-slate-500">{userDetail.name}</p>
              </div>
            </div>

            <div className="my-6">
              <p className="text-xs text-slate-600 mb-3">
                As a Super Admin, you can assign any administrative or user role to this account:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                      newRole === r
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                disabled={updatingRole}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleSubmit}
                disabled={updatingRole}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
              >
                {updatingRole ? 'Updating...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set / Add Password Modal (ADMIN & SUPER_ADMIN) */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setPasswordModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {userDetail.hasPassword ? 'Update Password' : 'Add Password'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[260px]">
                  {userDetail.name} ({userDetail.email})
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 my-4 text-xs sm:text-sm">
              <p className="text-xs text-slate-600 leading-relaxed">
                Set a login password for this account. Once saved, the user can immediately log in using their email (<strong className="text-slate-900 font-semibold">{userDetail.email}</strong>) and this password.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswordInput ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Enter at least 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 pr-10 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPasswordInput ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  disabled={settingPassword}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settingPassword}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {settingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteUser}
        title="Delete this user account?"
        applicantName={userDetail?.name}
        loading={deletingUser}
      />
    </div>
  );
}
