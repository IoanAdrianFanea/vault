/*
Typed hook for the context that AdminLayout shares with its child admin pages.
Lets a page ask the layout to refresh the pending-approvals count in the tab
bar.
*/


import { useOutletContext } from 'react-router-dom';

export interface AdminOutletContext {
  refreshPendingCount: () => void;
}

export function useAdminLayout(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}
