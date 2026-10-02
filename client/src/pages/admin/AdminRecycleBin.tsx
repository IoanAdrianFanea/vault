import { useCallback, useEffect, useState } from 'react';
import { AdminTabs } from '../../components/admin/AdminTabs';
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

type PendingAction =
  | { type: 'restore-document'; document: DeletedDocument; requiresProjectChoice: boolean }
  | { type: 'purge-document'; document: DeletedDocument }
  | { type: 'restore-project'; project: DeletedProject }
  | { type: 'purge-project'; project: DeletedProject }
  | null;

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mimeType: string): string {
  return mimeType === 'application/pdf' ? 'picture_as_pdf' : 'image';
}

function expiryBadge(daysRemaining: number) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-label-sm font-semibold ${
        daysRemaining <= 5
          ? 'bg-error-container/50 text-error'
          : 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {daysRemaining === 0 ? 'Today' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`}
    </span>
  );
}

interface ConfirmModalProps {
  action: PendingAction;
  isLoading: boolean;
  activeProjects: AdminProject[];
  selectedProjectId: string;
  onSelectedProjectIdChange: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmModal({
  action,
  isLoading,
  activeProjects,
  selectedProjectId,
  onSelectedProjectIdChange,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!action) return null;

  const isPurge = action.type === 'purge-document' || action.type === 'purge-project';
  const isRestoreDocumentWithChoice =
    action.type === 'restore-document' && action.requiresProjectChoice;

  const title = isPurge
    ? action.type === 'purge-project'
      ? 'Delete Project Permanently'
      : 'Delete Permanently'
    : action.type === 'restore-project'
      ? 'Restore Project'
      : 'Restore Document';

  const message = (() => {
    switch (action.type) {
      case 'purge-document':
        return `"${action.document.originalFilename}" and its file will be removed for good. The deletion log entry is kept for auditing. This cannot be undone.`;
      case 'purge-project':
        return `"${action.project.name}" and every remaining document in it will be removed for good. Deletion log entries are kept for auditing. This cannot be undone.`;
      case 'restore-project':
        return action.project.isArchived
          ? `"${action.project.name}" will be returned to the archive. Its documents stay hidden until the project is unarchived.`
          : `"${action.project.name}" and the documents that were active when it was deleted will be restored and become visible again.`;
      case 'restore-document':
        return action.requiresProjectChoice
          ? `Choose which project "${action.document.originalFilename}" should be restored into.`
          : `"${action.document.originalFilename}" will be returned to ${action.document.projectName} and become visible again.`;
      default:
        return '';
    }
  })();

  const confirmLabel = isPurge ? 'Delete Permanently' : action.type === 'restore-project' ? 'Restore Project' : 'Restore';
  const btnClass = isPurge
    ? 'bg-error text-on-error hover:bg-error/90'
    : 'bg-primary text-on-primary hover:bg-primary/90';
  const confirmDisabled = isLoading || (isRestoreDocumentWithChoice && !selectedProjectId);

  return (
    <div
      className="fixed inset-0 bg-scrim/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-full max-w-sm mx-4">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
          <p className="text-body-sm text-on-surface-variant mt-2">{message}</p>

          {isRestoreDocumentWithChoice && (
            <select
              value={selectedProjectId}
              onChange={(e) => onSelectedProjectIdChange(e.target.value)}
              className="mt-4 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface"
            >
              <option value="">Select a project…</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${btnClass}`}
          >
            {isLoading && (
              <span className="material-symbols-outlined text-[16px] animate-spin">
                progress_activity
              </span>
            )}
            {isLoading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AdminRecycleBin() {
  const [documents, setDocuments] = useState<DeletedDocument[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<DeletedProject[]>([]);
  const [activeProjects, setActiveProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedProject, setSelectedProject] = useState<DeletedProject | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<DeletedDocument[]>([]);
  const [isLoadingProjectDocuments, setIsLoadingProjectDocuments] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [docs, projects, projectOptions] = await Promise.all([
        getDeletedDocuments(),
        getDeletedProjects(),
        getProjects(),
      ]);
      setDocuments(docs);
      setDeletedProjects(projects);
      setActiveProjects(projectOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the recycle bin');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProjectDocuments = useCallback(async (projectId: string) => {
    setIsLoadingProjectDocuments(true);
    setError('');
    try {
      setProjectDocuments(await getDeletedProjectDocuments(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the project documents');
    } finally {
      setIsLoadingProjectDocuments(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openProject = (project: DeletedProject) => {
    setSelectedProject(project);
    void loadProjectDocuments(project.id);
  };

  const closeProject = () => {
    setSelectedProject(null);
    setProjectDocuments([]);
  };

  const handleRefresh = () => {
    void load();
    if (selectedProject) {
      void loadProjectDocuments(selectedProject.id);
    }
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;

    setIsActing(true);
    setError('');
    try {
      let leftSelectedProject = false;

      switch (pendingAction.type) {
        case 'restore-document':
          await restoreDocument(
            pendingAction.document.id,
            pendingAction.requiresProjectChoice ? selectedProjectId : undefined,
          );
          break;
        case 'purge-document':
          await permanentlyDeleteDocument(pendingAction.document.id);
          break;
        case 'restore-project':
          await restoreProject(pendingAction.project.id);
          leftSelectedProject = selectedProject?.id === pendingAction.project.id;
          break;
        case 'purge-project':
          await permanentlyDeleteProject(pendingAction.project.id);
          leftSelectedProject = selectedProject?.id === pendingAction.project.id;
          break;
      }

      setPendingAction(null);
      setSelectedProjectId('');

      if (leftSelectedProject) {
        setSelectedProject(null);
        setProjectDocuments([]);
      }

      await load();
      if (selectedProject && !leftSelectedProject) {
        await loadProjectDocuments(selectedProject.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsActing(false);
    }
  };

  const retentionDays =
    documents[0]?.retentionDays ?? deletedProjects[0]?.retentionDays ?? 30;

  const renderDocumentsTable = (
    docs: DeletedDocument[],
    options: { loading: boolean; emptyMessage: string; showProjectColumn: boolean; requiresProjectChoiceOnRestore: boolean },
  ) => (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 text-label-md font-label uppercase tracking-wider text-outline">
            <th className="px-6 py-4 font-medium w-1/3">Document</th>
            {options.showProjectColumn && (
              <th className="px-6 py-4 font-medium w-1/6">Project</th>
            )}
            <th className="px-6 py-4 font-medium w-1/6">Deleted By</th>
            <th className="px-6 py-4 font-medium w-1/6">Deleted On</th>
            <th className="px-6 py-4 font-medium w-1/12">Expires</th>
            <th className="px-6 py-4 font-medium w-1/6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/5">
          {options.loading ? (
            <tr>
              <td
                colSpan={options.showProjectColumn ? 6 : 5}
                className="px-6 py-5 text-center text-on-surface-variant"
              >
                Loading...
              </td>
            </tr>
          ) : docs.length === 0 ? (
            <tr>
              <td
                colSpan={options.showProjectColumn ? 6 : 5}
                className="px-6 py-5 text-center text-on-surface-variant"
              >
                {options.emptyMessage}
              </td>
            </tr>
          ) : (
            docs.map((doc) => (
              <tr
                key={doc.id}
                className="hover:bg-surface-container-low/30 transition-colors group"
              >
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-error-container text-error flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">
                        {fileIcon(doc.mimeType)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-on-surface block truncate">
                        {doc.originalFilename}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {formatSize(doc.sizeBytes)}
                      </span>
                    </div>
                  </div>
                </td>
                {options.showProjectColumn && (
                  <td className="px-6 py-5 text-on-surface-variant">{doc.projectName}</td>
                )}
                <td className="px-6 py-5 text-on-surface-variant">
                  {doc.deletedByName || doc.deletedByEmail || 'Unknown'}
                </td>
                <td className="px-6 py-5 text-on-surface-variant">{formatDate(doc.deletedAt)}</td>
                <td className="px-6 py-5">{expiryBadge(doc.daysRemaining)}</td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {doc.restorable ? (
                      <button
                        onClick={() =>
                          setPendingAction({
                            type: 'restore-document',
                            document: doc,
                            requiresProjectChoice:
                              options.requiresProjectChoiceOnRestore ||
                              doc.requiresProjectChoice,
                          })
                        }
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors"
                        title="Restore"
                      >
                        <span className="material-symbols-outlined text-[18px]">restore</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-1.5 text-on-surface-variant/40 cursor-not-allowed rounded"
                        title="Stored in the project archive – restore the whole project"
                      >
                        <span className="material-symbols-outlined text-[18px]">restore</span>
                      </button>
                    )}
                    <button
                      onClick={() => setPendingAction({ type: 'purge-document', document: doc })}
                      className="p-1.5 text-outline hover:text-error hover:bg-error-container/20 rounded transition-colors"
                      title="Delete Permanently"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete_forever
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
      <ConfirmModal
        action={pendingAction}
        isLoading={isActing}
        activeProjects={activeProjects}
        selectedProjectId={selectedProjectId}
        onSelectedProjectIdChange={setSelectedProjectId}
        onConfirm={handleConfirm}
        onClose={() => {
          setPendingAction(null);
          setSelectedProjectId('');
        }}
      />

      <div className="bg-surface pt-6 px-10 shrink-0 sticky top-0 z-10">
        <AdminTabs />
      </div>

      <div className="flex-1 overflow-y-auto p-10 max-w-7xl mx-auto w-full">
        {selectedProject ? (
          <>
            <button
              onClick={closeProject}
              className="mb-4 flex items-center gap-1 text-label-md font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Recycle Bin
            </button>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h1 className="text-headline-sm font-headline font-bold text-on-surface">
                  {selectedProject.name}
                </h1>
                {selectedProject.isArchived && (
                  <span className="px-2.5 py-0.5 rounded text-label-sm font-semibold bg-tertiary-container text-tertiary-dim border border-tertiary-dim/20">
                    Archived
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPendingAction({ type: 'restore-project', project: selectedProject })}
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg flex items-center gap-2 text-label-md font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-sm">restore</span>
                  Restore Project
                </button>
                <button
                  onClick={() => setPendingAction({ type: 'purge-project', project: selectedProject })}
                  className="bg-error text-on-error px-4 py-2 rounded-lg flex items-center gap-2 text-label-md font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-sm">delete_forever</span>
                  Delete Permanently
                </button>
              </div>
            </div>
            <p className="text-body-sm text-on-surface-variant mb-8">
              Deleted by {selectedProject.deletedByName || selectedProject.deletedByEmail || 'Unknown'} on{' '}
              {formatDate(selectedProject.deletedAt)}.{' '}
              {selectedProject.isArchived
                ? 'This project was archived when deleted. Swept documents can only be restored with the whole project.'
                : 'Restoring an individual document below lets you choose which project to send it to.'}
            </p>

            {error && (
              <p className="mb-4 text-label-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </p>
            )}

            {renderDocumentsTable(projectDocuments, {
              loading: isLoadingProjectDocuments,
              emptyMessage: 'This project has no deleted documents',
              showProjectColumn: false,
              requiresProjectChoiceOnRestore: true,
            })}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-headline-sm font-headline font-bold text-on-surface">
                Recycle Bin
              </h1>
              <button
                onClick={handleRefresh}
                className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg flex items-center gap-2 text-label-md font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Refresh
              </button>
            </div>
            <p className="text-body-sm text-on-surface-variant mb-8">
              Deleted projects and documents are kept for {retentionDays} days and are then
              permanently removed. Deletions stay in the audit log either way.
            </p>

            {error && (
              <p className="mb-4 text-label-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {error}
              </p>
            )}

            <h2 className="text-title-md font-semibold text-on-surface mb-3">Deleted Projects</h2>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden shadow-sm mb-10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/10 bg-surface-container-low/50 text-label-md font-label uppercase tracking-wider text-outline">
                    <th className="px-6 py-4 font-medium w-1/3">Project</th>
                    <th className="px-6 py-4 font-medium w-1/6">Documents</th>
                    <th className="px-6 py-4 font-medium w-1/6">Deleted By</th>
                    <th className="px-6 py-4 font-medium w-1/6">Deleted On</th>
                    <th className="px-6 py-4 font-medium w-1/12">Expires</th>
                    <th className="px-6 py-4 font-medium w-1/6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-5 text-center text-on-surface-variant">
                        Loading...
                      </td>
                    </tr>
                  ) : deletedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-5 text-center text-on-surface-variant">
                        No deleted projects
                      </td>
                    </tr>
                  ) : (
                    deletedProjects.map((project) => (
                      <tr
                        key={project.id}
                        className="hover:bg-surface-container-low/30 transition-colors group cursor-pointer"
                        onClick={() => openProject(project)}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-error-container text-error flex items-center justify-center">
                              <span className="material-symbols-outlined text-sm">folder</span>
                            </div>
                            <span className="font-semibold text-on-surface block truncate">
                              {project.name}
                            </span>
                            {project.isArchived && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-tertiary-container text-tertiary-dim border border-tertiary-dim/20 shrink-0">
                                Archived
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-on-surface-variant">
                          {project.documentCount}
                        </td>
                        <td className="px-6 py-5 text-on-surface-variant">
                          {project.deletedByName || project.deletedByEmail || 'Unknown'}
                        </td>
                        <td className="px-6 py-5 text-on-surface-variant">
                          {formatDate(project.deletedAt)}
                        </td>
                        <td className="px-6 py-5">{expiryBadge(project.daysRemaining)}</td>
                        <td className="px-6 py-5 text-right">
                          <div
                            className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => openProject(project)}
                              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors"
                              title="View Documents"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                folder_open
                              </span>
                            </button>
                            <button
                              onClick={() => setPendingAction({ type: 'restore-project', project })}
                              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors"
                              title="Restore Project"
                            >
                              <span className="material-symbols-outlined text-[18px]">restore</span>
                            </button>
                            <button
                              onClick={() => setPendingAction({ type: 'purge-project', project })}
                              className="p-1.5 text-outline hover:text-error hover:bg-error-container/20 rounded transition-colors"
                              title="Delete Permanently"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete_forever
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="text-title-md font-semibold text-on-surface mb-3">Deleted Documents</h2>
            {renderDocumentsTable(documents, {
              loading: isLoading,
              emptyMessage: 'The recycle bin is empty',
              showProjectColumn: true,
              requiresProjectChoiceOnRestore: false,
            })}
          </>
        )}
      </div>
    </main>
  );
}
