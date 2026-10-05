import { PASSWORD_RULES } from '../../utils/passwordRules';

export interface PasswordChecklistProps {
  password: string;
  id?: string;
  className?: string;
}

export function PasswordChecklist({
  password,
  id,
  className = '',
}: PasswordChecklistProps) {
  const containerClasses = ['mt-1.5 space-y-0.5', className]
    .filter(Boolean)
    .join(' ');

  return (
    <ul id={id} aria-label="Password requirements" className={containerClasses}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);

        return (
          <li
            key={rule.label}
            className="flex items-center gap-1.5 text-small text-ink-body"
          >
            <span
              className={`material-symbols-outlined text-[14px] leading-none ${
                met ? 'text-accent' : 'text-ink-muted'
              }`}
              aria-hidden="true"
            >
              check_circle
            </span>
            <span className="sr-only">
              {met ? 'Met: ' : 'Not met: '}
            </span>
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
