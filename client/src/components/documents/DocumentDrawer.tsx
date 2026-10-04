import { useState } from 'react';
import type { Document } from '../../types';
import { downloadDocument } from '../../api/exports';
import { InlineAlert, StatusBadge } from '../ui';

interface DocumentDrawerProps {
  document: Document;
  onClose: () => void;
  onDelete: (documentId: string) => void;
}

export function DocumentDrawer({ document, onClose, onDelete }: DocumentDrawerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<{ documentId: string; message: string } | null>(null);
  const isImage = document.mimeType.startsWith('image/');

  const handleDownload = async () => {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      await downloadDocument(document.id);
    } catch (error) {
      setDownloadError({
        documentId: document.id,
        message: error instanceof Error ? error.message : 'Failed to download document',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <aside className="w-[400px] border-l border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-xl shadow-slate-200/50">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Document Details</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="w-full aspect-[4/3] bg-slate-100 rounded-lg mb-6 flex items-center justify-center border border-slate-200 overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
            <button className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-slate-50">
              Open Preview
            </button>
          </div>
          <span className="material-symbols-outlined text-6xl text-slate-300">
            {isImage ? 'image' : 'picture_as_pdf'}
          </span>
          <div className="absolute top-3 right-3 bg-white rounded p-1 shadow-sm">
            <span className="material-symbols-outlined text-slate-400 text-sm">open_in_full</span>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-bold text-slate-900 break-all leading-tight">
                  {document.fileName}
                </h3>
                <StatusBadge status={document.status} errorMessage={document.errorMessage} />
              </div>
              <button className="text-slate-400 hover:text-primary shrink-0 pt-1">
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>
            <div className="flex flex-col gap-1 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                {document.uploadDate}
              </span>
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">hard_drive</span>
                {document.fileSize} • {isImage ? 'Image' : 'PDF Document'}
              </span>
            </div>
          </div>

          {downloadError?.documentId === document.id && (
            <InlineAlert tone="error" onDismiss={() => setDownloadError(null)}>
              {downloadError.message}
            </InlineAlert>
          )}

          <div className="flex gap-3">
            <button 
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 bg-primary text-white py-2 px-4 rounded-lg font-medium text-sm hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download
                </>
              )}
            </button>
            <button className="flex-1 bg-white border border-slate-200 text-slate-700 py-2 px-4 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">share</span>
              Share
            </button>
          </div>

          {document.extractedText && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Extracted Text
                </label>
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                  OCR Completed
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-600 font-mono leading-relaxed h-32 overflow-y-auto custom-scrollbar select-text whitespace-pre-wrap">
                  {document.extractedText}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Properties</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">Author</p>
                <p className="text-xs font-medium text-slate-700">
                  {document.uploadedBy || 'System Upload'}
                </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">Page Count</p>
                <p className="text-xs font-medium text-slate-700">
                  {document.pageCount ? `${document.pageCount} Pages` : 'N/A'}
                </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">Dimensions</p>
                <p className="text-xs font-medium text-slate-700">A4 (Portrait)</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">Version</p>
                <p className="text-xs font-medium text-slate-700">v1.0 (Original)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <button 
          onClick={() => onDelete(document.id)}
          className="w-full text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Delete Document
        </button>
      </div>
    </aside>
  );
}
