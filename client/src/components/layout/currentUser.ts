import { createContext, useContext } from 'react';
import type { User } from '../../api/auth';

export type CurrentUserState =
  | { status: 'loading' }
  | { status: 'ready'; user: User }
  | { status: 'error' };

export const CurrentUserContext = createContext<CurrentUserState>({ status: 'loading' });

export function useCurrentUser(): CurrentUserState {
  return useContext(CurrentUserContext);
}

export function useIsAdmin(): boolean {
  const state = useCurrentUser();
  return state.status === 'ready' && state.user.role === 'ADMIN';
}
