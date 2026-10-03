import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GlassLoader } from '../ui/GlassLoader';

/**
 * AdminRoute Component
 * Strictly restricts route access to verified administrators.
 * Non-admin authenticated accounts are securely redirected to /app.
 */
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <GlassLoader message="Verifying administrator authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  return children;
};
