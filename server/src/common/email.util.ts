/*
Trims and lower-cases email addresses, used as a transform on DTO email
fields so every email is stored and compared in the same form.
*/


export function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
