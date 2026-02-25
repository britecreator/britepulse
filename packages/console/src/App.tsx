import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AppsListPage from './pages/admin/AppsListPage';
import AppDetailPage from './pages/admin/AppDetailPage';
import UsersPage from './pages/admin/UsersPage';
import IssuesListPage from './pages/issues/IssuesListPage';
import IssueDetailPage from './pages/issues/IssueDetailPage';
import NotificationsPage from './pages/NotificationsPage';

// BritePulse SDK type declaration
declare global {
  interface Window {
    BritePulse?: {
      init: (config: any) => any;
      getInstance: () => {
        setUser?: (user: any) => void;
        captureError: (error: Error, context?: any) => void;
      } | null;
    };
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { hasRole } = useAuth();

  if (!hasRole('Admin')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, isAuthenticated } = useAuth();

  // Update BritePulse user context when authentication changes
  // Note: SDK auto-initializes from script tag data attributes
  useEffect(() => {
    if (isAuthenticated && user) {
      const instance = window.BritePulse?.getInstance();
      instance?.setUser?.({
        id: user.user_id,
        email: user.email,
      });
    }
  }, [isAuthenticated, user]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />

        {/* Admin routes */}
        <Route
          path="admin/apps"
          element={
            <AdminRoute>
              <AppsListPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/apps/:appId"
          element={
            <AdminRoute>
              <AppDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />

        {/* Issue routes (PO and above) */}
        <Route path="issues" element={<IssuesListPage />} />
        <Route path="issues/:issueId" element={<IssueDetailPage />} />

        {/* Notifications */}
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
