/*
Small spinning loading indicator, hidden from screen readers unless it has a
label.
*/


export interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'size-3' : 'size-4';
  const classes = [
    'inline-block shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin',
    sizeClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (label) {
    return (
      <span className={classes} role="status">
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return <span className={classes} aria-hidden="true" />;
}
