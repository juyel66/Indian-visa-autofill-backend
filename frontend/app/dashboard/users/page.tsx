'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { AdminUserItem, UserRole } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import {
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Edit2,
  Users,
  UserPlus,
  Lock,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function UsersManagementPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Role Edit Modal State (SUPER_ADMIN only)
  const [selectedUserForRole, setSelectedUserForRole] = useState<AdminUserItem | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('USER');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Set / Add Password Modal State (ADMIN & SUPER_ADMIN)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AdminUserItem | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('USER');
  const [createActive, setCreateActive] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);

  // Status Toggle State
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';

  // Permission checks
  const canSetPassword = (u: AdminUserItem) => {
    // If target is Mother Super Admin, only Mother Super Admin themselves can modify
    if (u.isMotherSuperAdmin) {
      return currentUser?.email?.trim().toLowerCase() === u.email?.trim().toLowerCase();
    }
    // Super Admin can set password for anyone else
    if (isSuperAdmin) return true;
    // Regular Admin cannot touch Super Admin
    if (isAdmin && u.role !== 'SUPER_ADMIN') return true;
    return false;
  };

  const canChangeRole = (u: AdminUserItem) => {
    if (!isSuperAdmin) return false;
    if (u.isMotherSuperAdmin) return false;
    if (currentUser?.id === u.id) return false;
    return true;
  };

  const canToggleStatus = (u: AdminUserItem) => {
    if (u.isMotherSuperAdmin) return false;
    if (currentUser?.id === u.id) return false;
    if (isSuperAdmin) return true;
    if (isAdmin && u.role === 'USER') return true;
    return false;
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers({
        page,
        limit,
        search: search.trim() || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      setUsers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      toastError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, statusFilter, toastError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleOpenRoleModal = (u: AdminUserItem) => {
    if (u.isMotherSuperAdmin) {
      toastError('The Mother Super Admin role cannot be modified.');
      return;
    }
    if (currentUser?.id === u.id) {
      toastError('You cannot modify your own role.');
      return;
    }
    setSelectedUserForRole(u);
    setNewRole(u.role);
  };

  const handleRoleSubmit = async () => {
    if (!selectedUserForRole) return;
    setUpdatingRole(true);
    try {
      await api.updateUserRole(selectedUserForRole.id, newRole);
      toastSuccess(`Updated role for ${selectedUserForRole.name} to ${newRole}`);
      setSelectedUserForRole(null);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleOpenPasswordModal = (u: AdminUserItem) => {
    if (u.isMotherSuperAdmin && currentUser?.email?.trim().toLowerCase() !== u.email?.trim().toLowerCase()) {
      toastError('The Mother Super Admin credentials are permanently protected.');
      return;
    }
    if (!isSuperAdmin && u.role === 'SUPER_ADMIN') {
      toastError('Administrators cannot change passwords for Super Admin accounts.');
      return;
    }
    setSelectedUserForPassword(u);
    setPasswordInput('');
    setShowPasswordInput(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;
    if (!passwordInput || passwordInput.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }

    setSettingPassword(true);
    try {
      await api.setUserPassword(selectedUserForPassword.id, passwordInput);
      toastSuccess(`Password successfully set for ${selectedUserForPassword.name}.`);
      setSelectedUserForPassword(null);
      setPasswordInput('');
      fetchUsers();
    } catch (err: any) {
      toastError(err.message || 'Failed to set user password.');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleToggleStatus = async (u: AdminUserItem) => {
    if (u.isMotherSuperAdmin) {
      toastError('The Mother Super Admin account cannot be disabled.');
      return;
    }

    if (currentUser?.id === u.id) {
      toastError('You cannot disable your own account.');
      return;
    }

    if (!isSuperAdmin && u.role === 'SUPER_ADMIN') {
      toastError('Administrators cannot modify Super Admin accounts.');
      return;
    }

    // Normal admins can only toggle regular USER accounts
    if (isAdmin && u.role !== 'USER') {
      toastError('Administrators can only activate or deactivate regular User accounts.');
      return;
    }

    setTogglingStatusId(u.id);
    try {
      const nextStatus = !u.isActive;
      await api.updateUserStatus(u.id, nextStatus);
      toastSuccess(`Account ${nextStatus ? 'activated' : 'deactivated'} successfully.`);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message || 'Failed to update account status.');
    } finally {
      setTogglingStatusId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = createName.trim();
    const trimmedEmail = createEmail.trim();

    if (!trimmedName || !trimmedEmail || !createPassword) {
      toastError('Please fill in all required fields.');
      return;
    }

    if (createPassword.length < 6) {
      toastError('Password must be at least 6 characters.');
      return;
    }

    setCreatingUser(true);
    try {
      await api.createAdminUser({
        name: trimmedName,
        email: trimmedEmail,
        password: createPassword,
        role: createRole,
        isActive: createActive,
      });

      toastSuccess(`User ${trimmedName} created successfully.`);
      setShowCreateModal(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('USER');
      setCreateActive(true);
      fetchUsers();
    } catch (err: any) {
      toastError(err.message || 'Failed to create user.');
    } finally {
      setCreatingUser(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Manage roles, view accounts, and control dashboard & API access ({total} users)
          </p>
        </div>

        {(isSuperAdmin || isAdmin) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </form>

        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="USER">USER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER ADMIN</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <button
            onClick={() => {
              setPage(1);
              fetchUsers();
            }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Main Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">No users found</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
            No accounts matched your current search and role filters.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-5">User</th>
                  <th className="py-3 px-5">Email Address</th>
                  <th className="py-3 px-5">Role</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Applications</th>
                  <th className="py-3 px-5">Joined</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => {
                  const isTargetSuperAdmin = u.role === 'SUPER_ADMIN';
                  const canToggleThisUser =
                    !isTargetSuperAdmin && (isSuperAdmin || (isAdmin && u.role === 'USER'));

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/dashboard/users/${u.id}`)}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {u.picture ? (
                            <img
                              src={u.picture}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center flex-shrink-0">
                              {u.name ? u.name[0].toUpperCase() : 'U'}
                            </div>
                          )}
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {u.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-5 text-slate-600 font-medium">
                        {u.email}
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleBadge(
                            u.role
                          )}`}
                        >
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 font-bold text-slate-700">
                        {u._count?.applications ?? 0}
                      </td>

                      <td className="py-4 px-5 text-slate-600">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/users/${u.id}`}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            View
                          </Link>

                          {/* Add / Set Password (ADMIN & SUPER_ADMIN) */}
                          {canSetPassword(u) && (
                            <button
                              onClick={() => handleOpenPasswordModal(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                              title={u.hasPassword ? 'Change or Reset Login Password' : 'Add Login Password'}
                            >
                              <KeyRound className="w-3 h-3 text-blue-600" />
                              <span>{u.hasPassword ? 'Password' : 'Add Password'}</span>
                            </button>
                          )}

                          {/* Role Management (SUPER_ADMIN ONLY, can promote anyone to SUPER_ADMIN except Mother) */}
                          {canChangeRole(u) && (
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Change Role"
                            >
                              Role
                            </button>
                          )}

                          {/* Status Toggle (SUPER_ADMIN or ADMIN for USER) */}
                          {canToggleStatus(u) && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={togglingStatusId === u.id}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                u.isActive
                                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {togglingStatusId === u.id ? '...' : u.isActive ? 'Disable' : 'Enable'}
                            </button>
                          )}

                          {/* Mother Super Admin Locked Indicator */}
                          {u.isMotherSuperAdmin && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                              <Lock className="w-3 h-3 text-amber-600" />
                              <span>Root Admin</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden space-y-3">
            {users.map((u) => {
              return (
                <div
                  key={u.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {u.picture ? (
                        <img
                          src={u.picture}
                          alt={u.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center flex-shrink-0">
                          {u.name ? u.name[0].toUpperCase() : 'U'}
                        </div>
                      )}
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{u.name}</h2>
                        <p className="text-xs text-slate-600">{u.email}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${roleBadge(
                        u.role
                      )}`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span>Applications: <strong className="text-slate-900">{u._count?.applications ?? 0}</strong></span>
                    <span>Status: {u.isActive ? <strong className="text-emerald-700">Active</strong> : <strong className="text-rose-600">Inactive</strong>}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/dashboard/users/${u.id}`}
                      className="py-1.5 px-3 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                    >
                      View
                    </Link>

                    {canSetPassword(u) && (
                      <button
                        onClick={() => handleOpenPasswordModal(u)}
                        className="inline-flex items-center gap-1 py-1.5 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-100"
                      >
                        <KeyRound className="w-3 h-3 text-blue-600" />
                        <span>{u.hasPassword ? 'Password' : 'Add Password'}</span>
                      </button>
                    )}

                    {canChangeRole(u) && (
                      <button
                        onClick={() => handleOpenRoleModal(u)}
                        className="py-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        Change Role
                      </button>
                    )}

                    {canToggleStatus(u) && (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={togglingStatusId === u.id}
                        className={`py-1.5 px-3 text-xs font-semibold rounded-xl transition-colors ${
                          u.isActive
                            ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                    )}

                    {u.isMotherSuperAdmin && (
                      <span className="inline-flex items-center gap-1 py-1 px-2.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Root Admin</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{users.length}</span> of{' '}
              <span className="font-bold text-slate-900">{total}</span> users (Page {page} of {totalPages})
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Create User
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Add a new staff or user account
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 my-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="USER">USER</option>
                  <option value="MANAGER">MANAGER</option>
                  {isSuperAdmin && <option value="ADMIN">ADMIN</option>}
                  {isSuperAdmin && <option value="SUPER_ADMIN">SUPER ADMIN</option>}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="createActive"
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <label htmlFor="createActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (user can sign in)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingUser}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Management Modal (SUPER_ADMIN ONLY - Can promote anyone to SUPER_ADMIN) */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setSelectedUserForRole(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Change Account Role
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[260px]">
                  {selectedUserForRole.name} ({selectedUserForRole.email})
                </p>
              </div>
            </div>

            <div className="space-y-4 my-6 text-xs sm:text-sm">
              <p className="text-xs text-slate-600 leading-relaxed">
                Select the role to assign. As a Super Admin, you can promote any user to Super Admin, Administrator, Manager, or standard User.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Role
                </label>
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
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUserForRole(null)}
                disabled={updatingRole}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleSubmit}
                disabled={updatingRole}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {updatingRole ? 'Updating...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set / Add Password Modal (ADMIN & SUPER_ADMIN) */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setSelectedUserForPassword(null)}
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
                  {selectedUserForPassword.hasPassword ? 'Update Password' : 'Add Password'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 truncate max-w-[260px]">
                  {selectedUserForPassword.name} ({selectedUserForPassword.email})
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 my-4 text-xs sm:text-sm">
              <p className="text-xs text-slate-600 leading-relaxed">
                Add or change the login password for this account. Once saved, this user can immediately sign in using their email (<strong className="text-slate-900 font-semibold">{selectedUserForPassword.email}</strong>) and this password.
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
                  onClick={() => setSelectedUserForPassword(null)}
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
    </div>
  );
}
