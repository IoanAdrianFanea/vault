import { useEffect, useState } from 'react';
import {
  deleteArchivedProject,
  downloadProjectArchive,
  getArchivedProjects,
  unarchiveProject,
  type ArchivedProject,
} from '../../api/archive';
import { AdminSection } from '../../components/admin/AdminSection';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  InlineAlert,
  Input,
  TableCell,
  TableHeaderCell,
  TableRow,
  TextAction,
} from '../../components/ui';
import {
  formatCount,
  formatCountLabel,
  formatDate,
  formatFileSize,
} from '../../utils/format';
import { beginSave, describeSaveResult } from '../../utils/saveFile';

const OPERATION_LABELS: Record<string, string> = {
  ARCHIVING: 'Archiving…',
  UNARCHIVING: 'Restoring…',
  DELETING: 'Deleting…',
};

export default function AdminArchive() {
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageAlert, setPageAlert] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [search, setSearch] = useState('');

  const [pendingAction, setPendingAction] = useState<{
    type: 'restore' | 'delete';
    project: ArchivedProject;
  } | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    getArchivedProjects()
      .then((data) => {
        setProjects(data);
        setError('');
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch archived projects',
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleDownload = async (project: ArchivedProject) => {
    const target = beginSave();
    setDownloadingId(project.id);
    setPageAlert(null);
    try {
      const result = await downloadProjectArchive(project.id, project.name, { target });
      setPageAlert(describeSaveResult(result));
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message: `Couldn't download the archive. ${
          err instanceof Error ? err.message : ''
        }`.trim(),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsActing(true);
    setPageAlert(null);

    const proj = pendingAction.project;

    try {
      if (pendingAction.type === 'restore') {
        const res = await unarchiveProject(proj.id);
        setProjects((prev) => prev.filter((p) => p.id !== proj.id));

        if (res.missingDocuments && res.missingDocuments.length > 0) {
          const names = res.missingDocuments
            .map((d) => `"${d.originalFilename}"`)
            .join(', ');
          setPageAlert({
            tone: 'warning',
            message: `Restored "${proj.name}" with ${formatCountLabel(
              res.restoredDocuments,
              'document',
              'documents',
            )}. These files were missing from storage: ${names}.`,
          });
        } else {
          setPageAlert({
            tone: 'success',
            message: `Restored "${proj.name}" with ${formatCountLabel(
              res.restoredDocuments,
              'document',
              'documents',
            )}.`,
          });
        }
      } else if (pendingAction.type === 'delete') {
        await deleteArchivedProject(proj.id);
        setProjects((prev) => prev.filter((p) => p.id !== proj.id));
        setPageAlert({
          tone: 'success',
          message: `"${proj.name}" moved to the recycle bin.`,
        });
      }
    } catch (err) {
      setPageAlert({
        tone: 'error',
        message:
          err instanceof Error ? err.message : 'Action failed. Try again.',
      });
    } finally {
      setIsActing(false);
      setPendingAction(null);
    }
  };

  const visibleProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <AdminSection
      toolbarStart={
        <Input
          size="sm"
          leadingIcon="search"
          placeholder="Search archived projects"
          aria-label="Search archived projects"
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      }
    >
      {pageAlert && (
        <InlineAlert
          tone={pageAlert.tone}
          onDismiss={() => setPageAlert(null)}
        >
          {pageAlert.message}
        </InlineAlert>
      )}

      {error && <InlineAlert tone="error">{error}</InlineAlert>}

      {isLoading && projects.length === 0 ? null : !error && projects.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="No archived projects"
          description="Archive a completed project from the Projects tab to free up the working view."
        />
      ) : !error && visibleProjects.length === 0 ? (
        <EmptyState
          icon="search_off"
          title={`No archived projects match "${search.trim()}"`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearch('')}
            >
              Clear search
            </Button>
          }
        />
      ) : (
        <DataTable
          label="Archived projects"
          fixed
          busy={isLoading && projects.length > 0}
        >
          <thead>
            <TableRow>
              <TableHeaderCell>Project</TableHeaderCell>
              <TableHeaderCell className="w-[180px]">Archived</TableHeaderCell>
              <TableHeaderCell align="end" className="w-[96px]">
                Documents
              </TableHeaderCell>
              <TableHeaderCell align="end" className="w-[88px]">
                Members
              </TableHeaderCell>
              <TableHeaderCell align="end" className="w-[90px]">
                Size
              </TableHeaderCell>
              <TableHeaderCell align="end" className="w-[260px]">
                Actions
              </TableHeaderCell>
            </TableRow>
          </thead>
          <tbody>
            {visibleProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate font-medium text-ink"
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      {project.operation && (
                        <Badge tone="amber">
                          {OPERATION_LABELS[project.operation] ??
                            project.operation}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-small text-ink tabular-nums">
                      {formatDate(project.archivedAt)}
                    </span>
                    {(project.archivedByName || project.archivedByEmail) && (
                      <span className="block text-small text-ink-muted">
                        by {project.archivedByName ?? project.archivedByEmail}
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="end">
                    <span className="text-small text-ink-muted tabular-nums">
                      {formatCount(project.documentCount)}
                    </span>
                  </TableCell>
                  <TableCell align="end">
                    <span className="text-small text-ink-muted tabular-nums">
                      {formatCount(project.memberCount)}
                    </span>
                  </TableCell>
                  <TableCell align="end">
                    <span className="text-small text-ink-muted tabular-nums">
                      {project.archiveSizeBytes > 0
                        ? formatFileSize(project.archiveSizeBytes)
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell align="end">
                    <div className="inline-flex items-center gap-1.5">
                      <TextAction
                        tone="accent"
                        disabled={
                          Boolean(project.operation) ||
                          isActing ||
                          downloadingId === project.id
                        }
                        onClick={() => handleDownload(project)}
                      >
                        {downloadingId === project.id
                          ? 'Downloading…'
                          : 'Download ZIP'}
                      </TextAction>
                      <span
                        className="text-small text-line-strong"
                        aria-hidden="true"
                      >
                        /
                      </span>
                      <TextAction
                        tone="accent"
                        disabled={Boolean(project.operation) || isActing}
                        onClick={() =>
                          setPendingAction({ type: 'restore', project })
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
                        disabled={Boolean(project.operation) || isActing}
                        onClick={() =>
                          setPendingAction({ type: 'delete', project })
                        }
                      >
                        Delete
                      </TextAction>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </tbody>
        </DataTable>
      )}

      <ConfirmDialog
        isOpen={pendingAction?.type === 'restore'}
        tone="default"
        title="Restore project?"
        confirmLabel="Restore"
        isConfirming={isActing}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
        message={
          <p>
            Restore "{pendingAction?.project.name}"? Files are extracted and the
            project becomes active again. Large projects can take a few minutes.
          </p>
        }
      />

      <ConfirmDialog
        isOpen={pendingAction?.type === 'delete'}
        title="Delete project?"
        confirmLabel="Delete"
        isConfirming={isActing}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
        message={
          <p>
            Move "{pendingAction?.project.name}" to the recycle bin? It can be
            restored for 30 days.
          </p>
        }
      />
    </AdminSection>
  );
}
