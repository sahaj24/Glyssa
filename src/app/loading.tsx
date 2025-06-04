import React from 'react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="flex items-center justify-center bg-white rounded-xl shadow-sm p-8 border border-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-slate-300 border-r-2 border-slate-500 mr-4"></div>
        <div className="flex flex-col">
          <h3 className="text-xl font-bold text-slate-700">Loading Glyssa</h3>
          <p className="text-sm text-slate-400">Preparing your code analysis environment...</p>
        </div>
      </div>
    </div>
  );
}
