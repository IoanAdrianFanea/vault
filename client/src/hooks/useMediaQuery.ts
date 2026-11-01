/*
Media query hooks for structural layout switches, such as rendering a different
component on phones or removing a feature from the DOM. Purely visual changes
use the Tailwind `max-md:`, `md:max-lg:` and `touch:` variants instead.
*/


import { useCallback, useSyncExternalStore } from 'react';

// Mirror Tailwind's default `md` and `lg` screens, so hooks and classes switch together.
export const PHONE_QUERY = 'not all and (min-width: 768px)';
export const TABLET_PORTRAIT_QUERY = '(min-width: 768px) and (max-width: 1023.98px)';
export const TOUCH_QUERY = '(pointer: coarse)';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onChange);
      return () => mediaQueryList.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false;

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

export function useIsTabletPortrait(): boolean {
  return useMediaQuery(TABLET_PORTRAIT_QUERY);
}

export function useIsTouch(): boolean {
  return useMediaQuery(TOUCH_QUERY);
}
