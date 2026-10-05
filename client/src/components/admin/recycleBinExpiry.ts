export function getExpiryDisplay(daysRemaining: number): {
  label: string;
  tone: 'red' | 'amber' | null;
} {
  const label =
    daysRemaining <= 0
      ? 'Today'
      : daysRemaining === 1
      ? 'in 1 day'
      : `in ${daysRemaining} days`;

  const tone =
    daysRemaining <= 2
      ? 'red'
      : daysRemaining <= 7
      ? 'amber'
      : null;

  return { label, tone };
}
