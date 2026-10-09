/*
Context and hook behind the shared toast. Any component below ToastProvider can
call useToast().showToast(message) to show a short, self-closing message.
*/


import { createContext, useContext } from 'react';

export interface ToastApi {
  showToast: (message: string) => void;
}

export const ToastContext = createContext<ToastApi>({ showToast: () => undefined });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
