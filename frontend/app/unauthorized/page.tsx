'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-5">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Access Restricted
        </h1>

        <p className="text-sm font-semibold text-rose-600 mt-2">
          You do not have permission to access the administration dashboard.
        </p>

        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          This portal is reserved strictly for authorized staff (Super Admins, Admins, and Managers). Regular user accounts must use the{' '}
          <strong className="text-slate-700">Visa Autofill Chrome Extension</strong> for passport processing and Indian portal autofill.
        </p>

        {user && (
          <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-left">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Signed in as:
            </p>
            <p className="font-semibold text-slate-800 truncate mt-0.5">{user.name}</p>
            <p className="text-slate-500 truncate">{user.email}</p>
            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              Role: {user.role}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/home"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
          <button
            onClick={() => logout()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
