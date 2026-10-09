/*
Main documents list: filters, sorting, status filter from the URL, bulk
selection, ZIP and CSV export, delete and preview. It combines the toolbar,
table and summary bar components and keeps the filters in the page state. While
documents are processing it quietly refreshes the list every few seconds.
*/


import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Document, DocumentStatus } from '../types';
import {
  documentsService,
  type DocumentStatusCounts,
} from '../api/documents';
import { projectsService, type Project } from '../api/projects';
import { filtersService, type FilterDefinition } from '../api/filters';
import { downloadDocument } from '../api/exports';
import { useIsAdmin } from '../components/layout/currentUser';
import { useDocumentStatusRefresh } from '../components/layout/documentStatusRefresh';
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  DOCUMENT_STATUS_ORDER,
  EmptyState,
  InlineAlert,
  useToast,
  type MenuItem,
} from '../components/ui';
import {
  formatCount,
  formatCountLabel,
} from '../utils/format';
import { downloadCsv } from '../utils/csv';
import {
  beginSave,
  commonProjectName,
  describeSaveResult,
  type SaveResult,
} from '../utils/saveFile';
import { readRouteNotice } from '../utils/routeNotice';
import { toUiDocument } from '../components/documents/documentConvert';
import {
  buildDocumentsCsv,
  documentsCsvFileName,
} from '../components/documents/documentCsv';
import {
  ALL_PROJECTS,
  DOCUMENT_LIST_LIMIT,
  buildFilterChips,
  countAppliedFilters,
  createEmptyFilters,
  getMatchingTotal,
  hasActiveFilters,
  readStoredProjectId,
  sortFilterDefinitions,
  toListQuery,
  writeStoredProjectId,
  type AppliedFilters,
  type DocumentSortBy,
} from '../components/documents/documentFilters';
import { BulkActionBar } from '../components/documents/BulkActionBar';
import { DocumentFilterChips } from '../components/documents/DocumentFilterChips';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import { DocumentTable } from '../components/documents/DocumentTable';
import { DocumentsSummaryBar } from '../components/documents/DocumentsSummaryBar';
import { DocumentsToolbar } from '../components/documents/DocumentsToolbar';
import { ExportModal } from '../components/documents/ExportModal';
import {
  countFinished,
  describeFinished,
  isInProgress,
} from '../components/documents/documentProgress';

interface ListSnapshot {
  documents: Document[];
  counts: DocumentStatusCounts | null;
  updatedAt: Date;
}

interface PageAlert {
  tone: 'error' | 'warning' | 'success';
  message: string;
}

const EMPTY_DOCUMENTS: Document[] = [];

// While documents are processing the list is quietly refetched on this interval,
// for at most POLL_MAX_MS of visible time.
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 10 * 60_000;

export default function Documents() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const { refresh: refreshSidebarCounts } = useDocumentStatusRefresh();

  const statusFilter = useMemo(() => {
    const statusParam = searchParams.get('status');
    return DOCUMENT_STATUS_ORDER.find((status) => status === statusParam);
  }, [searchParams]);

  const [applied, setApplied] = useState<AppliedFilters>(() =>
    createEmptyFilters(readStoredProjectId()),
  );
  const [sortBy, setSortBy] = useState<DocumentSortBy>('upload-newest');

  const [projects, setProjects] = useState<Project[]>([]);
  const [filterDefinitions, setFilterDefinitions] = useState<FilterDefinition[]>([]);

  const [snapshot, setSnapshot] = useState<ListSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const pollElapsedMsRef = useRef(0);
  const rowsRef = useRef<Document[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [initialNotice] = useState(() => readRouteNotice(location.state));
  const [pageAlert, setPageAlert] = useState<PageAlert | null>(initialNotice);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stops a reload showing the upload notice again
  useEffect(() => {
    if (initialNotice) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist project in sessionStorage
  useEffect(() => {
    writeStoredProjectId(applied.projectId);
  }, [applied.projectId]);

  // Load filter definitions
  useEffect(() => {
    let isActive = true;
    filtersService
      .listFilters()
      .then((data) => {
        if (!isActive) return;
        setFilterDefinitions(sortFilterDefinitions(data));
      })
      .catch((err) => console.error('Failed to fetch filters:', err));
    return () => {
      isActive = false;
    };
  }, []);

  // Load projects
  useEffect(() => {
    let isActive = true;
    projectsService
      .listProjects('uploadable')
      .then((data) => {
        if (!isActive) return;
        setProjects(data);
        setApplied((prev) =>
          prev.projectId !== ALL_PROJECTS && !data.some((p) => p.id === prev.projectId)
            ? { ...prev, projectId: ALL_PROJECTS }
            : prev,
        );
      })
      .catch((err) => console.error('Failed to fetch projects:', err));
    return () => {
      isActive = false;
    };
  }, []);

  // Fetch cycle
  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setPollTimedOut(false);
    pollElapsedMsRef.current = 0;
    const query = toListQuery(applied, statusFilter, sortBy);

    Promise.all([
      documentsService.listDocuments(query),
      documentsService.getStatusCounts(query).catch(() => null),
    ])
      .then(([apiDocs, counts]) => {
        if (!isActive) return;
        setSnapshot({
          documents: apiDocs.map(toUiDocument),
          counts,
          updatedAt: new Date(),
        });
        setLoadError('');
      })
      .catch((err) => {
        if (!isActive) return;
        setSnapshot(null);
        setLoadError(err instanceof Error ? err.message : 'Failed to load documents');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [applied, statusFilter, sortBy, reloadKey]);

  const rows = snapshot?.documents ?? EMPTY_DOCUMENTS;
  const counts = snapshot?.counts ?? null;
  const hasInProgress = rows.some((doc) => isInProgress(doc.status));

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Quiet refresh while documents are processing. A failed poll is skipped and the next
  // tick tries again, so a 429 never turns into a tight retry loop.
  useEffect(() => {
    if (!hasInProgress || pollTimedOut) return;

    let isActive = true;
    let inFlight = false;
    let timer: number | undefined;
    const query = toListQuery(applied, statusFilter, sortBy);

    const poll = async () => {
      timer = undefined;
      if (!isActive || inFlight || document.hidden) return;
      inFlight = true;

      try {
        const [apiDocs, nextCounts] = await Promise.all([
          documentsService.listDocuments(query),
          documentsService.getStatusCounts(query).catch(() => null),
        ]);
        if (!isActive) return;

        const nextDocuments = apiDocs.map(toUiDocument);
        const message = describeFinished(countFinished(rowsRef.current, nextDocuments));
        if (message) showToast(message);

        setSnapshot((prev) => ({
          documents: nextDocuments,
          counts: nextCounts ?? prev?.counts ?? null,
          updatedAt: new Date(),
        }));
        refreshSidebarCounts();
      } catch {
        // Skipped: the next tick tries again.
      } finally {
        inFlight = false;
      }

      if (!isActive) return;
      pollElapsedMsRef.current += POLL_INTERVAL_MS;
      if (pollElapsedMsRef.current >= POLL_MAX_MS) {
        setPollTimedOut(true);
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      if (timer !== undefined) window.clearTimeout(timer);
      void poll();
    };

    timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    hasInProgress,
    pollTimedOut,
    applied,
    statusFilter,
    sortBy,
    showToast,
    refreshSidebarCounts,
  ]);

  // Preview document
  useEffect(() => {
    if (!id) {
      setSelectedDocument(null);
      return;
    }
    const existing = rows.find((d) => d.id === id);
    if (existing) {
      setSelectedDocument(existing);
      return;
    }
    let isActive = true;
    documentsService
      .getDocument(id)
      .then((apiDoc) => {
        if (!isActive) return;
        setSelectedDocument(toUiDocument(apiDoc));
      })
      .catch((err) => {
        if (!isActive) return;
        console.error('Failed to fetch document:', err);
        setSelectedDocument(null);
      });
    return () => {
      isActive = false;
    };
  }, [id, rows]);

  // Selection reset on result key change (adjust state during render)
  const resultKey = JSON.stringify([applied, statusFilter ?? null, sortBy]);
  const [selectionKey, setSelectionKey] = useState(resultKey);
  if (selectionKey !== resultKey) {
    setSelectionKey(resultKey);
    setSelectedIds(new Set());
  }

  // Derived values
  const total = counts ? getMatchingTotal(counts, statusFilter) : rows.length;
  const isCapped = counts ? total > DOCUMENT_LIST_LIMIT : rows.length >= DOCUMENT_LIST_LIMIT;
  const totalBytes = rows.reduce((acc, doc) => acc + (doc.sizeBytes ?? 0), 0);
  const selectedRows = rows.filter((d) => selectedIds.has(d.id));
  const projectName =
    applied.projectId === ALL_PROJECTS
      ? null
      : projects.find((p) => p.id === applied.projectId)?.name ?? null;

  const chips = buildFilterChips({
    filters: applied,
    projectName,
    definitions: filterDefinitions,
    status: statusFilter,
  });
  const appliedFilterCount = countAppliedFilters(applied, filterDefinitions);
  const hasFilters = hasActiveFilters(applied, statusFilter);

  const countLabel = !snapshot
    ? null
    : isCapped
    ? `Showing the first ${DOCUMENT_LIST_LIMIT} documents — narrow with filters`
    : `Showing ${formatCountLabel(rows.length, 'document', 'documents')}`;

  const setStatusParam = (status: DocumentStatus | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (status) {
      nextParams.set('status', status);
    } else {
      nextParams.delete('status');
    }
    setSearchParams(nextParams);
  };

  const handleProjectChange = (projectId: string) => {
    setApplied((prev) => ({ ...prev, projectId }));
  };

  const handleApplyFilters = (next: AppliedFilters) => {
    setApplied(next);
  };

  const handleClearPopoverFilters = () => {
    setApplied(createEmptyFilters());
  };

  const handleClearAllFilters = () => {
    setApplied(createEmptyFilters());
    setStatusParam(null);
  };

  const handleRemoveChip = (key: string) => {
    if (key === 'project') {
      setApplied((prev) => ({ ...prev, projectId: ALL_PROJECTS }));
    } else if (key === 'keyword') {
      setApplied((prev) => ({ ...prev, keyword: '' }));
    } else if (key === 'status') {
      setStatusParam(null);
    } else if (key.startsWith('custom:')) {
      const defId = key.slice(7);
      setApplied((prev) => {
        const nextCustom = { ...prev.customFilters };
        delete nextCustom[defId];
        return { ...prev, customFilters: nextCustom };
      });
    }
  };

  const handleSortChange = (next: DocumentSortBy) => {
    setSortBy(next);
  };

  const handleShowFailed = () => {
    setStatusParam('FAILED');
  };

  const handleOpenPreview = (docId: string) => {
    navigate({ pathname: `/documents/${docId}`, search: location.search });
  };

  const handleClosePreview = () => {
    navigate({ pathname: '/documents', search: location.search });
  };

  const handleToggleSelect = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((d) => d.id)) : new Set());
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const showSaveResult = (result: SaveResult) => {
    const notice = describeSaveResult(result);
    if (notice) setPageAlert(notice);
  };

  const handleDownloadDocument = async (docId: string) => {
    const target = beginSave();
    try {
      const result = await downloadDocument(docId, {
        projectName: rows.find((d) => d.id === docId)?.projectName,
        target,
      });
      showSaveResult(result);
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to download document',
      });
    }
  };

  const handleRetryProcessing = (_docId: string) => {
    void _docId;
    // TODO(backend): endpoint to re-run text extraction for a FAILED document (for example POST /documents/:id/retry), then reload the list.
  };

  const handleGenerateRegisterPdf = () => {
    // TODO(backend): endpoint that renders the filtered document register as a PDF.
  };

  const handleExportShownCsv = () => {
    const target = beginSave();
    void downloadCsv(documentsCsvFileName(new Date()), buildDocumentsCsv(rows), {
      projectName: commonProjectName(rows.map((d) => d.projectName)),
      target,
    }).then(showSaveResult);
  };

  const handleExportSelectedCsv = () => {
    const target = beginSave();
    void downloadCsv(documentsCsvFileName(new Date()), buildDocumentsCsv(selectedRows), {
      projectName: commonProjectName(selectedRows.map((d) => d.projectName)),
      target,
    }).then(showSaveResult);
  };

  const handleOpenZipExport = () => {
    setShowExportModal(true);
  };

  const handleRequestDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await documentsService.bulkDeleteDocuments(ids);
      if (result.failed.length > 0) {
        setPageAlert({
          tone: 'warning',
          message: `${formatCountLabel(result.deleted, 'document', 'documents')} moved to the recycle bin. ${formatCount(result.failed.length)} couldn't be deleted.`,
        });
      } else {
        setPageAlert(null);
      }
      setSelectedIds(new Set());
      setReloadKey((k) => k + 1);
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete documents',
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleRetryLoad = () => {
    setLoadError('');
    setReloadKey((k) => k + 1);
  };

  const exportItems: MenuItem[] = [
    {
      id: 'export-shown',
      label: `Export shown as CSV (${formatCount(rows.length)})`,
      disabled: rows.length === 0,
      onSelect: handleExportShownCsv,
    },
    {
      id: 'export-selected-csv',
      label: `Export selected as CSV (${formatCount(selectedRows.length)})`,
      disabled: selectedRows.length === 0,
      onSelect: handleExportSelectedCsv,
    },
    {
      id: 'export-selected-zip',
      label: `Download selected as ZIP (${formatCount(selectedIds.size)})`,
      disabled: selectedIds.size === 0,
      onSelect: handleOpenZipExport,
    },
    {
      id: 'generate-pdf',
      label: 'Generate register PDF',
      dividerBefore: true,
      onSelect: handleGenerateRegisterPdf,
    },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div
        className={`flex min-h-0 flex-1 flex-col gap-2 px-4 pt-3 ${
          selectedIds.size > 0 ? 'pb-20' : 'pb-4'
        }`}
      >
        <DocumentsToolbar
          projects={projects}
          isAdmin={isAdmin}
          applied={applied}
          filterDefinitions={filterDefinitions}
          appliedFilterCount={appliedFilterCount}
          sortBy={sortBy}
          countLabel={countLabel}
          exportItems={exportItems}
          onProjectChange={handleProjectChange}
          onApplyFilters={handleApplyFilters}
          onClearPopoverFilters={handleClearPopoverFilters}
          onSortChange={handleSortChange}
        />

        <DocumentFilterChips
          chips={chips}
          onRemove={handleRemoveChip}
          onClearAll={handleClearAllFilters}
        />

        {pageAlert && (
          <InlineAlert tone={pageAlert.tone} onDismiss={() => setPageAlert(null)}>
            {pageAlert.message}
          </InlineAlert>
        )}

        {pollTimedOut && hasInProgress && (
          <InlineAlert tone="info">
            Some documents are still processing. Refresh the page to check again.
          </InlineAlert>
        )}

        {isLoading && (
          <p className="sr-only" role="status">
            Loading documents…
          </p>
        )}

        {loadError && !isLoading ? (
          <div className="flex flex-col items-start gap-3">
            <InlineAlert tone="error">
              <p className="font-medium">Couldn't load documents.</p>
              <p>{loadError}</p>
            </InlineAlert>
            <Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={handleRetryLoad}
            >
              Try again
            </Button>
          </div>
        ) : rows.length === 0 && !isLoading ? (
          hasFilters ? (
            <EmptyState
              className="rounded border border-line"
              icon="filter_alt_off"
              title="No documents match these filters"
              description="Remove a filter or clear them all."
              action={
                <Button variant="secondary" size="sm" onClick={handleClearAllFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              className="rounded border border-line"
              icon="folder_open"
              title="No documents yet"
              description="Upload PDF, JPG or PNG files to add them to the register."
              action={
                <ButtonLink to="/upload" variant="dark" size="sm" icon="add">
                  Upload document
                </ButtonLink>
              }
            />
          )
        ) : (
          <>
            <DocumentTable
              documents={rows}
              isLoading={isLoading}
              selectedIds={selectedIds}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              onOpenPreview={handleOpenPreview}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onDownload={handleDownloadDocument}
              onRetry={handleRetryProcessing}
            />
            {snapshot && rows.length > 0 && (
              <DocumentsSummaryBar
                total={total}
                totalBytes={totalBytes}
                shownCount={rows.length}
                isCapped={isCapped}
                updatedAt={snapshot.updatedAt}
                counts={counts}
                isFailedFilterActive={statusFilter === 'FAILED'}
                onShowFailed={handleShowFailed}
              />
            )}
          </>
        )}
      </div>

      {selectedDocument && (
        <DocumentPreviewModal
          document={selectedDocument}
          filterDefinitions={filterDefinitions}
          onClose={handleClosePreview}
        />
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onExport={handleOpenZipExport}
          onExportCsv={handleExportSelectedCsv}
          onDelete={handleRequestDelete}
          onClear={handleClearSelection}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        documentIds={Array.from(selectedIds)}
        projectName={commonProjectName(selectedRows.map((d) => d.projectName))}
        onSaved={showSaveResult}
      />

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        title={
          selectedIds.size === 1
            ? 'Delete 1 document?'
            : `Delete ${formatCount(selectedIds.size)} documents?`
        }
        message={
          selectedIds.size === 1
            ? "It'll move to the recycle bin. An admin can restore it for 30 days."
            : "They'll move to the recycle bin. An admin can restore them for 30 days."
        }
        confirmLabel="Delete"
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </main>
  );
}
