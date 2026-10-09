/*
Root component that defines every route. Pages are wrapped in the sign-in check
and the app shell, and the /admin section is gated by an admin-only guard. The
/jobs routes redirect to the documents list with a toast until Jobs is built.
*/


import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import VerifyEmail from './pages/VerifyEmail';
import Documents from './pages/Documents';
import Upload from './pages/Upload';
import Search from './pages/Search';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth } from './components/layout/RequireAuth';
import { JOBS_UNAVAILABLE_MESSAGE } from './components/layout/jobsAvailability';
import { ToastProvider, useToast } from './components/ui';
import { authService } from './api/auth';
import AdminProjects from './pages/admin/AdminProjects';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPending from './pages/admin/AdminPending';
import AdminArchive from './pages/admin/AdminArchive';
import AdminFilters from './pages/admin/AdminFilters';
import AdminRecycleBin from './pages/admin/AdminRecycleBin';

import { AdminLayout } from './components/admin/AdminLayout';

interface AdminGuardProps {
  children: ReactNode;
}

function AdminGuard({ children }: AdminGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isActive = true;

    authService
      .getMe()
      .then((user) => {
        if (!isActive) return;
        setIsAdmin(user.role === 'ADMIN');
      })
      .catch(() => {
        if (!isActive) return;
        setIsAdmin(false);
      })
      .finally(() => {
        if (!isActive) return;
        setIsChecking(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (isChecking) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Jobs arrives in Phase 6, so direct visits go back to the documents list.
function JobsRedirect() {
  const { showToast } = useToast();

  useEffect(() => {
    showToast(JOBS_UNAVAILABLE_MESSAGE);
  }, [showToast]);

  return <Navigate to="/documents" replace />;
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/change-password"
            element={
              <RequireAuth>
                <ChangePassword />
              </RequireAuth>
            }
          />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/search"
            element={
              <RequireAuth>
                <AppShell>
                  <Search />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/search/:id"
            element={
              <RequireAuth>
                <AppShell>
                  <Search />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/upload"
            element={
              <RequireAuth>
                <AppShell>
                  <Upload />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/documents"
            element={
              <RequireAuth>
                <AppShell>
                  <Documents />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/documents/:id"
            element={
              <RequireAuth>
                <AppShell>
                  <Documents />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/jobs"
            element={
              <RequireAuth>
                <JobsRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <RequireAuth>
                <JobsRedirect />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminGuard>
                  <AppShell>
                    <AdminLayout />
                  </AppShell>
                </AdminGuard>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/admin/projects" replace />} />
            <Route path="projects" element={<AdminProjects />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="pending" element={<AdminPending />} />
            <Route path="recycle-bin" element={<AdminRecycleBin />} />
            <Route path="archive" element={<AdminArchive />} />
            <Route path="filters" element={<AdminFilters />} />
          </Route>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Navigate to="/documents" replace />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;


