import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { Document, DocumentStatus } from '../types';
import { documentsService } from '../api/documents';
import type { Document as ApiDocument, CustomFilterQueryValue } from '../api/documents';
import { projectsService, type Project } from '../api/projects';
import { filtersService, type FilterDefinition } from '../api/filters';
import { downloadDocument } from '../api/exports';
import { DocumentTable } from '../components/documents/DocumentTable';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import { BulkActionBar } from '../components/documents/BulkActionBar';
import { ExportModal } from '../components/documents/ExportModal';

const statusLabelMap: Record<DocumentStatus, string> = {
  UPLOADED: 'Uploaded',
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
};
const statusValues = new Set<DocumentStatus>(['UPLOADED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED']);

// Helper to convert API document to UI document
const convertApiDocument = (apiDoc: ApiDocument): Document => {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return {
    id: apiDoc.id,
    fileName: apiDoc.originalFilename,
    mimeType: apiDoc.mimeType,
    fileSize: formatFileSize(apiDoc.sizeBytes),
    status: apiDoc.status,
    uploadDate: formatDate(apiDoc.uploadedAt),
    uploadedBy: apiDoc.uploadedByEmail || 'Unknown',
    errorMessage: apiDoc.errorMessage ?? undefined,
    pageCount: apiDoc.pageCount || undefined,
    extractedText: apiDoc.textPreview || undefined,
    filterValues: apiDoc.filterValues,
  };
};

export default function Documents() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  const allProjectsValue = 'all';
  const allProjectsLabel = 'All Projects';
  const projectStorageKey = 'documents:selectedProject';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    const storedValue = sessionStorage.getItem(projectStorageKey);
    if (!storedValue || storedValue === allProjectsLabel) {
      return allProjectsValue;
    }
    return storedValue;
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [sortBy, setSortBy] = useState<'upload-newest' | 'upload-oldest' | 'name-asc' | 'name-desc' | 'status'>('upload-newest');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [mainFilter, setMainFilter] = useState('');
  const [filterDefs, setFilterDefs] = useState<FilterDefinition[]>([]);
  const [customFilterValues, setCustomFilterValues] = useState<Record<string, CustomFilterQueryValue>>({});

  // Update (or clear, once fully empty) one custom filter's raw value(s).
  const setCustomFilterValue = (filterId: string, patch: Partial<CustomFilterQueryValue>) => {
    setCustomFilterValues((prev) => {
      const merged = { ...prev[filterId], ...patch };
      const next = { ...prev };
      if (merged.value || merged.from || merged.to) {
        next[filterId] = merged;
      } else {
        delete next[filterId];
      }
      return next;
    });
  };

  const statusFilter = useMemo(() => {
    const statusParam = searchParams.get('status');
    if (!statusParam) return undefined;
    return statusValues.has(statusParam as DocumentStatus) ? (statusParam as DocumentStatus) : undefined;
  }, [searchParams]);

  useEffect(() => {
    filtersService
      .listFilters()
      .then(setFilterDefs)
      .catch((err) => console.error('Failed to fetch filters:', err));
  }, []);

  useEffect(() => {
    sessionStorage.setItem(projectStorageKey, selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectsService.listProjects('uploadable');
        setProjects(data);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const apiDocuments = await documentsService.listDocuments({
          projectId: selectedProjectId !== allProjectsValue ? selectedProjectId : undefined,
          mainFilter,
          customFilters: customFilterValues,
          status: statusFilter,
          sortBy,
        });
        const convertedDocuments = apiDocuments.map(convertApiDocument);
        setDocuments(convertedDocuments);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
        console.error('Failed to fetch documents:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [selectedProjectId, mainFilter, customFilterValues, statusFilter, sortBy]);

  // Fetch selected document details when ID is in URL
  useEffect(() => {
    if (!id) {
      setSelectedDocument(null);
      return;
    }

    const existing = documents.find((doc) => doc.id === id);
    if (existing) {
      setSelectedDocument(existing);
      return;
    }

    const fetchDocument = async () => {
      try {
        const apiDoc = await documentsService.getDocument(id);
        const doc = convertApiDocument(apiDoc);
        setSelectedDocument(doc);
      } catch (err) {
        console.error('Failed to fetch document:', err);
        setSelectedDocument(null);
      }
    };

    fetchDocument();
  }, [id, documents]);

  const selectedProjectName = useMemo(() => {
    if (selectedProjectId === allProjectsValue) {
      return allProjectsLabel;
    }
    return projects.find((project) => project.id === selectedProjectId)?.name || allProjectsLabel;
  }, [projects, selectedProjectId]);

  const activeFilterTags = [
    selectedProjectId !== allProjectsValue ? { key: 'project', label: `Project: ${selectedProjectName}` } : null,
    mainFilter ? { key: 'mainFilter', label: `Main: ${mainFilter}` } : null,
    ...filterDefs.map((def) => {
      const raw = customFilterValues[def.id];
      if (!raw) return null;
      const label =
        def.type === 'DATE'
          ? `${def.name}: ${raw.from || 'Any'} to ${raw.to || 'Any'}`
          : `${def.name}: ${raw.value}`;
      return raw.value || raw.from || raw.to ? { key: `custom:${def.id}`, label } : null;
    }),
    statusFilter ? { key: 'status', label: `Status: ${statusLabelMap[statusFilter]}` } : null,
  ].filter((tag): tag is { key: string; label: string } => Boolean(tag));

  const handleSelectDocument = (docId: string) => {
    navigate(`/documents/${docId}`);
  };

  const handleClosePreview = () => {
    navigate('/documents');
  };

  const handleToggleSelect = (docId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleExportSelected = () => {
    setShowExportModal(true);
  };

  const handleDownloadDocument = async (documentId: string) => {
    try {
      await downloadDocument(documentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download document');
    }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected documents? This action cannot be undone.`)) {
      return;
    }

    try {
      const selectedIdsSnapshot = new Set(selectedIds);
      const result = await documentsService.bulkDeleteDocuments(Array.from(selectedIdsSnapshot));
      
      // Show result if some failed
      if (result.failed.length > 0) {
        alert(`Deleted ${result.deleted} documents. Failed to delete ${result.failed.length} documents.`);
      }

      const failedSet = new Set(result.failed);
      const deletedIds = Array.from(selectedIdsSnapshot).filter((id) => !failedSet.has(id));
      
      // Clear selection
      setSelectedIds(new Set());
      
      // Update list with only successfully deleted documents removed.
      setDocuments((prev) => prev.filter((d) => !deletedIds.includes(d.id)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete documents');
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const removeFilterTag = (key: string) => {
    if (key === 'project') setSelectedProjectId(allProjectsValue);
    if (key === 'mainFilter') setMainFilter('');
    if (key === 'status') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('status');
      setSearchParams(nextParams);
    }
    if (key.startsWith('custom:')) {
      const filterId = key.slice('custom:'.length);
      setCustomFilterValues((prev) => {
        const next = { ...prev };
        delete next[filterId];
        return next;
      });
    }
  };

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-10 min-w-56 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-700 dark:text-slate-200"
              >
                <option value={allProjectsValue}>{allProjectsLabel}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary"
              >
                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                Filter
              </button>

              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-10 min-w-52 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-700 dark:text-slate-200"
              >
                <option value="upload-newest">Date Uploaded: Newest first</option>
                <option value="upload-oldest">Date Uploaded: Oldest first</option>
                <option value="name-asc">Document Name: A to Z</option>
                <option value="name-desc">Document Name: Z to A</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="text-sm text-slate-500">
              Showing 1-{documents.length} of {documents.length}
            </div>
          </div>

          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterTags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => removeFilterTag(tag.key)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-100"
                >
                  {tag.label}
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              ))}
            </div>
          )}

          {isFilterPanelOpen && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Main Filter</label>
                  <input
                    type="text"
                    value={mainFilter}
                    onChange={(e) => setMainFilter(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                    placeholder="Search filename or document text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  >
                    <option value={allProjectsValue}>{allProjectsLabel}</option>
                    {projects.map((project) => (
                      <option key={`filter-${project.id}`} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {filterDefs.map((def) => {
                  const raw = customFilterValues[def.id] ?? {};
                  if (def.type === 'DATE') {
                    return (
                      <div key={def.id}>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                          {def.name} (range)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={raw.from ?? ''}
                            onChange={(e) => setCustomFilterValue(def.id, { from: e.target.value })}
                            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                          />
                          <span className="text-slate-500">to</span>
                          <input
                            type="date"
                            value={raw.to ?? ''}
                            onChange={(e) => setCustomFilterValue(def.id, { to: e.target.value })}
                            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={def.id}>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        {def.name}
                      </label>
                      <input
                        type={def.type === 'NUMBER' ? 'number' : 'text'}
                        value={raw.value ?? ''}
                        onChange={(e) => setCustomFilterValue(def.id, { value: e.target.value })}
                        className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                        placeholder={def.type === 'NUMBER' ? 'e.g. 500' : `Enter ${def.name.toLowerCase()}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">Filters are applied server-side and reflect uploaded documents.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(allProjectsValue);
                    setMainFilter('');
                    setCustomFilterValues({});
                  }}
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-slate-500">Loading documents...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error</span>
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load documents</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700 mb-4">folder_open</span>
              <p className="text-slate-600 dark:text-slate-400 font-medium mb-2">No documents yet</p>
              <p className="text-sm text-slate-500 mb-4">Upload your first PDF to get started</p>
              <button
                onClick={() => navigate('/upload')}
                className="bg-primary hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
              >
                Upload Document
              </button>
            </div>
          </div>
        ) : (
          <DocumentTable
            documents={documents}
            selectedDocumentId={selectedDocument?.id || null}
            selectedIds={selectedIds}
            onSelectDocument={handleSelectDocument}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onDownloadDocument={handleDownloadDocument}
          />
        )}
      </main>

      {selectedDocument && (
        <DocumentPreviewModal
          document={selectedDocument} 
          onClose={handleClosePreview}
        />
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onExport={handleExportSelected}
          onDelete={handleDeleteSelected}
          onClear={handleClearSelection}
        />
      )}

      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        documentIds={Array.from(selectedIds)}
      />

    </>
  );
}
