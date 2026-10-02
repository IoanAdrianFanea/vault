import { useEffect, useState } from 'react';
import { AdminTabs } from '../../components/admin/AdminTabs';
import {
  deleteArchivedProject,
  downloadProjectArchive,
  getArchivedProjects,
  unarchiveProject,
  type ArchivedProject,
} from '../../api/archive';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface ConfirmModalProps {
  action: { type: 'restore' | 'delete'; project: ArchivedProject } | null;
  isLoading: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function ConfirmModal({
  action,
  isLoading,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!action) return null;

  const isRestore = action.type === 'restore';
  const title = isRestore ? 'Restore Project' : 'Delete Archived Project';
  const message = isRestore
    ? `"${action.project.name}" will be extracted and become visible again to its members.`
    : `"${action.project.name}" will be moved to the recycle bin. It can be restored to the archive within 30 days, after which it is permanently deleted.`;

  return (
    <div
      className="fixed inset-0 bg-scrim/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isRestore
                  ? 'bg-primary-container text-primary'
                  : 'bg-error-container text-error'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isRestore ? 'unarchive' : 'delete'}
              </span>
            </div>
            <h2 className="text-title-md font-semibold text-on-surface">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="px-6 pb-6">
          <div
            className={`border rounded-lg p-4 mb-4 flex items-start gap-3 ${
              isRestore
                ? 'bg-primary-container/20 border-primary/20'
                : 'bg-error-container/20 border-error/20'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${
                isRestore ? 'text-primary' : 'text-error'
              }`}
            >
              {isRestore ? 'info' : 'warning'}
            </span>
            <p className="text-body-sm text-on-surface-variant">{message}</p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-label-md font-semibold transition-opacity disabled:opacity-50 flex items-center gap-2 ${
                isRestore
                  ? 'bg-primary text-on-primary hover:opacity-90'
                  : 'bg-error text-on-error hover:opacity-90'
              }`}
            >
              {isLoading && (
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
              )}
              {isRestore ? 'Restore Project' : 'Move to Recycle Bin'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminArchive() {
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<{
    type: 'restore' | 'delete';
    project: ArchivedProject;
  } | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    getArchivedProjects()
      .then(setProjects)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load archive'),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const handleDownload = async (project: ArchivedProject) => {
    setDownloadingId(project.id);
    setError('');
    try {
      await downloadProjectArchive(project.id, project.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to download project archive',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsActing(true);
    setError('');
    setNotice(null);

    const { type, project } = pendingAction;
    try {
      if (type === 'restore') {
        const res = await unarchiveProject(project.id);
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
        if (res.missingDocuments && res.missingDocuments.length > 0) {
          const names = res.missingDocuments
            .map((d) => d.originalFilename)
            .join(', ');
          setNotice(
            `Project "${project.name}" was restored, but some files were missing from storage: ${names}`,
          );
        }
      } else {
        await deleteArchivedProject(project.id);
        setProjects((prev) => prev.filter((p) => p.id !== project.id));
      }
      setPendingAction(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Action failed. Please try again.',
      );
    } finally {
      setIsActing(false);
    }
  };

  const visibleProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden">
      <ConfirmModal
        action={pendingAction}
        isLoading={isActing}
        onConfirm={handleConfirmAction}
        onClose={() => setPendingAction(null)}
      />

      <div className="bg-surface pt-6 px-10 shrink-0 sticky top-0 z-10">
        <AdminTabs />
      </div>

      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-6xl mx-auto mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-headline font-bold text-on-surface mb-2 tracking-tight">
              Archive
            </h1>
            <p className="text-body-md font-body text-on-surface-variant">
              Manage and restore previously archived project data.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-outline text-sm">
                  search
                </span>
              </div>
              <input
                className="block w-64 pl-9 pr-3 py-1.5 bg-surface-container-low border-b border-transparent focus:border-primary focus:bg-surface-container-lowest focus:ring-0 text-body-md font-body text-on-surface transition-all duration-200 outline-none rounded-t-lg placeholder-outline"
                placeholder="Search archive..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="mb-4 bg-error-container/30 border border-error/20 rounded-lg p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-[20px] mt-0.5 shrink-0">
                error
              </span>
              <p className="text-body-sm text-error font-medium">{error}</p>
            </div>
          )}

          {notice && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500 text-[20px] mt-0.5 shrink-0">
                warning
              </span>
              <p className="text-body-sm text-on-surface-variant">{notice}</p>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/10">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-container-low border-b border-surface-container-highest">
              <div className="col-span-4 text-label-md font-label uppercase tracking-wider text-outline font-semibold">
                Project Name
              </div>
              <div className="col-span-3 text-label-md font-label uppercase tracking-wider text-outline font-semibold">
                Archived Date
              </div>
              <div className="col-span-2 text-label-md font-label uppercase tracking-wider text-outline font-semibold">
                File Size
              </div>
              <div className="col-span-1 text-label-md font-label uppercase tracking-wider text-outline font-semibold">
                Docs
              </div>
              <div className="col-span-2 text-label-md font-label uppercase tracking-wider text-outline font-semibold text-right">
                Actions
              </div>
            </div>

            <div className="divide-y divide-surface-container-highest">
              {isLoading ? (
                <div className="px-6 py-8 text-center text-on-surface-variant">
                  Loading archive...
                </div>
              ) : visibleProjects.length === 0 ? (
                <div className="px-6 py-8 text-center text-on-surface-variant">
                  {projects.length === 0
                    ? 'No archived projects'
                    : 'No archived projects match your search'}
                </div>
              ) : (
                visibleProjects.map((project) => (
                  <div
                    key={project.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-surface-container-low transition-colors group"
                  >
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-outline shrink-0">
                        <span className="material-symbols-outlined text-sm">
                          folder_zip
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-body-md font-body font-medium text-on-surface truncate">
                            {project.name}
                          </p>
                          {project.operation && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                              In progress
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-body text-outline mt-0.5 truncate">
                          ID: {project.id}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-3 min-w-0">
                      <p className="text-body-md font-body text-on-surface-variant">
                        {formatDate(project.archivedAt)}
                      </p>
                      <p className="text-xs font-body text-outline mt-0.5 truncate">
                        by{' '}
                        {project.archivedByName ||
                          project.archivedByEmail ||
                          'Unknown'}
                      </p>
                    </div>

                    <div className="col-span-2 text-body-md font-body text-on-surface-variant">
                      {formatSize(project.archiveSizeBytes)}
                    </div>

                    <div className="col-span-1 text-body-md font-body text-on-surface-variant">
                      {project.documentCount}
                    </div>

                    <div className="col-span-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(project)}
                        disabled={
                          !!project.operation || downloadingId === project.id
                        }
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors disabled:opacity-40"
                        title="Download Zip"
                      >
                        {downloadingId === project.id ? (
                          <span className="material-symbols-outlined text-sm animate-spin">
                            progress_activity
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">
                            download
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setPendingAction({ type: 'restore', project })
                        }
                        disabled={!!project.operation}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-container/50 rounded transition-colors disabled:opacity-40"
                        title="Restore"
                      >
                        <span className="material-symbols-outlined text-sm">
                          unarchive
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          setPendingAction({ type: 'delete', project })
                        }
                        disabled={!!project.operation}
                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors disabled:opacity-40"
                        title="Move to recycle bin"
                      >
                        <span className="material-symbols-outlined text-sm">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-4 bg-surface-container-lowest border-t border-surface-container-highest flex justify-between items-center">
              <p className="text-xs font-body text-outline">
                Showing {visibleProjects.length} of {projects.length} archived
                projects
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
