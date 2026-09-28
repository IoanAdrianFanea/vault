import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsService } from '../api/documents';
import { projectsService, type Project } from '../api/projects';
import { filtersService, type FilterDefinition } from '../api/filters';

// Tracks file upload state
interface PendingFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export default function Upload() {
  const navigate = useNavigate();
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [filterDefs, setFilterDefs] = useState<FilterDefinition[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowedMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
  ]);

  useEffect(() => {
    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const data = await projectsService.listProjects('uploadable');
        setProjects(data);
        setProjectsError(null);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (error) {
        setProjectsError(
          error instanceof Error ? error.message : 'Failed to load projects',
        );
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    filtersService
      .listFilters()
      .then(setFilterDefs)
      .catch((error) => console.error('Failed to fetch filters:', error));
  }, []);

  // Handle drag over drop zone
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle drag leave drop zone
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Handle file drop
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      allowedMimeTypes.has(file.type),
    );

    if (files.length === 0) {
      alert('Only PDF, JPEG, and PNG files are supported');
      return;
    }

    addFiles(files);
  };

  // Handle file input selection
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        allowedMimeTypes.has(file.type),
      );

      if (files.length === 0) {
        alert('Only PDF, JPEG, and PNG files are supported');
        return;
      }

      addFiles(files);
    }
  };

  // Add files to pending list
  const addFiles = (files: File[]) => {
    const newFiles: PendingFile[] = files.map((file) => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: 'pending',
    }));

    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  // Remove file from pending list
  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Format bytes to human-readable size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Upload all pending files
  const handleUploadAll = async () => {
    const filesToUpload = pendingFiles.filter((f) => f.status === 'pending');

    if (filesToUpload.length === 0) {
      return;
    }

    if (!selectedProjectId) {
      alert('Select a project before uploading');
      return;
    }

    // Upload files sequentially
    for (const pendingFile of filesToUpload) {
      setPendingFiles((prev) =>
        prev.map((f) =>
          f.id === pendingFile.id ? { ...f, status: 'uploading' } : f
        )
      );

      try {
        await documentsService.uploadDocument(pendingFile.file, selectedProjectId, filterValues);

        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id ? { ...f, status: 'success' } : f
          )
        );
      } catch (error) {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === pendingFile.id
              ? {
                  ...f,
                  status: 'error',
                  errorMessage:
                    error instanceof Error ? error.message : 'Upload failed',
                }
              : f
          )
        );
      }
    }

    // Navigate to documents page after uploads complete
    setTimeout(() => {
      navigate('/documents');
    }, 1500);
  };

  // Get status color class
  const getStatusColor = (status: PendingFile['status']) => {
    switch (status) {
      case 'pending':
        return 'text-slate-600 dark:text-slate-400';
      case 'uploading':
        return 'text-blue-600 dark:text-blue-400';
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
    }
  };

  const getStatusIcon = (status: PendingFile['status']) => {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'uploading':
        return 'sync';
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
    }
  };

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full py-8 px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Upload Documents
            </h2>
            <button
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Documents
            </button>
          </div>

          {/* Drop Zone */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={isLoadingProjects || projects.length === 0}
              className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              {isLoadingProjects ? (
                <option value="">Loading projects...</option>
              ) : projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))
              )}
            </select>
            {projectsError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{projectsError}</p>
            )}
          </div>

          {filterDefs.length > 0 && (
            <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Document Details
              </label>
              <p className="text-xs text-slate-500 mb-4">
                These values are applied to every file in this upload batch.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterDefs.map((def) => (
                  <div key={def.id}>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      {def.name}
                    </label>
                    <input
                      type={def.type === 'NUMBER' ? 'number' : def.type === 'DATE' ? 'date' : 'text'}
                      value={filterValues[def.id] ?? ''}
                      onChange={(e) =>
                        setFilterValues((prev) => ({ ...prev, [def.id]: e.target.value }))
                      }
                      className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
                      placeholder={def.type === 'TEXT' ? `Enter ${def.name.toLowerCase()}` : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-16 mb-10 transition-all cursor-pointer ${
              isDragging
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-primary'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl">upload_file</span>
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {isDragging
                ? 'Drop files here'
                : 'Drag & drop PDF or image files here or browse'}
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Support for single or bulk upload. Maximum file size 50MB per file.
            </p>
            <button
              type="button"
              className="bg-white border border-slate-300 dark:border-slate-600 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium py-2.5 px-6 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shadow-sm"
            >
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Pending Files List */}
          {pendingFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Files ({pendingFiles.length})
                </h3>
                {pendingFiles.some((f) => f.status === 'pending') && (
                  <button
                    onClick={handleUploadAll}
                    disabled={pendingFiles.every((f) => f.status !== 'pending') || !selectedProjectId}
                    className="bg-primary hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    Start Upload
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {pendingFiles.map((pendingFile) => (
              <div
                key={pendingFile.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm group hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg dark:bg-red-900/20 dark:text-red-400 shrink-0">
                    <span className="material-symbols-outlined text-xl block">
                      picture_as_pdf
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {pendingFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatFileSize(pendingFile.file.size)}</span>
                      <span>•</span>
                      <span className={getStatusColor(pendingFile.status)}>
                        {pendingFile.status === 'pending' && 'Ready to upload'}
                        {pendingFile.status === 'uploading' && 'Uploading...'}
                        {pendingFile.status === 'success' && 'Upload complete'}
                        {pendingFile.status === 'error' &&
                          (pendingFile.errorMessage || 'Upload failed')}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span
                      className={`material-symbols-outlined text-xl ${getStatusColor(
                        pendingFile.status
                      )} ${pendingFile.status === 'uploading' ? 'animate-spin' : ''}`}
                    >
                      {getStatusIcon(pendingFile.status)}
                    </span>
                  </div>
                </div>
                {pendingFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(pendingFile.id)}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors ml-2 shrink-0"
                  >
                    <span className="material-symbols-outlined text-xl block">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
        </div>
      </div>
    </main>
  );
}
