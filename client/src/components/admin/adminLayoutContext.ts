import { useOutletContext } from 'react-router-dom';

export interface AdminOutletContext {
  refreshPendingCount: () => void;
}

export function useAdminLayout(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}
