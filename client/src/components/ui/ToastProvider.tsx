/*
Holds the toasts that are currently showing and renders them bottom-right. Each
one closes after four seconds, at most three show at once, and repeating a
message that is already showing restarts its timer instead of stacking it.
*/


import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toast } from './Toast';
import { ToastContext, type ToastApi } from './toastContext';

const TOAST_DURATION_MS = 4000;
const MAX_TOASTS = 3;

interface ToastItem {
  id: number;
  message: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const itemsRef = useRef<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, number>());

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      itemsRef.current = itemsRef.current.filter((toast) => toast.id !== id);
      setToasts(itemsRef.current);
    },
    [clearTimer],
  );

  const startTimer = useCallback(
    (id: number) => {
      clearTimer(id);
      timersRef.current.set(
        id,
        window.setTimeout(() => dismiss(id), TOAST_DURATION_MS),
      );
    },
    [clearTimer, dismiss],
  );

  const showToast = useCallback(
    (message: string) => {
      const duplicate = itemsRef.current.find((toast) => toast.message === message);
      if (duplicate) {
        startTimer(duplicate.id);
        return;
      }
      const id = nextIdRef.current++;
      const next = [...itemsRef.current, { id, message }];
      for (const dropped of next.slice(0, Math.max(0, next.length - MAX_TOASTS))) {
        clearTimer(dropped.id);
      }
      itemsRef.current = next.slice(-MAX_TOASTS);
      setToasts(itemsRef.current);
      startTimer(id);
    },
    [clearTimer, startTimer],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-full max-w-[360px] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext>
  );
}
