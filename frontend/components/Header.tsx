'use client';

import React from 'react';
import { Menu, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  title?: string;
}

export function Header({
  onOpenMobileMenu,
  title,
}: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {title && (
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider border ${
                user.role === 'SUPER_ADMIN'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : user.role === 'ADMIN'
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {user.role.replace('_', ' ')}
            </span>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50"></span>
          <span className="text-xs font-semibold text-slate-600">Online</span>
        </div>
      </div>
    </header>
  );
}
