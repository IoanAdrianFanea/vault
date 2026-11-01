/*
Upload page: choose a project, fill in the custom filter fields, add PDF, JPG or
PNG files by dragging or browsing, and upload them one by one. It rejects wrong
or oversized files up front and can save a local copy of each upload. Phones
get a photo grid with the camera instead of the drop zone and queue table, and
photos taken from the documents list arrive already queued.
*/


import {
  useState,
  useRef,
  useEffect,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsService } from '../api/documents';
import { projectsService, type Project } from '../api/projects';
import { filtersService, type FilterDefinition } from '../api/filters';
import {
  Badge,
  Button,
  DataTable,
  FormField,
  IconButton,
  InlineAlert,
  Input,
  PageHeader,
  Select,
  Spinner,
  TableCell,
  TableHeaderCell,
  TableRow,
  TextAction,
} from '../components/ui';
import { UploadPhotoTile } from '../components/upload/UploadPhotoTile';
import { useIsPhone } from '../hooks/useMediaQuery';
import {
  formatCount,
  formatCountLabel,
  formatFileSize,
} from '../utils/format';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../utils/uploadLimits';
import { beginSave, saveFile } from '../utils/saveFile';
import { clearPendingUploads, peekPendingUploads } from '../utils/pendingUploads';

export interface UploadQueueItem {
  id: string;
  file: File;
  status: 'waiting' | 'uploading' | 'uploaded' | 'failed';
  errorMessage?: string;
}

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

interface FileBatch {
  accepted: File[];
  rejected: string[];
  oversize: string[];
}

function partitionFiles(files: File[]): FileBatch {
  const batch: FileBatch = { accepted: [], rejected: [], oversize: [] };
  for (const file of files) {
    if (!allowedMimeTypes.has(file.type)) {
      batch.rejected.push(file.name);
    } else if (file.size > MAX_UPLOAD_BYTES) {
      batch.oversize.push(file.name);
    } else {
      batch.accepted.push(file);
    }
  }
  return batch;
}

function toQueueItems(files: File[]): UploadQueueItem[] {
  return files.map((file) => ({
    file,
    id: Math.random().toString(36).substring(2, 9),
    status: 'waiting',
  }));
}

export default function Upload() {
  const navigate = useNavigate();
  // Photos taken from the documents list on a phone arrive through this store.
  const [initialBatch] = useState(() => partitionFiles(peekPendingUploads()));
  const [queue, setQueue] = useState<UploadQueueItem[]>(() =>
    toQueueItems(initialBatch.accepted),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [filterDefs, setFilterDefs] = useState<FilterDefinition[]>([]);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [rejectedFileNames, setRejectedFileNames] = useState<string[]>(initialBatch.rejected);
  const [oversizeFileNames, setOversizeFileNames] = useState<string[]>(initialBatch.oversize);
  const [isUploading, setIsUploading] = useState(false);
  const [runResult, setRunResult] = useState<{
    tone: 'success' | 'warning';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const isPhone = useIsPhone();

  useEffect(() => {
    let isActive = true;

    projectsService
      .listProjects('uploadable')
      .then((data) => {
        if (!isActive) return;
        setProjects(data);
        setProjectsError(null);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      })
      .catch((error) => {
        if (!isActive) return;
        setProjectsError(
          error instanceof Error ? error.message : 'Failed to load projects',
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingProjects(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    filtersService
      .listFilters()
      .then((defs) => {
        if (!isActive) return;
        setFilterDefs(defs);
        setFiltersError(null);
      })
      .catch(() => {
        if (!isActive) return;
        setFiltersError(
          "Couldn't load the document fields. You can still upload without them.",
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current !== null) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const addFiles = (files: File[]) => {
    const { accepted, rejected, oversize } = partitionFiles(files);

    setRejectedFileNames(rejected);
    setOversizeFileNames(oversize);
    setRunResult(null);

    if (accepted.length > 0) {
      const newItems = toQueueItems(accepted);
      setQueue((prev) => [...prev, ...newItems]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  useEffect(() => {
    clearPendingUploads();
  }, []);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handlePhotosTaken = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) addFiles(files);
  };

  const removeFile = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearList = () => {
    setQueue([]);
    setRejectedFileNames([]);
    setOversizeFileNames([]);
    setRunResult(null);
  };

  const handleUploadAll = async () => {
    const saveTarget = beginSave();
    const runItems = queue.filter(
      (item) => item.status === 'waiting' || item.status === 'failed',
    );
    if (runItems.length === 0 || !selectedProjectId) {
      return;
    }
    const runIds = runItems.map((item) => item.id);
    const projectName = projects.find((p) => p.id === selectedProjectId)?.name;

    setQueue((prev) =>
      prev.map((item) =>
        runIds.includes(item.id)
          ? { ...item, status: 'waiting', errorMessage: undefined }
          : item,
      ),
    );
    setIsUploading(true);
    setRunResult(null);

    let failedCount = 0;
    let copiesSaved = 0;
    let copiesFailed = 0;
    let savedTo = '';

    for (const item of runItems) {
      setQueue((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'uploading' } : f,
        ),
      );

      try {
        await documentsService.uploadDocument(
          item.file,
          selectedProjectId,
          filterValues,
        );
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'uploaded' } : f,
          ),
        );
        const copy = await saveFile(item.file, item.file.name, {
          projectName,
          target: saveTarget,
          fallbackToDownload: false,
        });
        if (copy.savedTo) {
          copiesSaved++;
          savedTo = copy.savedTo;
        }
        if (copy.warning) {
          copiesFailed++;
        }
      } catch (err) {
        failedCount++;
        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed';
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'failed', errorMessage }
              : f,
          ),
        );
      }
    }

    if (failedCount === 0) {
      let tone: 'success' | 'warning' = 'success';
      let message = `${formatCountLabel(runIds.length, 'file', 'files')} uploaded`;
      if (copiesFailed > 0) {
        tone = 'warning';
        message += `, but ${formatCountLabel(copiesFailed, 'copy', 'copies')} couldn't be saved to your folder.`;
      } else if (copiesSaved > 0) {
        message += `. Copies saved to ${savedTo}.`;
      }
      setRunResult({ tone, message });
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/documents', { state: { notice: { tone, message } } });
      }, 1500);
    } else {
      let message = `${failedCount} of ${runIds.length} files couldn't be uploaded. Upload them again or remove them.`;
      if (copiesFailed > 0) {
        message += ` ${formatCountLabel(copiesFailed, 'copy', 'copies')} couldn't be saved to your folder.`;
      }
      setRunResult({ tone: 'warning', message });
    }

    setIsUploading(false);
  };

  const retryableCount = queue.filter(
    (item) => item.status === 'waiting' || item.status === 'failed',
  ).length;

  const projectError =
    retryableCount > 0 && !selectedProjectId && !isLoadingProjects
      ? 'Choose a project before uploading.'
      : undefined;

  const uploadButtonLabel =
    retryableCount === 1
      ? 'Upload 1 file'
      : retryableCount > 1
      ? `Upload ${formatCount(retryableCount)} files`
      : 'Upload files';

  const alerts = (
    <>
      {projectsError && (
        <InlineAlert tone="error">{projectsError}</InlineAlert>
      )}
      {filtersError && (
        <InlineAlert tone="warning">{filtersError}</InlineAlert>
      )}
      {rejectedFileNames.length > 0 && (
        <InlineAlert
          tone="warning"
          onDismiss={() => setRejectedFileNames([])}
        >
          These files weren't added because they aren't PDF, JPG or PNG:{' '}
          {rejectedFileNames.join(', ')}
        </InlineAlert>
      )}
      {oversizeFileNames.length > 0 && (
        <InlineAlert
          tone="warning"
          onDismiss={() => setOversizeFileNames([])}
        >
          These files are larger than {MAX_UPLOAD_MB} MB and weren't added:{' '}
          {oversizeFileNames.join(', ')}
        </InlineAlert>
      )}
      {runResult && (
        <InlineAlert tone={runResult.tone}>{runResult.message}</InlineAlert>
      )}
    </>
  );

  const detailsPanel = (
    <div className="rounded border border-line bg-canvas">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-panel text-ink">Upload details</h2>
      </header>
      <div className="space-y-4 p-4">
        <FormField
          label="Project"
          htmlFor="upload-project"
          error={projectError}
        >
          <Select
            id="upload-project"
            invalid={Boolean(projectError)}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={isLoadingProjects || projects.length === 0}
          >
            {isLoadingProjects ? (
              <option value="" disabled>
                Loading projects…
              </option>
            ) : projects.length === 0 ? (
              <option value="" disabled>
                No projects available — ask an admin to add you to a
                project
              </option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </Select>
        </FormField>

        {filterDefs.length > 0 && (
          <div>
            <h3 className="text-label uppercase text-ink-muted">
              Document details
            </h3>
            <p className="text-small text-ink-muted">
              Applied to every file in this batch.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 max-md:grid-cols-1">
              {filterDefs.map((def) => (
                <FormField
                  key={def.id}
                  label={def.name}
                  htmlFor={`filter-${def.id}`}
                >
                  {def.type === 'NUMBER' ? (
                    <Input
                      id={`filter-${def.id}`}
                      type="number"
                      value={filterValues[def.id] ?? ''}
                      onChange={(e) =>
                        setFilterValues((prev) => ({
                          ...prev,
                          [def.id]: e.target.value,
                        }))
                      }
                    />
                  ) : def.type === 'DATE' ? (
                    <Input
                      id={`filter-${def.id}`}
                      type="date"
                      value={filterValues[def.id] ?? ''}
                      onChange={(e) =>
                        setFilterValues((prev) => ({
                          ...prev,
                          [def.id]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <Input
                      id={`filter-${def.id}`}
                      type="text"
                      placeholder={`Enter ${def.name.toLowerCase()}`}
                      value={filterValues[def.id] ?? ''}
                      onChange={(e) =>
                        setFilterValues((prev) => ({
                          ...prev,
                          [def.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </FormField>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Phones replace the drop zone and queue table with a photo grid and a
  // bottom bar. The upload logic is shared.
  if (isPhone) {
    const queuedBytes = queue.reduce((acc, item) => acc + item.file.size, 0);
    const allImages = queue.every((item) => item.file.type.startsWith('image/'));
    const queueSummary =
      queue.length === 0
        ? `PDF, JPG or PNG, up to ${MAX_UPLOAD_MB} MB each`
        : `${formatCountLabel(
            queue.length,
            allImages ? 'photo' : 'file',
            allImages ? 'photos' : 'files',
          )} · ${formatFileSize(queuedBytes)} · up to ${MAX_UPLOAD_MB} MB each`;

    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-28">
          <PageHeader
            back={{ label: 'Back to documents', to: '/documents' }}
            title="Upload documents"
            description="Photograph delivery notes, invoices and site photos."
          />

          {alerts}

          <ul aria-label="Files to upload" className="grid grid-cols-3 gap-2">
            {queue.map((item) => (
              <UploadPhotoTile
                key={item.id}
                file={item.file}
                status={item.status}
                errorMessage={item.errorMessage}
                showStatus={isUploading || item.status !== 'waiting'}
                canRemove={
                  (item.status === 'waiting' || item.status === 'failed') && !isUploading
                }
                onRemove={() => removeFile(item.id)}
              />
            ))}
            <li>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-accent bg-selected text-body font-medium text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[28px] leading-none" aria-hidden="true">
                  photo_camera
                </span>
                {queue.length === 0 ? 'Take photo' : 'Take another'}
              </button>
            </li>
          </ul>

          <div className="flex items-center justify-between gap-3">
            <span className="text-small text-ink-muted tabular-nums">{queueSummary}</span>
            <TextAction
              tone="accent"
              variant="inline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="shrink-0 underline"
            >
              Choose files
            </TextAction>
          </div>

          {detailsPanel}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-bulkbar flex gap-2 border-t border-line bg-canvas px-4 pb-5 pt-3">
          <Button
            variant="secondary"
            onClick={clearList}
            disabled={queue.length === 0 || isUploading}
            className="max-md:h-12"
          >
            Clear list
          </Button>
          <Button
            variant="dark"
            icon="upload"
            loading={isUploading}
            disabled={!selectedProjectId || retryableCount === 0 || isUploading}
            onClick={handleUploadAll}
            className="flex-1 max-md:h-12"
          >
            {uploadButtonLabel}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handlePhotosTaken}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
        <PageHeader
          back={{ label: 'Back to documents', to: '/documents' }}
          title="Upload documents"
          description="Add delivery notes, invoices and site photos to a project."
        />

        {alerts}

        <div className="grid grid-cols-2 gap-4 md:max-lg:grid-cols-1">
          {detailsPanel}

          <div
            role="button"
            tabIndex={0}
            aria-label="Add files: drag files here or browse"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-6 text-center transition-colors ${
              isDragging
                ? 'border-accent bg-selected'
                : 'border-line-strong bg-canvas hover:bg-subtle'
            }`}
          >
            <span
              className="material-symbols-outlined text-[32px] text-ink-muted"
              aria-hidden="true"
            >
              upload_file
            </span>
            <p className="text-body text-ink">
              Drag files here or{' '}
              <span className="font-medium text-link underline">browse</span>
            </p>
            <p className="text-small text-ink-muted">PDF, JPG or PNG, up to {MAX_UPLOAD_MB} MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {queue.length > 0 && (
          <DataTable label="Upload queue" fixed>
            <thead>
              <TableRow>
                <TableHeaderCell>File name</TableHeaderCell>
                <TableHeaderCell align="end" className="w-[100px]">
                  Size
                </TableHeaderCell>
                <TableHeaderCell className="w-[140px]">Status</TableHeaderCell>
                <TableHeaderCell className="w-10">
                  <span className="sr-only">Remove</span>
                </TableHeaderCell>
              </TableRow>
            </thead>
            <tbody>
              {queue.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span
                      className="block truncate font-medium text-ink"
                      title={item.file.name}
                    >
                      {item.file.name}
                    </span>
                  </TableCell>
                  <TableCell align="end">
                    <span className="text-small text-ink-muted tabular-nums">
                      {formatFileSize(item.file.size)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.status === 'waiting' ? (
                      <Badge tone="slate">Waiting</Badge>
                    ) : item.status === 'uploading' ? (
                      <Badge tone="amber">
                        <Spinner size="sm" />
                        <span>Uploading</span>
                      </Badge>
                    ) : item.status === 'uploaded' ? (
                      <Badge tone="teal" dot>
                        Uploaded
                      </Badge>
                    ) : (
                      <Badge tone="red" dot title={item.errorMessage}>
                        Failed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell align="end">
                    {(item.status === 'waiting' || item.status === 'failed') &&
                      !isUploading && (
                        <IconButton
                          icon="close"
                          size="sm"
                          label={`Remove ${item.file.name}`}
                          onClick={() => removeFile(item.id)}
                        />
                      )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </DataTable>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={clearList}
            disabled={queue.length === 0 || isUploading}
          >
            Clear list
          </Button>
          <Button
            variant="primary"
            icon="upload"
            loading={isUploading}
            disabled={!selectedProjectId || retryableCount === 0 || isUploading}
            onClick={handleUploadAll}
          >
            {uploadButtonLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}

