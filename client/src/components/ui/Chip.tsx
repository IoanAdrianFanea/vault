/*
Removable label-and-value chip, used to show an applied filter.
*/


export interface ChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export function Chip({ label, value, onRemove }: ChipProps) {
  return (
    <span className="inline-flex h-6 max-w-full items-center gap-1 rounded border border-line bg-subtle pl-2 pr-0.5 text-small text-ink touch:h-10 touch:pl-2.5 touch:pr-0 touch:text-body max-md:shrink-0">
      <span className="shrink-0 text-ink-muted">{label}:</span>
      <span className="max-w-[16rem] truncate font-medium" title={value}>
        {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-line hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent touch:size-[38px]"
      >
        <span className="material-symbols-outlined text-[14px] leading-none touch:text-[16px]" aria-hidden="true">
          close
        </span>
      </button>
    </span>
  );
}
