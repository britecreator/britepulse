import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApps } from './useApi';

/**
 * Returns the app IDs where the current user is listed in owners.po_emails.
 */
export function useMyAppIds() {
  const { user } = useAuth();
  const { data: apps, isLoading } = useApps();

  const myAppIds = useMemo(() => {
    if (!user?.email || !apps) return [];
    const email = user.email.toLowerCase();
    return apps
      .filter(app => app.owners?.po_emails?.some(
        e => e.toLowerCase() === email
      ))
      .map(app => app.app_id);
  }, [user?.email, apps]);

  return {
    myAppIds,
    isLoading,
    ownsApps: myAppIds.length > 0,
  };
}
