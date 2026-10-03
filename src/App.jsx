import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppShell } from './components/layout/AppShell';

// Route Guards
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { AuthRoute } from './components/auth/AuthRoute';

// Pages
import { LandingPreview } from './pages/LandingPreview';
import { SignInPage } from './pages/auth/SignInPage';
import { SignUpPage } from './pages/auth/SignUpPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { UserDashboardShell } from './pages/UserDashboardShell';
import { AdminDashboardShell } from './pages/AdminDashboardShell';
import { AccountPage } from './pages/account/AccountPage';
import { WorkspaceManagementPage } from './pages/workspace/WorkspaceManagementPage';
import { JoinWorkspacePage } from './pages/workspace/JoinWorkspacePage';
import { ComponentShowcase } from './pages/ComponentShowcase';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <AppShell>
              <Routes>
                {/* Public Marketing & Demo Views */}
                <Route path="/" element={<LandingPreview />} />
                <Route path="/showcase" element={<ComponentShowcase />} />

                {/* Authentication Routes (redirect to app/admin if already logged in) */}
                <Route
                  path="/login"
                  element={
                    <AuthRoute>
                      <SignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/signin"
                  element={
                    <AuthRoute>
                      <SignInPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <AuthRoute>
                      <SignUpPage />
                    </AuthRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <AuthRoute>
                      <ForgotPasswordPage />
                    </AuthRoute>
                  }
                />

                {/* Join Workspace Request Flow (accessible public or authenticated) */}
                <Route path="/join/:token" element={<JoinWorkspacePage />} />
                <Route path="/join/:inviteToken" element={<JoinWorkspacePage />} />

                {/* User Protected Views */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <UserDashboardShell />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <AccountPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspace"
                  element={
                    <ProtectedRoute>
                      <WorkspaceManagementPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Protected Views */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboardShell />
                    </AdminRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
