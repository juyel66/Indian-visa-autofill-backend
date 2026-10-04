'use client';

import React, { useEffect, useState, useCallback } from 'react';
import * as api from '@/lib/api';
import { AuditLogItem } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import {
  History,
  Shield,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { error: toastError } = useToast();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        page,
        limit,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      });

      setLogs(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      toastError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionFilter, toastError]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (user && user.role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <Shield className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">
          Super Admin Access Required
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          System audit logs are strictly restricted to Super Administrators.
        </p>
      </div>
    );
  }

  const formatTimestamp = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const actionBadge = (action: string) => {
    if (action.includes('ROLE')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (action.includes('DELETED')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (action.includes('ENABLED')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (action.includes('DISABLED')) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            System Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable tracking of privileged administrator actions ({total} total events)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="all">All Actions</option>
            <option value="USER_ROLE_CHANGED">User Role Changed</option>
            <option value="USER_STATUS_CHANGED">User Status Changed</option>
            <option value="USER_DISABLED">User Disabled</option>
            <option value="USER_ENABLED">User Enabled</option>
            <option value="APPLICATION_DELETED">Application Deleted</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">No audit logs recorded</h2>
          <p className="text-xs text-slate-500 mt-1">
            Privileged administrator events will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Actor</th>
                  <th className="py-3 px-5">Action</th>
                  <th className="py-3 px-5">Target</th>
                  <th className="py-3 px-5">Metadata Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatTimestamp(log.createdAt)}
                    </td>

                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {log.actor?.name ? log.actor.name[0].toUpperCase() : 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {log.actor?.name || 'System / Staff'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {log.actor?.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${actionBadge(
                          log.action
                        )}`}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-4 px-5 font-mono text-[11px] text-slate-700">
                      {log.targetType || 'N/A'}:{' '}
                      <span className="text-slate-400 font-normal">
                        {log.targetId ? log.targetId.slice(0, 8) + '...' : ''}
                      </span>
                    </td>

                    <td className="py-4 px-5 font-mono text-[10px] text-slate-600 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{logs.length}</span> of{' '}
              <span className="font-bold text-slate-900">{total}</span> logs (Page {page} of {totalPages})
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
