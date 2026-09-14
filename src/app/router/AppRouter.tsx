import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLoginScreen } from '@/pages/AdminLogin/AdminLoginScreen';
import { HomeScreen } from '@/pages/Home/HomeScreen';
import { UserManagementScreen } from '@/pages/UserManagement/UserManagementScreen';
import { GroupManagementScreen } from '@/pages/GroupManagement/GroupManagementScreen';
import { ContactRequestsScreen } from '@/pages/ContactRequests/ContactRequestsScreen';
import { EdgeNodeScreen } from '@/pages/EdgeNode/EdgeNodeScreen';
import { NCCScreen } from '@/pages/NCC/NCCScreen';
import { ROUTES } from './routes';

if (typeof window !== 'undefined') {
  sessionStorage.removeItem('dtak_admin_id');
  sessionStorage.removeItem('dtak_admin_name');
  sessionStorage.removeItem('dtak_admin_role');
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = !!sessionStorage.getItem('dtak_admin_id');
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = !!sessionStorage.getItem('dtak_admin_id');
  if (isAuthenticated) {
    return <Navigate to={ROUTES.HOME} replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const isAuthenticated = !!sessionStorage.getItem('dtak_admin_id');
  return <Navigate to={isAuthenticated ? ROUTES.HOME : ROUTES.LOGIN} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
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
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
