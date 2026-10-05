import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const messageId = useId();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      layer="confirm"
      role="alertdialog"
      showCloseButton={false}
      closeDisabled={isConfirming}
      ariaDescribedBy={messageId}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="md"
            loading={isConfirming}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div id={messageId} className="text-body text-ink-body">
        {message}
      </div>
    </Modal>
  );
}
