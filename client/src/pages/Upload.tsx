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
} from '../components/ui';
import {
  formatCount,
  formatCountLabel,
  formatFileSize,
} from '../utils/format';

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

export default function Upload() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [filterDefs, setFilterDefs] = useState<FilterDefinition[]>([]);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [rejectedFileNames, setRejectedFileNames] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [runResult, setRunResult] = useState<{
    tone: 'success' | 'warning';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const redirectTimerRef = useRef<number | null>(null);

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
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (allowedMimeTypes.has(file.type)) {
        accepted.push(file);
      } else {
        rejected.push(file.name);
      }
    }

    setRejectedFileNames(rejected);
    setRunResult(null);

    if (accepted.length > 0) {
      const newItems: UploadQueueItem[] = accepted.map((file) => ({
        file,
        id: Math.random().toString(36).substring(2, 9),
        status: 'waiting',
      }));
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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearList = () => {
    setQueue([]);
    setRejectedFileNames([]);
    setRunResult(null);
  };

  const handleUploadAll = async () => {
    const runItems = queue.filter(
      (item) => item.status === 'waiting' || item.status === 'failed',
    );
    if (runItems.length === 0 || !selectedProjectId) {
      return;
    }
    const runIds = runItems.map((item) => item.id);

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
      setRunResult({
        tone: 'success',
        message: `${formatCountLabel(runIds.length, 'file', 'files')} uploaded`,
      });
      redirectTimerRef.current = window.setTimeout(() => {
        navigate('/documents');
      }, 1500);
    } else {
      setRunResult({
        tone: 'warning',
        message: `${failedCount} of ${runIds.length} files couldn't be uploaded. Upload them again or remove them.`,
      });
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

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-3 pb-4 overflow-y-auto custom-scrollbar">
        <PageHeader
          back={{ label: 'Back to documents', to: '/documents' }}
          title="Upload documents"
          description="Add delivery notes, invoices and site photos to a project."
        />

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
        {runResult && (
          <InlineAlert tone={runResult.tone}>{runResult.message}</InlineAlert>
        )}

        <div className="grid grid-cols-2 gap-4">
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
                  <div className="mt-2 grid grid-cols-2 gap-3">
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
            <p className="text-small text-ink-muted">PDF, JPG or PNG</p>
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
            {retryableCount === 1
              ? 'Upload 1 file'
              : retryableCount > 1
              ? `Upload ${formatCount(retryableCount)} files`
              : 'Upload files'}
          </Button>
        </div>
      </div>
    </main>
  );
}

