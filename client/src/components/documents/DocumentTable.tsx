import type { Document } from '../../types';
import { StatusBadge } from '../ui';

interface DocumentTableProps {
  documents: Document[];
  selectedDocumentId: string | null;
  selectedIds: Set<string>;
  onSelectDocument: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onDownloadDocument: (id: string) => void;
}

export function DocumentTable({
  documents,
  selectedDocumentId,
  selectedIds,
  onSelectDocument,
  onToggleSelect,
  onSelectAll,
  onDownloadDocument,
}: DocumentTableProps) {
  const allSelected = documents.length > 0 && documents.every((doc) => selectedIds.has(doc.id));
  const someSelected = documents.some((doc) => selectedIds.has(doc.id)) && !allSelected;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
          <tr>
            <th className="py-3 px-6 w-12 border-b border-slate-100">
              <input
                className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white"
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              Document
            </th>
            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              Status
            </th>
            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              Uploaded By
            </th>
            <th className="py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              Date Uploaded
            </th>
            <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((doc) => {
            const isSelected = selectedIds.has(doc.id);
            const isDrawerOpen = selectedDocumentId === doc.id;

            return (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                  isDrawerOpen
                    ? 'bg-blue-50/50 border-l-2 border-l-primary'
                    : isSelected
                    ? 'bg-blue-50/30 border-l-2 border-l-blue-400'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <td className="py-3 px-6" onClick={(e) => e.stopPropagation()}>
                  <input
                    checked={isSelected}
                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 bg-white cursor-pointer"
                    type="checkbox"
                    onChange={() => onToggleSelect(doc.id)}
                  />
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 p-2 bg-red-100 text-red-600 rounded-lg">
                      <span className="material-symbols-outlined text-[20px] block">picture_as_pdf</span>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectDocument(doc.id)}
                        className="text-sm font-medium text-slate-900 hover:text-primary text-left"
                      >
                        {doc.fileName}
                      </button>
                      <p className="text-xs text-slate-500">{doc.fileSize}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <StatusBadge status={doc.status} errorMessage={doc.errorMessage} />
                </td>
                <td className="py-3 px-2 text-sm text-slate-600">{doc.uploadedBy || 'Unknown'}</td>
                <td className="py-3 px-2 text-sm text-slate-500">
                  {doc.uploadDate}
                </td>
                <td className="py-3 px-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDocument(doc.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      Preview
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadDocument(doc.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Download
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
