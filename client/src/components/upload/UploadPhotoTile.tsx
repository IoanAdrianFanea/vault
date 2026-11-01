/*
Square tile for one queued file on the phone upload page: an image thumbnail or
a file icon, a remove button with a 44px hit area, and the upload status while a
batch is running. The thumbnail's object URL is revoked on removal and unmount.
*/


import { useLayoutEffect, useRef } from 'react';
import { Badge, IconButton, Spinner } from '../ui';

export type UploadTileStatus = 'waiting' | 'uploading' | 'uploaded' | 'failed';

export interface UploadPhotoTileProps {
  file: File;
  status: UploadTileStatus;
  errorMessage?: string;
  showStatus: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

export function UploadPhotoTile({
  file,
  status,
  errorMessage,
  showStatus,
  canRemove,
  onRemove,
}: UploadPhotoTileProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const isImage = file.type.startsWith('image/');

  // Set through the ref so the URL is created and revoked in the same effect.
  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!isImage || !image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, isImage]);

  return (
    <li className="relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded border border-line bg-subtle text-ink-muted">
      {isImage ? (
        <img
          ref={imageRef}
          alt={file.name}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <span className="material-symbols-outlined text-[28px] leading-none" aria-hidden="true">
            picture_as_pdf
          </span>
          <span className="line-clamp-2 px-2 text-center text-small [overflow-wrap:anywhere]">
            {file.name}
          </span>
        </>
      )}

      {canRemove && (
        <IconButton
          icon="close"
          label={`Remove ${file.name}`}
          variant="inverse"
          size="sm"
          onClick={onRemove}
          className="absolute right-2.5 top-2.5 rounded-full bg-action max-md:size-6 max-md:hover:bg-action-hover after:absolute after:-inset-2.5 after:content-['']"
        />
      )}

      {showStatus && (
        <span className="absolute bottom-1 left-1">
          {status === 'waiting' ? (
            <Badge tone="slate">Waiting</Badge>
          ) : status === 'uploading' ? (
            <Badge tone="amber">
              <Spinner size="sm" />
              <span>Uploading</span>
            </Badge>
          ) : status === 'uploaded' ? (
            <Badge tone="teal" dot>
              Uploaded
            </Badge>
          ) : (
            <Badge tone="red" dot title={errorMessage}>
              Failed
            </Badge>
          )}
        </span>
      )}
    </li>
  );
}
