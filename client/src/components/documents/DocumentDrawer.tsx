import { useEffect, useState } from 'react';
import type { Document } from '../../types';
import type { FilterDefinition } from '../../api/filters';
import { documentsService } from '../../api/documents';
import { downloadDocument } from '../../api/exports';
import { formatDateTime, formatIsoDate } from '../../utils/format';
import { sortFilterDefinitions } from './documentFilters';
import {
  Button,
  Drawer,
  InlineAlert,
  Spinner,
  StatusBadge,
  TextAction,
} from '../ui';

export type DrawerDocumentState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; document: Document };

export interface DocumentDrawerProps {
  state: DrawerDocumentState;
  filterDefinitions: FilterDefinition[];
  onClose: () => void;
  onDelete: (documentId: string) => void;
  onOpenPreview: (document: Document) => void;
}

type TextState =
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'none' }
  | { status: 'error' };

export function DocumentDrawer({
  state,
  filterDefinitions,
  onClose,
  onDelete,
  onOpenPreview,
}: DocumentDrawerProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<{
    documentId: string;
    message: string;
  } | null>(null);
  const [textState, setTextState] = useState<TextState>({ status: 'loading' });

  const readyDocument = state.status === 'ready' ? state.document : null;
  const docId = readyDocument?.id;
  const docStatus = readyDocument?.status;

  useEffect(() => {
    if (!docId) return;

    if (docStatus !== 'PROCESSED') {
      setTextState({ status: 'none' });
      return;
    }

    let isActive = true;
    setTextState({ status: 'loading' });

    documentsService
      .getDocumentText(docId)
      .then((res) => {
        if (!isActive) return;
        if (res.extractedText && res.extractedText.trim().length > 0) {
          setTextState({ status: 'ready', text: res.extractedText });
        } else {
          setTextState({ status: 'none' });
        }
      })
      .catch((err) => {
        if (!isActive) return;
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'Extracted text not found') {
          setTextState({ status: 'none' });
        } else {
          setTextState({ status: 'error' });
        }
      });

    return () => {
      isActive = false;
    };
  }, [docId, docStatus]);

  const handleDownload = async () => {
    if (!readyDocument) return;
    setDownloadError(null);
    setIsDownloading(true);
    try {
      await downloadDocument(readyDocument.id);
    } catch (error) {
      setDownloadError({
        documentId: readyDocument.id,
        message:
          error instanceof Error ? error.message : 'Failed to download document',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <Drawer title="Loading document…" onClose={onClose}>
        <div className="flex h-48 items-center justify-center">
          <Spinner label="Loading document" />
        </div>
      </Drawer>
    );
  }

  if (state.status === 'error') {
    return (
      <Drawer title="Document unavailable" onClose={onClose}>
        <InlineAlert tone="error">{state.message}</InlineAlert>
      </Drawer>
    );
  }

  const document = state.document;
  const sortedDefs = sortFilterDefinitions(filterDefinitions);
  const filterValueMap = new Map<string, string | null>();
  if (document.filterValues) {
    for (const fv of document.filterValues) {
      filterValueMap.set(fv.filterDefinitionId, fv.value);
    }
  }

  const dateUploaded = document.uploadedAt
    ? formatDateTime(document.uploadedAt)
    : document.uploadDate;

  return (
    <Drawer
      title={<span title={document.fileName}>{document.fileName}</span>}
      headerAside={
        <StatusBadge
          status={document.status}
          errorMessage={document.errorMessage}
        />
      }
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            icon="delete"
            className="mr-auto"
            onClick={() => onDelete(document.id)}
          >
            Delete
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
      <div className="space-y-4">
        {downloadError && downloadError.documentId === document.id && (
          <InlineAlert tone="error">{downloadError.message}</InlineAlert>
        )}

        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5 text-body">
          <dt className="text-label uppercase text-ink-muted">Date uploaded</dt>
          <dd className="text-ink tabular-nums">{dateUploaded}</dd>

          <dt className="text-label uppercase text-ink-muted">Size</dt>
          <dd className="text-ink tabular-nums">{document.fileSize}</dd>

          {typeof document.pageCount === 'number' && (
            <>
              <dt className="text-label uppercase text-ink-muted">Pages</dt>
              <dd className="text-ink tabular-nums">{document.pageCount}</dd>
            </>
          )}

          {sortedDefs.map((def) => {
            const rawVal = filterValueMap.get(def.id);
            const displayVal =
              rawVal !== undefined && rawVal !== null && rawVal.trim().length > 0
                ? def.type === 'DATE'
                  ? formatIsoDate(rawVal)
                  : rawVal
                : '—';

            return (
              <div key={def.id} className="contents">
                <dt className="text-label uppercase text-ink-muted">
                  {def.name}
                </dt>
                <dd className="text-ink tabular-nums">{displayVal}</dd>
              </div>
            );
          })}
        </dl>

        <div>
          <h3 className="mt-4 mb-1.5 text-label uppercase text-ink-muted">
            Extracted text
          </h3>
          {document.status === 'PROCESSED' ? (
            textState.status === 'loading' ? (
              <div className="flex items-center gap-2 text-small text-ink-muted">
                <Spinner size="sm" />
                <span>Loading text…</span>
              </div>
            ) : textState.status === 'ready' ? (
              <p className="whitespace-pre-wrap break-words rounded border border-line bg-subtle p-2 text-small text-ink-body">
                {textState.text.length > 600
                  ? `${textState.text.slice(0, 600)}…`
                  : textState.text}
              </p>
            ) : textState.status === 'none' ? (
              <p className="text-small text-ink-muted">
                No text was extracted from this document.
              </p>
            ) : (
              <p className="text-small text-ink-muted">
                Couldn't load the extracted text.
              </p>
            )
          ) : document.status === 'FAILED' ? (
            <p className="text-small text-ink-muted">
              Processing failed, so there's no extracted text.
            </p>
          ) : (
            <p className="text-small text-ink-muted">
              Text appears here once processing finishes.
            </p>
          )}

          <TextAction
            tone="accent"
            className="mt-2"
            onClick={() => onOpenPreview(document)}
          >
            Show full preview
          </TextAction>
        </div>
      </div>
    </Drawer>
  );
}

