'use client';

import React from 'react';
import { X, FileCheck, Layers, Sparkles, Chrome, ExternalLink } from 'lucide-react';

interface NewApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewApplicationModal({ isOpen, onClose }: NewApplicationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-app-title"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 id="new-app-title" className="text-xl font-bold text-slate-900">
              New Application Workflow
            </h3>
            <p className="text-xs font-medium text-slate-500">
              Automated passport extraction & portal autofill
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Chrome className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">Handled via Chrome Extension:</span> Document OCR extraction and government portal autofill are securely handled by your installed <span className="font-semibold">Visa Autofill Chrome Extension</span>.
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6 text-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-semibold text-slate-800">Open Extension Popup</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Click the Visa Autofill icon in your Chrome extensions bar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-semibold text-slate-800">Upload Passport PDF</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Drop your applicant's passport PDF. The OCR engine reads the MRZ and visual zones with high confidence.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-semibold text-slate-800">Save to Dashboard</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Click &quot;Save Application&quot;. The record synchronizes instantly here for editing, PDF downloads, and review.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm shadow-blue-200 text-center"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
