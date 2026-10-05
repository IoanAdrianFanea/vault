import { useState } from 'react';
import { exportDocuments } from '../../api/exports';
import { Button, InlineAlert, Modal } from '../ui';
import { formatCountLabel } from '../../utils/format';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentIds: string[];
}

export function ExportModal({ isOpen, onClose, documentIds }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportDocuments(documentIds);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export documents');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Download as ZIP"
      size="sm"
      closeDisabled={isExporting}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="folder_zip"
            loading={isExporting}
            onClick={handleExport}
          >
            Download ZIP
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-body">
        {formatCountLabel(documentIds.length, 'document', 'documents')} will be packaged into
        one ZIP file and downloaded.
      </p>
      {error && (
        <InlineAlert tone="error" className="mt-3">
          {error}
        </InlineAlert>
      )}
    </Modal>
  );
}
