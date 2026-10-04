'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { AdminApplicationDetail } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/Toast';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { ApplicationDetailSkeleton } from '@/components/Skeletons';
import {
  APPLICATION_SECTIONS,
  getSectionForFieldKey,
  formatFieldLabel,
} from '@/lib/field-schema';
import {
  ArrowLeft,
  FileDown,
  Trash2,
  FileText,
  User,
  Users,
  Home,
  MapPin,
  BookOpen,
  Briefcase,
  Compass,
  HelpCircle,
  Database,
  Calendar,
  Clock,
  Shield,
  Layers,
  CheckCircle2,
} from 'lucide-react';

const SECTION_ICONS: Record<string, React.ElementType> = {
  registration: FileText,
  basic_details: User,
  family_details: Users,
  present_address: Home,
  permanent_address: MapPin,
  passport: BookOpen,
  employment: Briefcase,
  visa: Compass,
  additional_questions: HelpCircle,
  metadata: Database,
};

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { user } = useAuth();
  const { error: toastError, success: toastSuccess, info: toastInfo } = useToast();

  const [application, setApplication] = useState<AdminApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('all');

  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.getAdminApplication(id);
        setApplication(data);
      } catch (err: any) {
        toastError(err.message || 'Failed to load application details.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, toastError]);

  // Extract all fields from applicationData
  const extractedFields = useMemo(() => {
    const res: Record<string, string> = {};
    if (!application?.applicationData) return res;

    const raw = application.applicationData;
    const fieldsObj = raw.fields || raw;

    if (fieldsObj && typeof fieldsObj === 'object') {
      for (const [key, val] of Object.entries(fieldsObj)) {
        if (
          key === 'provenance' ||
          key === 'sourceDocuments' ||
          key === 'manualEdits' ||
          key === 'metadata'
        ) {
          continue;
        }

        if (val && typeof val === 'object' && 'value' in val) {
          res[key] = (val as any).value ?? '';
        } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          res[key] = String(val);
        }
      }
    }

    return res;
  }, [application]);

  // Group fields into the 10 canonical sections
  const groupedSections = useMemo(() => {
    const map: Record<string, { key: string; label: string; value: string }[]> = {};

    APPLICATION_SECTIONS.forEach((sec) => {
      map[sec.id] = [];
    });

    Object.entries(extractedFields).forEach(([key, val]) => {
      const secId = getSectionForFieldKey(key);
      const label = formatFieldLabel(key);
      if (!map[secId]) map[secId] = [];
      map[secId].push({ key, label, value: val });
    });

    Object.keys(map).forEach((secId) => {
      map[secId].sort((a, b) => a.label.localeCompare(b.label));
    });

    return map;
  }, [extractedFields]);

  const handleDownloadPdf = async () => {
    if (!application) return;
    try {
      setDownloadingPdf(true);
      toastInfo('PDF download started.');
      const fileName =
        application.originalPdfFileName ||
        `${application.applicantFullName.replace(/\s+/g, '_')}_${application.passportNumber || application.id}.pdf`;
      await api.downloadApplicationPdf(application.id, fileName);
      toastSuccess('PDF downloaded successfully.');
    } catch (err: any) {
      toastError(err.message || 'Failed to download original PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!application) return;
    setDeleting(true);
    try {
      await api.deleteAdminApplication(application.id);
      toastSuccess('Application deleted successfully.');
      router.push('/dashboard/applications');
    } catch (err: any) {
      toastError(err.message || 'Failed to delete application.');
      setDeleting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
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

  if (loading) {
    return <ApplicationDetailSkeleton />;
  }

  if (!application) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <h2 className="text-lg font-bold text-slate-900">Application not found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This record may have been removed or does not exist.
        </p>
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Applications</span>
        </Link>
      </div>
    );
  }

  const applicantPhoto =
    application.applicationData?.photograph ||
    application.applicationData?.fields?.photograph?.value;

  const provenance =
    application.applicationData?.provenance ||
    application.applicationData?.metadata?.provenance;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/applications"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            title="Back to applications"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {application.applicantFullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 capitalize">
                {application.status || 'draft'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Application ID: <span className="font-mono text-slate-700 font-semibold">{application.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-xs"
          >
            <FileDown className="w-4 h-4 text-blue-600" />
            <span>{downloadingPdf ? 'Downloading...' : 'Download Original PDF'}</span>
          </button>

          {canDelete && (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="p-2 text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-colors shadow-xs"
              title="Delete Application"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Info Cards: Applicant, Uploader, Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Applicant Identity (Given Name + Surname) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Applicant Identity
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
              <User className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Given Name:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {application.applicantGivenName || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Surname:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {application.applicantSurname || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Full Display Name:</span>
              <p className="font-extrabold text-blue-700 text-sm mt-0.5">
                {application.applicantFullName}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Passport Number:</span>
              <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                {application.passportNumber || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Uploader / User Details */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Uploaded By
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Uploader Name:</span>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {application.user?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Uploader Email:</span>
              <p className="font-medium text-slate-800 text-xs mt-0.5 break-all">
                {application.user?.email || 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Account Role:</span>
              <div className="mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                  {application.user?.role || 'USER'}
                </span>
              </div>
            </div>
            {application.user?.id && (
              <div className="pt-1">
                <a
                  href={`/dashboard/users/${application.user.id}`}
                  className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 text-xs"
                >
                  <span>View User Profile &rarr;</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 3. Document Timeline & File */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Timeline & Document
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Uploaded At:</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {formatDate(application.createdAt)}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Last Updated:</span>
              <p className="font-semibold text-slate-800 mt-0.5">
                {formatDate(application.updatedAt)}
              </p>
            </div>
            <div>
              <span className="text-slate-400 font-medium">Original PDF File:</span>
              <p className="font-mono text-slate-700 text-xs mt-0.5 truncate" title={application.originalPdfFileName || 'passport.pdf'}>
                {application.originalPdfFileName || 'passport.pdf'}
              </p>
            </div>
            <div className="pt-1">
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Filter Tabs */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center flex-wrap gap-1.5">
        <button
          onClick={() => setActiveSectionId('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeSectionId === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Sections
        </button>
        {APPLICATION_SECTIONS.map((sec) => {
          const count = (groupedSections[sec.id] || []).length;
          if (count === 0 && sec.id !== 'metadata') return null;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSectionId(sec.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                activeSectionId === sec.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sec.title} ({count})
            </button>
          );
        })}
      </div>

      {/* 10 Organized Sections (No Raw JSON) */}
      <div className="space-y-6">
        {APPLICATION_SECTIONS.map((sec) => {
          if (activeSectionId !== 'all' && activeSectionId !== sec.id) {
            return null;
          }

          const fields = groupedSections[sec.id] || [];
          const Icon = SECTION_ICONS[sec.id] || FileText;

          if (fields.length === 0 && sec.id !== 'metadata') {
            return null;
          }

          return (
            <div
              key={sec.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{sec.title}</h3>
                    <p className="text-xs text-slate-500">{sec.description}</p>
                  </div>
                </div>

                <span className="text-xs font-semibold text-slate-400">
                  {fields.length} {fields.length === 1 ? 'field' : 'fields'}
                </span>
              </div>

              <div className="p-5 sm:p-6">
                {fields.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No fields recorded in this section.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60"
                      >
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate" title={field.label}>
                          {field.label}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 break-words">
                          {field.value || <span className="text-slate-400 italic font-normal">Not specified</span>}
                        </p>
                        <span className="block text-[10px] text-slate-400 font-mono mt-1 truncate" title={field.key}>
                          {field.key}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Extra provenance display for Metadata */}
                {sec.id === 'metadata' && provenance && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      OCR Provenance & Extraction Confidence
                    </h4>
                    <pre className="p-3 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-600 overflow-x-auto max-h-48 border border-slate-100">
                      {JSON.stringify(provenance, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        applicantName={application.applicantFullName}
        loading={deleting}
      />
    </div>
  );
}
