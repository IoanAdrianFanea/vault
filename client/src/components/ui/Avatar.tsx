/*
Circular avatar showing a user's initials, falling back to the email's first
letter or a generic icon.
*/


export interface AvatarProps {
  fullName?: string | null;
  email?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

function getInitials(fullName?: string | null, email?: string | null): string {
  const trimmedName = fullName?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0][0].toUpperCase();
    }
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    return trimmedEmail[0].toUpperCase();
  }
  return '';
}

export function Avatar({ fullName, email, size = 'md', className }: AvatarProps) {
  const initials = getInitials(fullName, email);
  const sizeStyles = size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-small';

  const classes = [
    'inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-white font-semibold select-none',
    sizeStyles,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span aria-hidden="true" className={classes}>
      {initials || (
        <span className="material-symbols-outlined text-[18px] leading-none">
          person
        </span>
      )}
    </span>
  );
}
