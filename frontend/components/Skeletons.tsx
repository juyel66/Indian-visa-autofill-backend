import React from 'react';

export function StatCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-24 h-4 bg-slate-200 rounded"></div>
        <div className="w-10 h-10 bg-slate-100 rounded-lg"></div>
      </div>
      <div className="mt-4 w-16 h-8 bg-slate-200 rounded"></div>
      <div className="mt-2 w-32 h-3 bg-slate-100 rounded"></div>
    </div>
  );
}

export function ApplicationTableSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden animate-pulse">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="w-48 h-5 bg-slate-200 rounded"></div>
        <div className="w-24 h-4 bg-slate-100 rounded"></div>
      </div>
      <div className="divide-y divide-slate-100">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-lg"></div>
              <div>
                <div className="w-36 h-4 bg-slate-200 rounded mb-2"></div>
                <div className="w-24 h-3 bg-slate-100 rounded"></div>
              </div>
            </div>
            <div className="hidden sm:block w-28 h-4 bg-slate-100 rounded"></div>
            <div className="w-16 h-6 bg-slate-100 rounded-full"></div>
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-slate-100 rounded"></div>
              <div className="w-8 h-8 bg-slate-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApplicationDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="w-48 h-7 bg-slate-200 rounded mb-2"></div>
          <div className="w-32 h-4 bg-slate-100 rounded"></div>
        </div>
        <div className="flex gap-2">
          <div className="w-28 h-10 bg-slate-200 rounded-lg"></div>
          <div className="w-24 h-10 bg-slate-200 rounded-lg"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="w-36 h-5 bg-slate-200 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="w-full h-9 bg-slate-100 rounded"></div>
              <div className="w-full h-9 bg-slate-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
