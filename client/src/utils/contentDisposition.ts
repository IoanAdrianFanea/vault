/*
Extracts the filename from a Content-Disposition response header, handling the
UTF-8, quoted and bare forms, and uses a fallback when none is present.
*/


export function getFilenameFromContentDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;

  // 1. filename*=UTF-8''encoded_name
  const starMatch = header.match(/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i);
  if (starMatch && starMatch[1]) {
    try {
      return decodeURIComponent(starMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // 2. Quoted filename="foo"
  const quotedMatch = header.match(/filename\s*=\s*"((?:\\.|[^"\\])*)"/i);
  if (quotedMatch && quotedMatch[1] !== undefined) {
    return quotedMatch[1].replace(/\\(.)/g, '$1');
  }

  // 3. Bare filename=foo
  const bareMatch = header.match(/filename\s*=\s*([^;]+)/i);
  if (bareMatch && bareMatch[1]) {
    return bareMatch[1].trim();
  }

  // 4. Otherwise fallback
  return fallback;
}
