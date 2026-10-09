import {
  deleteSaveFolderHandle,
  loadSaveFolderHandle,
  storeSaveFolderHandle,
} from './saveFolderStore';

export interface SaveTarget {
  folder: FileSystemDirectoryHandle | null;
  warning: string | null;
}

export interface SaveResult {
  savedTo: string | null;
  warning: string | null;
}

export const PERMISSION_WARNING =
  "Permission to use your save folder wasn't given, so the file went to your Downloads folder.";
export const WRITE_WARNING =
  "Couldn't save to your folder, so the file went to your Downloads folder.";

const MAX_NAME_ATTEMPTS = 999;
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

let cachedFolder: FileSystemDirectoryHandle | null = null;
let cachedPermission: PermissionState | null = null;

export function isSaveFolderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export async function initSaveFolder(): Promise<void> {
  if (!isSaveFolderSupported()) return;
  try {
    const handle = await loadSaveFolderHandle();
    if (!handle) return;
    cachedFolder = handle;
    cachedPermission = await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    // A missing or unreadable folder just means downloads go to the browser's default.
  }
}

export function getSaveFolderName(): string | null {
  return cachedFolder?.name ?? null;
}

export async function chooseSaveFolder(): Promise<string | null> {
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker!({ id: 'docindex-save-folder', mode: 'readwrite' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
  await storeSaveFolderHandle(handle);
  cachedFolder = handle;
  cachedPermission = 'granted';
  return handle.name;
}

export async function clearSaveFolder(): Promise<void> {
  await deleteSaveFolderHandle();
  cachedFolder = null;
  cachedPermission = null;
}

/**
 * Call this as the first statement of a click handler, before any `await`: the
 * permission prompt needs the click's user activation.
 */
export function beginSave(): Promise<SaveTarget> {
  const folder = cachedFolder;
  if (!isSaveFolderSupported() || !folder) {
    return Promise.resolve({ folder: null, warning: null });
  }

  let permission: Promise<PermissionState>;
  try {
    permission =
      cachedPermission === 'granted'
        ? folder.queryPermission({ mode: 'readwrite' })
        : folder.requestPermission({ mode: 'readwrite' });
  } catch {
    return Promise.resolve({ folder: null, warning: PERMISSION_WARNING });
  }

  return permission.then(
    (state): SaveTarget => {
      cachedPermission = state;
      return state === 'granted'
        ? { folder, warning: null }
        : { folder: null, warning: PERMISSION_WARNING };
    },
    (): SaveTarget => ({ folder: null, warning: PERMISSION_WARNING }),
  );
}

export function sanitiseFileName(name: string, fallback: string): string {
  let result = name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .trim()
    .replace(/[. ]+$/, '');

  const dotIndex = result.indexOf('.');
  const stem = dotIndex === -1 ? result : result.slice(0, dotIndex);
  if (RESERVED_NAMES.test(stem)) {
    result = `${stem}_${result.slice(stem.length)}`;
  }

  return result === '' ? fallback : result;
}

export function commonProjectName(names: Array<string | null | undefined>): string | undefined {
  const distinct = new Set(names.filter((name): name is string => !!name));
  return distinct.size === 1 ? [...distinct][0] : undefined;
}

export function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

async function nextFreeName(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex > 0 ? name.slice(dotIndex) : '';

  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? name : `${base} (${attempt})${extension}`;
    try {
      await dir.getFileHandle(candidate);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return candidate;
      if (!(error instanceof DOMException && error.name === 'TypeMismatchError')) throw error;
    }
  }

  throw new Error('No free file name');
}

export async function saveFile(
  blob: Blob,
  fileName: string,
  options: {
    projectName?: string;
    target?: Promise<SaveTarget>;
    fallbackToDownload?: boolean;
  } = {},
): Promise<SaveResult> {
  const target = await (options.target ?? beginSave());
  const fallbackToDownload = options.fallbackToDownload ?? true;
  let warning: string | null = null;

  if (target.folder) {
    try {
      let dir = target.folder;
      let folderName: string | undefined;
      if (options.projectName) {
        folderName = sanitiseFileName(options.projectName, 'Project');
        dir = await dir.getDirectoryHandle(folderName, { create: true });
      }

      const finalName = await nextFreeName(dir, sanitiseFileName(fileName, 'file'));
      const fileHandle = await dir.getFileHandle(finalName, { create: true });
      let writable: FileSystemWritableFileStream | undefined;
      try {
        writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        await writable?.abort().catch(() => undefined);
        await dir.removeEntry(finalName).catch(() => undefined);
        throw error;
      }

      return {
        savedTo: [target.folder.name, folderName].filter(Boolean).join('/'),
        warning: null,
      };
    } catch {
      warning = WRITE_WARNING;
    }
  }

  if (fallbackToDownload) {
    triggerBrowserDownload(blob, fileName);
  }

  return { savedTo: null, warning: target.warning ?? warning ?? null };
}

export function describeSaveResult(
  result: SaveResult,
): { tone: 'success' | 'warning'; message: string } | null {
  if (result.savedTo) {
    return { tone: 'success', message: `Saved to ${result.savedTo}` };
  }
  if (result.warning) {
    return { tone: 'warning', message: result.warning };
  }
  return null;
}
