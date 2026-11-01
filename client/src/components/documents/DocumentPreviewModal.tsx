/*
Large modal that previews a document's file and extracted text, shows its page
count and custom field values, and offers download. The file is fetched as a
blob and shown through a temporary object URL. On phones it is the full-screen
document view, with a link that opens the file in a new tab.
*/


import { Fragment, useEffect, useId, useState } from 'react';
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
import { useIsPhone } from '../../hooks/useMediaQuery';

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
  const isPhone = useIsPhone();
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

  const previewContent = isPreviewLoading ? (
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
  ) : null;

  const failedAlert = document.status === 'FAILED' && (
    <InlineAlert tone="error">
      Processing failed: {document.errorMessage ?? 'no reason was recorded.'}
    </InlineAlert>
  );

  const extractedTextSection = (
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
  );

  const detailItems: { key: string; label: string; value: string | number; custom?: boolean }[] = [
    { key: 'project', label: 'Project', value: document.projectName ?? '—' },
    { key: 'uploaded-by', label: 'Uploaded by', value: document.uploadedBy ?? '—' },
    { key: 'date', label: 'Date uploaded', value: document.uploadDate },
    { key: 'pages', label: 'Pages', value: details.pageCount ?? '—' },
    ...sortedDefs.map((def) => {
      const rawVal = filterValueMap.get(def.id);
      let displayVal = '—';
      if (rawVal && rawVal.trim().length > 0) {
        displayVal = def.type === 'DATE' ? formatIsoDate(rawVal) : rawVal;
      }
      return { key: def.id, label: def.name, value: displayVal, custom: true };
    }),
  ];

  const statusBadge = (
    <StatusBadge status={document.status} errorMessage={document.errorMessage} />
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={<span title={document.fileName}>{document.fileName}</span>}
      description={
        isPhone ? (
          <span className="mt-1 flex items-center gap-2">
            {statusBadge}
            <span>{document.fileSize}</span>
          </span>
        ) : (
          document.fileSize
        )
      }
      headerAside={isPhone ? undefined : statusBadge}
      phoneCloseStyle="back"
      size="xl"
      bodyClassName="p-4"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="max-md:h-12">
            Close
          </Button>
          <Button
            variant={isPhone ? 'dark' : 'primary'}
            icon="download"
            loading={isDownloading}
            onClick={handleDownload}
            className="max-md:h-12 max-md:flex-1"
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

      {isPhone ? (
        <div className="flex flex-col gap-4">
          {failedAlert}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {detailItems.map((item) => (
              <div key={item.key} className="min-w-0">
                <dt className="text-label uppercase text-ink-muted">{item.label}</dt>
                <dd className="mt-0.5 break-words text-[14px] leading-5 text-ink tabular-nums">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Phones open the file in a new tab, where their own viewer handles PDFs better. */}
          <figure className="flex flex-col items-center gap-2 rounded border border-line bg-subtle p-4">
            <div className="h-72 w-full overflow-hidden">{previewContent}</div>
            {previewUrl && (
              <figcaption>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center text-small font-medium text-link underline"
                >
                  Tap to open full screen
                </a>
              </figcaption>
            )}
          </figure>

          {extractedTextSection}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4">
          {/* Left column: Preview */}
          <div className="h-[60vh] min-h-[320px] overflow-hidden rounded border border-line bg-subtle">
            {previewContent}
          </div>

          {/* Right column: Details and Extracted Text */}
          <div className="flex min-h-0 flex-col gap-4">
            {failedAlert}

            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              {detailItems.map((item) => {
                const pair = (
                  <>
                    <dt className="text-label uppercase text-ink-muted">{item.label}</dt>
                    <dd className="min-w-0 break-words text-body text-ink tabular-nums">
                      {item.value}
                    </dd>
                  </>
                );
                return item.custom ? (
                  <div key={item.key} className="contents">
                    {pair}
                  </div>
                ) : (
                  <Fragment key={item.key}>{pair}</Fragment>
                );
              })}
            </dl>

            {extractedTextSection}
          </div>
        </div>
      )}
    </Modal>
  );
}
