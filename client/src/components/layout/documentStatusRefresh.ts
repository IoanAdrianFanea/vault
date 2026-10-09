/*
A small shared trigger that lets a page ask the app shell to refetch the sidebar
document status counts straight away. The shell refetches whenever the version
number changes.
*/


import { createContext, useContext } from 'react';

export interface DocumentStatusRefresh {
  version: number;
  refresh: () => void;
}

export const DocumentStatusRefreshContext = createContext<DocumentStatusRefresh>({
  version: 0,
  refresh: () => undefined,
});

export function useDocumentStatusRefresh(): DocumentStatusRefresh {
  return useContext(DocumentStatusRefreshContext);
}
