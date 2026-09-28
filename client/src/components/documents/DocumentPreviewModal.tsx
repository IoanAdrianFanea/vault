import { useEffect, useState } from 'react';
import type { Document, DocumentFilterValue } from '../../types';
import { downloadDocument, getDocumentBlob } from '../../api/exports';
import { documentsService } from '../../api/documents';

interface DocumentPreviewModalProps {
  document: Document;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, onClose }: DocumentPreviewModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [filterValues, setFilterValues] = useState<DocumentFilterValue[]>(document.filterValues ?? []);
  const isImage = document.mimeType.startsWith('image/');

  // The document list doesn't include custom filter values (kept lean); fetch the
  // full document record here so the preview can show what was entered on upload.
  useEffect(() => {
    let isMounted = true;

    documentsService
      .getDocument(document.id)
      .then((full) => {
        if (isMounted) setFilterValues(full.filterValues ?? []);
      })
      .catch(() => {
        // Non-critical — the preview still works without custom field values.
      });

    return () => {
      isMounted = false;
    };
  }, [document.id]);

  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const loadPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);

      try {
        const { blob } = await getDocumentBlob(document.id);
        currentObjectUrl = window.URL.createObjectURL(blob);

        if (!isMounted) {
          window.URL.revokeObjectURL(currentObjectUrl);
          return;
        }

        setPreviewUrl(currentObjectUrl);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : 'Failed to load preview');
      } finally {
        if (isMounted) {
          setIsPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        window.URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [document.id]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadDocument(document.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to download document');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={onClose} />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`shrink-0 p-2 rounded-lg ${
                  isImage
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] block">
                  {isImage ? 'image' : 'picture_as_pdf'}
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">{document.fileName}</h2>
                <p className="text-sm text-slate-500">{document.fileSize}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Uploaded By</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">{document.uploadedBy || 'Unknown'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Status</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">{document.status}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">Date Uploaded</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">{document.uploadDate}</p>
              </div>
            </div>

            {filterValues.length > 0 && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-2">Custom Fields</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {filterValues.map((fv) => (
                    <div
                      key={fv.filterDefinitionId}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3"
                    >
                      <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">{fv.name}</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1 break-words">
                        {fv.value ?? '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/30 overflow-hidden h-[60vh] min-h-[460px]">
              {isPreviewLoading && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
                    <p className="text-sm text-slate-500">Loading preview...</p>
                  </div>
                </div>
              )}

              {!isPreviewLoading && previewError && (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Could not load this preview</p>
                    <p className="text-xs text-slate-500 mt-1">{previewError}</p>
                    <p className="text-xs text-slate-500 mt-3">Use Download to open the file directly.</p>
                  </div>
                </div>
              )}

              {!isPreviewLoading && previewUrl && isImage && (
                <img
                  src={previewUrl}
                  alt={`Preview of ${document.fileName}`}
                  className="w-full h-full object-contain bg-white"
                />
              )}

              {!isPreviewLoading && previewUrl && !isImage && (
                <iframe
                  src={previewUrl}
                  title={`Preview of ${document.fileName}`}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 disabled:opacity-70 text-white text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
