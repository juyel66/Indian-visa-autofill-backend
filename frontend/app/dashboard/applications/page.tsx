'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { AdminApplicationItem } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { ApplicationTableSkeleton } from '@/components/Skeletons';
import {
  Search,
  FileDown,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function AdminApplicationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

  const [applications, setApplications] = useState<AdminApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedAppToDelete, setSelectedAppToDelete] = useState<AdminApplicationItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAdminApplications({
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      setApplications(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      toastError(err.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, toastError]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchApplications();
  };

  const handleDownloadPdf = async (app: AdminApplicationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingId(app.id);
      toastInfo('PDF download started.');
      const fallbackName = `${app.applicantFullName.replace(/\s+/g, '_')}_${app.passportNumber || app.id}.pdf`;
      await api.downloadApplicationPdf(app.id, fallbackName);
      toastSuccess('PDF downloaded successfully.');
    } catch (err: any) {
      toastError(err.message || 'Failed to download original PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAppToDelete) return;
    setDeleting(true);
    try {
      await api.deleteAdminApplication(selectedAppToDelete.id);
      toastSuccess('Application deleted successfully.');
      setSelectedAppToDelete(null);
      fetchApplications();
    } catch (err: any) {
      toastError(err.message || 'Failed to delete application.');
    } finally {
      setDeleting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Application Monitoring
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Monitor and review all visa applications uploaded across the system ({total} total)
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by applicant name, passport, uploader name or email..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-auto px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <button
            onClick={() => {
              setPage(1);
              fetchApplications();
            }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Main Table / Cards */}
      {loading ? (
        <ApplicationTableSkeleton />
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">
            No applications found
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
            No visa applications matched your current search or filter criteria.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-5">Applicant Name (Given + Surname)</th>
                  <th className="py-3 px-5">Passport</th>
                  <th className="py-3 px-5">Uploader / User</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Uploaded At</th>
                  <th className="py-3 px-5">Updated At</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/applications/${app.id}`)}
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-bold flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          {/* CRITICAL: Given Name + Surname display order */}
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {app.applicantFullName}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate max-w-[140px]" title={app.id}>
                            ID: {app.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 font-mono font-semibold text-slate-800">
                      {app.passportNumber || 'N/A'}
                    </td>

                    <td className="py-4 px-5">
                      <p className="font-semibold text-slate-800">
                        {app.user?.name || 'Unknown'}
                      </p>
                      <p className="text-slate-600 text-[11px] truncate max-w-[160px]">
                        {app.user?.email || 'N/A'}
                      </p>
                    </td>

                    <td className="py-4 px-5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] bg-slate-100 text-slate-700 capitalize">
                        {app.status || 'draft'}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-slate-600">
                      {formatDate(app.createdAt)}
                    </td>

                    <td className="py-4 px-5 text-slate-600">
                      {formatDate(app.updatedAt)}
                    </td>

                    <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/applications/${app.id}`}
                          className="px-2.5 py-1.5 font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Open
                        </Link>
                        <button
                          onClick={(e) => handleDownloadPdf(app, e)}
                          disabled={downloadingId === app.id}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Download Original PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setSelectedAppToDelete(app)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Application"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="lg:hidden space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {app.applicantFullName}
                    </h2>
                    <p className="text-xs font-mono font-medium text-slate-600 mt-0.5">
                      Passport: {app.passportNumber || 'N/A'}
                    </p>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                    {app.status || 'draft'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>
                    <span className="font-semibold text-slate-700">Uploaded by:</span> {app.user?.name} ({app.user?.email})
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Uploaded:</span> {formatDate(app.createdAt)}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => handleDownloadPdf(app, e)}
                    disabled={downloadingId === app.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  {canDelete && (
                    <button
                      onClick={() => setSelectedAppToDelete(app)}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                      title="Delete Application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <a
                    href={`/dashboard/applications/${app.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                  >
                    <span>Open</span>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-slate-900">{applications.length}</span> of{' '}
              <span className="font-bold text-slate-900">{total}</span> applications (Page {page} of {totalPages})
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!selectedAppToDelete}
        onClose={() => setSelectedAppToDelete(null)}
        onConfirm={handleDeleteConfirm}
        applicantName={selectedAppToDelete?.applicantFullName}
        loading={deleting}
      />
    </div>
  );
}
