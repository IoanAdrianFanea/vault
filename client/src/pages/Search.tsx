import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Document } from '../types';
import {
  documentsService,
  type SearchResult,
} from '../api/documents';
import { filtersService, type FilterDefinition } from '../api/filters';
import { downloadDocument } from '../api/exports';
import {
  ButtonLink,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  InlineAlert,
  PageHeader,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableSkeletonRows,
  TextAction,
} from '../components/ui';
import { BulkActionBar } from '../components/documents/BulkActionBar';
import {
  DocumentDrawer,
  type DrawerDocumentState,
} from '../components/documents/DocumentDrawer';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import { ExportModal } from '../components/documents/ExportModal';
import { SearchSnippet } from '../components/search/SearchSnippet.tsx';
import { toUiDocument } from '../components/documents/documentConvert';
import { useRangeSelection } from '../hooks/useRangeSelection';
import { formatCount, formatCountLabel } from '../utils/format';

type PendingDelete =
  | { kind: 'single'; documentId: string }
  | { kind: 'bulk' };

export default function Search() {
  const [searchParams] = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const [drawerState, setDrawerState] = useState<DrawerDocumentState | null>(null);
  const [filterDefinitions, setFilterDefinitions] = useState<FilterDefinition[]>([]);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pageAlert, setPageAlert] = useState<{
    tone: 'error' | 'warning' | 'success';
    message: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selection = useRangeSelection(
    results.map((r) => r.documentId),
    query,
  );

  useEffect(() => {
    let isActive = true;
    filtersService
      .listFilters()
      .then((defs) => {
        if (isActive) setFilterDefinitions(defs);
      })
      .catch(() => {
        if (isActive) setFilterDefinitions([]);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    documentsService
      .searchDocuments(query.trim())
      .then((data) => {
        if (!isActive) return;
        setResults(data.results);
      })
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [query]);

  useEffect(() => {
    if (!id) {
      setDrawerState(null);
      return;
    }

    let isActive = true;
    setDrawerState({ status: 'loading' });

    documentsService
      .getDocument(id)
      .then((apiDoc) => {
        if (!isActive) return;
        setDrawerState({ status: 'ready', document: toUiDocument(apiDoc) });
      })
      .catch((err) => {
        if (!isActive) return;
        setDrawerState({
          status: 'error',
          message:
            err instanceof Error ? err.message : "Couldn't load this document.",
        });
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  const handleCloseDrawer = () => {
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  };

  const handleOpenDocument = (documentId: string) => {
    navigate(
      query
        ? `/search/${documentId}?q=${encodeURIComponent(query)}`
        : `/search/${documentId}`,
    );
  };

  const handleOpenPreview = async (documentId: string) => {
    setPreviewLoadingId(documentId);
    try {
      const apiDoc = await documentsService.getDocument(documentId);
      setPreviewDocument(toUiDocument(apiDoc));
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: `Couldn't open the preview. ${err instanceof Error ? err.message : ''}`.trim(),
      });
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const handleOpenPreviewFromDrawer = (doc: Document) => {
    setPreviewDocument(doc);
  };

  const handleDownload = async (documentId: string) => {
    setDownloadingId(documentId);
    try {
      await downloadDocument(documentId);
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: `Couldn't download the document. ${err instanceof Error ? err.message : ''}`.trim(),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRequestDelete = (documentId: string) => {
    setPendingDelete({ kind: 'single', documentId });
  };

  const handleRequestBulkDelete = () => {
    setPendingDelete({ kind: 'bulk' });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);

    if (pendingDelete.kind === 'single') {
      const docId = pendingDelete.documentId;
      try {
        await documentsService.deleteDocument(docId);
        setResults((prev) => prev.filter((r) => r.documentId !== docId));
        selection.retain(
          Array.from(selection.selectedIds).filter((selectedId) => selectedId !== docId),
        );
        setPendingDelete(null);
        handleCloseDrawer();
      } catch (err) {
        setPageAlert({
          tone: 'error',
          message: `Couldn't delete. ${err instanceof Error ? err.message : ''}`.trim(),
        });
      } finally {
        setIsDeleting(false);
      }
    } else {
      const ids = Array.from(selection.selectedIds);
      try {
        const result = await documentsService.bulkDeleteDocuments(ids);
        const failedSet = new Set(result.failed);
        setResults((prev) =>
          prev.filter(
            (r) => !ids.includes(r.documentId) || failedSet.has(r.documentId),
          ),
        );
        selection.retain(result.failed);

        if (id && ids.includes(id) && !failedSet.has(id)) {
          handleCloseDrawer();
        }

        if (result.failed.length > 0) {
          setPageAlert({
            tone: 'warning',
            message: `Deleted ${formatCountLabel(result.deleted, 'document', 'documents')}. ${formatCountLabel(result.failed.length, 'document', 'documents')} couldn't be deleted.`,
          });
        }
        setPendingDelete(null);
      } catch (err) {
        setPageAlert({
          tone: 'error',
          message: `Couldn't delete. ${err instanceof Error ? err.message : ''}`.trim(),
        });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleExportSelected = () => {
    setShowExportModal(true);
  };

  const hasSearchQuery = query.trim().length >= 2;
  const showResults = hasSearchQuery && !error;

  const headerDescription =
    showResults && !isLoading
      ? results.length === 20
        ? 'Showing the top 20 results — refine your search'
        : `"${query}" — ${formatCountLabel(results.length, 'result', 'results')}`
      : undefined;

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <div
          className={`flex min-h-0 flex-1 flex-col gap-2 px-4 pt-3 ${
            selection.selectedIds.size > 0 ? 'pb-20' : 'pb-4'
          }`}
        >
          <PageHeader
            title="Search results"
            description={headerDescription}
          />

          {pageAlert && (
            <InlineAlert
              tone={pageAlert.tone}
              onDismiss={() => setPageAlert(null)}
            >
              {pageAlert.message}
            </InlineAlert>
          )}

          {!hasSearchQuery ? (
            <EmptyState
              className="rounded border border-line"
              icon="search"
              title="Search your documents"
              description="Type at least 2 characters in the search bar to search file names and document text."
            />
          ) : error ? (
            <InlineAlert tone="error">
              <p className="font-medium">Couldn't search documents.</p>
              <p>{error}</p>
            </InlineAlert>
          ) : isLoading && results.length === 0 ? (
            <DataTable label="Search results" fixed>
              <tbody>
                <TableSkeletonRows columns={3} rows={6} />
              </tbody>
            </DataTable>
          ) : results.length === 0 ? (
            <EmptyState
              className="rounded border border-line"
              icon="search_off"
              title={`No results for "${query}"`}
              description="Try a different word, or browse all documents."
              action={
                <ButtonLink to="/documents" variant="secondary" size="sm">
                  Browse documents
                </ButtonLink>
              }
            />
          ) : (
            <DataTable label="Search results" fixed busy={isLoading}>
              <thead>
                <TableRow>
                  <TableHeaderCell align="center" className="w-8">
                    <Checkbox
                      aria-label="Select all results"
                      checked={selection.allSelected}
                      indeterminate={
                        selection.someSelected && !selection.allSelected
                      }
                      onChange={(e) => selection.setAll(e.target.checked)}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>Document</TableHeaderCell>
                  <TableHeaderCell align="end" className="w-[160px]">
                    Actions
                  </TableHeaderCell>
                </TableRow>
              </thead>
              <tbody>
                {results.map((result) => {
                  const isSelected = selection.selectedIds.has(result.documentId);

                  return (
                    <TableRow
                      key={result.documentId}
                      selected={isSelected}
                      onClick={() => handleOpenDocument(result.documentId)}
                    >
                      <TableCell
                        align="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          aria-label={`Select ${result.filename}`}
                          checked={isSelected}
                          onChange={(e) =>
                            selection.toggle(
                              result.documentId,
                              (e.nativeEvent as MouseEvent).shiftKey,
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          title={result.filename}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocument(result.documentId);
                          }}
                          className="block max-w-full truncate rounded-sm text-left text-body font-medium text-ink hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {result.filename}
                        </button>
                        <SearchSnippet
                          snippet={result.snippet}
                          className="mt-0.5 line-clamp-2 text-small text-ink-muted"
                        />
                      </TableCell>
                      <TableCell align="end" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <TextAction
                            tone="accent"
                            aria-label={`Preview ${result.filename}`}
                            disabled={previewLoadingId !== null}
                            onClick={() => handleOpenPreview(result.documentId)}
                          >
                            Preview
                          </TextAction>
                          <span
                            className="text-small text-line-strong"
                            aria-hidden="true"
                          >
                            /
                          </span>
                          <TextAction
                            tone="muted"
                            aria-label={`Download ${result.filename}`}
                            disabled={downloadingId === result.documentId}
                            onClick={() => handleDownload(result.documentId)}
                          >
                            Download
                          </TextAction>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </div>
      </main>

      {drawerState && (
        <DocumentDrawer
          state={drawerState}
          filterDefinitions={filterDefinitions}
          onClose={handleCloseDrawer}
          onDelete={handleRequestDelete}
          onOpenPreview={handleOpenPreviewFromDrawer}
        />
      )}

      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          filterDefinitions={filterDefinitions}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {selection.selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selection.selectedIds.size}
          onExport={handleExportSelected}
          onDelete={handleRequestBulkDelete}
          onClear={selection.clear}
        />
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        documentIds={Array.from(selection.selectedIds)}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={
          pendingDelete?.kind === 'single'
            ? 'Delete this document?'
            : selection.selectedIds.size === 1
            ? 'Delete 1 document?'
            : `Delete ${formatCount(selection.selectedIds.size)} documents?`
        }
        message={
          pendingDelete?.kind === 'single' || selection.selectedIds.size === 1
            ? "It'll move to the recycle bin. An admin can restore it for 30 days."
            : "They'll move to the recycle bin. An admin can restore them for 30 days."
        }
        confirmLabel="Delete"
        isConfirming={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

