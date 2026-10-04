'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import { DashboardStats } from '@/types';
import { useToast } from '@/components/Toast';
import {
  Users,
  UserCheck,
  FileText,
  Calendar,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  User,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { StatCardSkeleton } from '@/components/Skeletons';

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { error: toastError } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const loadStats = useCallback(async () => {
    if (fetchingRef.current) return;
    const currentUser = userRef.current;
    if (currentUser && currentUser.role === 'USER') return;

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      let msg = err.message || 'Unable to load dashboard data. Please try again.';
      if (
        msg.includes('AbortError') ||
        msg.includes('timeout') ||
        msg.includes('P1001') ||
        msg.includes('ETIMEDOUT')
      ) {
        msg = 'Unable to load dashboard data. Please try again.';
      } else if (msg.includes('fetch') || msg.includes('server')) {
        msg = 'Visa Autofill server is unavailable.';
      }
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [toastError]);

  useEffect(() => {
    if (user?.role && user.role !== 'USER') {
      loadStats();
    }
  }, [user?.role, user?.id, loadStats]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Control Panel Overview
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-lg uppercase tracking-wider border ${
                user?.role === 'SUPER_ADMIN'
                  ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : user?.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-900 border-purple-200'
                  : 'bg-blue-100 text-blue-900 border-blue-200'
              }`}
            >
              {user?.role?.replace('_', ' ') || 'STAFF'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600 font-medium">
            Welcome back, {user?.name}. Monitor visa applications, manage users, and inspect extraction activity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>View All Applications</span>
          </Link>
        </div>
      </div>

      {/* Error / Retry Banner */}
      {error && !stats && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-5 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">{error}</p>
              <p className="text-xs text-rose-700/80 mt-0.5">
                The database or server may have taken longer to respond. Click Retry to re-fetch dashboard metrics.
              </p>
            </div>
          </div>
          <button
            onClick={() => loadStats()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs flex-shrink-0 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Retrying...' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Real Aggregated Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : !stats ? (
          <div className="col-span-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
            Unable to load summary metrics. Use the Retry button above.
          </div>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Total Users
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {stats.totalUsers}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  All registered accounts
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Active Users
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {stats.activeUsers}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Enabled accounts
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Applications
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {stats.totalApplications}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Total in system
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Today
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {stats.applicationsToday}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Uploaded today
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  This Month
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {stats.applicationsThisMonth}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Month to date
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Staff Members
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {stats.totalAdmins + stats.totalManagers + stats.totalSuperAdmins}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {stats.totalSuperAdmins} SA / {stats.totalAdmins} Admin
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Two-Column Activity: Recent Applications & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Recent Applications
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Latest visa applications uploaded via Chrome Extension
              </p>
            </div>
            <Link
              href="/dashboard/applications"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg"></div>
              <div className="h-10 bg-slate-100 rounded-lg"></div>
              <div className="h-10 bg-slate-100 rounded-lg"></div>
            </div>
          ) : !stats ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Unable to load recent applications.
            </div>
          ) : stats.recentApplications.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No applications recorded in the system yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {stats.recentApplications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {app.applicantFullName}
                    </p>
                    <p className="text-slate-600 truncate mt-0.5">
                      Passport: <span className="font-mono font-medium text-slate-800">{app.passportNumber || 'N/A'}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 truncate mt-0.5">
                      Uploaded by <span className="font-semibold text-slate-700">{app.user?.name || 'User'}</span> ({app.user?.email})
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                      {app.status || 'draft'}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {formatDate(app.createdAt)}
                    </span>
                    <Link
                      href={`/dashboard/applications/${app.id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      Open &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Recent Users
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Latest registered extension and staff accounts
              </p>
            </div>
            <Link
              href="/dashboard/users"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg"></div>
              <div className="h-10 bg-slate-100 rounded-lg"></div>
              <div className="h-10 bg-slate-100 rounded-lg"></div>
            </div>
          ) : !stats ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Unable to load recent users.
            </div>
          ) : stats.recentUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No users registered yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {stats.recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.picture ? (
                      <img
                        src={u.picture}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">
                        {u.name ? u.name[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{u.name}</p>
                      <p className="text-slate-600 truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${roleBadge(
                        u.role
                      )}`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/dashboard/users/${u.id}`}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      View &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
