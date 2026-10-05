import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';

export type SortDirection = 'ascending' | 'descending';

export interface DataTableProps {
  children: ReactNode;
  fixed?: boolean;
  busy?: boolean;
  label?: string;
  className?: string;
}

export function DataTable({
  children,
  fixed = false,
  busy = false,
  label,
  className,
}: DataTableProps) {
  const containerClasses = [
    'min-h-0 overflow-auto custom-scrollbar rounded border border-line bg-canvas',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const tableClasses = [
    'w-full border-separate border-spacing-0 text-left text-body text-ink-body',
    fixed ? 'table-fixed' : '',
    busy ? 'opacity-60' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      <table aria-label={label} aria-busy={busy || undefined} className={tableClasses}>
        {children}
      </table>
    </div>
  );
}

const alignClasses: Record<'start' | 'center' | 'end', string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

export interface TableHeaderCellProps
  extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
  align?: 'start' | 'center' | 'end';
  sortDirection?: SortDirection | null;
  onSort?: () => void;
}

export function TableHeaderCell({
  children,
  align = 'start',
  sortDirection,
  onSort,
  className,
  ...rest
}: TableHeaderCellProps) {
  const baseClasses =
    'sticky top-0 z-sticky h-7 px-2 bg-subtle border-b border-line align-middle whitespace-nowrap text-label uppercase text-ink-muted';

  const classes = [baseClasses, alignClasses[align], className].filter(Boolean).join(' ');

  return (
    <th
      scope="col"
      aria-sort={onSort ? (sortDirection ?? 'none') : undefined}
      className={classes}
      {...rest}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 rounded-sm uppercase hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {children}
          {sortDirection && (
            <span
              className="material-symbols-outlined text-[14px] leading-none text-accent"
              aria-hidden="true"
            >
              {sortDirection === 'ascending' ? 'arrow_upward' : 'arrow_downward'}
            </span>
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export function TableRow({
  children,
  selected = false,
  className,
  onClick,
  ...rest
}: TableRowProps) {
  const classes = [
    'transition-colors [&:last-child>td]:border-b-0',
    selected ? 'bg-selected' : 'hover:bg-subtle',
    onClick ? 'cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr
      data-selected={selected ? 'true' : undefined}
      onClick={onClick}
      className={classes}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TableCellProps
  extends Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> {
  align?: 'start' | 'center' | 'end';
}

export function TableCell({
  children,
  align = 'start',
  className,
  ...rest
}: TableCellProps) {
  const classes = [
    'h-8 px-2 py-1 border-b border-line align-middle',
    alignClasses[align],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td className={classes} {...rest}>
      {children}
    </td>
  );
}

const widthCycle = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6'] as const;

export interface TableSkeletonRowsProps {
  columns: number;
  rows?: number;
}

export function TableSkeletonRows({ columns, rows = 8 }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }).map((_, colIndex) => {
            const widthClass = widthCycle[(rowIndex + colIndex) % 4];
            return (
              <td key={colIndex} className="h-8 px-2 py-1 border-b border-line">
                <span
                  className={`block h-3 animate-pulse rounded-sm bg-line ${widthClass}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
