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

// BritePulse SDK type declaration
declare global {
  interface Window {
    BritePulse?: {
      init: (config: any) => void;
      setUser: (user: any) => void;
      captureError: (error: Error, context?: any) => void;
      openWidget: (options?: any) => void;
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

  // Initialize BritePulse and set user context
  useEffect(() => {
    const initBritePulse = () => {
      window.BritePulse?.init({
        appId: '0410caf0-1276-4782-82d7-aec5140f946f',
        apiUrl: 'https://britepulse-api-29820647719.us-central1.run.app',
        environment: 'production',
      });
    };

    if (window.BritePulse) {
      initBritePulse();
    } else {
      window.addEventListener('britepulse:ready', initBritePulse);
      return () => window.removeEventListener('britepulse:ready', initBritePulse);
    }
  }, []);

  // Update BritePulse user context when authentication changes
  useEffect(() => {
    if (isAuthenticated && user && window.BritePulse) {
      window.BritePulse.setUser({
        userId: user.user_id,
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
