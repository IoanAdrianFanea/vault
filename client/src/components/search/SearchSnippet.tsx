import { parseSnippet } from './searchSnippet';

export interface SearchSnippetProps {
  snippet: string;
  className?: string;
}

export function SearchSnippet({ snippet, className }: SearchSnippetProps) {
  const segments = parseSnippet(snippet);

  return (
    <p className={className}>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark key={index}>{segment.text}</mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
