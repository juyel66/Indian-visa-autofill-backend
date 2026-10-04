'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  User as UserIcon,
  Mail,
  Shield,
  Calendar,
  KeyRound,
  LogOut,
  FileText,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const [appCount, setAppCount] = useState<number | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function loadCount() {
      try {
        const res = await api.getAdminApplications({ limit: 1 });
        setAppCount(res.total);
      } catch {
        setAppCount(0);
      }
    }
    loadCount();
  }, []);

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'VA';

  const isMotherSuperAdmin = user?.email?.toLowerCase() === 'mdjuyelrana.com.bd1@gmail.com';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toastError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changeOwnPassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      toastSuccess('Your password has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toastError(err.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Account Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            View your authenticated credentials and account details
          </p>
        </div>
        {isMotherSuperAdmin && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl shadow-xs">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Mother Super Admin (Permanent)</span>
          </span>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Banner Cover */}
        <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700"></div>

        <div className="px-6 pb-6 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 sm:-mt-10 gap-4 mb-6">
            <div className="flex items-end gap-4">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center border-4 border-white shadow-md">
                  {initials}
                </div>
              )}

              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {user?.name || 'Authorized User'}
                  </h2>
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs sm:text-sm text-slate-500">
                    {user?.email || 'N/A'}
                  </p>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                    {user?.role?.replace('_', ' ') || 'STAFF'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100 shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs sm:text-sm">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Full Name
              </span>
              <p className="font-semibold text-slate-900">
                {user?.name || 'Not provided'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Email Address
              </span>
              <p className="font-semibold text-slate-900">
                {user?.email || 'Not provided'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Assigned Role
              </span>
              <p className="font-bold text-slate-900 flex items-center gap-2">
                <span>{user?.role?.replace('_', ' ')}</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                  Active
                </span>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Account User ID
              </span>
              <p className="font-mono text-xs text-slate-700 font-semibold break-all">
                {user?.id || 'Protected Identity'}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 sm:col-span-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Applications Saved
              </span>
              <p className="font-semibold text-slate-900">
                {appCount !== null ? `${appCount} application(s)` : 'Loading...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Change Password
            </h3>
            <p className="text-xs text-slate-500">
              Update your account login password
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg mt-4 text-xs sm:text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Current Password <span className="text-slate-400 font-normal lowercase">(if previously set)</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 pr-10 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 pr-10 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 pr-10 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Secure Staff Access
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Your staff credentials provide encrypted access to the Visa Autofill control panel. All operations, application records, and audit events are synchronized server-side.
            </p>
            <div className="mt-3 text-[11px] text-slate-600 font-medium">
              Sensitive server secrets, database connection strings, and JWT signing keys are strictly protected on the backend.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
