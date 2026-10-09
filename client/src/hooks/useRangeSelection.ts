/*
Hook that manages row selection for tables, including shift-click range
selection over the visible rows. Selection is cleared whenever the reset key
changes.
*/


import { useCallback, useState } from 'react';

export interface RangeSelection {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  toggle: (id: string, shiftKey?: boolean) => void;
  setAll: (checked: boolean) => void;
  clear: () => void;
  retain: (ids: Iterable<string>) => void;
}

export function useRangeSelection(
  visibleIds: string[],
  resetKey: string,
): RangeSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setSelectedIds(new Set());
    setAnchorId(null);
  }

  const toggle = useCallback(
    (id: string, shiftKey?: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (
          shiftKey &&
          anchorId &&
          visibleIds.includes(anchorId) &&
          visibleIds.includes(id)
        ) {
          const a = visibleIds.indexOf(anchorId);
          const b = visibleIds.indexOf(id);
          const start = Math.min(a, b);
          const end = Math.max(a, b);
          visibleIds.slice(start, end + 1).forEach((item) => next.add(item));
          return next;
        }

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setAnchorId(id);
        return next;
      });
    },
    [anchorId, visibleIds],
  );

  const setAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(visibleIds));
      } else {
        setSelectedIds(new Set());
      }
      setAnchorId(null);
    },
    [visibleIds],
  );

  const clear = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorId(null);
  }, []);

  const retain = useCallback((ids: Iterable<string>) => {
    const keep = new Set(ids);
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (keep.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  return {
    selectedIds,
    allSelected,
    someSelected,
    toggle,
    setAll,
    clear,
    retain,
  };
}
