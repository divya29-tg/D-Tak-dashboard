import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLoginScreen } from '@/pages/AdminLogin/AdminLoginScreen';
import { HomeScreen } from '@/pages/Home/HomeScreen';
import { UserManagementScreen } from '@/pages/UserManagement/UserManagementScreen';
import { GroupManagementScreen } from '@/pages/GroupManagement/GroupManagementScreen';
import { ContactRequestsScreen } from '@/pages/ContactRequests/ContactRequestsScreen';
import { EdgeNodeScreen } from '@/pages/EdgeNode/EdgeNodeScreen';
import { NCCScreen } from '@/pages/NCC/NCCScreen';
import { SharedMapScreen } from '@/pages/SharedMap/SharedMapScreen';
import { gunService } from '@/services/gunService';
import { ROUTES } from './routes';

type AuthStatus = 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  /** Call after a successful login so the router actually navigates to HOME. */
  login: (alias: string) => void;
  /** Call on logout so PublicOnlyRoute stops bouncing straight back to HOME. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  status: 'unauthenticated',
  login: () => {},
  logout: () => {},
});

/**
 * status alone used to be read directly from sessionStorage by each route
 * guard, which broke the moment auth became async (session recall): a
 * fresh login or a logout only ever updated sessionStorage, never the
 * status React had already captured, so ProtectedRoute/PublicOnlyRoute kept
 * acting on stale state -- login looked "stuck" (silently bounced back to
 * /login) and logout looked broken (bounced straight back to /home). login()
 * and logout() are how the rest of the app now updates the *shared* status
 * that the route guards actually read.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// Module-level, not component state: React 18 StrictMode double-invokes
// mount effects in dev, and two concurrent gunService.recallSession() calls
// race each other on the single shared Gun user instance (its `cat.ing`
// "already authenticating" guard rejects the second one, sometimes taking
// the first down with it). Memoizing the promise here means recall only
// ever actually runs once per app load no matter how many times AuthGate's
// effect fires.
let recallPromise: ReturnType<typeof gunService.recallSession> | null = null;
function recallSessionOnce() {
  if (!recallPromise) {
    recallPromise = gunService.recallSession();
  }
  return recallPromise;
}

/**
 * Restores the Gun session (if any) before the router decides between the
 * login screen and protected content -- fixes "refresh logs out": a plain
 * reload used to unconditionally wipe the session flag before anything else
 * ran. Nothing renders until this resolves, so there's no flash of the
 * login screen for a session that's about to be restored anyway.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | 'checking'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recalled = await recallSessionOnce();
      if (cancelled) return;
      if (recalled) {
        sessionStorage.setItem('dtak_admin_id', recalled.alias);
        setStatus('authenticated');
      } else {
        sessionStorage.removeItem('dtak_admin_id');
        sessionStorage.removeItem('dtak_admin_name');
        sessionStorage.removeItem('dtak_admin_role');
        setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100%',
          backgroundColor: '#050a08',
          color: '#8fbf3f',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.08em',
        }}
      >
        RESTORING SESSION...
      </div>
    );
  }

  const login: AuthContextValue['login'] = (alias) => {
    sessionStorage.setItem('dtak_admin_id', alias);
    setStatus('authenticated');
  };

  const logout: AuthContextValue['logout'] = () => {
    gunService.logout();
    sessionStorage.removeItem('dtak_admin_id');
    sessionStorage.removeItem('dtak_admin_name');
    sessionStorage.removeItem('dtak_admin_role');
    setStatus('unauthenticated');
  };

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status !== 'authenticated') {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'authenticated') {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const { status } = useAuth();
  return <Navigate to={status === 'authenticated' ? ROUTES.HOME : ROUTES.LOGIN} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path={ROUTES.LOGIN}
            element={
              <PublicOnlyRoute>
                <AdminLoginScreen />
              </PublicOnlyRoute>
            }
          />
          <Route
            path={ROUTES.HOME}
            element={
              <ProtectedRoute>
                <HomeScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.USER_MANAGEMENT}
            element={
              <ProtectedRoute>
                <UserManagementScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.GROUP_MANAGEMENT}
            element={
              <ProtectedRoute>
                <GroupManagementScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.CONTACT_REQUESTS}
            element={
              <ProtectedRoute>
                <ContactRequestsScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.EDGE_NODES}
            element={
              <ProtectedRoute>
                <EdgeNodeScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.NCC}
            element={
              <ProtectedRoute>
                <NCCScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.SHARED_MAP}
            element={
              <ProtectedRoute>
                <SharedMapScreen />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
