/*
A single dark message bubble with a close button. ToastProvider stacks these in
the bottom-right corner of the screen.
*/


import { IconButton } from './IconButton';

export interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div className="pointer-events-auto flex items-start gap-2 rounded-md bg-ink py-2 pl-3 pr-1 text-body text-white shadow-overlay">
      <p className="min-w-0 flex-1 py-0.5">{message}</p>
      <IconButton
        icon="close"
        label="Dismiss"
        variant="inverse"
        size="sm"
        onClick={onDismiss}
      />
    </div>
  );
}
