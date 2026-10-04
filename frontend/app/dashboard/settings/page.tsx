'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import { AdminSettings } from '@/types';
import {
  ShieldAlert,
  ShieldCheck,
  Server,
  Users,
  CreditCard,
  Lock,
  Mail,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getAdminSettings();
        setSettings(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load system settings');
      } finally {
        setLoading(false);
      }
    }

    if (isSuperAdmin) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  // Non-Super Admin Guard
  if (!isSuperAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Super Admin Privileges Required
        </h1>
        <p className="text-slate-600 text-sm mb-6 max-w-md mx-auto">
          The System Settings module is strictly restricted to SUPER_ADMIN accounts. Your current role is{' '}
          <span className="font-semibold text-slate-900">{user?.role}</span>.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors shadow-xs"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-xl shadow-xs">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              System Settings & Architecture
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Super-admin role configuration, environment metrics, and architectural module status
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      ) : settings ? (
        <>
          {/* Super Admin Bootstrap Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Bootstrap Super-Admin Configuration
                  </h2>
                  <p className="text-xs text-slate-500">
                    Controlled centrally via backend environment configuration (<code className="text-amber-700 font-mono text-[11px]">SUPER_ADMIN_EMAILS</code>)
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Protected Sync Active</span>
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-0.5">Read-Only Environment Synchronization:</p>
                  <p className="text-amber-800">
                    Emails defined in the backend <code className="font-mono font-bold">SUPER_ADMIN_EMAILS</code> variable are automatically guaranteed <span className="font-bold">SUPER_ADMIN</span> privileges upon Google OAuth login. The server-side environment is never exposed or altered through web inputs for maximum zero-trust security.
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Configured Super Admin Emails ({settings.configuredSuperAdminEmails.length})
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {settings.configuredSuperAdminEmails.map((email) => {
                    const isCurrent = user?.email?.toLowerCase() === email.toLowerCase();
                    return (
                      <div
                        key={email}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                          isCurrent
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <Mail className={`w-3.5 h-3.5 ${isCurrent ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span>{email}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">
                            You
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Role System & Hierarchy */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Role-Based Access Control (RBAC) Matrix
                </h2>
                <p className="text-xs text-slate-500">
                  Strict hierarchy: SUPER_ADMIN &gt; ADMIN &gt; MANAGER &gt; USER (No dashboard access)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {/* SUPER_ADMIN */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    SUPER_ADMIN
                  </span>
                  <span className="text-sm font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300">
                    {settings.roleCounts.superAdmins}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Full root control: Manage roles, promote/demote admins, delete applications, audit logs, system settings. Protected by last-super-admin safeguard.
                </p>
              </div>

              {/* ADMIN */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                    ADMIN
                  </span>
                  <span className="text-sm font-extrabold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-300">
                    {settings.roleCounts.admins}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Operations & users: View all applications, download PDFs, manage & toggle USER accounts. Cannot modify SUPER_ADMIN or change roles.
                </p>
              </div>

              {/* MANAGER */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                    MANAGER
                  </span>
                  <span className="text-sm font-extrabold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-300">
                    {settings.roleCounts.managers}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Operational read-only: View dashboard analytics, browse applications, view user summaries and monitor PDF uploads. Cannot modify accounts.
                </p>
              </div>

              {/* USER */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    USER (Extension)
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-300">
                    {settings.roleCounts.users}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chrome Extension end-users only: Upload PDFs, OCR autofill, own application access. <span className="font-semibold text-rose-600">Blocked from admin panel</span>.
                </p>
              </div>
            </div>
          </div>

          {/* System & Runtime Environment */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Infrastructure & Runtime
                </h2>
                <p className="text-xs text-slate-500">
                  Backend server configuration and connectivity
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-5 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-semibold block mb-1">Environment</span>
                <span className="font-mono font-bold text-slate-900 uppercase">
                  {settings.environment}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-semibold block mb-1">Database Engine</span>
                <span className="font-bold text-slate-900">PostgreSQL (Neon Serverless)</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-semibold block mb-1">ORM & Migrations</span>
                <span className="font-bold text-slate-900">Prisma 6.19 (Strict Schema)</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-semibold block mb-1">Server Clock</span>
                <span className="font-mono text-slate-800">
                  {new Date(settings.serverTime).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  })}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-semibold block mb-1">Authentication</span>
                <span className="font-bold text-slate-900">Email + Password / Dual JWT</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-semibold block mb-1">Security Standard</span>
                <span className="font-bold text-emerald-700">Zero-Trust Backend RBAC</span>
              </div>
            </div>
          </div>

          {/* Future Modules: Wallet & Indian Visa Automation (Section 30 Architecture Preparation) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Architectural Modules in Pipeline
                  </h2>
                  <p className="text-xs text-slate-500">
                    Prepared foundation for balance, recharge logs, and automation
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                Future Roadmap
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {/* Wallet & Recharge */}
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/40">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Wallet & Recharge Engine (Section 30)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Architecture ready for per-user balances, transaction ledgers, extraction fee deductions, and recharge history. Payment gateway integration will be connected in next milestone. Frontend cannot modify balances directly.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Architecture Initialized &bull; Gateway Disconnected</span>
                </div>
              </div>

              {/* Indian Visa Automation */}
              <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/40">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Indian Visa Portal Automation (Phase 2)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Automated form fill-up, appointment slot tracking, and CAPTCHA solving modules will hook directly into privileged application management APIs once authorized.
                </p>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Phase 2 Pipeline</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
