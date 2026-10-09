import { useEffect, useId, useState } from 'react';
import type { Document, DocumentFilterValue } from '../../types';
import type { FilterDefinition } from '../../api/filters';
import { downloadDocument, getDocumentBlob } from '../../api/exports';
import { documentsService } from '../../api/documents';
import {
  Button,
  EmptyState,
  InlineAlert,
  Modal,
  Spinner,
  StatusBadge,
} from '../ui';
import { formatIsoDate } from '../../utils/format';
import { beginSave, describeSaveResult } from '../../utils/saveFile';
import { sortFilterDefinitions } from './documentFilters';

export interface DocumentPreviewModalProps {
  document: Document;
  filterDefinitions: FilterDefinition[];
  onClose: () => void;
}

type TextState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'none' }
  | { status: 'error' };

export function DocumentPreviewModal({
  document,
  filterDefinitions,
  onClose,
}: DocumentPreviewModalProps) {
  const textHeadingId = useId();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string>('');
  const [downloadNotice, setDownloadNotice] = useState<{
    tone: 'success' | 'warning';
    message: string;
  } | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);

  const [details, setDetails] = useState<{
    pageCount: number | null;
    filterValues: DocumentFilterValue[];
  }>({
    pageCount: document.pageCount ?? null,
    filterValues: document.filterValues ?? [],
  });

  const [textState, setTextState] = useState<TextState>({ status: 'loading' });

  const isImage = document.mimeType.startsWith('image/');

  // Fetch full details (pages, custom fields)
  useEffect(() => {
    let isMounted = true;

    documentsService
      .getDocument(document.id)
      .then((full) => {
        if (!isMounted) return;
        setDetails({
          pageCount: full.pageCount ?? null,
          filterValues: full.filterValues ?? [],
        });
      })
      .catch(() => {
        // Non-critical — detail values are optional
      });

    return () => {
      isMounted = false;
    };
  }, [document.id]);

  // Fetch blob preview
  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const loadPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);

      try {
        const { blob } = await getDocumentBlob(document.id);
        currentObjectUrl = window.URL.createObjectURL(blob);

        if (!isMounted) {
          window.URL.revokeObjectURL(currentObjectUrl);
          return;
        }

        setPreviewUrl(currentObjectUrl);
      } catch (error) {
        if (!isMounted) return;
        setPreviewError(error instanceof Error ? error.message : 'Failed to load preview');
      } finally {
        if (isMounted) {
          setIsPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        window.URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [document.id]);

  // Fetch extracted text
  useEffect(() => {
    let isMounted = true;

    if (document.status !== 'PROCESSED') {
      setTextState({ status: 'none' });
      return;
    }

    setTextState({ status: 'loading' });

    documentsService
      .getDocumentText(document.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.extractedText && res.extractedText.trim().length > 0) {
          setTextState({ status: 'ready', text: res.extractedText });
        } else {
          setTextState({ status: 'none' });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'Extracted text not found') {
          setTextState({ status: 'none' });
        } else {
          setTextState({ status: 'error' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [document.id, document.status]);

  const handleDownload = async () => {
    const target = beginSave();
    setIsDownloading(true);
    setDownloadError('');
    setDownloadNotice(null);
    try {
      const result = await downloadDocument(document.id, {
        projectName: document.projectName,
        target,
      });
      setDownloadNotice(describeSaveResult(result));
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : 'Failed to download document',
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const sortedDefs = sortFilterDefinitions(filterDefinitions);
  const filterValueMap = new Map<string, string | null>();
  for (const fv of details.filterValues) {
    filterValueMap.set(fv.filterDefinitionId, fv.value);
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={<span title={document.fileName}>{document.fileName}</span>}
      description={document.fileSize}
      headerAside={
        <StatusBadge status={document.status} errorMessage={document.errorMessage} />
      }
      size="xl"
      bodyClassName="p-4"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            icon="download"
            loading={isDownloading}
            onClick={handleDownload}
          >
            Download
          </Button>
        </>
      }
    >
      {downloadError && (
        <InlineAlert
          tone="error"
          onDismiss={() => setDownloadError('')}
          className="mb-3"
        >
          {downloadError}
        </InlineAlert>
      )}
      {downloadNotice && (
        <InlineAlert
          tone={downloadNotice.tone}
          onDismiss={() => setDownloadNotice(null)}
          className="mb-3"
        >
          {downloadNotice.message}
        </InlineAlert>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4">
        {/* Left column: Preview */}
        <div className="h-[60vh] min-h-[320px] overflow-hidden rounded border border-line bg-subtle">
          {isPreviewLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-body text-ink-muted">
              <Spinner label="Loading preview" />
              Loading preview…
            </div>
          ) : previewError ? (
            <EmptyState
              icon="visibility_off"
              title="Couldn't load this preview"
              description="Use Download to open the file."
              className="h-full"
            />
          ) : previewUrl && isImage ? (
            <img
              src={previewUrl}
              alt={`Preview of ${document.fileName}`}
              className="h-full w-full bg-canvas object-contain"
            />
          ) : previewUrl && !isImage ? (
            <iframe
              src={previewUrl}
              title={`Preview of ${document.fileName}`}
              className="h-full w-full"
            />
          ) : null}
        </div>

        {/* Right column: Details and Extracted Text */}
        <div className="flex min-h-0 flex-col gap-4">
          {document.status === 'FAILED' && (
            <InlineAlert tone="error">
              Processing failed: {document.errorMessage ?? 'no reason was recorded.'}
            </InlineAlert>
          )}

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
            <dt className="text-label uppercase text-ink-muted">Project</dt>
            <dd className="min-w-0 break-words text-body text-ink tabular-nums">
              {document.projectName ?? '—'}
            </dd>

            <dt className="text-label uppercase text-ink-muted">Uploaded by</dt>
            <dd className="min-w-0 break-words text-body text-ink tabular-nums">
              {document.uploadedBy ?? '—'}
            </dd>

            <dt className="text-label uppercase text-ink-muted">Date uploaded</dt>
            <dd className="min-w-0 break-words text-body text-ink tabular-nums">
              {document.uploadDate}
            </dd>

            <dt className="text-label uppercase text-ink-muted">Pages</dt>
            <dd className="min-w-0 break-words text-body text-ink tabular-nums">
              {details.pageCount ?? '—'}
            </dd>

            {sortedDefs.map((def) => {
              const rawVal = filterValueMap.get(def.id);
              let displayVal = '—';
              if (rawVal && rawVal.trim().length > 0) {
                displayVal = def.type === 'DATE' ? formatIsoDate(rawVal) : rawVal;
              }

              return (
                <div key={def.id} className="contents">
                  <dt className="text-label uppercase text-ink-muted">{def.name}</dt>
                  <dd className="min-w-0 break-words text-body text-ink tabular-nums">
                    {displayVal}
                  </dd>
                </div>
              );
            })}
          </dl>

          <section aria-labelledby={textHeadingId} className="flex min-h-0 flex-col">
            <h3 id={textHeadingId} className="mb-1 text-label uppercase text-ink-muted">
              Extracted text
            </h3>
            <div
              tabIndex={0}
              aria-labelledby={textHeadingId}
              className="max-h-56 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words rounded border border-line bg-subtle p-2 text-small text-ink-body"
            >
              {textState.status === 'loading' ? (
                <div className="flex items-center gap-2 py-2 text-ink-muted">
                  <Spinner label="Loading extracted text" />
                </div>
              ) : textState.status === 'ready' ? (
                textState.text
              ) : textState.status === 'error' ? (
                <span className="text-status-red-text">
                  Couldn't load the extracted text.
                </span>
              ) : (
                <span className="text-ink-muted">No extracted text.</span>
              )}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
