import { useCallback, useEffect, useState } from 'react';
import {
  getDeletedDocuments,
  getDeletedProjects,
  getDeletedProjectDocuments,
  permanentlyDeleteDocument,
  permanentlyDeleteProject,
  restoreDocument,
  restoreProject,
  type DeletedDocument,
  type DeletedProject,
} from '../../api/recycleBin';
import { getProjects, type AdminProject } from '../../api/projects';
import { AdminSection } from '../../components/admin/AdminSection';
import { useRangeSelection } from '../../hooks/useRangeSelection';
import {
  Badge,
  BulkBar,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  InlineAlert,
  Modal,
  SegmentedControl,
  Select,
  TableCell,
  TableHeaderCell,
  TableRow,
  TextAction,
  getTabId,
  getTabPanelId,
} from '../../components/ui';
import { formatCount, formatCountLabel, formatDate, formatFileSize } from '../../utils/format';
import { getExpiryDisplay } from '../../components/admin/recycleBinExpiry';

type PendingAction =
  | { type: 'restore-document-choice'; document: DeletedDocument }
  | { type: 'purge-document'; document: DeletedDocument }
  | { type: 'restore-project'; project: DeletedProject }
  | { type: 'purge-project'; project: DeletedProject }
  | { type: 'bulk-purge'; ids: string[] }
  | null;

export default function AdminRecycleBin() {
  const [documents, setDocuments] = useState<DeletedDocument[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<DeletedProject[]>([]);
  const [activeProjects, setActiveProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState<'documents' | 'projects'>('documents');
  const [selectedProject, setSelectedProject] = useState<DeletedProject | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<DeletedDocument[]>([]);
  const [isLoadingProjectDocuments, setIsLoadingProjectDocuments] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [pageAlert, setPageAlert] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const selection = useRangeSelection(
    documents.map((d) => d.id),
    tab,
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [docs, projects, allProjects] = await Promise.all([
        getDeletedDocuments(),
        getDeletedProjects(),
        getProjects(),
      ]);
      setDocuments(docs);
      setDeletedProjects(projects);
      setActiveProjects(allProjects);
    } catch {
      setError('Failed to load the recycle bin. Please try refreshing.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadProjectDocuments = useCallback(async (projectId: string) => {
    setIsLoadingProjectDocuments(true);
    try {
      const docs = await getDeletedProjectDocuments(projectId);
      setProjectDocuments(docs);
    } catch {
      setPageAlert({
        tone: 'error',
        message: 'Failed to load project documents.',
      });
    } finally {
      setIsLoadingProjectDocuments(false);
    }
  }, []);

  const openProject = (project: DeletedProject) => {
    setSelectedProject(project);
    loadProjectDocuments(project.id);
  };

  const closeProject = () => {
    setSelectedProject(null);
    setProjectDocuments([]);
  };

  const handleRefresh = () => {
    load();
    if (selectedProject) {
      loadProjectDocuments(selectedProject.id);
    }
  };

  const reloadAfterAction = useCallback(
    (removedProjectId?: string) => {
      load();
      if (selectedProject) {
        if (removedProjectId && selectedProject.id === removedProjectId) {
          closeProject();
        } else {
          loadProjectDocuments(selectedProject.id);
        }
      }
    },
    [load, loadProjectDocuments, selectedProject],
  );

  const handleRestoreDocument = async (doc: DeletedDocument) => {
    if (!doc.restorable) return;
    if (doc.requiresProjectChoice) {
      setSelectedProjectId('');
      setPendingAction({ type: 'restore-document-choice', document: doc });
      return;
    }

    setIsActing(true);
    setPageAlert(null);
    try {
      await restoreDocument(doc.id);
      setPageAlert({
        tone: 'success',
        message: `"${doc.originalFilename}" was restored to ${doc.projectName}.`,
      });
      selection.retain(
        Array.from(selection.selectedIds).filter((id) => id !== doc.id),
      );
      reloadAfterAction();
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Action failed',
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setIsActing(true);
    setPageAlert(null);

    try {
      if (pendingAction.type === 'restore-document-choice') {
        const doc = pendingAction.document;
        await restoreDocument(doc.id, selectedProjectId);
        const chosenProject = activeProjects.find((p) => p.id === selectedProjectId);
        setPageAlert({
          tone: 'success',
          message: `"${doc.originalFilename}" was restored to ${chosenProject?.name ?? 'project'}.`,
        });
        selection.retain(
          Array.from(selection.selectedIds).filter((id) => id !== doc.id),
        );
        setPendingAction(null);
        reloadAfterAction();
      } else if (pendingAction.type === 'purge-document') {
        const doc = pendingAction.document;
        await permanentlyDeleteDocument(doc.id);
        selection.retain(
          Array.from(selection.selectedIds).filter((id) => id !== doc.id),
        );
        setPendingAction(null);
        reloadAfterAction();
      } else if (pendingAction.type === 'restore-project') {
        const proj = pendingAction.project;
        await restoreProject(proj.id);
        setPageAlert({
          tone: 'success',
          message: `"${proj.name}" was restored.`,
        });
        setPendingAction(null);
        reloadAfterAction(proj.id);
      } else if (pendingAction.type === 'purge-project') {
        const proj = pendingAction.project;
        await permanentlyDeleteProject(proj.id);
        setPendingAction(null);
        reloadAfterAction(proj.id);
      } else if (pendingAction.type === 'bulk-purge') {
        let failedCount = 0;
        const failedIds: string[] = [];
        for (const id of pendingAction.ids) {
          try {
            await permanentlyDeleteDocument(id);
          } catch {
            failedCount++;
            failedIds.push(id);
          }
        }
        selection.retain(failedIds);
        if (failedCount > 0) {
          setPageAlert({
            tone: 'warning',
            message: `${formatCountLabel(failedCount, 'document', 'documents')} couldn't be deleted.`,
          });
        }
        setPendingAction(null);
        reloadAfterAction();
      }
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Action failed',
      });
      setPendingAction(null);
    } finally {
      setIsActing(false);
    }
  };

  const handleBulkRestore = async () => {
    const selectedDocs = documents.filter((d) => selection.selectedIds.has(d.id));
    const restorableNow = selectedDocs.filter(
      (d) => d.restorable && !d.requiresProjectChoice,
    );
    const skipped = selectedDocs.filter(
      (d) => !d.restorable || d.requiresProjectChoice,
    );

    if (restorableNow.length === 0) {
      const names = skipped.map((d) => `"${d.originalFilename}"`).join(', ');
      setPageAlert({
        tone: 'warning',
        message: `None of the selected documents can be restored in bulk: ${names}. Restore them one at a time to choose a project, or restore their whole project.`,
      });
      return;
    }

    setIsBulkRunning(true);
    setPageAlert(null);
    let restoredCount = 0;
    let failedCount = 0;
    const failedIds: string[] = [];

    for (const doc of restorableNow) {
      try {
        await restoreDocument(doc.id);
        restoredCount++;
      } catch {
        failedCount++;
        failedIds.push(doc.id);
      }
    }

    const skippedIds = skipped.map((d) => d.id);
    selection.retain([...skippedIds, ...failedIds]);
    reloadAfterAction();

    if (skipped.length === 0 && failedCount === 0) {
      setPageAlert({
        tone: 'success',
        message: `Restored ${formatCountLabel(restoredCount, 'document', 'documents')}.`,
      });
    } else {
      const parts: string[] = [];
      if (restoredCount > 0) {
        parts.push(`Restored ${formatCountLabel(restoredCount, 'document', 'documents')}.`);
      }
      if (skipped.length > 0) {
        const skippedNames = skipped.map((d) => `"${d.originalFilename}"`).join(', ');
        parts.push(`Skipped ${skippedNames}: restore these one at a time to choose a project, or restore their whole project.`);
      }
      if (failedCount > 0) {
        parts.push(`${formatCountLabel(failedCount, 'document', 'documents')} couldn't be restored.`);
      }
      setPageAlert({
        tone: 'warning',
        message: parts.join(' '),
      });
    }

    setIsBulkRunning(false);
  };

  const isBinEmpty =
    !isLoading &&
    !error &&
    documents.length === 0 &&
    deletedProjects.length === 0;

  return (
    <AdminSection
      bulkBarSpace={
        !selectedProject &&
        tab === 'documents' &&
        selection.selectedIds.size > 0
      }
      toolbarStart={
        !selectedProject ? (
          <SegmentedControl
            label="Recycle bin contents"
            idPrefix="recycle-bin"
            value={tab}
            onChange={setTab}
            items={[
              {
                value: 'documents',
                label: 'Documents',
                count: documents.length,
              },
              {
                value: 'projects',
                label: 'Projects',
                count: deletedProjects.length,
              },
            ]}
          />
        ) : undefined
      }
      toolbarEnd={
        !selectedProject ? (
          <Button
            variant="secondary"
            size="sm"
            icon="refresh"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        ) : undefined
      }
    >
      {selectedProject ? (
        <div className="space-y-4">
          <TextAction
            tone="muted"
            onClick={closeProject}
            className="inline-flex items-center gap-1 mb-1"
          >
            <span
              className="material-symbols-outlined text-[14px]"
              aria-hidden="true"
            >
              arrow_back
            </span>
            <span>Back to recycle bin</span>
          </TextAction>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-section text-ink">
                  {selectedProject.name}
                </h2>
                {selectedProject.isArchived && (
                  <Badge
                    tone="slate"
                    title="Stored in the project archive – restore the whole project"
                  >
                    Archived
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-small text-ink-muted tabular-nums">
                {formatCountLabel(
                  selectedProject.documentCount,
                  'document',
                  'documents',
                )}{' '}
                · Deleted {formatDate(selectedProject.deletedAt)} by{' '}
                {selectedProject.deletedByName ??
                  selectedProject.deletedByEmail ??
                  '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="restore_from_trash"
                onClick={() =>
                  setPendingAction({
                    type: 'restore-project',
                    project: selectedProject,
                  })
                }
              >
                Restore
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="delete_forever"
                onClick={() =>
                  setPendingAction({
                    type: 'purge-project',
                    project: selectedProject,
                  })
                }
              >
                Delete permanently
              </Button>
            </div>
          </div>

          {pageAlert && (
            <InlineAlert
              tone={pageAlert.tone}
              onDismiss={() => setPageAlert(null)}
            >
              {pageAlert.message}
            </InlineAlert>
          )}

          {isLoadingProjectDocuments && projectDocuments.length === 0 ? null : projectDocuments.length === 0 ? (
            <EmptyState
              icon="description"
              title="No deleted documents"
            />
          ) : (
            <DataTable
              label={`Deleted documents in ${selectedProject.name}`}
              fixed
              busy={isLoadingProjectDocuments}
            >
              <thead>
                <TableRow>
                  <TableHeaderCell>Document</TableHeaderCell>
                  <TableHeaderCell>Deleted by</TableHeaderCell>
                  <TableHeaderCell className="w-[110px]">
                    Deleted
                  </TableHeaderCell>
                  <TableHeaderCell className="w-[110px]">
                    Expires
                  </TableHeaderCell>
                </TableRow>
              </thead>
              <tbody>
                {projectDocuments.map((doc) => {
                  const exp = getExpiryDisplay(doc.daysRemaining);

                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <span
                          className="block truncate font-medium text-ink"
                          title={doc.originalFilename}
                        >
                          {doc.originalFilename}
                        </span>
                        <span className="block text-small text-ink-muted tabular-nums">
                          {formatFileSize(doc.sizeBytes)}
                        </span>
                      </TableCell>
                      <TableCell className="truncate">
                        {doc.deletedByName ?? doc.deletedByEmail ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                        {formatDate(doc.deletedAt)}
                      </TableCell>
                      <TableCell>
                        {exp.tone ? (
                          <Badge tone={exp.tone}>{exp.label}</Badge>
                        ) : (
                          <span className="text-small text-ink-muted tabular-nums">
                            {exp.label}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </div>
      ) : (
        <>
          {pageAlert && (
            <InlineAlert
              tone={pageAlert.tone}
              onDismiss={() => setPageAlert(null)}
            >
              {pageAlert.message}
            </InlineAlert>
          )}

          {error && <InlineAlert tone="error">{error}</InlineAlert>}

          {isBinEmpty ? (
            <EmptyState
              className="rounded border border-line"
              icon="delete"
              title="Recycle bin is empty"
              description="Deleted documents and projects stay here for 30 days before they're permanently removed."
            />
          ) : tab === 'documents' ? (
            <div
              role="tabpanel"
              id={getTabPanelId('recycle-bin', 'documents')}
              aria-labelledby={getTabId('recycle-bin', 'documents')}
            >
              {isLoading && documents.length === 0 ? null : documents.length === 0 ? (
                <EmptyState
                  icon="description"
                  title="No deleted documents"
                />
              ) : (
                <DataTable
                  label="Deleted documents"
                  fixed
                  busy={isLoading}
                >
                  <thead>
                    <TableRow>
                      <TableHeaderCell align="center" className="w-8">
                        <Checkbox
                          aria-label="Select all documents"
                          checked={selection.allSelected}
                          indeterminate={
                            selection.someSelected && !selection.allSelected
                          }
                          onChange={(e) => selection.setAll(e.target.checked)}
                        />
                      </TableHeaderCell>
                      <TableHeaderCell>Document</TableHeaderCell>
                      <TableHeaderCell>Project</TableHeaderCell>
                      <TableHeaderCell>Deleted by</TableHeaderCell>
                      <TableHeaderCell className="w-[110px]">
                        Deleted
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[100px]">
                        Expires
                      </TableHeaderCell>
                      <TableHeaderCell align="end" className="w-[150px]">
                        Actions
                      </TableHeaderCell>
                    </TableRow>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const isSelected = selection.selectedIds.has(doc.id);
                      const exp = getExpiryDisplay(doc.daysRemaining);

                      return (
                        <TableRow
                          key={doc.id}
                          selected={isSelected}
                        >
                          <TableCell
                            align="center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              aria-label={`Select ${doc.originalFilename}`}
                              checked={isSelected}
                              onChange={(e) =>
                                selection.toggle(
                                  doc.id,
                                  (e.nativeEvent as MouseEvent).shiftKey,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <span
                              className="block truncate font-medium text-ink"
                              title={doc.originalFilename}
                            >
                              {doc.originalFilename}
                            </span>
                            <span className="block text-small text-ink-muted tabular-nums">
                              {formatFileSize(doc.sizeBytes)}
                            </span>
                          </TableCell>
                          <TableCell className="truncate">
                            {doc.projectName}
                          </TableCell>
                          <TableCell className="truncate">
                            {doc.deletedByName ?? doc.deletedByEmail ?? '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                            {formatDate(doc.deletedAt)}
                          </TableCell>
                          <TableCell>
                            {exp.tone ? (
                              <Badge tone={exp.tone}>{exp.label}</Badge>
                            ) : (
                              <span className="text-small text-ink-muted tabular-nums">
                                {exp.label}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              {doc.restorable ? (
                                <TextAction
                                  tone="accent"
                                  aria-label={`Restore ${doc.originalFilename}`}
                                  disabled={isActing}
                                  onClick={() => handleRestoreDocument(doc)}
                                >
                                  Restore
                                </TextAction>
                              ) : (
                                <span title="Restore the whole project from the Projects tab">
                                  <TextAction
                                    tone="accent"
                                    aria-label={`Restore ${doc.originalFilename}`}
                                    disabled
                                  >
                                    Restore
                                  </TextAction>
                                </span>
                              )}
                              <span
                                className="text-small text-line-strong"
                                aria-hidden="true"
                              >
                                /
                              </span>
                              <TextAction
                                tone="danger"
                                aria-label={`Permanently delete ${doc.originalFilename}`}
                                onClick={() =>
                                  setPendingAction({
                                    type: 'purge-document',
                                    document: doc,
                                  })
                                }
                              >
                                Delete
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
          ) : (
            <div
              role="tabpanel"
              id={getTabPanelId('recycle-bin', 'projects')}
              aria-labelledby={getTabId('recycle-bin', 'projects')}
            >
              {isLoading && deletedProjects.length === 0 ? null : deletedProjects.length === 0 ? (
                <EmptyState
                  icon="folder_delete"
                  title="No deleted projects"
                />
              ) : (
                <DataTable
                  label="Deleted projects"
                  fixed
                  busy={isLoading}
                >
                  <thead>
                    <TableRow>
                      <TableHeaderCell>Project</TableHeaderCell>
                      <TableHeaderCell align="end" className="w-[100px]">
                        Documents
                      </TableHeaderCell>
                      <TableHeaderCell>Deleted by</TableHeaderCell>
                      <TableHeaderCell className="w-[110px]">
                        Deleted
                      </TableHeaderCell>
                      <TableHeaderCell className="w-[100px]">
                        Expires
                      </TableHeaderCell>
                      <TableHeaderCell align="end" className="w-[200px]">
                        Actions
                      </TableHeaderCell>
                    </TableRow>
                  </thead>
                  <tbody>
                    {deletedProjects.map((proj) => {
                      const exp = getExpiryDisplay(proj.daysRemaining);

                      return (
                        <TableRow
                          key={proj.id}
                          onClick={() => openProject(proj)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className="truncate font-medium text-ink"
                                title={proj.name}
                              >
                                {proj.name}
                              </span>
                              {proj.isArchived && (
                                <Badge
                                  tone="slate"
                                  title="Stored in the project archive – restore the whole project"
                                >
                                  Archived
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell align="end">
                            <span className="text-small text-ink-muted tabular-nums">
                              {formatCount(proj.documentCount)}
                            </span>
                          </TableCell>
                          <TableCell className="truncate">
                            {proj.deletedByName ?? proj.deletedByEmail ?? '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-small text-ink-muted tabular-nums">
                            {formatDate(proj.deletedAt)}
                          </TableCell>
                          <TableCell>
                            {exp.tone ? (
                              <Badge tone={exp.tone}>{exp.label}</Badge>
                            ) : (
                              <span className="text-small text-ink-muted tabular-nums">
                                {exp.label}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <TextAction
                                tone="accent"
                                onClick={() => openProject(proj)}
                              >
                                View
                              </TextAction>
                              <span
                                className="text-small text-line-strong"
                                aria-hidden="true"
                              >
                                /
                              </span>
                              <TextAction
                                tone="accent"
                                onClick={() =>
                                  setPendingAction({
                                    type: 'restore-project',
                                    project: proj,
                                  })
                                }
                              >
                                Restore
                              </TextAction>
                              <span
                                className="text-small text-line-strong"
                                aria-hidden="true"
                              >
                                /
                              </span>
                              <TextAction
                                tone="danger"
                                onClick={() =>
                                  setPendingAction({
                                    type: 'purge-project',
                                    project: proj,
                                  })
                                }
                              >
                                Delete
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
          )}

          {!selectedProject &&
            tab === 'documents' &&
            selection.selectedIds.size > 0 && (
              <BulkBar
                selectedCount={selection.selectedIds.size}
                busy={isBulkRunning || isActing}
                onClear={selection.clear}
                actions={[
                  {
                    key: 'restore',
                    label: 'Restore selected',
                    icon: 'restore_from_trash',
                    onClick: handleBulkRestore,
                  },
                  {
                    key: 'purge',
                    label: 'Delete permanently',
                    icon: 'delete_forever',
                    onClick: () =>
                      setPendingAction({
                        type: 'bulk-purge',
                        ids: [...selection.selectedIds],
                      }),
                  },
                ]}
              />
            )}
        </>
      )}

      {pendingAction?.type === 'restore-document-choice' && (
        <Modal
          isOpen
          onClose={() => setPendingAction(null)}
          size="sm"
          title="Restore to which project?"
          closeDisabled={isActing}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingAction(null)}
                disabled={isActing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={isActing}
                disabled={!selectedProjectId}
                onClick={handleConfirm}
              >
                Restore
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-body text-ink-body">
              "{pendingAction.document.originalFilename}" — The original project
              has been deleted or archived.
            </p>
            <FormField label="Project" htmlFor="restore-target-project">
              <Select
                id="restore-target-project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={isActing || activeProjects.length === 0}
              >
                <option value="">Choose a project</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {activeProjects.length === 0 && (
              <InlineAlert tone="info">
                There are no active projects to restore into. Create a project
                first.
              </InlineAlert>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={pendingAction?.type === 'purge-document'}
        title="Delete permanently?"
        confirmLabel="Delete permanently"
        isConfirming={isActing}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
        message={
          pendingAction?.type === 'purge-document'
            ? `Permanently delete "${pendingAction.document.originalFilename}"? This can't be undone.`
            : ''
        }
      />

      <ConfirmDialog
        isOpen={pendingAction?.type === 'purge-project'}
        title="Delete permanently?"
        confirmLabel="Delete permanently"
        isConfirming={isActing}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
        message={
          pendingAction?.type === 'purge-project'
            ? `Permanently delete "${pendingAction.project.name}" and its ${formatCountLabel(
                pendingAction.project.documentCount,
                'document',
                'documents',
              )}? This can't be undone.`
            : ''
        }
      />

      <ConfirmDialog
        isOpen={pendingAction?.type === 'restore-project'}
        tone="default"
        title="Restore project?"
        confirmLabel="Restore"
        isConfirming={isActing}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
        message={
          pendingAction?.type === 'restore-project'
            ? `"${pendingAction.project.name}" and the documents that were active when it was deleted will be restored.`
            : ''
        }
      />

      <ConfirmDialog
        isOpen={pendingAction?.type === 'bulk-purge'}
        title={
          pendingAction?.type === 'bulk-purge'
            ? `Delete ${formatCountLabel(pendingAction.ids.length, 'document', 'documents')} permanently?`
            : ''
        }
        confirmLabel="Delete permanently"
        isConfirming={isActing}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
        message={<p>This can't be undone.</p>}
      />
    </AdminSection>
  );
}
