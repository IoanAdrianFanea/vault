import { useState } from 'react';
import {
  chooseSaveFolder,
  clearSaveFolder,
  getSaveFolderName,
  isSaveFolderSupported,
} from '../../utils/saveFile';
import { Button, InlineAlert } from '../ui';

export type SaveLocationSettingsProps = Record<string, never>;

const SUPPORT_NOTE =
  'Only works in Chrome or Edge on a computer. The setting is saved in this browser only.';

export function SaveLocationSettings() {
  const [folderName, setFolderName] = useState<string | null>(() => getSaveFolderName());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const isSupported = isSaveFolderSupported();

  async function handleChoose() {
    setError('');
    setIsBusy(true);
    try {
      const name = await chooseSaveFolder();
      if (name) setFolderName(name);
    } catch {
      setError("Couldn't use that folder. Choose another one.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClear() {
    setError('');
    setIsBusy(true);
    try {
      await clearSaveFolder();
      setFolderName(null);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-panel text-ink">Save location</h3>
      <p className="text-body text-ink-body">
        Choose a folder on this computer. Files you download, and copies of files you upload, are
        saved there in a folder per project. Changing the folder doesn't move files you've already
        saved.
      </p>

      <div className="space-y-1">
        <p className="text-label uppercase text-ink-muted">Current folder</p>
        {folderName ? (
          <p className="text-body font-medium text-ink">{folderName}</p>
        ) : (
          <p className="text-body text-ink-muted">
            Not set — files go to your browser's Downloads folder
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!isSupported || isBusy}
          onClick={() => void handleChoose()}
        >
          {folderName ? 'Change folder' : 'Choose folder'}
        </Button>
        <Button
          variant="secondary"
          disabled={!isSupported || isBusy || !folderName}
          onClick={() => void handleClear()}
        >
          Stop saving to a folder
        </Button>
      </div>

      {isSupported ? (
        <p className="text-small text-ink-muted">{SUPPORT_NOTE}</p>
      ) : (
        <InlineAlert tone="info">{SUPPORT_NOTE}</InlineAlert>
      )}
      {error && <InlineAlert tone="error">{error}</InlineAlert>}
    </section>
  );
}
