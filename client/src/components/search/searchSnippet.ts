export interface SnippetSegment {
  text: string;
  highlighted: boolean;
}

export function parseSnippet(snippet: string): SnippetSegment[] {
  if (!snippet) return [];
  const parts = snippet.split(/(<mark>|<\/mark>)/);
  const segments: SnippetSegment[] = [];
  let isHighlighted = false;

  for (const part of parts) {
    if (part === '<mark>') {
      isHighlighted = true;
    } else if (part === '</mark>') {
      isHighlighted = false;
    } else if (part.length > 0) {
      segments.push({
        text: part,
        highlighted: isHighlighted,
      });
    }
  }

  return segments;
}
