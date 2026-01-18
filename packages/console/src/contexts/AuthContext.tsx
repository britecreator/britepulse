import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  hasAppAccess: (appId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// API base URL - use VITE_API_URL in production, localhost in dev
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';
const AUTH_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const TOKEN_KEY = 'britepulse_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  useEffect(() => {
    // Check for token in URL (after OAuth redirect)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setState({
          user: data.data,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        // Token invalid/expired, clear it
        localStorage.removeItem(TOKEN_KEY);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (error) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Failed to check authentication',
      });
    }
  }

  function login() {
    // Redirect to Google OAuth (direct to API server, not through proxy)
    window.location.href = `${AUTH_BASE}/auth/google`;
  }

  async function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  }

  function hasRole(role: UserRole): boolean {
    if (!state.user) return false;

    const roleHierarchy: UserRole[] = ['Admin', 'PO', 'Engineer', 'ReadOnly'];
    const userRoleIndex = roleHierarchy.indexOf(state.user.role);
    const requiredRoleIndex = roleHierarchy.indexOf(role);

    // Lower index = higher privilege
    return userRoleIndex <= requiredRoleIndex;
  }

  function hasAppAccess(appId: string): boolean {
    if (!state.user) return false;
    if (state.user.role === 'Admin') return true;
    return state.user.app_access?.includes(appId) ?? false;
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        hasRole,
        hasAppAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
